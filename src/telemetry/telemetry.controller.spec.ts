import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
import { getModelToken } from '@nestjs/mongoose';
import { Telemetry } from './schemas/telemetry.schema';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

describe('TelemetryService', () => {
  let service: TelemetryService;

  interface MockTelemetryInstance {
    save: jest.Mock;
  }

  interface MockTelemetryModel {
    new (doc?: any): MockTelemetryInstance;
    findOne: jest.Mock;
    aggregate: jest.Mock;
    db: { db: { command: jest.Mock } };
  }

  const mockTelemetryModel: MockTelemetryModel = function (
    this: MockTelemetryInstance,
    doc?: any,
  ) {
    this.save = jest.fn().mockResolvedValue({ ...doc, _id: 'mockid' });
  };
  mockTelemetryModel.findOne = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(null),
  });
  mockTelemetryModel.aggregate = jest.fn().mockResolvedValue([]);
  // provide a fake db object for health check
  mockTelemetryModel.db = {
    db: { command: jest.fn().mockResolvedValue({ ok: 1 }) },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'REDIS_URL') return '';
      if (key === 'ALERT_WEBHOOK_URL') return '';
      return null;
    }),
  };

  const mockHttpService = {
    post: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({
        toPromise: jest.fn(),
      }),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        { provide: getModelToken(Telemetry.name), useValue: mockTelemetryModel },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});