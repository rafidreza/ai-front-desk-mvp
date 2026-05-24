import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { AuditLogService } from './audit-log.service';

const AuditLogQuerySchema = z.object({
  clientId: z.string().trim().min(1).optional(),
  actorId: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(250).optional(),
});

const AuditLogCreateSchema = z.object({
  clientId: z.string().trim().min(1).optional(),
  actorId: z.string().trim().min(1),
  actorRole: z.string().trim().min(1),
  action: z.string().trim().min(1),
  entityType: z.string().trim().min(1),
  entityId: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).max(300),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

@Controller('internal/audit-log')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  async list(@Query() query: unknown) {
    const parsed = AuditLogQuerySchema.parse(query);
    return { entries: await this.auditLog.list(parsed) };
  }

  @Post()
  async create(@Body() body: unknown) {
    const parsed = AuditLogCreateSchema.parse(body);
    return { entry: await this.auditLog.create(parsed) };
  }
}
