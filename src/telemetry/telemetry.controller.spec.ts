import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { getModelToken } from '@nestjs/mongoose';

// --- Mock TelemetryService ---
// We create a mock object that fakes what the service does.
const mockTelemetryService = {
  ingestTelemetry: jest.fn(),
  getLatestByDevice: jest.fn(),
  getSiteSummary: jest.fn(),
  checkHealth: jest.fn(),
};

// --- Mock other providers that might be needed indirectly (though less common) ---
const mockConfigService = {
  get: jest.fn(),
};
const mockHttpService = {};
const mockTelemetryModel = {};

describe('TelemetryController', () => {
  let controller: TelemetryController;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let service: TelemetryService;

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelemetryController],
      providers: [
        // Provide the mock TelemetryService
        {
          provide: TelemetryService,
          useValue: mockTelemetryService,
        },
        // Add all other providers from telemetry.module.ts as mocks
        // This is good practice for controller tests.
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: getModelToken('Telemetry'),
          useValue: mockTelemetryModel,
        },
      ],
    }).compile();

    controller = module.get<TelemetryController>(TelemetryController);
    service = module.get<TelemetryService>(TelemetryService);
  });

  // --- This is the test that fixes your error ---
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // --- These are extra unit tests as required by the PDF ---
  describe('getLatest', () => {
    it('should return the latest telemetry', async () => {
      const resultDto = {
        deviceId: 'dev-001',
        siteId: 'site-A',
        ts: '',
        metrics: { temperature: 25, humidity: 50 },
      };

      // Tell the mock service what to return
      mockTelemetryService.getLatestByDevice.mockResolvedValue(resultDto);

      const result = await controller.getLatest('dev-001');

      expect(result).toBe(resultDto);
      expect(mockTelemetryService.getLatestByDevice).toHaveBeenCalledWith(
        'dev-001',
      );
    });

    it('should throw NotFoundException if service returns null', async () => {
      // Tell the mock service to return null (device not found)
      mockTelemetryService.getLatestByDevice.mockResolvedValue(null);

      // Check that the controller correctly throws a 404 error
      await expect(controller.getLatest('non-existent-device')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ingest', () => {
    it('should call the service to ingest telemetry', async () => {
      const telemetryData = [
        {
          deviceId: 'dev-002',
          siteId: 'site-B',
          ts: '',
          metrics: { temperature: 30, humidity: 60 },
        },
      ];
      const response = { success: true, count: 1, message: '...' };

      mockTelemetryService.ingestTelemetry.mockResolvedValue(response);

      const result = await controller.ingest(telemetryData);

      expect(result).toBe(response);
      expect(mockTelemetryService.ingestTelemetry).toHaveBeenCalledWith(
        telemetryData,
      );
    });
  });
});
