import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WebhookEventDocument = WebhookEvent & Document;

@Schema({ collection: 'webhook_events', timestamps: true })
export class WebhookEvent {
  @Prop({ required: true, index: true })
  requestId: string;

  @Prop({ required: true, index: true })
  sourceSystem: string;

  @Prop({ required: true })
  eventType: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, any>;

  @Prop({ type: Object })
  headers: Record<string, any>;

  @Prop()
  sourceIp: string;

  @Prop({ default: false, index: true })
  processed: boolean;

  @Prop()
  jobId: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);

// TTL index for automatic cleanup (90 days)
WebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
