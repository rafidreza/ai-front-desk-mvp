import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { KnowledgeEntry } from '../types/domain';
import pilotKnowledge from './pilot-knowledge.json';

interface KnowledgeMatch {
  entries: KnowledgeEntry[];
  confidence: number;
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
        ? (await this.requirePrisma().knowledgeEntry.findMany({ where: { clientId, status: 'active' } })).map((entry) => ({
            id: entry.id,
            clientId: entry.clientId,
            title: entry.title,
            answer: entry.answer,
            keywords: entry.keywords,
            confidenceBoost: entry.confidenceBoost ?? undefined,
            status: entry.status as KnowledgeEntry['status'],
            version: entry.version,
            archivedAt: entry.archivedAt?.toISOString(),
          }))
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

    return entries.map((entry) => ({
      id: entry.id,
      clientId: entry.clientId,
      title: entry.title,
      answer: entry.answer,
      keywords: entry.keywords,
      confidenceBoost: entry.confidenceBoost ?? undefined,
      status: entry.status as KnowledgeEntry['status'],
      version: entry.version,
      archivedAt: entry.archivedAt?.toISOString(),
    }));
  }

  async createDraft(input: {
    clientId: string;
    title: string;
    answer: string;
    keywords: string[];
    confidenceBoost?: number;
  }): Promise<KnowledgeEntry> {
    const entry = await this.requirePrisma().knowledgeEntry.create({
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

  async update(entryId: string, input: Partial<Pick<KnowledgeEntry, 'title' | 'answer' | 'keywords' | 'confidenceBoost'>>): Promise<KnowledgeEntry> {
    const entry = await this.requirePrisma().knowledgeEntry.update({
      where: { id: entryId },
      data: {
        ...input,
        version: { increment: 1 },
        status: 'draft',
        archivedAt: null,
      },
    });

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

  async setStatus(entryId: string, status: KnowledgeEntry['status']): Promise<KnowledgeEntry> {
    const entry = await this.requirePrisma().knowledgeEntry.update({
      where: { id: entryId },
      data: {
        status,
        archivedAt: status === 'archived' ? new Date() : null,
      },
    });

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
}
