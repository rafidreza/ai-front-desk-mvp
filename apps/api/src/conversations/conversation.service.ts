import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PilotClientService } from '../clients/pilot-client.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { StructuredLoggerService } from '../observability/structured-logger.service';
import { PromptProfileService } from '../prompts/prompt-profile.service';
import { TicketService } from '../tickets/ticket.service';
import { AgentReply, ConversationLog, ConversationQaGrade, IncomingMessage, Ticket } from '../types/domain';
import { ConversationRepository } from './conversation.repository';

interface HandleMessageResult {
  conversation: ConversationLog;
  reply: AgentReply;
  ticket?: Ticket;
  alreadyProcessed?: boolean;
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
    }

    await this.repository.setConversationResult(conversationId, {
      lastConfidence: reply.confidence,
      ticketId: ticket?.id,
    });

    return {
      conversation,
      reply,
      ticket,
    };
  }

  listConversations(): Promise<ConversationLog[]> {
    return this.repository.listConversations();
  }

  listTickets(): Promise<Ticket[]> {
    return this.repository.listTickets();
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
}
