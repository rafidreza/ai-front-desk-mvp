import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { extractMessengerHistoryCandidates, extractReadablePageText } from '@ai-front-desk/shared';
import type {
  KnowledgeChangeRequest,
  KnowledgeChangeRequestReviewDetail,
  KnowledgeEntry,
  KnowledgeImportFileInput,
  KnowledgeImportResult,
} from '@ai-front-desk/shared';
import type { AppDb } from '../db/client';
import {
  knowledgeChangeRequestEvents,
  knowledgeChangeRequests,
  knowledgeEntries,
  knowledgeEntryVersions,
} from '../db/schema';
import { BadRequestError, NotFoundError } from '../errors';
import { decodeBase64, decodeBase64Text } from '../utils/base64';
import { randomId } from '../utils/crypto';
import { EmbeddingService } from './embedding';
import { toKnowledgeEntry, toKnowledgeRequest, toKnowledgeRequestEvent, toKnowledgeVersion } from './mappers';

type KnowledgeAction = 'baseline' | 'created' | 'updated' | 'published' | 'archived' | 'rollback';

export class KnowledgeService {
  private readonly embedder = new EmbeddingService();

  constructor(private readonly db: AppDb) {}

  async list(clientId: string, status?: string): Promise<KnowledgeEntry[]> {
    const where = status === undefined || status === 'all'
      ? eq(knowledgeEntries.clientId, clientId)
      : and(eq(knowledgeEntries.clientId, clientId), eq(knowledgeEntries.status, status));
    const rows = await this.db.select().from(knowledgeEntries).where(where).orderBy(asc(knowledgeEntries.category), asc(knowledgeEntries.title));
    return rows.map(toKnowledgeEntry);
  }

  async findRelevant(clientId: string, text: string) {
    const entries = await this.list(clientId, 'active');
    const normalized = text.toLowerCase();
    const scored = entries
      .map((entry) => {
        const hits = entry.keywords.filter((keyword) => normalized.includes(keyword.toLowerCase())).length;
        const titleHit = normalized.includes(entry.title.toLowerCase()) ? 1 : 0;
        const score = Math.min(1, (hits * 0.25 + titleHit * 0.2 + (entry.confidenceBoost ?? 0)));
        return { entry, score, hits };
      })
      .filter((item) => item.hits > 0 || item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const confidence = scored.length === 0 ? 0.3 : Math.max(0.35, Math.min(0.95, scored[0]!.score + 0.55));
    return { entries: scored.map((item) => item.entry), confidence };
  }

  async createDraft(input: {
    clientId: string;
    title: string;
    answer: string;
    keywords: string[];
    category?: string;
    confidenceBoost?: number;
    actorId?: string;
    status?: KnowledgeEntry['status'];
    sourceTicketId?: string;
    templateKey?: string;
  }) {
    const now = new Date();
    const [entry] = await this.db
      .insert(knowledgeEntries)
      .values({
        id: randomId(),
        clientId: input.clientId,
        title: input.title,
        answer: input.answer,
        keywords: input.keywords,
        category: input.category ?? 'general',
        confidenceBoost: input.confidenceBoost,
        status: input.status ?? 'draft',
        version: 1,
        sourceTicketId: input.sourceTicketId,
        templateKey: input.templateKey,
        archivedAt: input.status === 'archived' ? now : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await this.writeEmbedding(entry!);
    await this.recordVersion(entry!, 'created', input.actorId);
    return toKnowledgeEntry(entry!);
  }

  async update(clientId: string, entryId: string, input: Partial<Pick<KnowledgeEntry, 'title' | 'answer' | 'keywords' | 'category' | 'confidenceBoost'>> & { actorId?: string }) {
    const [existing] = await this.db.select().from(knowledgeEntries).where(and(eq(knowledgeEntries.id, entryId), eq(knowledgeEntries.clientId, clientId))).limit(1);
    if (existing === undefined) throw new NotFoundError(`Knowledge entry not found: ${entryId}`);
    const now = new Date();
    const [updated] = await this.db
      .update(knowledgeEntries)
      .set({
        title: input.title,
        answer: input.answer,
        keywords: input.keywords,
        category: input.category,
        confidenceBoost: input.confidenceBoost,
        status: 'draft',
        archivedAt: null,
        version: sql`${knowledgeEntries.version} + 1`,
        updatedAt: now,
      })
      .where(eq(knowledgeEntries.id, entryId))
      .returning();
    await this.writeEmbedding(updated!);
    await this.recordVersion(updated!, 'updated', input.actorId);
    return toKnowledgeEntry(updated!);
  }

  async setStatus(clientId: string, entryId: string, status: KnowledgeEntry['status'], actorId?: string) {
    const [existing] = await this.db.select().from(knowledgeEntries).where(and(eq(knowledgeEntries.id, entryId), eq(knowledgeEntries.clientId, clientId))).limit(1);
    if (existing === undefined) throw new NotFoundError(`Knowledge entry not found: ${entryId}`);
    const now = new Date();
    const [updated] = await this.db
      .update(knowledgeEntries)
      .set({ status, archivedAt: status === 'archived' ? now : null, updatedAt: now })
      .where(eq(knowledgeEntries.id, entryId))
      .returning();
    await this.recordVersion(updated!, status === 'active' ? 'published' : status === 'archived' ? 'archived' : 'updated', actorId);
    return toKnowledgeEntry(updated!);
  }

  async listVersions(clientId: string, entryId: string) {
    const rows = await this.db
      .select()
      .from(knowledgeEntryVersions)
      .where(and(eq(knowledgeEntryVersions.clientId, clientId), eq(knowledgeEntryVersions.entryId, entryId)))
      .orderBy(desc(knowledgeEntryVersions.createdAt));
    return rows.map(toKnowledgeVersion);
  }

  async rollback(input: { clientId: string; entryId: string; versionId: string; actorId?: string }) {
    const [snapshot] = await this.db
      .select()
      .from(knowledgeEntryVersions)
      .where(
        and(
          eq(knowledgeEntryVersions.id, input.versionId),
          eq(knowledgeEntryVersions.entryId, input.entryId),
          eq(knowledgeEntryVersions.clientId, input.clientId),
        ),
      )
      .limit(1);
    if (snapshot === undefined) throw new NotFoundError(`Knowledge version not found: ${input.versionId}`);
    const [updated] = await this.db
      .update(knowledgeEntries)
      .set({
        title: snapshot.title,
        answer: snapshot.answer,
        keywords: snapshot.keywords,
        category: snapshot.category,
        confidenceBoost: snapshot.confidenceBoost,
        status: 'draft',
        archivedAt: null,
        version: sql`${knowledgeEntries.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeEntries.id, input.entryId))
      .returning();
    await this.writeEmbedding(updated!);
    await this.recordVersion(updated!, 'rollback', input.actorId);
    return toKnowledgeEntry(updated!);
  }

  async reindex(clientId: string) {
    const rows = await this.db
      .select()
      .from(knowledgeEntries)
      .where(and(eq(knowledgeEntries.clientId, clientId), ne(knowledgeEntries.status, 'archived')));
    for (const entry of rows) {
      await this.writeEmbedding(entry);
    }
    return { updated: rows.length };
  }

  async harvestFromResolvedTicket(input: {
    clientId: string;
    ticketId: string;
    customerMessage: string;
    suggestedReply: string;
    actorId?: string;
  }) {
    return this.createDraft({
      clientId: input.clientId,
      title: `Resolved ticket: ${input.customerMessage.slice(0, 60)}`,
      answer: input.suggestedReply,
      keywords: this.extractKeywords(input.customerMessage),
      confidenceBoost: 0.04,
      actorId: input.actorId ?? 'live-learning',
      sourceTicketId: input.ticketId,
    });
  }

  async findByTemplateKey(clientId: string, templateKey: string) {
    const [entry] = await this.db
      .select()
      .from(knowledgeEntries)
      .where(and(eq(knowledgeEntries.clientId, clientId), eq(knowledgeEntries.templateKey, templateKey)))
      .limit(1);
    return entry === undefined ? null : toKnowledgeEntry(entry);
  }

  private async writeEmbedding(entry: Pick<KnowledgeEntry, 'id' | 'title' | 'answer' | 'keywords'>) {
    const embeddingText = `${entry.title}\n${entry.answer}\n${entry.keywords.join(', ')}`;
    const vector = this.embedder.toSqlVector(this.embedder.embedText(embeddingText));
    try {
      await this.db.execute(sql`
        UPDATE "KnowledgeEntry"
        SET "embedding" = ${vector}::vector,
            "embeddingText" = ${embeddingText},
            "embeddedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${entry.id}
      `);
    } catch {
      await this.db.update(knowledgeEntries).set({ embeddingText, embeddedAt: new Date() }).where(eq(knowledgeEntries.id, entry.id));
    }
  }

  private async recordVersion(
    entry: {
      id: string;
      clientId: string;
      version: number;
      title: string;
      answer: string;
      keywords: string[];
      category?: string | null;
      confidenceBoost?: number | null;
      status: string;
    },
    action: KnowledgeAction,
    actorId = 'internal-console',
  ) {
    await this.db.insert(knowledgeEntryVersions).values({
      id: randomId(),
      entryId: entry.id,
      clientId: entry.clientId,
      version: entry.version,
      title: entry.title,
      answer: entry.answer,
      keywords: entry.keywords,
      category: entry.category ?? 'general',
      confidenceBoost: entry.confidenceBoost ?? undefined,
      status: entry.status,
      action,
      actorId,
    });
  }

  private extractKeywords(text: string) {
    return Array.from(
      new Set(
        text
          .toLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .filter((token) => token.length > 2)
          .slice(0, 8),
      ),
    );
  }
}

const requestTypes = ['create', 'edit'];
const urgencies = ['normal', 'urgent'];
const reviewStatuses = ['submitted', 'in_review', 'needs_clarification', 'approved', 'edited_then_published', 'rejected', 'published'];

function assertIncludes<T extends string>(allowed: readonly T[], value: string, label: string): T {
  if (allowed.includes(value as T)) return value as T;
  throw new BadRequestError(`${label} must be one of: ${allowed.join(', ')}`);
}

export class KnowledgeChangeRequestService {
  constructor(
    private readonly db: AppDb,
    private readonly knowledge: KnowledgeService,
  ) {}

  async list(input: { clientId?: string; status?: string | 'all'; urgency?: string | 'all' } = {}) {
    const filters = [];
    if (input.clientId !== undefined) filters.push(eq(knowledgeChangeRequests.clientId, input.clientId));
    if (input.status !== undefined && input.status !== 'all') filters.push(eq(knowledgeChangeRequests.status, input.status));
    if (input.urgency !== undefined && input.urgency !== 'all') filters.push(eq(knowledgeChangeRequests.urgency, input.urgency));
    const rows = await this.db
      .select()
      .from(knowledgeChangeRequests)
      .where(filters.length === 0 ? undefined : and(...filters))
      .orderBy(desc(knowledgeChangeRequests.urgency), desc(knowledgeChangeRequests.createdAt));
    return rows.map(toKnowledgeRequest);
  }

  async find(clientId: string, requestId: string) {
    const [record] = await this.db
      .select()
      .from(knowledgeChangeRequests)
      .where(and(eq(knowledgeChangeRequests.id, requestId), eq(knowledgeChangeRequests.clientId, clientId)))
      .limit(1);
    if (record === undefined) throw new NotFoundError(`Knowledge change request not found: ${requestId}`);
    return toKnowledgeRequest(record);
  }

  async findById(requestId: string) {
    const [record] = await this.db.select().from(knowledgeChangeRequests).where(eq(knowledgeChangeRequests.id, requestId)).limit(1);
    if (record === undefined) throw new NotFoundError(`Knowledge change request not found: ${requestId}`);
    return toKnowledgeRequest(record);
  }

  async getReviewDetail(requestId: string): Promise<KnowledgeChangeRequestReviewDetail> {
    const request = await this.findById(requestId);
    const events = await this.db
      .select()
      .from(knowledgeChangeRequestEvents)
      .where(eq(knowledgeChangeRequestEvents.requestId, requestId))
      .orderBy(asc(knowledgeChangeRequestEvents.createdAt));
    const current = request.currentEntrySnapshot;
    return {
      request,
      events: events.map(toKnowledgeRequestEvent),
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
  }) {
    const requestType = assertIncludes(requestTypes, input.requestType, 'requestType');
    const urgency = assertIncludes(urgencies, input.urgency ?? 'normal', 'urgency');
    let currentEntrySnapshot: Record<string, unknown> | undefined;
    if (requestType === 'edit') {
      if (input.targetEntryId === undefined) throw new BadRequestError('targetEntryId is required for edit requests.');
      const [entry] = await this.db
        .select()
        .from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.id, input.targetEntryId), eq(knowledgeEntries.clientId, input.clientId)))
        .limit(1);
      if (entry === undefined) throw new NotFoundError(`Knowledge entry not found: ${input.targetEntryId}`);
      currentEntrySnapshot = { ...toKnowledgeEntry(entry) };
    }
    const now = new Date();
    const [created] = await this.db
      .insert(knowledgeChangeRequests)
      .values({
        id: randomId(),
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
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await this.recordEvent({
      requestId: created!.id,
      eventType: 'submitted',
      actorId: created!.submittedBy,
      note: created!.requesterNote ?? undefined,
      payload: { requestType, status: created!.status, urgency: created!.urgency },
    });
    return toKnowledgeRequest(created!);
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
  }) {
    const status = assertIncludes(reviewStatuses, input.status, 'status');
    const existing = await this.find(input.clientId, input.requestId);
    const now = new Date();
    const [updated] = await this.db
      .update(knowledgeChangeRequests)
      .set({
        status,
        reviewerNote: input.reviewerNote,
        clientVisibleMessage: input.clientVisibleMessage,
        internalNote: input.internalNote,
        reviewedBy: input.reviewedBy,
        decisionSnapshot: input.decisionSnapshot,
        reviewedAt: now,
        closedAt: status === 'rejected' || status === 'published' ? now : undefined,
        updatedAt: now,
      })
      .where(eq(knowledgeChangeRequests.id, input.requestId))
      .returning();
    await this.recordEvent({
      requestId: updated!.id,
      eventType: status,
      actorId: input.reviewedBy ?? 'internal-console',
      note: input.clientVisibleMessage ?? input.reviewerNote ?? input.internalNote,
      payload: { previousStatus: existing.status, status },
    });
    return toKnowledgeRequest(updated!);
  }

  async publish(input: {
    requestId: string;
    reviewerNote?: string;
    clientVisibleMessage?: string;
    internalNote?: string;
    reviewedBy?: string;
    finalTitle?: string;
    finalAnswer?: string;
    finalKeywords?: string[];
    finalCategory?: string;
  }) {
    const request = await this.findById(input.requestId);
    if (request.status === 'published') throw new BadRequestError('Knowledge change request has already been published.');
    if (request.status === 'rejected') throw new BadRequestError('Rejected knowledge change requests cannot be published.');

    const finalTitle = input.finalTitle?.trim() || request.proposedTitle;
    const finalAnswer = input.finalAnswer?.trim() || request.proposedAnswer;
    const finalKeywords = input.finalKeywords?.length ? input.finalKeywords : request.proposedKeywords;
    const finalCategory = input.finalCategory?.trim() || request.proposedCategory;
    const actorId = input.reviewedBy ?? 'internal-console';
    const draft =
      request.requestType === 'create'
        ? await this.knowledge.createDraft({ clientId: request.clientId, title: finalTitle, answer: finalAnswer, keywords: finalKeywords, category: finalCategory, actorId })
        : await this.knowledge.update(request.clientId, this.requireTargetEntryId(request), {
            title: finalTitle,
            answer: finalAnswer,
            keywords: finalKeywords,
            category: finalCategory,
            actorId,
          });
    const published = await this.knowledge.setStatus(request.clientId, draft.id, 'active', actorId);
    const now = new Date();
    const decisionSnapshot = { proposedTitle: finalTitle, proposedAnswer: finalAnswer, proposedKeywords: finalKeywords, proposedCategory: finalCategory };
    const [updated] = await this.db
      .update(knowledgeChangeRequests)
      .set({
        status: 'published',
        reviewerNote: input.reviewerNote,
        clientVisibleMessage: input.clientVisibleMessage,
        internalNote: input.internalNote,
        reviewedBy: actorId,
        publishedEntryId: published.id,
        decisionSnapshot,
        reviewedAt: now,
        publishedAt: now,
        closedAt: now,
        updatedAt: now,
      })
      .where(eq(knowledgeChangeRequests.id, request.id))
      .returning();
    await this.recordEvent({
      requestId: updated!.id,
      eventType: 'published',
      actorId,
      note: input.clientVisibleMessage ?? input.reviewerNote ?? input.internalNote,
      payload: { previousStatus: request.status, publishedEntryId: published.id, requestType: request.requestType },
    });
    return toKnowledgeRequest(updated!);
  }

  private requireTargetEntryId(request: KnowledgeChangeRequest) {
    if (request.targetEntryId === undefined) throw new BadRequestError('targetEntryId is required to publish edit requests.');
    return request.targetEntryId;
  }

  private async recordEvent(input: { requestId: string; eventType: string; actorId: string; note?: string; payload?: Record<string, unknown> }) {
    await this.db.insert(knowledgeChangeRequestEvents).values({
      id: randomId(),
      requestId: input.requestId,
      eventType: input.eventType,
      actorId: input.actorId,
      note: input.note,
      payload: input.payload ?? {},
    });
  }
}

const MAX_FILES = 5;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_DRAFTS_PER_IMPORT = 30;
const MAX_PAGE_CHARS = 120_000;

export class KnowledgeImportService {
  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly env: { GOOGLE_CLOUD_VISION_API_KEY?: string },
  ) {}

  async importFiles(input: { clientId: string; files: KnowledgeImportFileInput[]; actorId?: string }): Promise<KnowledgeImportResult> {
    if (input.files.length === 0) throw new BadRequestError('At least one file is required.');
    if (input.files.length > MAX_FILES) throw new BadRequestError(`Upload up to ${MAX_FILES} files per import.`);

    const skipped = [];
    const extracted = [];
    for (const file of input.files) {
      try {
        extracted.push(await this.extractFile(file));
      } catch (error) {
        skipped.push({ fileName: file.fileName, reason: error instanceof Error ? error.message : 'Unable to extract this file.' });
      }
    }
    const candidates = extracted.flatMap((file) => this.extractDraftCandidates(file.text).map((candidate) => ({ ...candidate, sourceFileName: file.fileName, sourceType: file.sourceType })));
    const imported = [];
    for (const candidate of candidates.slice(0, MAX_DRAFTS_PER_IMPORT)) {
      const entry = await this.knowledge.createDraft({
        clientId: input.clientId,
        title: candidate.title,
        answer: candidate.answer,
        keywords: candidate.keywords,
        confidenceBoost: 0.03,
        actorId: input.actorId ?? 'knowledge-import',
      });
      imported.push({ entry, sourceFileName: candidate.sourceFileName, sourceType: candidate.sourceType });
    }
    if (candidates.length > MAX_DRAFTS_PER_IMPORT) {
      skipped.push({ fileName: 'import batch', reason: `Created first ${MAX_DRAFTS_PER_IMPORT} drafts; split the remaining content into another import.` });
    }
    return { imported, skipped, extractedCharacters: extracted.reduce((total, file) => total + file.text.length, 0) };
  }

  async importPublicPage(input: { clientId: string; url: string; actorId?: string; fetchImpl?: typeof fetch }): Promise<KnowledgeImportResult> {
    const url = this.parsePublicUrl(input.url);
    const fetcher = input.fetchImpl ?? fetch;
    const response = await fetcher(url.toString(), {
      headers: {
        'User-Agent': 'Daemion-KnowledgeImporter/1.0',
        Accept: 'text/html,text/plain;q=0.9,*/*;q=0.5',
      },
    });
    if (!response.ok) throw new BadRequestError(`Public page fetch failed: ${response.status}.`);

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) {
      throw new BadRequestError('Public page import supports HTML or plain-text pages only.');
    }

    const raw = await response.text();
    const text = this.cleanText(extractReadablePageText(raw).slice(0, MAX_PAGE_CHARS));
    if (text.length < 40) throw new BadRequestError('Public page did not contain enough readable text to create drafts.');

    const candidates = this.extractDraftCandidates(text);
    const imported = [];
    for (const candidate of candidates.slice(0, MAX_DRAFTS_PER_IMPORT)) {
      const entry = await this.knowledge.createDraft({
        clientId: input.clientId,
        title: candidate.title,
        answer: candidate.answer,
        keywords: candidate.keywords,
        confidenceBoost: 0.03,
        actorId: input.actorId ?? 'page-scraper',
      });
      imported.push({ entry, sourceFileName: url.toString(), sourceType: 'public_page' });
    }
    return {
      imported,
      skipped: candidates.length > MAX_DRAFTS_PER_IMPORT
        ? [{ fileName: url.toString(), reason: `Created first ${MAX_DRAFTS_PER_IMPORT} drafts; split the remaining page content into another import.` }]
        : [],
      extractedCharacters: text.length,
    };
  }

  private parsePublicUrl(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new BadRequestError('Enter a valid public URL.');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new BadRequestError('Only public HTTP or HTTPS URLs can be imported.');
    }
    return url;
  }

  private async extractFile(file: KnowledgeImportFileInput) {
    const fileName = file.fileName.trim();
    if (fileName.length < 2) throw new Error('File name is required.');
    const bytes = decodeBase64(file.base64);
    if (bytes.length === 0) throw new Error('File is empty.');
    if (bytes.length > MAX_FILE_BYTES) throw new Error('File is larger than the 4 MB alpha limit.');
    const contentType = file.contentType?.toLowerCase() ?? '';
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

    if (this.isTextLike(contentType, extension)) {
      const text = this.cleanText(decodeBase64Text(file.base64));
      return {
        fileName,
        sourceType: this.isMessengerHistoryJson(text, extension) ? 'messenger_history' : 'text',
        text,
      };
    }
    if (this.isExcelLike(contentType, extension)) {
      return { fileName, sourceType: 'excel', text: this.cleanText(await this.extractWorkbook(bytes)) };
    }
    if (contentType.includes('pdf') || extension === 'pdf') {
      return { fileName, sourceType: 'pdf', text: this.cleanText(await this.extractPdf(bytes)) };
    }
    if (contentType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
      return { fileName, sourceType: 'image', text: this.cleanText(await this.extractImageText(file.base64, contentType)) };
    }
    throw new Error('Unsupported file type. Use TXT, CSV, TSV, Markdown, PDF, Excel, PNG, JPG, or WebP.');
  }

  private isTextLike(contentType: string, extension: string) {
    return contentType.startsWith('text/') || contentType.includes('csv') || contentType.includes('json') || ['txt', 'csv', 'tsv', 'md', 'markdown', 'json'].includes(extension);
  }

  private isExcelLike(contentType: string, extension: string) {
    return contentType.includes('spreadsheet') || contentType.includes('excel') || ['xlsx', 'xlsm', 'xls'].includes(extension);
  }

  private async extractWorkbook(bytes: Uint8Array) {
    const XLSX = await import('@e965/xlsx');
    const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
    const lines = [];
    for (const sheetName of workbook.SheetNames) {
      lines.push(`Sheet: ${sheetName}`);
      const sheet = workbook.Sheets[sheetName];
      if (sheet !== undefined) {
        lines.push(XLSX.utils.sheet_to_csv(sheet, { FS: ' | ' }));
      }
    }
    return lines.join('\n');
  }

  private async extractPdf(bytes: Uint8Array) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const document = await getDocumentProxy(bytes);
    const { text } = await extractText(document, { mergePages: true });
    return text;
  }

  private async extractImageText(base64: string, contentType: string) {
    const apiKey = this.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (apiKey === undefined || apiKey.trim() === '') {
      throw new Error('Image OCR requires GOOGLE_CLOUD_VISION_API_KEY. Upload text, PDF, or Excel until OCR is configured.');
    }
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            imageContext: contentType === 'image/webp' ? undefined : { languageHints: ['bn', 'en'] },
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Image OCR failed: ${response.status}`);
    const data = (await response.json()) as { responses?: { fullTextAnnotation?: { text?: string }; error?: { message?: string } }[] };
    const first = data.responses?.[0];
    if (first?.error?.message !== undefined) throw new Error(first.error.message);
    return first?.fullTextAnnotation?.text ?? '';
  }

  private cleanText(text: string) {
    return text.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  private extractDraftCandidates(text: string) {
    const messengerCandidates = extractMessengerHistoryCandidates(text);
    if (messengerCandidates.length > 0) return messengerCandidates;

    const blocks = text.split(/\n\s*\n/g).map((block) => block.trim()).filter((block) => block.length > 0);
    const candidates = blocks.flatMap((block) => {
      const qa = block.match(/(?:^|\n)\s*Q[:：]\s*(.+?)\s*\n\s*A[:：]\s*([\s\S]+)$/i);
      if (qa?.[1] !== undefined && qa[2] !== undefined) {
        return [{ title: qa[1].trim(), answer: qa[2].trim(), keywords: this.keywords(`${qa[1]} ${qa[2]}`) }];
      }
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length >= 2) {
        return [{ title: lines[0]!.replace(/^#+\s*/, '').slice(0, 120), answer: lines.slice(1).join('\n').slice(0, 2000), keywords: this.keywords(block) }];
      }
      return [];
    });
    return candidates.length > 0
      ? candidates
      : [{ title: 'Imported knowledge', answer: text.slice(0, 2000), keywords: this.keywords(text) }];
  }

  private keywords(text: string) {
    const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 2);
    return Array.from(new Set(tokens)).slice(0, 8);
  }

  private isMessengerHistoryJson(text: string, extension: string) {
    return extension === 'json' && extractMessengerHistoryCandidates(text).length > 0;
  }
}
