import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  Ip,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WebhookService } from './webhook.service';
import { WebhookBookingDto } from './dto/webhook-booking.dto';
import { WebhookResponseDto } from './dto/webhook-response.dto';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';

@ApiTags('webhook')
@Controller('webhook')
@UseInterceptors(LoggingInterceptor)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('booking')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @ApiOperation({ summary: 'Receive booking webhook from external systems' })
  @ApiHeader({ name: 'x-request-id', required: true, description: 'Unique request ID' })
  @ApiHeader({ name: 'x-source-system', required: true, description: 'Source system identifier' })
  @ApiHeader({ name: 'x-signature', required: true, description: 'HMAC-SHA256 signature' })
  @ApiHeader({ name: 'x-timestamp', required: true, description: 'Unix timestamp' })
  @ApiResponse({ status: 202, description: 'Webhook accepted and queued', type: WebhookResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  @ApiResponse({ status: 409, description: 'Duplicate request' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async receiveBookingWebhook(
    @Body() payload: WebhookBookingDto,
    @Headers('x-request-id') requestId: string,
    @Headers('x-source-system') sourceSystem: string,
    @Headers('x-signature') signature: string,
    @Headers('x-timestamp') timestamp: string,
    @Headers() allHeaders: Record<string, any>,
    @Ip() sourceIp: string,
    @CorrelationId() correlationId: string,
  ): Promise<WebhookResponseDto> {
    // Validate required headers
    if (!requestId || !sourceSystem || !signature || !timestamp) {
      throw new BadRequestException('Missing required headers');
    }

    // Validate signature
    const payloadString = JSON.stringify(payload);
    const isValid = this.webhookService.validateSignature(
      payloadString,
      signature,
      timestamp,
      sourceSystem,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Process webhook
    const { jobId, correlationId: generatedCorrelationId } =
      await this.webhookService.processBookingWebhook(
        payload,
        sourceSystem,
        requestId,
        allHeaders,
        sourceIp,
      );

    return {
      success: true,
      jobId,
      correlationId: generatedCorrelationId,
      message: 'Webhook accepted and queued for processing',
    };
  }

  @Post('pms')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @ApiOperation({ summary: 'Receive PMS webhook events' })
  async receivePmsWebhook(
    @Body() payload: any,
    @Headers('x-request-id') requestId: string,
    @Headers('x-source-system') sourceSystem: string,
    @Headers() allHeaders: Record<string, any>,
    @Ip() sourceIp: string,
  ): Promise<WebhookResponseDto> {
    // Similar implementation for PMS webhooks
    // TODO: Implement PMS-specific processing
    return {
      success: true,
      jobId: 'pms-job-id',
      correlationId: 'pms-correlation-id',
      message: 'PMS webhook accepted',
    };
  }
}
