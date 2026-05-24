import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditLogEntry } from '../types/domain';

type AuditLogRow = {
  id: string;
  clientId: string | null;
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: unknown;
  createdAt: Date;
};

function toMetadata(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function mapAuditLog(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    clientId: row.clientId ?? undefined,
    actorId: row.actorId,
    actorRole: row.actorRole,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId ?? undefined,
    summary: row.summary,
    metadata: toMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma?: PrismaService) {}

  private readonly fallbackLogs: AuditLogEntry[] = [];

  async create(input: {
    clientId?: string;
    actorId: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId?: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogEntry> {
    if (this.prisma?.enabled === true) {
      const created = await this.prisma.auditLog.create({
        data: {
          id: randomUUID(),
          clientId: input.clientId,
          actorId: input.actorId,
          actorRole: input.actorRole,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          summary: input.summary,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
      return mapAuditLog(created);
    }

    const log: AuditLogEntry = {
      id: randomUUID(),
      clientId: input.clientId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString(),
    };
    this.fallbackLogs.unshift(log);
    return log;
  }

  async list(input: {
    clientId?: string;
    actorId?: string;
    entityType?: string;
    action?: string;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 100, 250));

    if (this.prisma?.enabled === true) {
      const rows = await this.prisma.auditLog.findMany({
        where: {
          clientId: input.clientId,
          actorId: input.actorId,
          entityType: input.entityType,
          action: input.action,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return rows.map(mapAuditLog);
    }

    return this.fallbackLogs
      .filter((log) => input.clientId === undefined || log.clientId === input.clientId)
      .filter((log) => input.actorId === undefined || log.actorId === input.actorId)
      .filter((log) => input.entityType === undefined || log.entityType === input.entityType)
      .filter((log) => input.action === undefined || log.action === input.action)
      .slice(0, limit);
  }
}
