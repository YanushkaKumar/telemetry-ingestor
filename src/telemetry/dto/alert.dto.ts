export interface AlertDto {
  deviceId: string;
  siteId: string;
  ts: string;
  reason: 'HIGH_TEMPERATURE' | 'HIGH_HUMIDITY';
  value: number;
}
