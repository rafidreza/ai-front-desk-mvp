import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { KnowledgeEntry, KnowledgeEntryVersion } from '../types/domain';
import pilotKnowledge from './pilot-knowledge.json';

interface KnowledgeMatch {
  entries: KnowledgeEntry[];
  confidence: number;
}

type KnowledgeAction = KnowledgeEntryVersion['action'];

function mapEntry(entry: {
  id: string;
  clientId: string;
  title: string;
  answer: string;
  keywords: string[];
  confidenceBoost: number | null;
  status: string;
  version: number;
  archivedAt: Date | null;
}): KnowledgeEntry {
  return {
    id: entry.id,
    clientId: entry.clientId,
    title: entry.title,
    answer: entry.answer,
    keywords: entry.keywords,
    confidenceBoost: entry.confidenceBoost ?? undefined,
    status: entry.status as KnowledgeEntry['status'],
    version: entry.version,
    archivedAt: entry.archivedAt?.toISOString(),
  };
}

function mapVersion(version: {
  id: string;
  entryId: string;
  clientId: string;
  version: number;
  title: string;
  answer: string;
  keywords: string[];
  confidenceBoost: number | null;
  status: string;
  action: string;
  actorId: string;
  createdAt: Date;
}): KnowledgeEntryVersion {
  return {
    id: version.id,
    entryId: version.entryId,
    clientId: version.clientId,
    version: version.version,
    title: version.title,
    answer: version.answer,
    keywords: version.keywords,
    confidenceBoost: version.confidenceBoost ?? undefined,
    status: version.status as KnowledgeEntry['status'],
    action: version.action as KnowledgeEntryVersion['action'],
    actorId: version.actorId,
    createdAt: version.createdAt.toISOString(),
  };
}

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma?: PrismaService) {}

  private readonly entries: KnowledgeEntry[] = pilotKnowledge.map((entry) => ({
    ...entry,
    confidenceBoost: entry.confidenceBoost ?? undefined,
    status: 'active' as const,
    version: 1,
  }));

  private requirePrisma(): PrismaService {
    if (this.prisma === undefined) {
      throw new Error('KnowledgeService persistence requires PrismaService.');
    }
    return this.prisma;
  }

  async findRelevant(clientId: string, text: string): Promise<KnowledgeMatch> {
    const candidateEntries: KnowledgeEntry[] =
      this.prisma?.enabled === true
        ? (await this.requirePrisma().knowledgeEntry.findMany({ where: { clientId, status: 'active' } })).map(mapEntry)
        : this.entries.filter((entry) => entry.clientId === clientId);

    const normalizedText = text.toLowerCase();
    const scored = candidateEntries
      .map((entry) => {
        const hits = entry.keywords.filter((keyword) => normalizedText.includes(keyword.toLowerCase())).length;
        const score = hits / Math.max(entry.keywords.length, 1) + (entry.confidenceBoost ?? 0);
        return { entry, hits, score };
      })
      .filter((item) => item.hits > 0)
      .sort((a, b) => b.score - a.score);

    const matchedEntries = scored.slice(0, 3).map((item) => item.entry);
    const topScore = scored[0]?.score ?? 0;
    const confidence = matchedEntries.length === 0 ? 0.25 : Math.min(0.95, 0.55 + topScore);

    return { entries: matchedEntries, confidence };
  }

  async list(clientId: string, status?: string): Promise<KnowledgeEntry[]> {
    const entries = await this.requirePrisma().knowledgeEntry.findMany({
      where: { clientId, ...(status === undefined || status === 'all' ? {} : { status }) },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });

    return entries.map(mapEntry);
  }

  async createDraft(input: {
    clientId: string;
    title: string;
    answer: string;
    keywords: string[];
    confidenceBoost?: number;
    actorId?: string;
  }): Promise<KnowledgeEntry> {
    const prisma = this.requirePrisma();
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.knowledgeEntry.create({
        data: {
          id: randomUUID(),
          clientId: input.clientId,
          title: input.title,
          answer: input.answer,
          keywords: input.keywords,
          confidenceBoost: input.confidenceBoost,
          status: 'draft',
          version: 1,
        },
      });
      await this.recordVersion(tx, created, 'created', input.actorId);
      return created;
    });

    return mapEntry(entry);
  }

  async update(
    clientId: string,
    entryId: string,
    input: Partial<Pick<KnowledgeEntry, 'title' | 'answer' | 'keywords' | 'confidenceBoost'>> & { actorId?: string },
  ): Promise<KnowledgeEntry> {
    const { actorId, ...changes } = input;
    const prisma = this.requirePrisma();
    const entry = await prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgeEntry.findFirst({ where: { id: entryId, clientId } });
      if (existing === null) {
        throw new NotFoundException(`Knowledge entry not found: ${entryId}`);
      }

      const updated = await tx.knowledgeEntry.update({
        where: { id: entryId },
        data: {
          ...changes,
          version: { increment: 1 },
          status: 'draft',
          archivedAt: null,
        },
      });
      await this.recordVersion(tx, updated, 'updated', actorId);
      return updated;
    });

    return mapEntry(entry);
  }

  async setStatus(
    clientId: string,
    entryId: string,
    status: KnowledgeEntry['status'],
    actorId?: string,
  ): Promise<KnowledgeEntry> {
    const prisma = this.requirePrisma();
    const entry = await prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgeEntry.findFirst({ where: { id: entryId, clientId } });
      if (existing === null) {
        throw new NotFoundException(`Knowledge entry not found: ${entryId}`);
      }

      const updated = await tx.knowledgeEntry.update({
        where: { id: entryId },
        data: {
          status,
          archivedAt: status === 'archived' ? new Date() : null,
        },
      });
      await this.recordVersion(tx, updated, status === 'active' ? 'published' : status === 'archived' ? 'archived' : 'updated', actorId);
      return updated;
    });

    return mapEntry(entry);
  }

  async listVersions(clientId: string, entryId: string): Promise<KnowledgeEntryVersion[]> {
    const versions = await this.requirePrisma().knowledgeEntryVersion.findMany({
      where: { clientId, entryId },
      orderBy: { createdAt: 'desc' },
    });
    return versions.map(mapVersion);
  }

  async rollback(input: {
    clientId: string;
    entryId: string;
    versionId: string;
    actorId?: string;
  }): Promise<KnowledgeEntry> {
    const prisma = this.requirePrisma();
    const entry = await prisma.$transaction(async (tx) => {
      const snapshot = await tx.knowledgeEntryVersion.findFirst({
        where: { id: input.versionId, entryId: input.entryId, clientId: input.clientId },
      });
      if (snapshot === null) {
        throw new NotFoundException(`Knowledge version not found: ${input.versionId}`);
      }

      const updated = await tx.knowledgeEntry.update({
        where: { id: input.entryId },
        data: {
          title: snapshot.title,
          answer: snapshot.answer,
          keywords: snapshot.keywords,
          confidenceBoost: snapshot.confidenceBoost,
          status: 'draft',
          archivedAt: null,
          version: { increment: 1 },
        },
      });
      await this.recordVersion(tx, updated, 'rollback', input.actorId);
      return updated;
    });

    return mapEntry(entry);
  }

  private async recordVersion(
    tx: {
      knowledgeEntryVersion: {
        create: (input: {
          data: {
            id: string;
            entryId: string;
            clientId: string;
            version: number;
            title: string;
            answer: string;
            keywords: string[];
            confidenceBoost?: number | null;
            status: string;
            action: string;
            actorId: string;
          };
        }) => Promise<unknown>;
      };
    },
    entry: {
      id: string;
      clientId: string;
      version: number;
      title: string;
      answer: string;
      keywords: string[];
      confidenceBoost: number | null;
      status: string;
    },
    action: KnowledgeAction,
    actorId = 'internal-console',
  ) {
    await tx.knowledgeEntryVersion.create({
      data: {
        id: randomUUID(),
        entryId: entry.id,
        clientId: entry.clientId,
        version: entry.version,
        title: entry.title,
        answer: entry.answer,
        keywords: entry.keywords,
        confidenceBoost: entry.confidenceBoost,
        status: entry.status,
        action,
        actorId,
      },
    });
  }
}
