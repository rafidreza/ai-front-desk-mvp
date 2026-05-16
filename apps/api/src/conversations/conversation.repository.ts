import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import {
  CalibrationQueueFilter,
  CalibrationQueueResult,
  CalibrationQueueSummary,
  ConversationLog,
  ConversationAutoQaGrade,
  ConversationMessage,
  ConversationQaDefect,
  ConversationQaGrade,
  Ticket,
  TicketComment,
  TicketDetail,
  TicketEvent,
  TicketStatus,
} from '../types/domain';

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma?: PrismaService) {}

  private readonly conversations = new Map<string, ConversationLog>();
  private readonly tickets = new Map<string, Ticket>();
  private readonly ticketEvents = new Map<string, TicketEvent[]>();
  private readonly ticketComments = new Map<string, TicketComment[]>();

  async upsertConversation(
    input: Omit<
      ConversationLog,
      | 'id'
      | 'messages'
      | 'hallucinationFlag'
      | 'qaGrade'
      | 'gradedBy'
      | 'gradedAt'
      | 'autoQaScore'
      | 'autoQaGrade'
      | 'autoQaDefects'
      | 'autoQaReason'
      | 'autoQaAt'
      | 'autoQaVersion'
    >,
  ): Promise<ConversationLog> {
    if (this.prisma?.enabled === true) {
      const conversation = await this.prisma.conversation.upsert({
        where: {
          clientId_channel_externalConversationId: {
            clientId: input.clientId,
            channel: input.channel,
            externalConversationId: input.externalConversationId,
          },
        },
        update: {
          externalSenderId: input.externalSenderId,
        },
        create: {
          id: randomUUID(),
          ...input,
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      return {
        id: conversation.id,
        clientId: conversation.clientId,
        channel: conversation.channel as ConversationLog['channel'],
        externalConversationId: conversation.externalConversationId,
        externalSenderId: conversation.externalSenderId,
        lastConfidence: conversation.lastConfidence ?? undefined,
        ticketId: conversation.ticketId ?? undefined,
        csatScore: conversation.csatScore ?? undefined,
        csatComment: conversation.csatComment ?? undefined,
        csatAt: conversation.csatAt?.toISOString(),
        qaGrade: (conversation.qaGrade as ConversationQaGrade | null) ?? undefined,
        hallucinationFlag: conversation.hallucinationFlag,
        gradedBy: conversation.gradedBy ?? undefined,
        gradedAt: conversation.gradedAt?.toISOString(),
        autoQaScore: conversation.autoQaScore ?? undefined,
        autoQaGrade: (conversation.autoQaGrade as ConversationAutoQaGrade | null) ?? undefined,
        autoQaDefects: conversation.autoQaDefects as ConversationQaDefect[],
        autoQaReason: conversation.autoQaReason ?? undefined,
        autoQaAt: conversation.autoQaAt?.toISOString(),
        autoQaVersion: conversation.autoQaVersion ?? undefined,
        messages: conversation.messages.map((message) => ({
          id: message.id,
          direction: message.direction as ConversationMessage['direction'],
          text: message.text,
          createdAt: message.createdAt.toISOString(),
        })),
      };
    }

    const existing = [...this.conversations.values()].find(
      (conversation) =>
        conversation.clientId === input.clientId &&
        conversation.channel === input.channel &&
        conversation.externalConversationId === input.externalConversationId,
    );
    if (existing !== undefined) {
      return existing;
    }

    const conversation: ConversationLog = {
      id: randomUUID(),
      ...input,
      messages: [],
      hallucinationFlag: false,
      autoQaDefects: [],
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async addMessage(conversationId: string, message: ConversationMessage): Promise<void> {
    if (this.prisma?.enabled === true) {
      await this.prisma.message.upsert({
        where: { id: message.id },
        update: {
          text: message.text,
        },
        create: {
          ...message,
          conversationId,
          createdAt: new Date(message.createdAt),
        },
      });
      return;
    }

    const conversation = this.getConversation(conversationId);
    conversation.messages.push(message);
  }

  async messageExists(messageId: string): Promise<boolean> {
    if (this.prisma?.enabled === true) {
      const count = await this.prisma.message.count({ where: { id: messageId } });
      return count > 0;
    }

    return [...this.conversations.values()].some((conversation) =>
      conversation.messages.some((message) => message.id === messageId),
    );
  }

  async setConversationResult(
    conversationId: string,
    input: { lastConfidence: number; ticketId?: string },
  ): Promise<void> {
    if (this.prisma?.enabled === true) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: input,
      });
      return;
    }

    const conversation = this.getConversation(conversationId);
    conversation.lastConfidence = input.lastConfidence;
    if (input.ticketId !== undefined) {
      conversation.ticketId = input.ticketId;
    }
  }

  async saveTicket(ticket: Ticket): Promise<Ticket> {
    const createdEvent: TicketEvent = {
      id: `${ticket.id}:created`,
      ticketId: ticket.id,
      eventType: 'ticket.created',
      payload: {
        priority: ticket.priority,
        reason: ticket.reason,
      },
      createdAt: ticket.createdAt,
    };

    if (this.prisma?.enabled === true) {
      const saved = await this.prisma.ticket.upsert({
        where: { id: ticket.id },
        update: {
          priority: ticket.priority,
          status: ticket.status,
          reason: ticket.reason,
          customerMessage: ticket.customerMessage,
          suggestedReply: ticket.suggestedReply,
          salesRecoveredEstimate: ticket.salesRecoveredEstimate,
          assigneeId: ticket.assigneeId,
          updatedAt: new Date(ticket.updatedAt),
        },
        create: {
          ...ticket,
          createdAt: new Date(ticket.createdAt),
          updatedAt: new Date(ticket.updatedAt),
          events: {
            create: {
              id: `${ticket.id}:created`,
              eventType: 'ticket.created',
              payload: {
                priority: ticket.priority,
                reason: ticket.reason,
              },
            },
          },
        },
      });

      return {
        ...saved,
        assigneeId: saved.assigneeId ?? undefined,
        version: saved.version,
        priority: saved.priority as Ticket['priority'],
        status: saved.status as Ticket['status'],
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      };
    }

    this.tickets.set(ticket.id, ticket);
    this.ticketEvents.set(ticket.id, [createdEvent]);
    return ticket;
  }

  async listConversations(): Promise<ConversationLog[]> {
    if (this.prisma?.enabled === true) {
      const conversations = await this.prisma.conversation.findMany({
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
      });

      return conversations.map((conversation) => ({
        id: conversation.id,
        clientId: conversation.clientId,
        channel: conversation.channel as ConversationLog['channel'],
        externalConversationId: conversation.externalConversationId,
        externalSenderId: conversation.externalSenderId,
        lastConfidence: conversation.lastConfidence ?? undefined,
        ticketId: conversation.ticketId ?? undefined,
        csatScore: conversation.csatScore ?? undefined,
        csatComment: conversation.csatComment ?? undefined,
        csatAt: conversation.csatAt?.toISOString(),
        qaGrade: (conversation.qaGrade as ConversationQaGrade | null) ?? undefined,
        hallucinationFlag: conversation.hallucinationFlag,
        gradedBy: conversation.gradedBy ?? undefined,
        gradedAt: conversation.gradedAt?.toISOString(),
        autoQaScore: conversation.autoQaScore ?? undefined,
        autoQaGrade: (conversation.autoQaGrade as ConversationAutoQaGrade | null) ?? undefined,
        autoQaDefects: conversation.autoQaDefects as ConversationQaDefect[],
        autoQaReason: conversation.autoQaReason ?? undefined,
        autoQaAt: conversation.autoQaAt?.toISOString(),
        autoQaVersion: conversation.autoQaVersion ?? undefined,
        messages: conversation.messages.map((message) => ({
          id: message.id,
          direction: message.direction as ConversationMessage['direction'],
          text: message.text,
          createdAt: message.createdAt.toISOString(),
        })),
      }));
    }

    return [...this.conversations.values()];
  }

  async listCalibrationQueue(input: {
    filter: CalibrationQueueFilter;
    limit: number;
  }): Promise<CalibrationQueueResult> {
    const conversations =
      this.prisma?.enabled === true
        ? (
            await this.prisma.conversation.findMany({
              include: { messages: { orderBy: { createdAt: 'asc' } } },
              orderBy: { updatedAt: 'desc' },
              take: Math.max(input.limit * 3, 100),
            })
          ).map((conversation) => this.mapConversation(conversation))
        : [...this.conversations.values()];

    const ranked = conversations
      .filter((conversation) => this.matchesCalibrationFilter(conversation, input.filter))
      .sort((a, b) => this.calibrationPriority(b) - this.calibrationPriority(a))
      .slice(0, input.limit);

    return {
      filter: input.filter,
      conversations: ranked,
      summary: this.buildCalibrationSummary(conversations),
    };
  }

  async listTickets(): Promise<Ticket[]> {
    if (this.prisma?.enabled === true) {
      const tickets = await this.prisma.ticket.findMany({ orderBy: { updatedAt: 'desc' } });
      return tickets.map((ticket) => ({
        id: ticket.id,
        clientId: ticket.clientId,
        conversationId: ticket.conversationId,
        assigneeId: ticket.assigneeId ?? undefined,
        version: ticket.version,
        priority: ticket.priority as Ticket['priority'],
        status: ticket.status as Ticket['status'],
        reason: ticket.reason,
        customerMessage: ticket.customerMessage,
        suggestedReply: ticket.suggestedReply,
        salesRecoveredEstimate: ticket.salesRecoveredEstimate,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      }));
    }

    return [...this.tickets.values()];
  }

  async getTicketDetail(ticketId: string): Promise<TicketDetail | null> {
    if (this.prisma?.enabled === true) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          events: {
            orderBy: { createdAt: 'asc' },
          },
          comments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (ticket === null) {
        return null;
      }

      return {
        ticket: {
          id: ticket.id,
          clientId: ticket.clientId,
          conversationId: ticket.conversationId,
          assigneeId: ticket.assigneeId ?? undefined,
          version: ticket.version,
          priority: ticket.priority as Ticket['priority'],
          status: ticket.status as Ticket['status'],
          reason: ticket.reason,
          customerMessage: ticket.customerMessage,
          suggestedReply: ticket.suggestedReply,
          salesRecoveredEstimate: ticket.salesRecoveredEstimate,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
        },
        events: ticket.events.map((event) => ({
          id: event.id,
          ticketId: event.ticketId,
          eventType: event.eventType,
          payload: event.payload as Record<string, unknown>,
          createdAt: event.createdAt.toISOString(),
        })),
        comments: ticket.comments.map((comment) => ({
          id: comment.id,
          ticketId: comment.ticketId,
          body: comment.body,
          authorId: comment.authorId,
          createdAt: comment.createdAt.toISOString(),
        })),
      };
    }

    const ticket = this.tickets.get(ticketId);
    if (ticket === undefined) {
      return null;
    }

    return {
      ticket,
      events: this.ticketEvents.get(ticketId) ?? [],
      comments: this.ticketComments.get(ticketId) ?? [],
    };
  }

  async updateTicketStatus(input: {
    ticketId: string;
    status: TicketStatus;
    actorId: string;
    expectedVersion?: number;
  }): Promise<Ticket> {
    const now = new Date().toISOString();
    const event: TicketEvent = {
      id: `${input.ticketId}:status:${input.status}:${Date.now()}`,
      ticketId: input.ticketId,
      eventType: 'ticket.status_updated',
      payload: {
        status: input.status,
        actorId: input.actorId,
      },
      createdAt: now,
    };

    if (this.prisma?.enabled === true) {
      const ticket = await this.prisma.$transaction(async (tx) => {
        const result = await tx.ticket.updateMany({
          where: {
            id: input.ticketId,
            ...(input.expectedVersion === undefined ? {} : { version: input.expectedVersion }),
          },
          data: {
            status: input.status,
            version: { increment: 1 },
            updatedAt: new Date(now),
          },
        });
        if (result.count === 0) {
          throw new ConflictException(`Ticket update conflict: ${input.ticketId}`);
        }
        await tx.ticketEvent.create({
          data: {
            id: event.id,
            ticketId: input.ticketId,
            eventType: event.eventType,
            payload: event.payload as Prisma.InputJsonValue,
            createdAt: new Date(event.createdAt),
          },
        });
        return tx.ticket.findUniqueOrThrow({ where: { id: input.ticketId } });
      });

      return {
        id: ticket.id,
        clientId: ticket.clientId,
        conversationId: ticket.conversationId,
        assigneeId: ticket.assigneeId ?? undefined,
        version: ticket.version,
        priority: ticket.priority as Ticket['priority'],
        status: ticket.status as Ticket['status'],
        reason: ticket.reason,
        customerMessage: ticket.customerMessage,
        suggestedReply: ticket.suggestedReply,
        salesRecoveredEstimate: ticket.salesRecoveredEstimate,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      };
    }

    const ticket = this.tickets.get(input.ticketId);
    if (ticket === undefined) {
      throw new Error(`Ticket not found: ${input.ticketId}`);
    }

    const updatedTicket: Ticket = {
      ...ticket,
      status: input.status,
      version: ticket.version + 1,
      updatedAt: now,
    };
    this.tickets.set(input.ticketId, updatedTicket);
    this.ticketEvents.set(input.ticketId, [...(this.ticketEvents.get(input.ticketId) ?? []), event]);
    return updatedTicket;
  }

  async updateTicketAssignee(input: {
    ticketId: string;
    assigneeId?: string;
    actorId: string;
    expectedVersion?: number;
  }): Promise<Ticket> {
    const now = new Date().toISOString();
    const assigneeId = input.assigneeId?.trim() === '' ? undefined : input.assigneeId;
    const event: TicketEvent = {
      id: `${input.ticketId}:assignee:${assigneeId ?? 'unassigned'}:${Date.now()}`,
      ticketId: input.ticketId,
      eventType: 'ticket.assignee_updated',
      payload: {
        assigneeId: assigneeId ?? null,
        actorId: input.actorId,
      },
      createdAt: now,
    };

    if (this.prisma?.enabled === true) {
      const ticket = await this.prisma.$transaction(async (tx) => {
        const result = await tx.ticket.updateMany({
          where: {
            id: input.ticketId,
            ...(input.expectedVersion === undefined ? {} : { version: input.expectedVersion }),
          },
          data: {
            assigneeId,
            version: { increment: 1 },
            updatedAt: new Date(now),
          },
        });
        if (result.count === 0) {
          throw new ConflictException(`Ticket update conflict: ${input.ticketId}`);
        }
        await tx.ticketEvent.create({
          data: {
            id: event.id,
            ticketId: input.ticketId,
            eventType: event.eventType,
            payload: event.payload as Prisma.InputJsonValue,
            createdAt: new Date(event.createdAt),
          },
        });
        return tx.ticket.findUniqueOrThrow({ where: { id: input.ticketId } });
      });

      return this.mapTicket(ticket);
    }

    const ticket = this.tickets.get(input.ticketId);
    if (ticket === undefined) {
      throw new Error(`Ticket not found: ${input.ticketId}`);
    }

    const updatedTicket: Ticket = {
      ...ticket,
      assigneeId,
      version: ticket.version + 1,
      updatedAt: now,
    };
    this.tickets.set(input.ticketId, updatedTicket);
    this.ticketEvents.set(input.ticketId, [...(this.ticketEvents.get(input.ticketId) ?? []), event]);
    return updatedTicket;
  }

  async addTicketComment(input: { ticketId: string; body: string; authorId: string }): Promise<TicketComment> {
    const now = new Date().toISOString();
    const comment: TicketComment = {
      id: randomUUID(),
      ticketId: input.ticketId,
      body: input.body,
      authorId: input.authorId,
      createdAt: now,
    };
    const event: TicketEvent = {
      id: `${input.ticketId}:comment:${comment.id}`,
      ticketId: input.ticketId,
      eventType: 'ticket.comment_added',
      payload: {
        commentId: comment.id,
        authorId: input.authorId,
      },
      createdAt: now,
    };

    if (this.prisma?.enabled === true) {
      const saved = await this.prisma.ticketComment.create({
        data: {
          id: comment.id,
          ticketId: comment.ticketId,
          body: comment.body,
          authorId: comment.authorId,
          createdAt: new Date(comment.createdAt),
        },
      });

      await this.prisma.ticket.update({
        where: { id: input.ticketId },
        data: {
          updatedAt: new Date(now),
          version: { increment: 1 },
          events: {
            create: {
              id: event.id,
              eventType: event.eventType,
              payload: event.payload as Prisma.InputJsonValue,
              createdAt: new Date(event.createdAt),
            },
          },
        },
      });

      return {
        id: saved.id,
        ticketId: saved.ticketId,
        body: saved.body,
        authorId: saved.authorId,
        createdAt: saved.createdAt.toISOString(),
      };
    }

    const ticket = this.tickets.get(input.ticketId);
    if (ticket === undefined) {
      throw new Error(`Ticket not found: ${input.ticketId}`);
    }
    this.ticketComments.set(input.ticketId, [comment, ...(this.ticketComments.get(input.ticketId) ?? [])]);
    this.ticketEvents.set(input.ticketId, [...(this.ticketEvents.get(input.ticketId) ?? []), event]);
    return comment;
  }

  async recordTicketEvent(input: {
    ticketId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<TicketEvent> {
    const event: TicketEvent = {
      id: `${input.ticketId}:${input.eventType}:${randomUUID()}`,
      ticketId: input.ticketId,
      eventType: input.eventType,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    };

    if (this.prisma?.enabled === true) {
      const saved = await this.prisma.ticketEvent.create({
        data: {
          id: event.id,
          ticketId: event.ticketId,
          eventType: event.eventType,
          payload: event.payload as Prisma.InputJsonValue,
          createdAt: new Date(event.createdAt),
        },
      });

      return {
        id: saved.id,
        ticketId: saved.ticketId,
        eventType: saved.eventType,
        payload: saved.payload as Record<string, unknown>,
        createdAt: saved.createdAt.toISOString(),
      };
    }

    this.ticketEvents.set(input.ticketId, [...(this.ticketEvents.get(input.ticketId) ?? []), event]);
    return event;
  }

  async captureCsatByExternalConversation(input: {
    clientId: string;
    channel: ConversationLog['channel'];
    externalConversationId: string;
    score: number;
    comment?: string;
  }): Promise<ConversationLog | null> {
    const now = new Date();

    if (this.prisma?.enabled === true) {
      const result = await this.prisma.conversation.updateMany({
        where: {
          clientId: input.clientId,
          channel: input.channel,
          externalConversationId: input.externalConversationId,
        },
        data: {
          csatScore: input.score,
          csatComment: input.comment,
          csatAt: now,
        },
      });

      if (result.count === 0) return null;

      const conversation = await this.prisma.conversation.findUnique({
        where: {
          clientId_channel_externalConversationId: {
            clientId: input.clientId,
            channel: input.channel,
            externalConversationId: input.externalConversationId,
          },
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      return conversation === null ? null : this.mapConversation(conversation);
    }

    const conversation = [...this.conversations.values()].find(
      (item) =>
        item.clientId === input.clientId &&
        item.channel === input.channel &&
        item.externalConversationId === input.externalConversationId,
    );
    if (conversation === undefined) return null;

    const updated: ConversationLog = {
      ...conversation,
      csatScore: input.score,
      csatComment: input.comment,
      csatAt: now.toISOString(),
    };
    this.conversations.set(updated.id, updated);
    return updated;
  }

  async updateConversationQa(input: {
    conversationId: string;
    qaGrade?: ConversationQaGrade;
    hallucinationFlag: boolean;
    actorId: string;
  }): Promise<ConversationLog> {
    const now = new Date().toISOString();

    if (this.prisma?.enabled === true) {
      const conversation = await this.prisma.conversation.update({
        where: { id: input.conversationId },
        data: {
          qaGrade: input.qaGrade,
          hallucinationFlag: input.hallucinationFlag,
          gradedBy: input.actorId,
          gradedAt: new Date(now),
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      return this.mapConversation(conversation);
    }

    const conversation = this.getConversation(input.conversationId);
    const updatedConversation: ConversationLog = {
      ...conversation,
      qaGrade: input.qaGrade,
      hallucinationFlag: input.hallucinationFlag,
      gradedBy: input.actorId,
      gradedAt: now,
    };
    this.conversations.set(input.conversationId, updatedConversation);
    return updatedConversation;
  }

  async updateConversationAutoQa(input: {
    conversationId: string;
    score: number;
    grade: ConversationAutoQaGrade;
    defects: ConversationQaDefect[];
    reason: string;
    version: string;
  }): Promise<ConversationLog> {
    const now = new Date().toISOString();

    if (this.prisma?.enabled === true) {
      const conversation = await this.prisma.conversation.update({
        where: { id: input.conversationId },
        data: {
          autoQaScore: input.score,
          autoQaGrade: input.grade,
          autoQaDefects: input.defects,
          autoQaReason: input.reason,
          autoQaAt: new Date(now),
          autoQaVersion: input.version,
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      return this.mapConversation(conversation);
    }

    const conversation = this.getConversation(input.conversationId);
    const updatedConversation: ConversationLog = {
      ...conversation,
      autoQaScore: input.score,
      autoQaGrade: input.grade,
      autoQaDefects: input.defects,
      autoQaReason: input.reason,
      autoQaAt: now,
      autoQaVersion: input.version,
    };
    this.conversations.set(input.conversationId, updatedConversation);
    return updatedConversation;
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

  private buildCalibrationSummary(conversations: ConversationLog[]): CalibrationQueueSummary {
    return {
      total: conversations.length,
      ungraded: conversations.filter((conversation) => conversation.qaGrade === undefined).length,
      failed: conversations.filter((conversation) => conversation.autoQaGrade === 'fail').length,
      review: conversations.filter((conversation) => conversation.autoQaGrade === 'review').length,
      hallucinationRisk: conversations.filter((conversation) =>
        conversation.autoQaDefects.includes('hallucination_risk'),
      ).length,
      escalationRisk: conversations.filter((conversation) =>
        conversation.autoQaDefects.includes('escalation_needed') || conversation.autoQaDefects.includes('escalation_miss'),
      ).length,
    };
  }

  private mapTicket(ticket: {
    id: string;
    clientId: string;
    conversationId: string;
    assigneeId: string | null;
    version: number;
    priority: string;
    status: string;
    reason: string;
    customerMessage: string;
    suggestedReply: string;
    salesRecoveredEstimate: number;
    createdAt: Date;
    updatedAt: Date;
  }): Ticket {
    return {
      id: ticket.id,
      clientId: ticket.clientId,
      conversationId: ticket.conversationId,
      assigneeId: ticket.assigneeId ?? undefined,
      version: ticket.version,
      priority: ticket.priority as Ticket['priority'],
      status: ticket.status as Ticket['status'],
      reason: ticket.reason,
      customerMessage: ticket.customerMessage,
      suggestedReply: ticket.suggestedReply,
      salesRecoveredEstimate: ticket.salesRecoveredEstimate,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  private mapConversation(conversation: {
    id: string;
    clientId: string;
    channel: string;
    externalConversationId: string;
    externalSenderId: string;
    lastConfidence: number | null;
    ticketId: string | null;
    csatScore: number | null;
    csatComment: string | null;
    csatAt: Date | null;
    qaGrade: string | null;
    hallucinationFlag: boolean;
    gradedBy: string | null;
    gradedAt: Date | null;
    autoQaScore: number | null;
    autoQaGrade: string | null;
    autoQaDefects: string[];
    autoQaReason: string | null;
    autoQaAt: Date | null;
    autoQaVersion: string | null;
    messages: {
      id: string;
      direction: string;
      text: string;
      createdAt: Date;
    }[];
  }): ConversationLog {
    return {
      id: conversation.id,
      clientId: conversation.clientId,
      channel: conversation.channel as ConversationLog['channel'],
      externalConversationId: conversation.externalConversationId,
      externalSenderId: conversation.externalSenderId,
      lastConfidence: conversation.lastConfidence ?? undefined,
      ticketId: conversation.ticketId ?? undefined,
      csatScore: conversation.csatScore ?? undefined,
      csatComment: conversation.csatComment ?? undefined,
      csatAt: conversation.csatAt?.toISOString(),
      qaGrade: (conversation.qaGrade as ConversationQaGrade | null) ?? undefined,
      hallucinationFlag: conversation.hallucinationFlag,
      gradedBy: conversation.gradedBy ?? undefined,
      gradedAt: conversation.gradedAt?.toISOString(),
      autoQaScore: conversation.autoQaScore ?? undefined,
      autoQaGrade: (conversation.autoQaGrade as ConversationAutoQaGrade | null) ?? undefined,
      autoQaDefects: conversation.autoQaDefects as ConversationQaDefect[],
      autoQaReason: conversation.autoQaReason ?? undefined,
      autoQaAt: conversation.autoQaAt?.toISOString(),
      autoQaVersion: conversation.autoQaVersion ?? undefined,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        direction: message.direction as ConversationMessage['direction'],
        text: message.text,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  private getConversation(conversationId: string): ConversationLog {
    const conversation = this.conversations.get(conversationId);
    if (conversation === undefined) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    return conversation;
  }
}
