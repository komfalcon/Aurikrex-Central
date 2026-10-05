import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';

@Controller('api/v1/knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('search')
  async search(
    @Body('queryText') queryText: string,
    @Body('subject') subject?: string,
    @Body('limit') limit?: number,
  ) {
    return this.knowledgeService.searchKnowledge({ queryText, subject, limit });
  }

  @Post('ingest')
  async ingest(
    @Body('title') title: string,
    @Body('content') content: string,
    @Body('subject') subject: string,
    @Body('topic') topic?: string,
    @Body('sourceApp') sourceApp?: string,
    @Body('sourceId') sourceId?: string,
    @Body('authorUserId') authorUserId?: string,
  ) {
    return this.knowledgeService.ingestKnowledge({
      title,
      content,
      subject,
      topic,
      sourceApp: sourceApp || 'central',
      sourceId,
      authorUserId,
    });
  }
}
