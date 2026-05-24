import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AutoReplyService } from '../clients/auto-reply.service';
import { PilotClientService } from '../clients/pilot-client.service';
import { BlockedSenderService } from '../customers/blocked-sender.service';
import { TestCustomerService } from '../customers/test-customer.service';
import { ExternalDataService } from '../external-data/external-data.service';
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
  ConversationSearchResult,
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
    private readonly externalData?: ExternalDataService,
    private readonly blockedSenders?: BlockedSenderService,
    private readonly testCustomers?: TestCustomerService,
    private readonly autoReplies?: AutoReplyService,
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

    const senderBlocked = await this.blockedSenders?.isBlocked({
      clientId: message.clientId,
      channel: message.channel,
      externalSenderId: message.externalSenderId,
    });
    if (senderBlocked === true) {
      this.logger?.event('conversation.inbound.blocked', {
        conversationId,
        clientId: message.clientId,
        channel: message.channel,
        externalSenderId: maskRecipient(message.externalSenderId),
        messageId: message.id,
      });
      return {
        conversation,
        reply: {
          text: '',
          confidence: 0,
          matchedKnowledgeIds: [],
          shouldEscalate: false,
        },
        alreadyProcessed: true,
      };
    }

    if (conversation.ticketId !== undefined) {
      try {
        const reopened = await this.tickets.reopenIfResolved({
          ticketId: conversation.ticketId,
          actorId: 'inbound-message',
          payload: { messageId: message.id, channel: message.channel },
        });
        if (reopened !== null) {
          this.logger?.event('ticket.reopened', {
            ticketId: reopened.id,
            clientId: reopened.clientId,
            conversationId,
            messageId: message.id,
          });
        }
      } catch (reopenError) {
        this.logger?.event('ticket.reopen_failed', {
          ticketId: conversation.ticketId,
          conversationId,
          error: reopenError instanceof Error ? reopenError.message : 'Unknown',
        });
      }
    }

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

    const enrichedMessage = await this.enrichImageMessage(message);
    await this.repository.addMessage(conversationId, {
      id: enrichedMessage.id,
      direction: 'inbound',
      text: enrichedMessage.text,
      attachmentType: enrichedMessage.attachmentType,
      attachmentUrl: enrichedMessage.attachmentUrl,
      transcript: enrichedMessage.transcript,
      extractedText: enrichedMessage.extractedText,
      matchedProducts: enrichedMessage.matchedProducts,
      createdAt: enrichedMessage.receivedAt,
    });

    const client = await this.clients.findById(enrichedMessage.clientId);
    const autoReply = await this.autoReplies?.findActiveReply({
      clientId: client.id,
      at: new Date(enrichedMessage.receivedAt),
    });
    if (autoReply !== undefined) {
      return this.completeReplyFlow({
        conversation,
        conversationId,
        client,
        message: enrichedMessage,
        outboundMessageId,
        reply: autoReply,
      });
    }

    const customerLookupText = this.buildCustomerLookupText(enrichedMessage);
    const operationalReply = await this.externalData?.findOperationalReply(client.id, customerLookupText);
    if (operationalReply !== undefined && operationalReply !== null) {
      return this.completeReplyFlow({
        conversation,
        conversationId,
        client,
        message: enrichedMessage,
        outboundMessageId,
        reply: operationalReply,
      });
    }

    const match = await this.knowledge.findRelevant(client.id, customerLookupText);
    const promptProfile = await this.prompts?.getActiveForClient(client);
    const reply = await this.aiService.generateReply({
      client,
      customerText: customerLookupText,
      knowledgeEntries: match.entries,
      promptProfile,
      retrievalConfidence: match.confidence,
    });

    return this.completeReplyFlow({
      conversation,
      conversationId,
      client,
      message: enrichedMessage,
      outboundMessageId,
      reply,
    });
  }

  private async enrichImageMessage(message: IncomingMessage): Promise<IncomingMessage> {
    if (message.attachmentType !== 'image') return message;

    const extractedText = message.extractedText ?? (await this.extractImageText(message.attachmentUrl));
    const lookupText = this.buildCustomerLookupText({ ...message, extractedText });
    const matchedProducts =
      lookupText.trim().length === 0 ? [] : await this.externalData?.findProductCandidates(message.clientId, lookupText, 4);

    return {
      ...message,
      extractedText,
      matchedProducts: matchedProducts ?? [],
    };
  }

  private buildCustomerLookupText(message: IncomingMessage) {
    return [message.text, message.extractedText]
      .filter((part): part is string => part !== undefined && part.trim().length > 0 && part !== 'OCR not configured.')
      .join('\n')
      .trim();
  }

  private async extractImageText(attachmentUrl?: string) {
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim();
    if (apiKey === undefined || apiKey === '') return 'OCR not configured.';
    if (attachmentUrl === undefined || !/^https?:\/\//i.test(attachmentUrl)) return 'OCR media URL unavailable.';

    try {
      const mediaResponse = await fetch(attachmentUrl);
      if (!mediaResponse.ok) return `OCR media fetch failed: ${mediaResponse.status}`;
      const contentType = mediaResponse.headers.get('content-type') ?? 'image/jpeg';
      const bytes = Buffer.from(await mediaResponse.arrayBuffer());
      if (bytes.length === 0) return 'OCR media file is empty.';
      if (bytes.length > 4 * 1024 * 1024) return 'OCR media file is larger than the 4 MB alpha limit.';

      const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: bytes.toString('base64') },
              features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
              imageContext: contentType === 'image/webp' ? undefined : { languageHints: ['bn', 'en'] },
            },
          ],
        }),
      });

      if (!response.ok) return `OCR failed: ${response.status}`;
      const data = (await response.json()) as {
        responses?: { fullTextAnnotation?: { text?: string }; error?: { message?: string } }[];
      };
      const first = data.responses?.[0];
      if (first?.error?.message !== undefined) return `OCR failed: ${first.error.message}`;
      return first?.fullTextAnnotation?.text?.trim() || 'No readable text found.';
    } catch (error) {
      return `OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async completeReplyFlow(input: {
    conversation: ConversationLog;
    conversationId: string;
    client: ClientProfile;
    message: IncomingMessage;
    outboundMessageId: string;
    reply: AgentReply;
  }): Promise<HandleMessageResult> {
    await this.repository.addMessage(input.conversationId, {
      id: input.outboundMessageId,
      direction: 'outbound',
      text: input.reply.text,
      createdAt: new Date().toISOString(),
    });

    const ticket = input.reply.shouldEscalate
      ? await this.tickets.createFromEscalation({ message: input.message, conversationId: input.conversationId, reply: input.reply })
      : undefined;

    if (ticket !== undefined) {
      this.logger?.event('ticket.created', {
        ticketId: ticket.id,
        clientId: ticket.clientId,
        conversationId: ticket.conversationId,
        priority: ticket.priority,
        reason: ticket.reason,
      });
      await this.notifyPocForUrgentTicket(input.client, ticket);
    }

    await this.repository.setConversationResult(input.conversationId, {
      lastConfidence: input.reply.confidence,
      ticketId: ticket?.id,
    });

    const isTestSender = await this.testCustomers?.isTestCustomer({
      clientId: input.message.clientId,
      channel: input.message.channel,
      externalSenderId: input.message.externalSenderId,
    });

    if (isTestSender !== true) {
      await this.scoreConversation({
        conversationId: input.conversationId,
        customerText: input.message.text,
        reply: input.reply,
        ticket,
      });
    } else {
      this.logger?.event('conversation.auto_qa_skipped_test_customer', {
        conversationId: input.conversationId,
        clientId: input.message.clientId,
        externalSenderId: maskRecipient(input.message.externalSenderId),
      });
    }

    return {
      conversation: input.conversation,
      reply: input.reply,
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

  searchConversations(input: { query: string; limit?: number }): Promise<ConversationSearchResult[]> {
    const trimmed = input.query.trim();
    if (trimmed.length < 2) return Promise.resolve([]);
    return this.repository.searchConversations({
      query: trimmed,
      limit: Math.max(1, Math.min(input.limit ?? 30, 100)),
    });
  }

  updateMessageTranscript(input: {
    conversationId: string;
    messageId: string;
    transcript: string;
  }) {
    return this.repository.updateMessageTranscript(input);
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
