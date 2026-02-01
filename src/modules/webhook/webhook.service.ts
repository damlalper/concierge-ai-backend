import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { ConfigService } from '../../config/config.service';
import { IdempotencyKey } from '../../database/entities/idempotency-key.entity';
import { WebhookEvent, WebhookEventDocument } from '../../database/schemas/webhook-event.schema';
import { WebhookBookingDto } from './dto/webhook-booking.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private idempotencyRepository: Repository<IdempotencyKey>,
    @InjectModel(WebhookEvent.name)
    private webhookEventModel: Model<WebhookEventDocument>,
    @InjectQueue('webhook-processing')
    private webhookQueue: Queue,
    private configService: ConfigService,
  ) {}

  async processBookingWebhook(
    payload: WebhookBookingDto,
    sourceSystem: string,
    requestId: string,
    headers: Record<string, any>,
    sourceIp: string,
  ): Promise<{ jobId: string; correlationId: string }> {
    const correlationId = uuidv4();

    // Check idempotency
    const keyHash = this.generateKeyHash(sourceSystem, requestId);
    const existingKey = await this.idempotencyRepository.findOne({
      where: { keyHash },
    });

    if (existingKey) {
      this.logger.warn(`Duplicate request detected: ${keyHash}`);
      throw new ConflictException({
        success: false,
        message: 'Duplicate request',
        jobId: existingKey.jobId,
        correlationId,
      });
    }

    // Persist raw payload to MongoDB
    const webhookEvent = new this.webhookEventModel({
      requestId,
      sourceSystem,
      eventType: payload.eventType,
      payload,
      headers,
      sourceIp,
      processed: false,
    });
    await webhookEvent.save();

    // Enqueue job
    const job = await this.webhookQueue.add(
      'process-booking',
      {
        payload,
        sourceSystem,
        requestId,
        correlationId,
        webhookEventId: webhookEvent._id.toString(),
      },
      {
        jobId: correlationId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    // Store idempotency key
    const idempotencyKey = this.idempotencyRepository.create({
      keyHash,
      sourceSystem,
      requestId,
      jobId: job.id,
      status: 'pending',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    });
    await this.idempotencyRepository.save(idempotencyKey);

    // Update webhook event with job ID
    webhookEvent.jobId = job.id;
    await webhookEvent.save();

    this.logger.log(
      `Webhook processed: ${sourceSystem} - ${requestId} - JobId: ${job.id} - CorrelationId: ${correlationId}`,
    );

    return { jobId: job.id, correlationId };
  }

  validateSignature(
    payload: string,
    signature: string,
    timestamp: string,
    sourceSystem: string,
  ): boolean {
    const secrets = this.configService.webhookSecrets;
    const secret = secrets[sourceSystem];

    if (!secret) {
      this.logger.warn(`No secret configured for source system: ${sourceSystem}`);
      return false;
    }

    // Check timestamp (reject if > 5 minutes old)
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - requestTime > 300) {
      this.logger.warn(`Request timestamp too old: ${timestamp}`);
      return false;
    }

    // Generate expected signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(timestamp + payload)
      .digest('hex');

    // Timing-safe comparison
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      return false;
    }
  }

  private generateKeyHash(sourceSystem: string, requestId: string): string {
    return createHash('sha256')
      .update(`${sourceSystem}:${requestId}`)
      .digest('hex');
  }
}
