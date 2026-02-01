import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import OpenAI from 'openai';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeChunk } from '../../database/entities/knowledge-chunk.entity';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;
  private readonly embeddingCache = new Map<string, number[]>();

  constructor(
    private configService: ConfigService,
    @InjectRepository(KnowledgeChunk)
    private knowledgeChunkRepository: Repository<KnowledgeChunk>,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.openaiApiKey,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Check cache
    const cacheKey = this.hashText(text);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey);
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.configService.openaiEmbeddingModel,
        input: text,
      });

      const embedding = response.data[0].embedding;

      // Cache embedding (TTL: 1 hour in production, use Redis)
      this.embeddingCache.set(cacheKey, embedding);

      return embedding;
    } catch (error) {
      this.logger.error(`Error generating embedding: ${error.message}`, error.stack);
      throw error;
    }
  }

  async searchSimilarChunks(
    queryEmbedding: number[],
    hotelId: string,
    limit: number = 5,
    similarityThreshold: number = 0.7,
  ): Promise<KnowledgeChunk[]> {
    try {
      // Use pgvector cosine similarity search
      // Note: This is a simplified version. In production, use proper pgvector query
      const query = `
        SELECT 
          id,
          content,
          metadata,
          hotel_id,
          1 - (embedding <=> $1::vector) as similarity
        FROM knowledge_chunks
        WHERE hotel_id = $2
          AND 1 - (embedding <=> $1::vector) > $3
        ORDER BY embedding <=> $1::vector
        LIMIT $4
      `;

      const results = await this.knowledgeChunkRepository.query(query, [
        JSON.stringify(queryEmbedding),
        hotelId,
        similarityThreshold,
        limit,
      ]);

      return results.map((row: any) => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
        hotelId: row.hotel_id,
        similarity: row.similarity,
      })) as KnowledgeChunk[];
    } catch (error) {
      this.logger.error(`Error searching similar chunks: ${error.message}`, error.stack);
      return [];
    }
  }

  async generateResponse(
    userQuestion: string,
    contextChunks: KnowledgeChunk[],
    guestContext?: {
      name?: string;
      bookingId?: string;
      checkIn?: Date;
      checkOut?: Date;
    },
    hotelName?: string,
  ): Promise<string> {
    try {
      // Build context from chunks
      const contextText = contextChunks
        .map((chunk) => chunk.content)
        .join('\n\n');

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(
        hotelName,
        contextText,
        guestContext,
      );

      // Generate completion
      const completion = await this.openai.chat.completions.create({
        model: this.configService.openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuestion },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content || 'Üzgünüm, bir hata oluştu.';

      // Check if response is hallucination (no context found)
      if (contextChunks.length === 0 || contextChunks[0].similarity < 0.7) {
        return 'Bu bilgi mevcut değil. Lütfen resepsiyon ile iletişime geçin.';
      }

      return response;
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`, error.stack);
      return 'Üzgünüm, bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
    }
  }

  async generateStreamingResponse(
    userQuestion: string,
    contextChunks: KnowledgeChunk[],
    guestContext?: {
      name?: string;
      bookingId?: string;
      checkIn?: Date;
      checkOut?: Date;
    },
    hotelName?: string,
  ): Promise<AsyncIterable<string>> {
    const contextText = contextChunks
      .map((chunk) => chunk.content)
      .join('\n\n');

    const systemPrompt = this.buildSystemPrompt(
      hotelName,
      contextText,
      guestContext,
    );

    const stream = await this.openai.chat.completions.create({
      model: this.configService.openaiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuestion },
      ],
      temperature: 0.3,
      max_tokens: 500,
      stream: true,
    });

    return this.streamResponse(stream);
  }

  private buildSystemPrompt(
    hotelName: string,
    contextText: string,
    guestContext?: {
      name?: string;
      bookingId?: string;
      checkIn?: Date;
      checkOut?: Date;
    },
  ): string {
    let prompt = `Sen ${hotelName || 'bir otel'} otelinin misafir asistanısın. 
Sadece aşağıdaki bilgileri kullanarak cevap ver.
Eğer soru bu bilgilerle cevaplanamazsa, 'Bu bilgi mevcut değil' de.

Otel Bilgileri:
${contextText || 'Bilgi bulunamadı.'}

`;

    if (guestContext) {
      prompt += `Misafir Bilgileri:
- Ad: ${guestContext.name || 'Bilinmiyor'}
`;

      if (guestContext.bookingId) {
        prompt += `- Rezervasyon ID: ${guestContext.bookingId}\n`;
      }

      if (guestContext.checkIn) {
        prompt += `- Check-in: ${guestContext.checkIn.toLocaleDateString('tr-TR')}\n`;
      }

      if (guestContext.checkOut) {
        prompt += `- Check-out: ${guestContext.checkOut.toLocaleDateString('tr-TR')}\n`;
      }
    }

    prompt += `\nKurallar:
- Sadece verilen bilgileri kullan
- Uydurma yapma
- Kibar ve profesyonel ol
- Türkçe cevap ver`;

    return prompt;
  }

  private async *streamResponse(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
  ): AsyncIterable<string> {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }
    }
  }

  private hashText(text: string): string {
    // Simple hash for caching (in production, use proper hashing)
    return Buffer.from(text).toString('base64').substring(0, 50);
  }
}
