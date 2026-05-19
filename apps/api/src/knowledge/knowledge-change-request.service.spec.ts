import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeChangeRequestEvent, KnowledgeEntry } from '../types/domain';
import { KnowledgeChangeRequestService } from './knowledge-change-request.service';

type ChangeRecord = {
  id: string;
  clientId: string;
  targetEntryId: string | null;
  requestType: string;
  status: string;
  urgency: string;
  proposedTitle: string;
  proposedAnswer: string;
  proposedKeywords: string[];
  proposedCategory: string;
  requesterNote: string | null;
  reviewerNote: string | null;
  clientVisibleMessage: string | null;
  internalNote: string | null;
  submittedBy: string;
  reviewedBy: string | null;
  publishedEntryId: string | null;
  currentEntrySnapshot: Record<string, unknown> | null;
  decisionSnapshot: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  closedAt: Date | null;
};

type EntryRecord = {
  id: string;
  clientId: string;
  title: string;
  answer: string;
  keywords: string[];
  category: string | null;
  confidenceBoost: number | null;
  status: string;
  version: number;
};

type EventRecord = {
  id: string;
  requestId: string;
  eventType: string;
  actorId: string;
  note: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
};

function definedEntries<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function createEntry(input: Partial<EntryRecord> = {}): EntryRecord {
  return {
    id: input.id ?? 'kb-1',
    clientId: input.clientId ?? 'client-1',
    title: input.title ?? 'Delivery window',
    answer: input.answer ?? 'Delivery takes 2-3 working days.',
    keywords: input.keywords ?? ['delivery', 'shipping'],
    category: input.category ?? 'delivery',
    confidenceBoost: input.confidenceBoost ?? null,
    status: input.status ?? 'active',
    version: input.version ?? 1,
  };
}

function cloneRequest(record: ChangeRecord): ChangeRecord {
  return {
    ...record,
    proposedKeywords: [...record.proposedKeywords],
    currentEntrySnapshot: record.currentEntrySnapshot === null ? null : { ...record.currentEntrySnapshot },
    decisionSnapshot: record.decisionSnapshot === null ? null : { ...record.decisionSnapshot },
  };
}

function createPrismaFake(options: { entries?: EntryRecord[] } = {}) {
  const requests: ChangeRecord[] = [];
  const events: EventRecord[] = [];
  const entries = [...(options.entries ?? [])];

  const prisma = {
    knowledgeEntry: {
      findFirst: vi.fn(async ({ where }: { where: { id?: string; clientId?: string } }) => {
        return entries.find((entry) => entry.id === where.id && entry.clientId === where.clientId) ?? null;
      }),
    },
    knowledgeChangeRequest: {
      findMany: vi.fn(async ({ where }: { where?: { clientId?: string; status?: string; urgency?: string } } = {}) => {
        return requests
          .filter((request) => {
            if (where?.clientId !== undefined && request.clientId !== where.clientId) return false;
            if (where?.status !== undefined && request.status !== where.status) return false;
            if (where?.urgency !== undefined && request.urgency !== where.urgency) return false;
            return true;
          })
          .map(cloneRequest);
      }),
      findFirst: vi.fn(async ({ where }: { where: { id?: string; clientId?: string } }) => {
        const record = requests.find((request) => request.id === where.id && request.clientId === where.clientId);
        return record === undefined ? null : cloneRequest(record);
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const record = requests.find((request) => request.id === where.id);
        return record === undefined ? null : cloneRequest(record);
      }),
      create: vi.fn(async ({ data }: { data: Partial<ChangeRecord> }) => {
        const now = new Date('2026-05-19T10:00:00.000Z');
        const record: ChangeRecord = {
          id: data.id ?? `request-${requests.length + 1}`,
          clientId: data.clientId ?? 'client-1',
          targetEntryId: data.targetEntryId ?? null,
          requestType: data.requestType ?? 'create',
          status: data.status ?? 'submitted',
          urgency: data.urgency ?? 'normal',
          proposedTitle: data.proposedTitle ?? 'New policy',
          proposedAnswer: data.proposedAnswer ?? 'New policy answer.',
          proposedKeywords: data.proposedKeywords ?? [],
          proposedCategory: data.proposedCategory ?? 'general',
          requesterNote: data.requesterNote ?? null,
          reviewerNote: data.reviewerNote ?? null,
          clientVisibleMessage: data.clientVisibleMessage ?? null,
          internalNote: data.internalNote ?? null,
          submittedBy: data.submittedBy ?? 'client',
          reviewedBy: data.reviewedBy ?? null,
          publishedEntryId: data.publishedEntryId ?? null,
          currentEntrySnapshot: data.currentEntrySnapshot ?? null,
          decisionSnapshot: data.decisionSnapshot ?? null,
          createdAt: data.createdAt ?? now,
          updatedAt: data.updatedAt ?? now,
          reviewedAt: data.reviewedAt ?? null,
          publishedAt: data.publishedAt ?? null,
          closedAt: data.closedAt ?? null,
        };
        requests.push(record);
        return cloneRequest(record);
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<ChangeRecord> }) => {
        const record = requests.find((request) => request.id === where.id);
        if (record === undefined) {
          throw new Error(`Missing request ${where.id}`);
        }
        Object.assign(record, definedEntries(data), { updatedAt: new Date('2026-05-19T10:05:00.000Z') });
        return cloneRequest(record);
      }),
    },
    knowledgeChangeRequestEvent: {
      findMany: vi.fn(async ({ where }: { where: { requestId: string } }) => {
        return events.filter((event) => event.requestId === where.requestId);
      }),
      create: vi.fn(async ({ data }: { data: Omit<EventRecord, 'createdAt'> & { createdAt?: Date } }) => {
        const record: EventRecord = {
          id: data.id,
          requestId: data.requestId,
          eventType: data.eventType,
          actorId: data.actorId,
          note: data.note ?? null,
          payload: data.payload ?? {},
          createdAt: data.createdAt ?? new Date('2026-05-19T10:01:00.000Z'),
        };
        events.push(record);
        return record;
      }),
    },
  };

  return { prisma, requests, events, entries };
}

function createKnowledgeFake() {
  const entries: KnowledgeEntry[] = [];
  const knowledge = {
    createDraft: vi.fn(async (input: {
      clientId: string;
      title: string;
      answer: string;
      keywords: string[];
      category?: string;
      actorId?: string;
    }): Promise<KnowledgeEntry> => {
      const entry: KnowledgeEntry = {
        id: `published-draft-${entries.length + 1}`,
        clientId: input.clientId,
        title: input.title,
        answer: input.answer,
        keywords: input.keywords,
        category: input.category ?? 'general',
        status: 'draft',
        version: 1,
      };
      entries.push(entry);
      return entry;
    }),
    update: vi.fn(async (
      clientId: string,
      entryId: string,
      input: {
        title?: string;
        answer?: string;
        keywords?: string[];
        category?: string;
        actorId?: string;
      },
    ): Promise<KnowledgeEntry> => {
      const entry: KnowledgeEntry = {
        id: entryId,
        clientId,
        title: input.title ?? 'Updated title',
        answer: input.answer ?? 'Updated answer',
        keywords: input.keywords ?? [],
        category: input.category ?? 'general',
        status: 'draft',
        version: 2,
      };
      entries.push(entry);
      return entry;
    }),
    setStatus: vi.fn(async (clientId: string, entryId: string, status: KnowledgeEntry['status']): Promise<KnowledgeEntry> => {
      const existing = entries.find((entry) => entry.id === entryId);
      const entry: KnowledgeEntry = {
        id: entryId,
        clientId,
        title: existing?.title ?? 'Published title',
        answer: existing?.answer ?? 'Published answer',
        keywords: existing?.keywords ?? [],
        category: existing?.category ?? 'general',
        status,
        version: existing?.version ?? 1,
      };
      entries.push(entry);
      return entry;
    }),
  };

  return { knowledge, entries };
}

function createService(options: { entries?: EntryRecord[] } = {}) {
  const prismaFake = createPrismaFake(options);
  const knowledgeFake = createKnowledgeFake();
  const service = new KnowledgeChangeRequestService(prismaFake.prisma as never, knowledgeFake.knowledge as never);
  return { service, prismaFake, knowledgeFake };
}

describe('KnowledgeChangeRequestService lifecycle', () => {
  it('creates a client-submitted KB request and records a submitted event', async () => {
    const { service, prismaFake } = createService();

    const request = await service.create({
      clientId: 'client-1',
      requestType: 'create',
      urgency: 'urgent',
      proposedTitle: 'Eid cutoff',
      proposedAnswer: 'Order by 5 PM for Eid delivery.',
      proposedKeywords: ['eid', 'cutoff'],
      proposedCategory: 'delivery',
      requesterNote: 'Customers keep asking this.',
      submittedBy: 'owner@example.com',
    });

    expect(request.status).toBe('submitted');
    expect(request.urgency).toBe('urgent');
    expect(request.proposedKeywords).toEqual(['eid', 'cutoff']);
    expect(prismaFake.events).toHaveLength(1);
    expect(prismaFake.events[0]).toMatchObject({
      requestId: request.id,
      eventType: 'submitted',
      actorId: 'owner@example.com',
      note: 'Customers keep asking this.',
      payload: { requestType: 'create', status: 'submitted', urgency: 'urgent' },
    });
  });

  it('blocks edit requests against entries outside the client boundary', async () => {
    const { service } = createService({ entries: [createEntry({ id: 'foreign-entry', clientId: 'client-2' })] });

    await expect(
      service.create({
        clientId: 'client-1',
        requestType: 'edit',
        targetEntryId: 'foreign-entry',
        proposedTitle: 'Changed title',
        proposedAnswer: 'Changed answer',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a request with client-visible feedback and an audit event', async () => {
    const { service, prismaFake } = createService();
    const request = await service.create({
      clientId: 'client-1',
      requestType: 'create',
      proposedTitle: 'Warranty',
      proposedAnswer: 'All products have a one-year warranty.',
    });

    const rejected = await service.updateReviewState({
      clientId: 'client-1',
      requestId: request.id,
      status: 'rejected',
      reviewerNote: 'Warranty terms need legal approval.',
      clientVisibleMessage: 'Please confirm the warranty wording with your team first.',
      reviewedBy: 'internal-agent',
    });

    expect(rejected.status).toBe('rejected');
    expect(rejected.clientVisibleMessage).toBe('Please confirm the warranty wording with your team first.');
    expect(rejected.closedAt).toBeDefined();
    expect(prismaFake.events.at(-1)).toMatchObject({
      eventType: 'rejected',
      actorId: 'internal-agent',
      note: 'Please confirm the warranty wording with your team first.',
      payload: { previousStatus: 'submitted', status: 'rejected' },
    });
  });

  it('approves a create request by publishing an active KB entry through the reindexing path', async () => {
    const { service, knowledgeFake, prismaFake } = createService();
    const request = await service.create({
      clientId: 'client-1',
      requestType: 'create',
      proposedTitle: 'Store pickup',
      proposedAnswer: 'Pickup is available from Banani after confirmation.',
      proposedKeywords: ['pickup', 'banani'],
      proposedCategory: 'fulfillment',
    });

    const published = await service.publish({
      requestId: request.id,
      reviewerNote: 'Approved as written.',
      clientVisibleMessage: 'Published to your live knowledgebase.',
      reviewedBy: 'internal-agent',
    });

    expect(knowledgeFake.knowledge.createDraft).toHaveBeenCalledWith({
      clientId: 'client-1',
      title: 'Store pickup',
      answer: 'Pickup is available from Banani after confirmation.',
      keywords: ['pickup', 'banani'],
      category: 'fulfillment',
      actorId: 'internal-agent',
    });
    expect(knowledgeFake.knowledge.setStatus).toHaveBeenCalledWith('client-1', 'published-draft-1', 'active', 'internal-agent');
    expect(published.status).toBe('published');
    expect(published.publishedEntryId).toBe('published-draft-1');
    expect(published.decisionSnapshot).toEqual({
      proposedTitle: 'Store pickup',
      proposedAnswer: 'Pickup is available from Banani after confirmation.',
      proposedKeywords: ['pickup', 'banani'],
      proposedCategory: 'fulfillment',
    });
    expect(prismaFake.events.at(-1)).toMatchObject({
      eventType: 'published',
      payload: { previousStatus: 'submitted', publishedEntryId: 'published-draft-1', requestType: 'create' },
    } satisfies Partial<KnowledgeChangeRequestEvent>);
  });

  it('publishes an edited request with reviewer final content against the target entry', async () => {
    const existingEntry = createEntry({ id: 'kb-delivery', title: 'Delivery', answer: 'Old answer.' });
    const { service, knowledgeFake } = createService({ entries: [existingEntry] });
    const request = await service.create({
      clientId: 'client-1',
      requestType: 'edit',
      targetEntryId: 'kb-delivery',
      proposedTitle: 'Delivery timing',
      proposedAnswer: 'Delivery takes 2-4 working days.',
      proposedKeywords: ['delivery'],
      proposedCategory: 'delivery',
    });

    const published = await service.publish({
      requestId: request.id,
      finalTitle: 'Delivery timing and charge',
      finalAnswer: 'Delivery takes 2-4 working days and starts from BDT 80.',
      finalKeywords: ['delivery', 'charge'],
      finalCategory: 'shipping',
      reviewedBy: 'senior-agent',
    });

    expect(request.currentEntrySnapshot).toMatchObject({
      id: 'kb-delivery',
      title: 'Delivery',
      answer: 'Old answer.',
      status: 'active',
    });
    expect(knowledgeFake.knowledge.update).toHaveBeenCalledWith('client-1', 'kb-delivery', {
      title: 'Delivery timing and charge',
      answer: 'Delivery takes 2-4 working days and starts from BDT 80.',
      keywords: ['delivery', 'charge'],
      category: 'shipping',
      actorId: 'senior-agent',
    });
    expect(knowledgeFake.knowledge.setStatus).toHaveBeenCalledWith('client-1', 'kb-delivery', 'active', 'senior-agent');
    expect(published.status).toBe('published');
    expect(published.publishedEntryId).toBe('kb-delivery');
    expect(published.decisionSnapshot).toEqual({
      proposedTitle: 'Delivery timing and charge',
      proposedAnswer: 'Delivery takes 2-4 working days and starts from BDT 80.',
      proposedKeywords: ['delivery', 'charge'],
      proposedCategory: 'shipping',
    });
  });
});
