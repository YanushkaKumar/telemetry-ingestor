/* eslint-disable prettier/prettier */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { timeout } from 'rxjs/operators';
import Redis from 'ioredis';
import { Telemetry } from './schemas/telemetry.schema';
import { TelemetryDto } from './dto/telemetry.dto';
import { AlertDto } from './dto/alert.dto';
import { firstValueFrom } from 'rxjs';

interface IngestResponse {
  success: boolean;
  count: number;
  message: string;
}

interface SiteSummary {
  count: number;
  avgTemperature: number;
  maxTemperature: number;
  avgHumidity: number;
  maxHumidity: number;
  uniqueDevices: number;
}

interface HealthStatus {
  mongo: boolean;
  redis: boolean;
}

@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryService.name);
  private redisClient!: Redis;
  private alertCache: Map<string, number> = new Map();

  constructor(
    @InjectModel(Telemetry.name) private telemetryModel: Model<Telemetry>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  onModuleInit(): void {
    const redisUrl = this.configService.get<string>('REDIS_URL') ?? '';
    this.redisClient = new Redis(redisUrl);

    this.redisClient.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.redisClient.on('error', (err: Error) => {
      this.logger.error('Redis connection error', err);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisClient.quit();
  }

  async ingestTelemetry(
    data: TelemetryDto | TelemetryDto[],
  ): Promise<IngestResponse> {
    const readings = Array.isArray(data) ? data : [data];

    if (readings.length === 0) {
      throw new BadRequestException('No telemetry readings provided');
    }

    // Basic validation before attempting to save to Mongo
    for (const r of readings) {
      if (!r.deviceId || typeof r.deviceId !== 'string') {
        throw new BadRequestException('deviceId is required and must be a string');
      }
      if (!r.siteId || typeof r.siteId !== 'string') {
        throw new BadRequestException('siteId is required and must be a string');
      }
      if (!r.ts || isNaN(new Date(r.ts).getTime())) {
        throw new BadRequestException('ts is required and must be a valid ISO date string');
      }
      if (
        !r.metrics ||
        typeof r.metrics.temperature !== 'number' ||
        typeof r.metrics.humidity !== 'number'
      ) {
        throw new BadRequestException(
          'metrics.temperature and metrics.humidity are required and must be numbers',
        );
      }
    }

    this.logger.log(`Ingesting ${readings.length} telemetry reading(s)`);

    const savedReadings: Array<Telemetry> = [];

    for (const reading of readings) {
      try {
        // Save to MongoDB
        const telemetry = new this.telemetryModel({
          deviceId: reading.deviceId,
          siteId: reading.siteId,
          ts: new Date(reading.ts),
          metrics: reading.metrics,
        });
        const saved = await telemetry.save();
        savedReadings.push(saved);

        // Cache latest in Redis
        const cacheKey = `latest:${reading.deviceId}`;
        await this.redisClient.set(cacheKey, JSON.stringify(reading));
        this.logger.log(`Cached latest reading for device ${reading.deviceId}`);

        // Check for alerts
        await this.checkAndSendAlerts(reading);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        this.logger.error(
          `Error processing reading for device ${reading.deviceId}: ${errorMessage}`,
          errorStack,
        );
        // Re-throw to let controller translate into appropriate HTTP response
        throw error;
      }
    }

    return {
      success: true,
      count: savedReadings.length,
      message: `${savedReadings.length} reading(s) ingested successfully`,
    };
  }

  private async checkAndSendAlerts(reading: TelemetryDto): Promise<void> {
    const alerts: AlertDto[] = [];

    // Check temperature threshold
    if (reading.metrics.temperature > 50) {
      alerts.push({
        deviceId: reading.deviceId,
        siteId: reading.siteId,
        ts: reading.ts,
        reason: 'HIGH_TEMPERATURE',
        value: reading.metrics.temperature,
      });
    }

    // Check humidity threshold
    if (reading.metrics.humidity > 90) {
      alerts.push({
        deviceId: reading.deviceId,
        siteId: reading.siteId,
        ts: reading.ts,
        reason: 'HIGH_HUMIDITY',
        value: reading.metrics.humidity,
      });
    }

    // Send alerts with deduplication (60s)
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  private async sendAlert(alert: AlertDto): Promise<void> {
    const dedupKey = `${alert.deviceId}:${alert.reason}`;
    const now = Date.now();
    const lastAlertTime = this.alertCache.get(dedupKey);

    // Deduplicate: skip if alert was sent within last 60 seconds
    if (lastAlertTime && now - lastAlertTime < 60000) {
      this.logger.log(`Alert deduplicated for ${dedupKey}`);
      return;
    }

    const webhookUrl = this.configService.get<string>('ALERT_WEBHOOK_URL');

    if (!webhookUrl) {
      this.logger.warn('ALERT_WEBHOOK_URL not configured');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await firstValueFrom(this.httpService.post(webhookUrl, alert, {headers: { 'Content-Type': 'application/json' },}).pipe(timeout(5000)),
      );

      this.alertCache.set(dedupKey, now);
      this.logger.log(
        `Alert sent: ${alert.reason} for device ${alert.deviceId}`,
      );
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to send alert to webhook: ${errorMessage}`);
    }
  }

  async getLatestByDevice(deviceId: string): Promise<TelemetryDto | null> {
    if (!deviceId || typeof deviceId !== 'string') {
      throw new BadRequestException('deviceId param is required');
    }

    // Try Redis first
    const cacheKey = `latest:${deviceId}`;
    const cached = await this.redisClient.get(cacheKey);

    if (cached) {
      this.logger.log(`Latest reading for ${deviceId} retrieved from cache`);
      return JSON.parse(cached) as TelemetryDto;
    }

    // Fallback to MongoDB
    this.logger.log(`Cache miss for ${deviceId}, querying MongoDB`);
    const latest = await this.telemetryModel
      .findOne({ deviceId })
      .sort({ ts: -1 })
      .exec();

    if (!latest) {
      return null;
    }

    return {
      deviceId: latest.deviceId,
      siteId: latest.siteId,
      ts: latest.ts.toISOString(),
      metrics: latest.metrics,
    };
  }

  async getSiteSummary(
    siteId: string,
    from: string,
    to: string,
  ): Promise<SiteSummary> {
    if (!siteId || typeof siteId !== 'string') {
      throw new BadRequestException('siteId is required');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid from/to date parameters');
    }

    this.logger.log(
      `Generating summary for site ${siteId} from ${from} to ${to}`,
    );

    const result = await this.telemetryModel.aggregate<SiteSummary>([
      {
        $match: {
          siteId,
          ts: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgTemperature: { $avg: '$metrics.temperature' },
          maxTemperature: { $max: '$metrics.temperature' },
          avgHumidity: { $avg: '$metrics.humidity' },
          maxHumidity: { $max: '$metrics.humidity' },
          uniqueDevices: { $addToSet: '$deviceId' },
        },
      },
      {
        $project: {
          _id: 0,
          count: 1,
          avgTemperature: { $round: ['$avgTemperature', 2] },
          maxTemperature: 1,
          avgHumidity: { $round: ['$avgHumidity', 2] },
          maxHumidity: 1,
          uniqueDevices: { $size: '$uniqueDevices' },
        },
      },
    ]);

    if (result.length === 0) {
      return {
        count: 0,
        avgTemperature: 0,
        maxTemperature: 0,
        avgHumidity: 0,
        maxHumidity: 0,
        uniqueDevices: 0,
      };
    }

    return result[0];
  }

  async checkHealth(): Promise<HealthStatus> {
    let mongoHealthy = false;
    let redisHealthy = false;

    try {
      if (this.telemetryModel.db?.db) {
        await this.telemetryModel.db.db.command({ ping: 1 });
        mongoHealthy = true;
      } else {
        this.logger.error('MongoDB connection is undefined');
      }
    } catch (error) {
      this.logger.error('MongoDB health check failed', error);
    }

    try {
      await this.redisClient.ping();
      redisHealthy = true;
    } catch (error) {
      this.logger.error('Redis health check failed', error);
    }

    return { mongo: mongoHealthy, redis: redisHealthy };
  }
}