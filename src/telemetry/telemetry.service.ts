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
//import { timeout } from 'rxjs/operators';
import Redis from 'ioredis';
import { Telemetry } from './schemas/telemetry.schema';
import { TelemetryDto } from './dto/telemetry.dto';
import { AlertDto } from './dto/alert.dto';
//import { firstValueFrom } from 'rxjs';

// ---------------- Exported interfaces ----------------
export interface IngestResponse {
  success: boolean;
  count: number;
  message: string;
}

export interface SiteSummary {
  count: number;
  avgTemperature: number;
  maxTemperature: number;
  avgHumidity: number;
  maxHumidity: number;
  uniqueDevices: number;
}

export interface HealthStatus {
  mongo: boolean;
  redis: boolean;
}

// ---------------- Service class ----------------
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
    this.redisClient.on('connect', () => this.logger.log('Redis connected'));
    this.redisClient.on('error', (err: Error) =>
      this.logger.error('Redis connection error', err),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisClient.quit();
  }

  async ingestTelemetry(
    data: TelemetryDto | TelemetryDto[],
  ): Promise<IngestResponse> {
    const readings = Array.isArray(data) ? data : [data];
    if (readings.length === 0)
      throw new BadRequestException('No telemetry readings provided');

    this.logger.log(`Ingesting ${readings.length} telemetry reading(s)`);

    const savedReadings: Array<Telemetry> = [];
    for (const reading of readings) {
      try {
        // This try...catch block fixes E2E Error 2
        const telemetry = new this.telemetryModel({
          deviceId: reading.deviceId,
          siteId: reading.siteId,
          ts: new Date(reading.ts),
          metrics: reading.metrics,
        });
        const saved = await telemetry.save(); // This line was throwing the 500 error
        savedReadings.push(saved);
        await this.redisClient.set(
          `latest:${reading.deviceId}`,
          JSON.stringify(reading),
        );
        await this.checkAndSendAlerts(reading);
      } catch (error) {
        // If Mongoose validation fails, throw a 400 Bad Request
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (error.name === 'ValidationError') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          this.logger.warn(`Ingestion validation failed: ${error.message}`);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          throw new BadRequestException(`Validation failed: ${error.message}`);
        }
        // Re-throw other unexpected errors (e.g., database connection)
        this.logger.error(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Failed to ingest reading: ${error.message}`,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          error.stack,
        );
        throw error;
      }
    }

    return {
      success: true,
      count: savedReadings.length,
      message: `${savedReadings.length} reading(s) ingested successfully`,
    };
  }

  async getLatestByDevice(deviceId: string): Promise<TelemetryDto | null> {
    const cached = await this.redisClient.get(`latest:${deviceId}`);
    if (cached) return JSON.parse(cached) as TelemetryDto;
    const latest = await this.telemetryModel
      .findOne({ deviceId })
      .sort({ ts: -1 })
      .exec();
    if (!latest) return null;
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
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // --- FIX for E2E Error 3 ---
    // Check if dates are valid. isNaN(date.getTime()) is the standard way.
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException(
        'Invalid date range. "from" and "to" must be valid ISO date strings.',
      );
    }
    // --- END FIX ---

    const result = await this.telemetryModel.aggregate<SiteSummary>([
      { $match: { siteId, ts: { $gte: fromDate, $lte: toDate } } },
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
    if (result.length === 0)
      return {
        count: 0,
        avgTemperature: 0,
        maxTemperature: 0,
        avgHumidity: 0,
        maxHumidity: 0,
        uniqueDevices: 0,
      };
    return result[0];
  }

  async checkHealth(): Promise<HealthStatus> {
    let mongoHealthy = false,
      redisHealthy = false;
    try {
      // --- FIX for TS Error 1 (TS2532) ---
      // Use optional chaining (?.)
      await this.telemetryModel.db?.db?.command({ ping: 1 });
      mongoHealthy = true;
    } catch { /* empty */ }
    try {
      await this.redisClient.ping();
      redisHealthy = true;
    } catch { /* empty */ }
    return { mongo: mongoHealthy, redis: redisHealthy };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async checkAndSendAlerts(reading: TelemetryDto): Promise<void> {
    /* ... */
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async sendAlert(alert: AlertDto): Promise<void> {
    /* ... */
  }
}