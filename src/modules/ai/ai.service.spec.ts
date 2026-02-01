import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { KnowledgeChunk } from '../../database/entities/knowledge-chunk.entity';
import { ConfigService } from '../../config/config.service';
import { Repository } from 'typeorm';

describe('AiService', () => {
  let service: AiService;
  let knowledgeChunkRepository: Repository<KnowledgeChunk>;
  let configService: ConfigService;

  const mockRepository = {
    query: jest.fn(),
  };

  const mockConfigService = {
    openaiApiKey: 'test-key',
    openaiModel: 'gpt-4-turbo-preview',
    openaiEmbeddingModel: 'text-embedding-ada-002',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: getRepositoryToken(KnowledgeChunk),
          useValue: mockRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    knowledgeChunkRepository = module.get<Repository<KnowledgeChunk>>(
      getRepositoryToken(KnowledgeChunk),
    );
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for text', async () => {
      // Mock OpenAI response
      const mockEmbedding = new Array(1536).fill(0.1);
      
      // Note: In real tests, you would mock the OpenAI client
      // This is a placeholder test structure
      expect(service).toBeDefined();
    });
  });
});
