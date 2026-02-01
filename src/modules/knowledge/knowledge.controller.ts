import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { IngestKnowledgeDto } from './dto/ingest-knowledge.dto';
import { KnowledgeChunk } from '../../database/entities/knowledge-chunk.entity';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

@ApiTags('knowledge')
@Controller('knowledge')
@UseInterceptors(LoggingInterceptor)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest knowledge content for a hotel' })
  @ApiResponse({ status: 201, description: 'Knowledge ingested successfully' })
  async ingestKnowledge(@Body() dto: IngestKnowledgeDto) {
    return this.knowledgeService.ingestKnowledge(dto);
  }

  @Get(':hotelId')
  @ApiOperation({ summary: 'Get all knowledge chunks for a hotel' })
  @ApiParam({ name: 'hotelId', type: 'string' })
  @ApiResponse({ status: 200, description: 'List of knowledge chunks', type: [KnowledgeChunk] })
  async getKnowledgeChunks(@Param('hotelId') hotelId: string): Promise<KnowledgeChunk[]> {
    return this.knowledgeService.getKnowledgeChunks(hotelId);
  }

  @Delete(':chunkId')
  @ApiOperation({ summary: 'Delete a knowledge chunk' })
  @ApiParam({ name: 'chunkId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Knowledge chunk deleted' })
  @ApiResponse({ status: 404, description: 'Knowledge chunk not found' })
  async deleteKnowledgeChunk(@Param('chunkId') chunkId: string): Promise<void> {
    return this.knowledgeService.deleteKnowledgeChunk(chunkId);
  }
}
