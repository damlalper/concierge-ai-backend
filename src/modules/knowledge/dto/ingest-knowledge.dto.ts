import { IsString, IsEnum, IsOptional, IsObject, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum KnowledgeSource {
  PDF = 'pdf',
  MARKDOWN = 'markdown',
  TEXT = 'text',
}

export class IngestKnowledgeDto {
  @ApiProperty()
  @IsUUID()
  hotelId: string;

  @ApiProperty({ enum: KnowledgeSource })
  @IsEnum(KnowledgeSource)
  source: KnowledgeSource;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: {
    category?: string;
    lastUpdated?: string;
  };
}
