import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { KnowledgeChunk } from '../../database/entities/knowledge-chunk.entity';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '../../config/config.service';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeChunk]), ConfigModule],
  providers: [AiService, ConfigService],
  exports: [AiService],
})
export class AiModule {}
