/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/await-thenable */
// src/telemetry/telemetry.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { getModelToken } from '@nestjs/mongoose';
import { Telemetry } from './schemas/telemetry.schema';

// 1. Fully mock the ioredis constructor and instance methods
const mockRedisClient = {
  on: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  ping: jest.fn().mockResolvedValue('PONG'),
};

// 2. Mock the ioredis module itself
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return mockRedisClient;
  });
});

const mockTelemetryModel = {
  // ... (rest of the model mock remains the same)
  db: {
    admin: () => ({
      ping: jest.fn().mockResolvedValue({ ok: 1 }),
    }),
  },
  // eslint-disable-next-line prettier/prettier
  save: jest.fn().mockImplementation(function() { return Promise.resolve(this); }),
  findOne: jest.fn(),
  aggregate: jest.fn(),
  // Mock the constructor
  constructor: jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue(data),
  })),
};

const mockHttpService = {
  // Use a mock for `post` that returns an observable and resolves immediately
  // eslint-disable-next-line prettier/prettier
  post: jest.fn().mockReturnValue({ toPromise: () => Promise.resolve({ data: {} }) }),
};

describe('TelemetryService', () => {
  let service: TelemetryService;
  let module: TestingModule; // Keep module scope to destroy later

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        TelemetryService,
        {
          provide: getModelToken(Telemetry.name),
          useValue: mockTelemetryModel,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'REDIS_URL') return 'redis://mock:6379';
              if (key === 'ALERT_WEBHOOK_URL') return 'http://mock-webhook.com';
              return null;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);

    // Call onModuleInit to simulate the service lifecycle (where Redis connects)
    await service.onModuleInit();
  });

  // 3. Add afterAll cleanup for open handles
  afterAll(async () => {
    // Manually trigger the service's cleanup method
    await service.onModuleDestroy();
    await module.close();
  });

  // The rest of your tests...
  // The checkHealth test should now pass because Redis.ping() is mocked.
  describe('checkHealth', () => {
    it('should return health status for mongo and redis', async () => {
      const healthStatus = await service.checkHealth();
      expect(healthStatus.mongo).toBe(true);
      expect(healthStatus.redis).toBe(true);
      // Ensure the mocked ping was called
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });
  });
});
