import {
  IsString,
  IsNotEmpty,
  IsISO8601,
  ValidateNested,
  IsNumber,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MetricsDto {
  @IsNumber()
  temperature: number;

  @IsNumber()
  humidity: number;
}

export class TelemetryDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  siteId: string;

  @IsISO8601()
  ts: string;

  @ValidateNested()
  @Type(() => MetricsDto)
  metrics: MetricsDto;
}

export class TelemetryArrayDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TelemetryDto)
  readings: TelemetryDto[];
}
