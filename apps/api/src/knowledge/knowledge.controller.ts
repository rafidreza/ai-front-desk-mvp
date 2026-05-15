import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { KnowledgeService } from './knowledge.service';

const KnowledgeEntrySchema = z.object({
  title: z.string().trim().min(2),
  answer: z.string().trim().min(2),
  keywords: z.array(z.string().trim().min(1)).min(1),
  confidenceBoost: z.number().min(0).max(0.5).optional(),
});

const KnowledgePatchSchema = KnowledgeEntrySchema.partial();

const StatusSchema = z.object({
  status: z.enum(['draft', 'active', 'archived']),
});

@Controller('clients/:clientId/knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  async list(@Param('clientId') clientId: string, @Query('status') status?: string) {
    return { entries: await this.knowledge.list(clientId, status) };
  }

  @Post()
  async create(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = KnowledgeEntrySchema.parse(body);
    return { entry: await this.knowledge.createDraft({ clientId, ...parsed }) };
  }

  @Patch(':entryId')
  async update(@Param('entryId') entryId: string, @Body() body: unknown) {
    const parsed = KnowledgePatchSchema.parse(body);
    return { entry: await this.knowledge.update(entryId, parsed) };
  }

  @Patch(':entryId/status')
  async setStatus(@Param('entryId') entryId: string, @Body() body: unknown) {
    const parsed = StatusSchema.parse(body);
    return { entry: await this.knowledge.setStatus(entryId, parsed.status) };
  }
}
