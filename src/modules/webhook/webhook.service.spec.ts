import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { WebhookService } from './webhook.service';
import { IdempotencyKey } from '../../database/entities/idempotency-key.entity';
import { WebhookEvent } from '../../database/schemas/webhook-event.schema';
import { ConfigService } from '../../config/config.service';
import { Repository } from 'typeorm';
import { Model } from 'mongoose';
import { Queue } from 'bullmq';

describe('WebhookService', () => {
  let service: WebhookService;
  let idempotencyRepository: Repository<IdempotencyKey>;
  let webhookEventModel: Model<WebhookEvent>;
  let webhookQueue: Queue;
  let configService: ConfigService;

  const mockIdempotencyRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockWebhookEventModel = {
    constructor: jest.fn(),
    save: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockConfigService = {
    webhookSecrets: {
      'booking.com': 'test-secret',
      airbnb: 'test-secret',
      expedia: 'test-secret',
      pms: 'test-secret',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: getRepositoryToken(IdempotencyKey),
          useValue: mockIdempotencyRepository,
        },
        {
          provide: getModelToken(WebhookEvent.name),
          useValue: mockWebhookEventModel,
        },
        {
          provide: getQueueToken('webhook-processing'),
          useValue: mockQueue,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    idempotencyRepository = module.get<Repository<IdempotencyKey>>(
      getRepositoryToken(IdempotencyKey),
    );
    webhookEventModel = module.get<Model<WebhookEvent>>(
      getModelToken(WebhookEvent.name),
    );
    webhookQueue = module.get<Queue>(getQueueToken('webhook-processing'));
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateSignature', () => {
    it('should validate correct signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test-secret')
        .update(timestamp + payload)
        .digest('hex');

      const isValid = service.validateSignature(
        payload,
        signature,
        timestamp,
        'booking.com',
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const invalidSignature = 'invalid-signature';

      const isValid = service.validateSignature(
        payload,
        invalidSignature,
        timestamp,
        'booking.com',
      );

      expect(isValid).toBe(false);
    });
  });
});
