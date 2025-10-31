import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Query,
  NotFoundException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryDto } from './dto/telemetry.dto';

@Controller('api/v1')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('telemetry')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async ingest(@Body() body: TelemetryDto | TelemetryDto[]) {
    // Service will validate inputs and throw BadRequestException for invalid payloads
    return await this.telemetryService.ingestTelemetry(body);
  }

  @Get('devices/:deviceId/latest')
  async getLatest(@Param('deviceId') deviceId: string) {
    const latest = await this.telemetryService.getLatestByDevice(deviceId);
    if (!latest) {
      throw new NotFoundException('No telemetry found for device');
    }
    return latest;
  }

  @Get('sites/:siteId/summary')
  async getSiteSummary(
    @Param('siteId') siteId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    // Service validates date params
    return await this.telemetryService.getSiteSummary(siteId, from, to);
  }

  @Get('health')
  async health() {
    return await this.telemetryService.checkHealth();
  }
}
