import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type {
  AgentReply,
  CalibrationQueueFilter,
  CalibrationQueueSummary,
  ConversationAutoQaGrade,
  ConversationLog,
  ConversationQaDefect,
  ConversationQaGrade,
  IncomingMessage,
  Ticket,
  TicketComment,
  TicketDetail,
  TicketPriority,
  TicketStatus,
} from '@ai-front-desk/shared';
import { transcribeVoiceAttachment } from '@ai-front-desk/shared';
import type { AppDb } from '../db/client';
import type { Env } from '../env';
import { conversations, messages, ticketComments, ticketEvents, tickets } from '../db/schema';
import { ConflictError, NotFoundError } from '../errors';
import { randomId } from '../utils/crypto';
import { AiService, AutoQaService } from './ai';
import { ClientService } from './clients';
import { ChannelSendService, UrgentTicketNotificationService } from './delivery';
import { KnowledgeService } from './knowledge';
import { LoggerService } from './logger';
import { toConversation, toTicket, toTicketComment, toTicketEvent } from './mappers';
import { PromptProfileService } from './prompts';

export class ConversationRepository {
  constructor(private readonly db: AppDb) {}

  async upsertConversation(input: Omit<ConversationLog, 'id' | 'messages' | 'hallucinationFlag' | 'autoQaDefects'>) {
    const now = new Date();
    const [existing] = await this.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.clientId, input.clientId),
          eq(conversations.channel, input.channel),
          eq(conversations.externalConversationId, input.externalConversationId),
        ),
      )
      .limit(1);
    if (existing !== undefined) {
      const [updated] = await this.db
        .update(conversations)
        .set({ externalSenderId: input.externalSenderId, updatedAt: now })
        .where(eq(conversations.id, existing.id))
        .returning();
      return this.mapConversationById(updated!.id);
    }
    const [created] = await this.db
      .insert(conversations)
      .values({
        id: randomId(),
        clientId: input.clientId,
        channel: input.channel,
        externalConversationId: input.externalConversationId,
        externalSenderId: input.externalSenderId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toConversation(created!, []);
  }

  async addMessage(conversationId: string, message: {
    id: string;
    direction: 'inbound' | 'outbound';
    text: string;
    attachmentType?: string;
    attachmentUrl?: string;
    transcript?: string;
    extractedText?: string;
    matchedProducts?: unknown;
    createdAt: string;
  }) {
    await this.db
      .insert(messages)
      .values({ ...message, conversationId, createdAt: new Date(message.createdAt) })
      .onConflictDoUpdate({
        target: messages.id,
        set: {
          text: message.text,
          attachmentType: message.attachmentType,
          attachmentUrl: message.attachmentUrl,
          transcript: message.transcript,
          extractedText: message.extractedText,
          matchedProducts: message.matchedProducts,
        },
      });
  }

  async messageExists(messageId: string) {
    const [row] = await this.db.select({ id: messages.id }).from(messages).where(eq(messages.id, messageId)).limit(1);
    return row !== undefined;
  }

  async setConversationResult(conversationId: string, input: { lastConfidence: number; ticketId?: string }) {
    await this.db.update(conversations).set({ ...input, updatedAt: new Date() }).where(eq(conversations.id, conversationId));
  }

  async attachTicketToConversation(conversationId: string, ticketId: string) {
    await this.db.update(conversations).set({ ticketId, updatedAt: new Date() }).where(eq(conversations.id, conversationId));
  }

  async saveTicket(ticket: Ticket) {
    const createdAt = new Date(ticket.createdAt);
    const updatedAt = new Date(ticket.updatedAt);
    const [saved] = await this.db
      .insert(tickets)
      .values({
        id: ticket.id,
        clientId: ticket.clientId,
        conversationId: ticket.conversationId,
        assigneeId: ticket.assigneeId,
        version: ticket.version,
        priority: ticket.priority,
        status: ticket.status,
        reason: ticket.reason,
        customerMessage: ticket.customerMessage,
        suggestedReply: ticket.suggestedReply,
        salesRecoveredEstimate: ticket.salesRecoveredEstimate,
        createdAt,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: tickets.id,
        set: {
          priority: ticket.priority,
          status: ticket.status,
          reason: ticket.reason,
          customerMessage: ticket.customerMessage,
          suggestedReply: ticket.suggestedReply,
          salesRecoveredEstimate: ticket.salesRecoveredEstimate,
          assigneeId: ticket.assigneeId,
          updatedAt,
        },
      })
      .returning();
    await this.db
      .insert(ticketEvents)
      .values({
        id: `${ticket.id}:created`,
        ticketId: ticket.id,
        eventType: 'ticket.created',
        payload: { priority: ticket.priority, reason: ticket.reason },
        createdAt,
      })
      .onConflictDoNothing();
    return toTicket(saved!);
  }

  async listConversations() {
    const rows = await this.db.select().from(conversations).orderBy(desc(conversations.updatedAt));
    const result = [];
    for (const row of rows) result.push(await this.mapConversationById(row.id));
    return result;
  }

  async getConversationById(conversationId: string) {
    const [conversation] = await this.db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (conversation === undefined) return null;
    return this.mapConversationById(conversationId);
  }

  async listTickets() {
    const rows = await this.db.select().from(tickets).orderBy(desc(tickets.updatedAt));
    return rows.map(toTicket);
  }

  async getTicketDetail(ticketId: string): Promise<TicketDetail | null> {
    const [ticket] = await this.db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
    if (ticket === undefined) return null;
    const events = await this.db.select().from(ticketEvents).where(eq(ticketEvents.ticketId, ticketId)).orderBy(asc(ticketEvents.createdAt));
    const comments = await this.db.select().from(ticketComments).where(eq(ticketComments.ticketId, ticketId)).orderBy(desc(ticketComments.createdAt));
    return { ticket: toTicket(ticket), events: events.map(toTicketEvent), comments: comments.map(toTicketComment) };
  }

  async updateTicketStatus(input: { ticketId: string; status: TicketStatus; actorId: string; expectedVersion?: number }) {
    const now = new Date();
    const where = input.expectedVersion === undefined
      ? eq(tickets.id, input.ticketId)
      : and(eq(tickets.id, input.ticketId), eq(tickets.version, input.expectedVersion));
    const [ticket] = await this.db
      .update(tickets)
      .set({ status: input.status, version: sql`${tickets.version} + 1`, updatedAt: now })
      .where(where)
      .returning();
    if (ticket === undefined) throw new ConflictError(`Ticket update conflict: ${input.ticketId}`);
    await this.db.insert(ticketEvents).values({
      id: `${input.ticketId}:status:${input.status}:${Date.now()}`,
      ticketId: input.ticketId,
      eventType: 'ticket.status_updated',
      payload: { status: input.status, actorId: input.actorId },
      createdAt: now,
    });
    return toTicket(ticket);
  }

  async updateTicketAssignee(input: { ticketId: string; assigneeId?: string; actorId: string; expectedVersion?: number }) {
    const now = new Date();
    const assigneeId = input.assigneeId?.trim() === '' ? undefined : input.assigneeId;
    const where = input.expectedVersion === undefined
      ? eq(tickets.id, input.ticketId)
      : and(eq(tickets.id, input.ticketId), eq(tickets.version, input.expectedVersion));
    const [ticket] = await this.db
      .update(tickets)
      .set({ assigneeId, version: sql`${tickets.version} + 1`, updatedAt: now })
      .where(where)
      .returning();
    if (ticket === undefined) throw new ConflictError(`Ticket update conflict: ${input.ticketId}`);
    await this.db.insert(ticketEvents).values({
      id: `${input.ticketId}:assignee:${assigneeId ?? 'unassigned'}:${Date.now()}`,
      ticketId: input.ticketId,
      eventType: 'ticket.assignee_updated',
      payload: { assigneeId: assigneeId ?? null, actorId: input.actorId },
      createdAt: now,
    });
    return toTicket(ticket);
  }

  async addTicketComment(input: { ticketId: string; body: string; authorId: string }): Promise<TicketComment> {
    const now = new Date();
    const [ticket] = await this.db.select().from(tickets).where(eq(tickets.id, input.ticketId)).limit(1);
    if (ticket === undefined) throw new NotFoundError(`Ticket not found: ${input.ticketId}`);
    const [comment] = await this.db
      .insert(ticketComments)
      .values({ id: randomId(), ticketId: input.ticketId, body: input.body, authorId: input.authorId, createdAt: now })
      .returning();
    await this.db.insert(ticketEvents).values({
      id: `${input.ticketId}:comment:${comment!.id}`,
      ticketId: input.ticketId,
      eventType: 'ticket.comment_added',
      payload: { commentId: comment!.id, authorId: input.authorId },
      createdAt: now,
    });
    await this.db.update(tickets).set({ updatedAt: now, version: sql`${tickets.version} + 1` }).where(eq(tickets.id, input.ticketId));
    return toTicketComment(comment!);
  }

  async recordTicketEvent(input: { ticketId: string; eventType: string; payload: Record<string, unknown> }) {
    const [event] = await this.db
      .insert(ticketEvents)
      .values({
        id: `${input.ticketId}:${input.eventType}:${randomId()}`,
        ticketId: input.ticketId,
        eventType: input.eventType,
        payload: input.payload,
        createdAt: new Date(),
      })
      .returning();
    return toTicketEvent(event!);
  }

  async captureCsatByExternalConversation(input: {
    clientId: string;
    channel: ConversationLog['channel'];
    externalConversationId: string;
    score: number;
    comment?: string;
  }) {
    const [conversation] = await this.db
      .update(conversations)
      .set({ csatScore: input.score, csatComment: input.comment, csatAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(conversations.clientId, input.clientId),
          eq(conversations.channel, input.channel),
          eq(conversations.externalConversationId, input.externalConversationId),
        ),
      )
      .returning();
    return conversation === undefined ? null : this.mapConversationById(conversation.id);
  }

  async updateConversationQa(input: { conversationId: string; qaGrade?: ConversationQaGrade; hallucinationFlag: boolean; actorId: string }) {
    const [conversation] = await this.db
      .update(conversations)
      .set({ qaGrade: input.qaGrade, hallucinationFlag: input.hallucinationFlag, gradedBy: input.actorId, gradedAt: new Date(), updatedAt: new Date() })
      .where(eq(conversations.id, input.conversationId))
      .returning();
    if (conversation === undefined) throw new NotFoundError(`Conversation not found: ${input.conversationId}`);
    return this.mapConversationById(conversation.id);
  }

  async updateConversationAutoQa(input: {
    conversationId: string;
    score: number;
    grade: ConversationAutoQaGrade;
    defects: ConversationQaDefect[];
    reason: string;
    version: string;
  }) {
    const [conversation] = await this.db
      .update(conversations)
      .set({
        autoQaScore: input.score,
        autoQaGrade: input.grade,
        autoQaDefects: input.defects,
        autoQaReason: input.reason,
        autoQaAt: new Date(),
        autoQaVersion: input.version,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, input.conversationId))
      .returning();
    if (conversation === undefined) throw new NotFoundError(`Conversation not found: ${input.conversationId}`);
    return this.mapConversationById(conversation.id);
  }

  async listCalibrationQueue(input: { filter: CalibrationQueueFilter; limit: number }) {
    const rows = await this.db.select().from(conversations).orderBy(desc(conversations.updatedAt)).limit(Math.max(input.limit * 3, 100));
    const full = [];
    for (const row of rows) full.push(await this.mapConversationById(row.id));
    const ranked = full
      .filter((conversation) => this.matchesCalibrationFilter(conversation, input.filter))
      .sort((a, b) => this.calibrationPriority(b) - this.calibrationPriority(a))
      .slice(0, input.limit);
    return { filter: input.filter, conversations: ranked, summary: this.buildCalibrationSummary(full) };
  }

  private async mapConversationById(conversationId: string) {
    const [conversation] = await this.db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (conversation === undefined) throw new NotFoundError(`Conversation not found: ${conversationId}`);
    const messageRows = await this.db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
    return toConversation(conversation, messageRows);
  }

  private matchesCalibrationFilter(conversation: ConversationLog, filter: CalibrationQueueFilter) {
    const ungraded = conversation.qaGrade === undefined;
    const defects = conversation.autoQaDefects;
    const failed = conversation.autoQaGrade === 'fail';
    const needsReview =
      ungraded &&
      (failed ||
        conversation.autoQaGrade === 'review' ||
        defects.includes('hallucination_risk') ||
        defects.includes('escalation_miss') ||
        (conversation.lastConfidence ?? 1) <= 0.65 ||
        conversation.ticketId !== undefined);
    if (filter === 'all') return true;
    if (filter === 'ungraded') return ungraded;
    if (filter === 'needs_review') return needsReview;
    if (filter === 'failed') return ungraded && failed;
    if (filter === 'hallucination') return ungraded && (defects.includes('hallucination_risk') || conversation.hallucinationFlag);
    if (filter === 'escalation') return ungraded && (defects.includes('escalation_needed') || defects.includes('escalation_miss'));
    return needsReview;
  }

  private calibrationPriority(conversation: ConversationLog) {
    let priority = 0;
    if (conversation.qaGrade === undefined) priority += 100;
    if (conversation.autoQaGrade === 'fail') priority += 80;
    if (conversation.autoQaGrade === 'review') priority += 45;
    if (conversation.autoQaDefects.includes('hallucination_risk')) priority += 35;
    if (conversation.autoQaDefects.includes('escalation_miss')) priority += 40;
    if (conversation.ticketId !== undefined) priority += 15;
    if ((conversation.lastConfidence ?? 1) <= 0.65) priority += 15;
    priority += 100 - (conversation.autoQaScore ?? 100);
    return priority;
  }

  private buildCalibrationSummary(conversationsList: ConversationLog[]): CalibrationQueueSummary {
    return {
      total: conversationsList.length,
      ungraded: conversationsList.filter((conversation) => conversation.qaGrade === undefined).length,
      failed: conversationsList.filter((conversation) => conversation.autoQaGrade === 'fail').length,
      review: conversationsList.filter((conversation) => conversation.autoQaGrade === 'review').length,
      hallucinationRisk: conversationsList.filter((conversation) => conversation.autoQaDefects.includes('hallucination_risk')).length,
      escalationRisk: conversationsList.filter((conversation) => conversation.autoQaDefects.includes('escalation_needed') || conversation.autoQaDefects.includes('escalation_miss')).length,
    };
  }
}

export class TicketService {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly knowledge: KnowledgeService,
    private readonly logger = new LoggerService(),
  ) {}

  async createFromEscalation(input: { message: IncomingMessage; conversationId: string; reply: AgentReply }) {
    const now = new Date().toISOString();
    const priority = this.getPriority(input.reply.escalationReason ?? '');
    return this.repository.saveTicket({
      id: randomId(),
      clientId: input.message.clientId,
      conversationId: input.conversationId,
      version: 0,
      priority,
      status: 'open',
      reason: input.reply.escalationReason ?? 'Escalated by AI',
      customerMessage: input.message.text,
      suggestedReply: input.reply.text,
      salesRecoveredEstimate: this.estimateRecoveredSales(priority),
      createdAt: now,
      updatedAt: now,
    });
  }

  async createFromManualTakeover(input: { conversationId: string; actorId?: string }) {
    const conversation = await this.repository.getConversationById(input.conversationId);
    if (conversation === null) throw new NotFoundError('Conversation not found.');
    if (conversation.ticketId !== undefined) {
      const existing = await this.repository.getTicketDetail(conversation.ticketId);
      if (existing !== null) return existing.ticket;
    }
    const now = new Date().toISOString();
    const lastInbound = [...conversation.messages].reverse().find((message) => message.direction === 'inbound');
    const lastOutbound = [...conversation.messages].reverse().find((message) => message.direction === 'outbound');
    const ticket = await this.repository.saveTicket({
      id: randomId(),
      clientId: conversation.clientId,
      conversationId: conversation.id,
      version: 0,
      priority: 'P2',
      status: 'assigned',
      reason: 'Manual operator takeover requested',
      customerMessage: lastInbound?.text ?? 'Manual takeover requested from the conversation view.',
      suggestedReply: lastOutbound?.text ?? 'Review the conversation and reply directly to the customer before closing the ticket.',
      salesRecoveredEstimate: this.estimateRecoveredSales('P2'),
      createdAt: now,
      updatedAt: now,
    });
    await this.repository.attachTicketToConversation(conversation.id, ticket.id);
    await this.repository.recordTicketEvent({
      ticketId: ticket.id,
      eventType: 'ticket.manual_takeover_requested',
      payload: { actorId: input.actorId ?? 'internal-console', conversationId: conversation.id },
    });
    return ticket;
  }

  async updateStatus(input: { ticketId: string; status: TicketStatus; actorId?: string; expectedVersion?: number }) {
    const ticket = await this.repository.updateTicketStatus({
      ticketId: input.ticketId,
      status: input.status,
      actorId: input.actorId ?? 'internal-operator',
      expectedVersion: input.expectedVersion,
    });
    if (input.status === 'resolved') {
      try {
        const detail = await this.repository.getTicketDetail(ticket.id);
        const operatorComment = detail?.comments.find((comment) => comment.body.trim() !== '');
        await this.knowledge.harvestFromResolvedTicket({
          clientId: ticket.clientId,
          ticketId: ticket.id,
          customerMessage: ticket.customerMessage,
          suggestedReply: operatorComment?.body ?? ticket.suggestedReply,
          actorId: input.actorId ?? 'live-learning',
        });
      } catch (error) {
        this.logger.event('knowledge.live_learning.failed', { ticketId: ticket.id, error: error instanceof Error ? error.message : 'Unknown error' }, 'error');
      }
    }
    return ticket;
  }

  async getDetail(ticketId: string) {
    return this.repository.getTicketDetail(ticketId);
  }

  async updateAssignee(input: { ticketId: string; assigneeId?: string; actorId?: string; expectedVersion?: number }) {
    return this.repository.updateTicketAssignee({
      ticketId: input.ticketId,
      assigneeId: input.assigneeId,
      actorId: input.actorId ?? 'internal-operator',
      expectedVersion: input.expectedVersion,
    });
  }

  async addComment(input: { ticketId: string; body: string; authorId?: string }) {
    return this.repository.addTicketComment({ ticketId: input.ticketId, body: input.body, authorId: input.authorId ?? 'internal-operator' });
  }

  private getPriority(reason: string): TicketPriority {
    const normalizedReason = reason.toLowerCase();
    if (normalizedReason.includes('refund') || normalizedReason.includes('complaint') || normalizedReason.includes('angry') || normalizedReason.includes('রিফান্ড') || normalizedReason.includes('অভিযোগ')) return 'P1';
    if (normalizedReason.includes('low knowledge confidence')) return 'P2';
    return 'P3';
  }

  private estimateRecoveredSales(priority: TicketPriority) {
    if (priority === 'P1') return 2500;
    if (priority === 'P2') return 1200;
    return 500;
  }
}

export class ConversationService {
  constructor(
    private readonly ai: AiService,
    private readonly clients: ClientService,
    private readonly knowledge: KnowledgeService,
    private readonly repository: ConversationRepository,
    private readonly tickets: TicketService,
    private readonly prompts: PromptProfileService,
    private readonly channelSend: ChannelSendService,
    private readonly logger = new LoggerService(),
    private readonly urgentNotifications?: UrgentTicketNotificationService,
    private readonly env?: Env,
    private readonly autoQa = new AutoQaService(),
  ) {}

  async handleIncomingMessage(message: IncomingMessage) {
    const conversation = await this.repository.upsertConversation({
      clientId: message.clientId,
      channel: message.channel,
      externalConversationId: message.externalConversationId,
      externalSenderId: message.externalSenderId,
    });
    const outboundMessageId = `reply:${message.id}`;
    if (await this.repository.messageExists(outboundMessageId)) {
      return {
        conversation,
        reply: { text: '', confidence: conversation.lastConfidence ?? 1, matchedKnowledgeIds: [], shouldEscalate: false },
        alreadyProcessed: true,
      };
    }

    const enrichedMessage = await this.enrichVoiceMessage(message);
    await this.repository.addMessage(conversation.id, {
      id: enrichedMessage.id,
      direction: 'inbound',
      text: enrichedMessage.text,
      attachmentType: enrichedMessage.attachmentType,
      attachmentUrl: enrichedMessage.attachmentUrl,
      transcript: enrichedMessage.transcript,
      createdAt: enrichedMessage.receivedAt,
    });
    const client = await this.clients.findById(message.clientId);
    const customerText = [enrichedMessage.text, enrichedMessage.transcript]
      .filter((part): part is string => part !== undefined && part.trim().length > 0)
      .join('\n')
      .trim();
    const match = await this.knowledge.findRelevant(client.id, customerText);
    const promptProfile = await this.prompts.getActiveForClient(client, {
      experimentKey: enrichedMessage.externalSenderId,
    });
    const reply = await this.ai.generateReply({ client, customerText, knowledgeEntries: match.entries, promptProfile, retrievalConfidence: match.confidence });
    await this.repository.addMessage(conversation.id, { id: outboundMessageId, direction: 'outbound', text: reply.text, createdAt: new Date().toISOString() });
    const ticket = reply.shouldEscalate ? await this.tickets.createFromEscalation({ message: enrichedMessage, conversationId: conversation.id, reply }) : undefined;
    if (ticket !== undefined) {
      await this.notifyPocForUrgentTicket(client, ticket);
    }
    await this.repository.setConversationResult(conversation.id, { lastConfidence: reply.confidence, ticketId: ticket?.id });
    await this.scoreConversation({ conversationId: conversation.id, customerText, reply, ticket });
    return { conversation, reply, ticket };
  }

  private async enrichVoiceMessage(message: IncomingMessage): Promise<IncomingMessage> {
    if (message.attachmentType !== 'voice') return message;
    const result = await transcribeVoiceAttachment({
      attachmentUrl: message.attachmentUrl,
      openAiApiKey: this.env?.OPENAI_API_KEY ?? this.env?.ASR_OPENAI_API_KEY,
      model: this.env?.ASR_TRANSCRIPTION_MODEL,
      prompt: this.env?.ASR_TRANSCRIPTION_PROMPT ?? 'English customer support. Transcribe customer speech accurately and preserve proper nouns and product names.',
      whatsAppAccessToken: this.env?.WHATSAPP_ACCESS_TOKEN,
      graphVersion: this.env?.WHATSAPP_GRAPH_VERSION ?? this.env?.MESSENGER_GRAPH_VERSION,
    });
    this.logger.event('conversation.voice_transcription', {
      clientId: message.clientId,
      channel: message.channel,
      status: result.status,
      reason: result.status === 'transcribed' ? undefined : result.reason,
    }, result.status === 'failed' ? 'warn' : 'log');
    if (result.status !== 'transcribed') return message;
    return {
      ...message,
      transcript: result.transcript,
      text: message.text.includes('Transcript pending') ? `Customer voice note transcript: ${result.transcript}` : message.text,
    };
  }

  listConversations() {
    return this.repository.listConversations();
  }

  listTickets() {
    return this.repository.listTickets();
  }

  listCalibrationQueue(input: { filter?: CalibrationQueueFilter; limit?: number }) {
    return this.repository.listCalibrationQueue({ filter: input.filter ?? 'needs_review', limit: Math.max(1, Math.min(input.limit ?? 100, 200)) });
  }

  async captureCsatFromChannel(input: { clientId: string; channel: IncomingMessage['channel']; externalConversationId: string; score: number; comment?: string }) {
    const conversation = await this.repository.captureCsatByExternalConversation(input);
    this.logger.event('conversation.csat_captured', { clientId: input.clientId, channel: input.channel, externalConversationId: input.externalConversationId, score: input.score, found: conversation !== null });
    return conversation;
  }

  gradeConversation(input: { conversationId: string; qaGrade?: ConversationQaGrade; hallucinationFlag: boolean; actorId?: string }) {
    return this.repository.updateConversationQa({ conversationId: input.conversationId, qaGrade: input.qaGrade, hallucinationFlag: input.hallucinationFlag, actorId: input.actorId ?? 'internal-qa' });
  }

  takeOverConversation(input: { conversationId: string; actorId?: string }) {
    return this.tickets.createFromManualTakeover(input);
  }

  private async scoreConversation(input: { conversationId: string; customerText: string; reply: AgentReply; ticket?: Ticket }) {
    try {
      const result = this.autoQa.score(input);
      await this.repository.updateConversationAutoQa({ conversationId: input.conversationId, ...result });
    } catch (error) {
      this.logger.event('conversation.auto_qa_failed', { conversationId: input.conversationId, error: error instanceof Error ? error.message : 'Unknown auto QA failure' }, 'error');
    }
  }

  private async notifyPocForUrgentTicket(client: Parameters<UrgentTicketNotificationService['notifyP1']>[0]['client'], ticket: Ticket) {
    if (ticket.priority !== 'P1' || this.urgentNotifications === undefined) return;
    try {
      const result = await this.urgentNotifications.notifyP1({ client, ticket });
      await this.repository.recordTicketEvent({
        ticketId: ticket.id,
        eventType: 'ticket.p1_whatsapp_ping',
        payload: { mode: result.mode, channel: result.channel, recipient: result.recipient, reason: result.reason },
      });
    } catch (error) {
      await this.repository.recordTicketEvent({ ticketId: ticket.id, eventType: 'ticket.p1_whatsapp_ping_failed', payload: { message: error instanceof Error ? error.message : 'Unknown P1 notification failure' } });
    }
  }
}
