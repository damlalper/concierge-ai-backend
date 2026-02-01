import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { IdempotencyKey } from '../../database/entities/idempotency-key.entity';
import { WebhookEvent, WebhookEventSchema } from '../../database/schemas/webhook-event.schema';
import { ConfigService } from '../../config/config.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IdempotencyKey]),
    MongooseModule.forFeature([
      { name: WebhookEvent.name, schema: WebhookEventSchema },
    ]),
    BullModule.registerQueue({
      name: 'webhook-processing',
    }),
  ],
  controllers: [WebhookController],
  providers: [WebhookService, ConfigService],
  exports: [WebhookService],
})
export class WebhookModule {}
