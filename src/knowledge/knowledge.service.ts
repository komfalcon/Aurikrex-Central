import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE } from '../db/database.module';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: LibSQLDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {}

  public async generateMistralEmbedding(textInput: string): Promise<number[]> {
    const apiKey = this.configService.get<string>('MISTRAL_API_KEY');
    if (!apiKey) {
      this.logger.warn('MISTRAL_API_KEY not configured; using fallback mock vector embedding');
      // Return 1024-dimension normalized mock vector if key is missing
      return new Array(1024).fill(0).map(() => (Math.random() - 0.5) * 0.1);
    }

    try {
      const response = await axios.post(
        'https://api.mistral.ai/v1/embeddings',
        {
          model: 'mistral-embed',
          input: [textInput],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const embedding = response.data?.data?.[0]?.embedding;
      if (!Array.isArray(embedding)) {
        throw new Error('Invalid embedding vector returned from Mistral AI');
      }
      return embedding;
    } catch (err: any) {
      this.logger.error(`Mistral AI Embedding generation failed: ${err?.message || err}`);
      throw new BadRequestException('Failed to generate vector embedding via Mistral AI');
    }
  }

  public async ingestKnowledge(data: {
    title: string;
    content: string;
    subject: string;
    topic?: string;
    sourceApp: string;
    sourceId?: string;
    authorUserId?: string;
  }) {
    const embeddingVector = await this.generateMistralEmbedding(
      `${data.title}\n${data.content}`,
    );
    const id = uuidv4();
    const now = new Date();

    await this.db.insert(schema.sharedKnowledgeBase).values({
      id,
      title: data.title,
      content: data.content,
      subject: data.subject,
      topic: data.topic || null,
      source_app: data.sourceApp,
      source_id: data.sourceId || null,
      embedding_json: JSON.stringify(embeddingVector),
      author_user_id: data.authorUserId || null,
      createdAt: now,
      updatedAt: now,
    } as any);

    return {
      success: true,
      id,
      title: data.title,
      subject: data.subject,
      vectorDimension: embeddingVector.length,
    };
  }

  public async searchKnowledge(params: {
    queryText: string;
    subject?: string;
    limit?: number;
  }) {
    const queryEmbedding = await this.generateMistralEmbedding(params.queryText);
    const limit = params.limit || 5;

    let items = await this.db.select().from(schema.sharedKnowledgeBase);
    if (params.subject) {
      items = items.filter((i) => i.subject.toLowerCase() === params.subject.toLowerCase());
    }

    // Cosine similarity computation over vectors
    const scored = items
      .map((item) => {
        let vec: number[] = [];
        try {
          vec = JSON.parse(item.embedding_json || '[]');
        } catch {}
        if (vec.length !== queryEmbedding.length) return null;

        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vec.length; i++) {
          dot += vec[i] * queryEmbedding[i];
          normA += vec[i] * vec[i];
          normB += queryEmbedding[i] * queryEmbedding[i];
        }
        const similarity = normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
        return {
          id: item.id,
          title: item.title,
          content: item.content,
          subject: item.subject,
          topic: item.topic,
          sourceApp: item.source_app,
          similarity,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored;
  }
}
