import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Telemetry extends Document {
  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop({ required: true, index: true })
  siteId: string;

  @Prop({ required: true, index: true })
  ts: Date;

  @Prop({ type: Object, required: true })
  metrics: {
    temperature: number;
    humidity: number;
  };
}

export const TelemetrySchema = SchemaFactory.createForClass(Telemetry);

// Compound index for site queries
TelemetrySchema.index({ siteId: 1, ts: 1 });
