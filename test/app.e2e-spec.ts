import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Telemetry } from '../src/telemetry/schemas/telemetry.schema';

describe('Telemetry API (e2e)', () => {
  let app: INestApplication;
  let telemetryModel: Model<Telemetry>;

  // ✅ Common header for all requests (includes auth)
  const AUTH_HEADER = {
    Authorization: `Bearer ${process.env.INGEST_TOKEN || 'secret123'}`,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    telemetryModel = moduleFixture.get<Model<Telemetry>>(
      getModelToken(Telemetry.name),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  beforeEach(async () => {
    // Clean up the database before each test
    await telemetryModel.deleteMany({});
  });

  afterAll(async () => {
    await telemetryModel.deleteMany({});
    await app.close();
  });

  // ---------------------- POST /telemetry ----------------------
  describe('POST /api/v1/telemetry', () => {
    const validTelemetryData = {
      deviceId: 'dev-test-001',
      siteId: 'site-test-A',
      ts: new Date().toISOString(),
      metrics: { temperature: 25.5, humidity: 60 },
    };

    it('should successfully ingest valid telemetry data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(AUTH_HEADER)
        .send(validTelemetryData)
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          count: 1,
        }),
      );
      expect(typeof (response.body as { message: string }).message).toBe(
        'string',
      );
    });

    it('should reject telemetry data with missing required fields', async () => {
      const invalidData = {
        deviceId: 'dev-test-002',
        ts: new Date().toISOString(),
        metrics: { temperature: 25.5 },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(AUTH_HEADER)
        .send(invalidData)
        .expect(400);

      expect((response.body as { message: string }).message).toContain(
        'siteId',
      );
    });

    it('should handle bulk telemetry ingestion', async () => {
      const bulkData = [
        validTelemetryData,
        { ...validTelemetryData, deviceId: 'dev-test-002' },
      ];

      const response = await request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(AUTH_HEADER)
        .send(bulkData)
        .expect(201);

      expect((response.body as { count: number }).count).toBe(2);
    });
  });

  // ---------------------- GET /devices/:id/latest ----------------------
  describe('GET /api/v1/devices/:deviceId/latest', () => {
    const deviceId = 'dev-test-003';
    const testData = {
      deviceId,
      siteId: 'site-test-B',
      ts: new Date().toISOString(),
      metrics: { temperature: 22, humidity: 55 },
    };

    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(AUTH_HEADER)
        .send(testData);
    });

    it('should retrieve latest reading for existing device', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/devices/${deviceId}/latest`)
        .set(AUTH_HEADER)
        .expect(200);

      expect(response.body).toMatchObject({
        deviceId,
        siteId: testData.siteId,
        metrics: testData.metrics,
      });
    });

    it('should return 404 for non-existent device', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/devices/non-existent-device/latest')
        .set(AUTH_HEADER)
        .expect(404);
    });
  });

  // ---------------------- GET /sites/:siteId/summary ----------------------
  describe('GET /api/v1/sites/:siteId/summary', () => {
    const siteId = 'site-test-summary';
    const testData = {
      deviceId: 'dev-summary-001',
      siteId,
      ts: new Date().toISOString(),
      metrics: { temperature: 30, humidity: 70 },
    };

    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(AUTH_HEADER)
        .send(testData);
    });

    it('should return valid summary for date range', async () => {
      const from = new Date('2025-01-01').toISOString();
      const to = new Date('2025-12-31').toISOString();

      const response = await request(app.getHttpServer())
        .get(`/api/v1/sites/${siteId}/summary`)
        .set(AUTH_HEADER)
        .query({ from, to })
        .expect(200);

      expect(response.body).toEqual({
        count: expect.any(Number) as unknown as number,
        avgTemperature: expect.any(Number) as unknown as number,
        maxTemperature: expect.any(Number) as unknown as number,
        avgHumidity: expect.any(Number) as unknown as number,
        maxHumidity: expect.any(Number) as unknown as number,
        uniqueDevices: expect.any(Number) as unknown as number,
      });
    });

    it('should handle invalid date range parameters', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/sites/${siteId}/summary`)
        .set(AUTH_HEADER)
        .query({ from: 'invalid-date', to: 'invalid-date' })
        .expect(400);
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return health status of dependencies', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set(AUTH_HEADER)
        .expect(200);

      expect(response.body).toEqual({
        mongo: expect.any(Boolean) as unknown as boolean,
        redis: expect.any(Boolean) as unknown as boolean,
      });
    });
  });
});
