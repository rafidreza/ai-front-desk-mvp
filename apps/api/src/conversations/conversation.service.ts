import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PilotClientService } from '../clients/pilot-client.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { UrgentTicketNotificationService } from '../notifications/urgent-ticket-notification.service';
import { StructuredLoggerService } from '../observability/structured-logger.service';
import { PromptProfileService } from '../prompts/prompt-profile.service';
import { TicketService } from '../tickets/ticket.service';
import {
  AgentReply,
  CalibrationQueueFilter,
  CalibrationQueueResult,
  ClientProfile,
  ConversationLog,
  ConversationQaGrade,
  IncomingMessage,
  Ticket,
} from '../types/domain';
import { AutoQaService } from './auto-qa.service';
import { ConversationRepository } from './conversation.repository';

interface HandleMessageResult {
  conversation: ConversationLog;
  reply: AgentReply;
  ticket?: Ticket;
  alreadyProcessed?: boolean;
}

function maskRecipient(recipient?: string) {
  if (recipient === undefined || recipient.length <= 4) return recipient;
  return `${recipient.slice(0, 4)}***${recipient.slice(-4)}`;
}

@Injectable()
export class ConversationService {
  constructor(
    private readonly aiService: AiService,
    private readonly clients: PilotClientService,
    private readonly knowledge: KnowledgeService,
    private readonly repository: ConversationRepository,
    private readonly tickets: TicketService,
    private readonly prompts?: PromptProfileService,
    private readonly logger?: StructuredLoggerService,
    private readonly urgentNotifications?: UrgentTicketNotificationService,
    private readonly autoQa?: AutoQaService,
  ) {}

  async handleIncomingMessage(message: IncomingMessage): Promise<HandleMessageResult> {
    const conversation = await this.repository.upsertConversation({
      clientId: message.clientId,
      channel: message.channel,
      externalConversationId: message.externalConversationId,
      externalSenderId: message.externalSenderId,
    });
    const conversationId = conversation.id;
    const outboundMessageId = `reply:${message.id}`;

    if (await this.repository.messageExists(outboundMessageId)) {
      return {
        conversation,
        reply: {
          text: '',
          confidence: conversation.lastConfidence ?? 1,
          matchedKnowledgeIds: [],
          shouldEscalate: false,
        },
        alreadyProcessed: true,
      };
    }

    await this.repository.addMessage(conversationId, {
      id: message.id,
      direction: 'inbound',
      text: message.text,
      createdAt: message.receivedAt,
    });

    const client = await this.clients.findById(message.clientId);
    const match = await this.knowledge.findRelevant(client.id, message.text);
    const promptProfile = await this.prompts?.getActiveForClient(client);
    const reply = await this.aiService.generateReply({
      client,
      customerText: message.text,
      knowledgeEntries: match.entries,
      promptProfile,
      retrievalConfidence: match.confidence,
    });

    await this.repository.addMessage(conversationId, {
      id: outboundMessageId,
      direction: 'outbound',
      text: reply.text,
      createdAt: new Date().toISOString(),
    });

    const ticket = reply.shouldEscalate
      ? await this.tickets.createFromEscalation({ message, conversationId, reply })
      : undefined;

    if (ticket !== undefined) {
      this.logger?.event('ticket.created', {
        ticketId: ticket.id,
        clientId: ticket.clientId,
        conversationId: ticket.conversationId,
        priority: ticket.priority,
        reason: ticket.reason,
      });
      await this.notifyPocForUrgentTicket(client, ticket);
    }

    await this.repository.setConversationResult(conversationId, {
      lastConfidence: reply.confidence,
      ticketId: ticket?.id,
    });

    await this.scoreConversation({
      conversationId,
      customerText: message.text,
      reply,
      ticket,
    });

    return {
      conversation,
      reply,
      ticket,
    };
  }

  private async scoreConversation(input: {
    conversationId: string;
    customerText: string;
    reply: AgentReply;
    ticket?: Ticket;
  }): Promise<void> {
    if (this.autoQa === undefined) return;

    try {
      const result = this.autoQa.score(input);
      await this.repository.updateConversationAutoQa({
        conversationId: input.conversationId,
        ...result,
      });
      this.logger?.event('conversation.auto_qa_scored', {
        conversationId: input.conversationId,
        score: result.score,
        grade: result.grade,
        defects: result.defects,
      });
    } catch (error) {
      this.logger?.event(
        'conversation.auto_qa_failed',
        {
          conversationId: input.conversationId,
          error: error instanceof Error ? error.message : 'Unknown auto QA failure',
        },
        'error',
      );
    }
  }

  private async notifyPocForUrgentTicket(client: ClientProfile, ticket: Ticket): Promise<void> {
    if (ticket.priority !== 'P1' || this.urgentNotifications === undefined) return;

    try {
      const result = await this.urgentNotifications.notifyP1({ client, ticket });
      await this.repository.recordTicketEvent({
        ticketId: ticket.id,
        eventType: 'ticket.p1_whatsapp_ping',
        payload: {
          mode: result.mode,
          channel: result.channel,
          recipient: maskRecipient(result.recipient),
          reason: result.reason,
        },
      });
      this.logger?.event('ticket.p1_whatsapp_ping', {
        ticketId: ticket.id,
        clientId: ticket.clientId,
        mode: result.mode,
        reason: result.reason,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown P1 notification failure';
      await this.repository.recordTicketEvent({
        ticketId: ticket.id,
        eventType: 'ticket.p1_whatsapp_ping_failed',
        payload: { message },
      });
      this.logger?.event(
        'ticket.p1_whatsapp_ping_failed',
        {
          ticketId: ticket.id,
          clientId: ticket.clientId,
          error: message,
        },
        'error',
      );
    }
  }

  listConversations(): Promise<ConversationLog[]> {
    return this.repository.listConversations();
  }

  listCalibrationQueue(input: {
    filter?: CalibrationQueueFilter;
    limit?: number;
  }): Promise<CalibrationQueueResult> {
    return this.repository.listCalibrationQueue({
      filter: input.filter ?? 'needs_review',
      limit: Math.max(1, Math.min(input.limit ?? 100, 200)),
    });
  }

  listTickets(): Promise<Ticket[]> {
    return this.repository.listTickets();
  }

  async captureCsatFromChannel(input: {
    clientId: string;
    channel: IncomingMessage['channel'];
    externalConversationId: string;
    score: number;
    comment?: string;
  }): Promise<ConversationLog | null> {
    const conversation = await this.repository.captureCsatByExternalConversation(input);
    this.logger?.event('conversation.csat_captured', {
      clientId: input.clientId,
      channel: input.channel,
      externalConversationId: input.externalConversationId,
      score: input.score,
      found: conversation !== null,
    });
    return conversation;
  }

  gradeConversation(input: {
    conversationId: string;
    qaGrade?: ConversationQaGrade;
    hallucinationFlag: boolean;
    actorId?: string;
  }): Promise<ConversationLog> {
    return this.repository.updateConversationQa({
      conversationId: input.conversationId,
      qaGrade: input.qaGrade,
      hallucinationFlag: input.hallucinationFlag,
      actorId: input.actorId ?? 'internal-qa',
    });
  }

  takeOverConversation(input: { conversationId: string; actorId?: string }): Promise<Ticket> {
    return this.tickets.createFromManualTakeover(input);
  }
}
