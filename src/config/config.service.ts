import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService) {}

  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  // Database
  get postgresUrl(): string {
    return this.configService.get<string>('DATABASE_URL');
  }

  get mongodbUrl(): string {
    return this.configService.get<string>('MONGODB_URL', 'mongodb://localhost:27017/concierge-ai');
  }

  // Redis
  get redisHost(): string {
    return this.configService.get<string>('REDIS_HOST', 'localhost');
  }

  get redisPort(): number {
    return this.configService.get<number>('REDIS_PORT', 6379);
  }

  get redisPassword(): string {
    return this.configService.get<string>('REDIS_PASSWORD', '');
  }

  // OpenAI
  get openaiApiKey(): string {
    return this.configService.get<string>('OPENAI_API_KEY');
  }

  get openaiModel(): string {
    return this.configService.get<string>('OPENAI_MODEL', 'gpt-4-turbo-preview');
  }

  get openaiEmbeddingModel(): string {
    return this.configService.get<string>('OPENAI_EMBEDDING_MODEL', 'text-embedding-ada-002');
  }

  // Supabase
  get supabaseUrl(): string {
    return this.configService.get<string>('SUPABASE_URL');
  }

  get supabaseKey(): string {
    return this.configService.get<string>('SUPABASE_ANON_KEY');
  }

  // Webhook secrets
  get webhookSecrets(): Record<string, string> {
    return {
      'booking.com': this.configService.get<string>('WEBHOOK_SECRET_BOOKING_COM', ''),
      airbnb: this.configService.get<string>('WEBHOOK_SECRET_AIRBNB', ''),
      expedia: this.configService.get<string>('WEBHOOK_SECRET_EXPEDIA', ''),
      pms: this.configService.get<string>('WEBHOOK_SECRET_PMS', ''),
    };
  }

  // CORS
  get corsOrigin(): string {
    return this.configService.get<string>('CORS_ORIGIN', '*');
  }
}
