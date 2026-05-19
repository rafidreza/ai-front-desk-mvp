import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import {
  KnowledgeChangeRequest,
  KnowledgeChangeRequestReviewDetail,
  KnowledgeChangeRequestStatus,
  KnowledgeChangeRequestType,
  KnowledgeChangeRequestUrgency,
} from '../types/domain';

type KnowledgeChangeRequestRecord = {
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
  currentEntrySnapshot: Prisma.JsonValue | null;
  decisionSnapshot: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  closedAt: Date | null;
};

type EntrySnapshot = {
  id: string;
  title: string;
  answer: string;
  keywords: string[];
  category: string;
  confidenceBoost?: number;
  status: string;
  version: number;
};

const requestTypes: KnowledgeChangeRequestType[] = ['create', 'edit'];
const urgencies: KnowledgeChangeRequestUrgency[] = ['normal', 'urgent'];
const reviewStatuses: KnowledgeChangeRequestStatus[] = [
  'submitted',
  'in_review',
  'needs_clarification',
  'approved',
  'edited_then_published',
  'rejected',
  'published',
];

function assertIncludes<T extends string>(allowed: readonly T[], value: string, label: string): T {
  if (!allowed.includes(value as T)) {
    throw new BadRequestException(`${label} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function mapJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function mapRequest(record: KnowledgeChangeRequestRecord): KnowledgeChangeRequest {
  return {
    id: record.id,
    clientId: record.clientId,
    targetEntryId: record.targetEntryId ?? undefined,
    requestType: record.requestType as KnowledgeChangeRequestType,
    status: record.status as KnowledgeChangeRequestStatus,
    urgency: record.urgency as KnowledgeChangeRequestUrgency,
    proposedTitle: record.proposedTitle,
    proposedAnswer: record.proposedAnswer,
    proposedKeywords: record.proposedKeywords,
    proposedCategory: record.proposedCategory,
    requesterNote: record.requesterNote ?? undefined,
    reviewerNote: record.reviewerNote ?? undefined,
    clientVisibleMessage: record.clientVisibleMessage ?? undefined,
    internalNote: record.internalNote ?? undefined,
    submittedBy: record.submittedBy,
    reviewedBy: record.reviewedBy ?? undefined,
    publishedEntryId: record.publishedEntryId ?? undefined,
    currentEntrySnapshot: mapJsonObject(record.currentEntrySnapshot),
    decisionSnapshot: mapJsonObject(record.decisionSnapshot),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    reviewedAt: record.reviewedAt?.toISOString(),
    publishedAt: record.publishedAt?.toISOString(),
    closedAt: record.closedAt?.toISOString(),
  };
}

function snapshotEntry(entry: {
  id: string;
  title: string;
  answer: string;
  keywords: string[];
  category: string | null;
  confidenceBoost: number | null;
  status: string;
  version: number;
}): EntrySnapshot {
  return {
    id: entry.id,
    title: entry.title,
    answer: entry.answer,
    keywords: entry.keywords,
    category: entry.category ?? 'general',
    confidenceBoost: entry.confidenceBoost ?? undefined,
    status: entry.status,
    version: entry.version,
  };
}

@Injectable()
export class KnowledgeChangeRequestService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: {
    clientId?: string;
    status?: KnowledgeChangeRequestStatus | 'all';
    urgency?: KnowledgeChangeRequestUrgency | 'all';
  } = {}): Promise<KnowledgeChangeRequest[]> {
    const records = await this.prisma.knowledgeChangeRequest.findMany({
      where: {
        ...(input.clientId === undefined ? {} : { clientId: input.clientId }),
        ...(input.status === undefined || input.status === 'all' ? {} : { status: input.status }),
        ...(input.urgency === undefined || input.urgency === 'all' ? {} : { urgency: input.urgency }),
      },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
    });

    return records.map(mapRequest);
  }

  async find(clientId: string, requestId: string): Promise<KnowledgeChangeRequest> {
    const record = await this.prisma.knowledgeChangeRequest.findFirst({
      where: { id: requestId, clientId },
    });
    if (record === null) {
      throw new NotFoundException(`Knowledge change request not found: ${requestId}`);
    }
    return mapRequest(record);
  }

  async findById(requestId: string): Promise<KnowledgeChangeRequest> {
    const record = await this.prisma.knowledgeChangeRequest.findUnique({
      where: { id: requestId },
    });
    if (record === null) {
      throw new NotFoundException(`Knowledge change request not found: ${requestId}`);
    }
    return mapRequest(record);
  }

  async getReviewDetail(requestId: string): Promise<KnowledgeChangeRequestReviewDetail> {
    const request = await this.findById(requestId);
    const current = request.currentEntrySnapshot;
    return {
      request,
      current:
        current === undefined
          ? undefined
          : {
              title: typeof current.title === 'string' ? current.title : undefined,
              answer: typeof current.answer === 'string' ? current.answer : undefined,
              keywords: Array.isArray(current.keywords) ? current.keywords.filter((item): item is string => typeof item === 'string') : undefined,
              category: typeof current.category === 'string' ? current.category : undefined,
              status: typeof current.status === 'string' ? current.status : undefined,
              version: typeof current.version === 'number' ? current.version : undefined,
            },
      proposed: {
        title: request.proposedTitle,
        answer: request.proposedAnswer,
        keywords: request.proposedKeywords,
        category: request.proposedCategory,
      },
    };
  }

  async create(input: {
    clientId: string;
    requestType: string;
    targetEntryId?: string;
    urgency?: string;
    proposedTitle: string;
    proposedAnswer: string;
    proposedKeywords?: string[];
    proposedCategory?: string;
    requesterNote?: string;
    submittedBy?: string;
  }): Promise<KnowledgeChangeRequest> {
    const requestType = assertIncludes(requestTypes, input.requestType, 'requestType');
    const urgency = assertIncludes(urgencies, input.urgency ?? 'normal', 'urgency');
    let currentEntrySnapshot: EntrySnapshot | undefined;

    if (requestType === 'edit') {
      if (input.targetEntryId === undefined) {
        throw new BadRequestException('targetEntryId is required for edit requests.');
      }
      const entry = await this.prisma.knowledgeEntry.findFirst({ where: { id: input.targetEntryId, clientId: input.clientId } });
      if (entry === null) {
        throw new NotFoundException(`Knowledge entry not found: ${input.targetEntryId}`);
      }
      currentEntrySnapshot = snapshotEntry(entry);
    }

    const created = await this.prisma.knowledgeChangeRequest.create({
      data: {
        id: randomUUID(),
        clientId: input.clientId,
        targetEntryId: requestType === 'edit' ? input.targetEntryId : undefined,
        requestType,
        urgency,
        proposedTitle: input.proposedTitle,
        proposedAnswer: input.proposedAnswer,
        proposedKeywords: input.proposedKeywords ?? [],
        proposedCategory: input.proposedCategory ?? 'general',
        requesterNote: input.requesterNote,
        submittedBy: input.submittedBy ?? 'client',
        currentEntrySnapshot,
      },
    });

    return mapRequest(created);
  }

  async updateReviewState(input: {
    clientId: string;
    requestId: string;
    status: string;
    reviewerNote?: string;
    clientVisibleMessage?: string;
    internalNote?: string;
    reviewedBy?: string;
    decisionSnapshot?: Record<string, unknown>;
  }): Promise<KnowledgeChangeRequest> {
    const status = assertIncludes(reviewStatuses, input.status, 'status');
    const existing = await this.prisma.knowledgeChangeRequest.findFirst({
      where: { id: input.requestId, clientId: input.clientId },
    });
    if (existing === null) {
      throw new NotFoundException(`Knowledge change request not found: ${input.requestId}`);
    }

    const now = new Date();
    const closedAt = status === 'rejected' || status === 'published' ? now : undefined;
    const updated = await this.prisma.knowledgeChangeRequest.update({
      where: { id: input.requestId },
      data: {
        status,
        reviewerNote: input.reviewerNote,
        clientVisibleMessage: input.clientVisibleMessage,
        internalNote: input.internalNote,
        reviewedBy: input.reviewedBy,
        decisionSnapshot: input.decisionSnapshot as Prisma.InputJsonValue | undefined,
        reviewedAt: now,
        closedAt,
      },
    });

    return mapRequest(updated);
  }
}
