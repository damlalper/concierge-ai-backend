import { ApiProperty } from '@nestjs/swagger';

export class WebhookResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  jobId: string;

  @ApiProperty()
  correlationId: string;

  @ApiProperty()
  message: string;
}
