import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeChunk } from '../../database/entities/knowledge-chunk.entity';
import { AiService } from '../ai/ai.service';
import { IngestKnowledgeDto } from './dto/ingest-knowledge.dto';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly CHUNK_SIZE = 500; // tokens
  private readonly CHUNK_OVERLAP = 50; // tokens

  constructor(
    @InjectRepository(KnowledgeChunk)
    private knowledgeChunkRepository: Repository<KnowledgeChunk>,
    private aiService: AiService,
  ) {}

  async ingestKnowledge(dto: IngestKnowledgeDto): Promise<{ chunksCreated: number }> {
    this.logger.log(`Ingesting knowledge for hotel: ${dto.hotelId} - Source: ${dto.source}`);

    // Parse content based on source type
    let textContent = '';
    switch (dto.source) {
      case 'text':
        textContent = dto.content;
        break;
      case 'markdown':
        textContent = this.parseMarkdown(dto.content);
        break;
      case 'pdf':
        // In production, use PDF parsing library
        textContent = dto.content; // Simplified
        break;
    }

    // Chunk text
    const chunks = this.chunkText(textContent);

    // Process chunks
    let chunksCreated = 0;
    for (const chunk of chunks) {
      try {
        // Generate embedding
        const embedding = await this.aiService.generateEmbedding(chunk);

        // Store chunk
        const knowledgeChunk = this.knowledgeChunkRepository.create({
          hotelId: dto.hotelId,
          content: chunk,
          metadata: {
            ...dto.metadata,
            source: dto.source,
            chunkIndex: chunksCreated,
          },
          embedding: JSON.stringify(embedding), // Store as JSON string (pgvector will handle conversion)
        });

        await this.knowledgeChunkRepository.save(knowledgeChunk);
        chunksCreated++;

        this.logger.debug(`Created chunk ${chunksCreated}/${chunks.length} for hotel: ${dto.hotelId}`);
      } catch (error) {
        this.logger.error(`Error processing chunk: ${error.message}`, error.stack);
      }
    }

    this.logger.log(`Ingestion completed: ${chunksCreated} chunks created for hotel: ${dto.hotelId}`);

    return { chunksCreated };
  }

  async getKnowledgeChunks(hotelId: string): Promise<KnowledgeChunk[]> {
    return this.knowledgeChunkRepository.find({
      where: { hotelId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteKnowledgeChunk(chunkId: string): Promise<void> {
    const chunk = await this.knowledgeChunkRepository.findOne({
      where: { id: chunkId },
    });

    if (!chunk) {
      throw new NotFoundException(`Knowledge chunk not found: ${chunkId}`);
    }

    await this.knowledgeChunkRepository.remove(chunk);
    this.logger.log(`Deleted knowledge chunk: ${chunkId}`);
  }

  private chunkText(text: string): string[] {
    // Simple chunking by sentences and character count
    // In production, use proper tokenization (tiktoken, etc.)
    const sentences = text.split(/[.!?]+\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > this.CHUNK_SIZE) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter((chunk) => chunk.length > 0);
  }

  private parseMarkdown(markdown: string): string {
    // Simple markdown parsing - remove markdown syntax
    // In production, use proper markdown parser
    return markdown
      .replace(/#{1,6}\s+/g, '') // Headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
      .replace(/`(.*?)`/g, '$1') // Code
      .trim();
  }
}
