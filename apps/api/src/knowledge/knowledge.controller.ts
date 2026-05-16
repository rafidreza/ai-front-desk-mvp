import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { KnowledgeImportService } from './knowledge-import.service';
import { KnowledgeService } from './knowledge.service';

const KnowledgeEntrySchema = z.object({
  title: z.string().trim().min(2),
  answer: z.string().trim().min(2),
  keywords: z.array(z.string().trim().min(1)).min(1),
  confidenceBoost: z.number().min(0).max(0.5).optional(),
  actorId: z.string().trim().min(2).optional(),
});

const KnowledgePatchSchema = KnowledgeEntrySchema.partial();

const StatusSchema = z.object({
  status: z.enum(['draft', 'active', 'archived']),
  actorId: z.string().trim().min(2).optional(),
});

const RollbackSchema = z.object({
  versionId: z.string().trim().min(2),
  actorId: z.string().trim().min(2).optional(),
});

const KnowledgeImportSchema = z.object({
  actorId: z.string().trim().min(2).optional(),
  files: z
    .array(
      z.object({
        fileName: z.string().trim().min(2),
        contentType: z.string().trim().optional(),
        base64: z.string().trim().min(4),
      }),
    )
    .min(1)
    .max(5),
});

@Controller('clients/:clientId/knowledge')
export class KnowledgeController {
  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly imports: KnowledgeImportService,
  ) {}

  @Get()
  async list(@Param('clientId') clientId: string, @Query('status') status?: string) {
    return { entries: await this.knowledge.list(clientId, status) };
  }

  @Post()
  async create(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = KnowledgeEntrySchema.parse(body);
    return { entry: await this.knowledge.createDraft({ clientId, ...parsed }) };
  }

  @Post('reindex')
  async reindex(@Param('clientId') clientId: string) {
    return this.knowledge.reindex(clientId);
  }

  @Post('import')
  async import(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = KnowledgeImportSchema.parse(body);
    return this.imports.importFiles({ clientId, ...parsed });
  }

  @Patch(':entryId')
  async update(@Param('clientId') clientId: string, @Param('entryId') entryId: string, @Body() body: unknown) {
    const parsed = KnowledgePatchSchema.parse(body);
    return { entry: await this.knowledge.update(clientId, entryId, parsed) };
  }

  @Patch(':entryId/status')
  async setStatus(@Param('clientId') clientId: string, @Param('entryId') entryId: string, @Body() body: unknown) {
    const parsed = StatusSchema.parse(body);
    return { entry: await this.knowledge.setStatus(clientId, entryId, parsed.status, parsed.actorId) };
  }

  @Get(':entryId/versions')
  async listVersions(@Param('clientId') clientId: string, @Param('entryId') entryId: string) {
    return { versions: await this.knowledge.listVersions(clientId, entryId) };
  }

  @Post(':entryId/rollback')
  async rollback(@Param('clientId') clientId: string, @Param('entryId') entryId: string, @Body() body: unknown) {
    const parsed = RollbackSchema.parse(body);
    return { entry: await this.knowledge.rollback({ clientId, entryId, versionId: parsed.versionId, actorId: parsed.actorId }) };
  }
}
