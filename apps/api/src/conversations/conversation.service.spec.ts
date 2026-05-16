import { describe, expect, it, vi } from 'vitest';
import { AiService } from '../ai/ai.service';
import { PilotClientService } from '../clients/pilot-client.service';
import { PrismaService } from '../database/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { UrgentTicketNotificationService } from '../notifications/urgent-ticket-notification.service';
import { TicketService } from '../tickets/ticket.service';
import { ClientProfile } from '../types/domain';
import { AutoQaService } from './auto-qa.service';
import { ConversationRepository } from './conversation.repository';
import { ConversationService } from './conversation.service';

const pilotClient: ClientProfile = {
  id: 'pilot-client',
  businessName: 'Pilot Commerce',
  pageId: 'pilot-page',
  onboardingStatus: 'active',
  defaultLanguage: 'mixed',
  tone: 'friendly, concise, helpful, and natural for Bangladeshi Messenger commerce',
  escalationKeywords: ['refund', 'complaint', 'wrong product', 'cancel', 'human', 'রিফান্ড', 'অভিযোগ'],
};

function createService(urgentNotifications?: UrgentTicketNotificationService, autoQa?: AutoQaService) {
  const disabledPrisma = { enabled: false } as unknown as PrismaService;
  const clients = { findById: async () => pilotClient } as unknown as PilotClientService;
  const repository = new ConversationRepository();
  const service = new ConversationService(
    new AiService(),
    clients,
    new KnowledgeService(disabledPrisma),
    repository,
    new TicketService(repository),
    undefined,
    undefined,
    urgentNotifications,
    autoQa,
  );

  return { repository, service };
}

describe('ConversationService', () => {
  it('replies from the hardcoded KB when confidence is high enough', async () => {
    const { service } = createService();

    const result = await service.handleIncomingMessage({
      id: 'message-1',
      clientId: 'pilot-client',
      channel: 'messenger',
      externalConversationId: 'customer-1',
      externalSenderId: 'customer-1',
      text: 'delivery charge koto?',
      receivedAt: new Date().toISOString(),
    });

    expect(result.reply.text).toContain('BDT 80');
    expect(result.reply.matchedKnowledgeIds).toEqual(['delivery-charge']);
    expect(result.reply.shouldEscalate).toBe(false);
    expect(result.ticket).toBeUndefined();
  });

  it('creates a ticket when the knowledge confidence is low', async () => {
    const { service } = createService();

    const result = await service.handleIncomingMessage({
      id: 'message-2',
      clientId: 'pilot-client',
      channel: 'messenger',
      externalConversationId: 'customer-2',
      externalSenderId: 'customer-2',
      text: 'eta blue color e ache with gift wrap?',
      receivedAt: new Date().toISOString(),
    });

    expect(result.reply.shouldEscalate).toBe(true);
    expect(result.ticket?.priority).toBe('P2');
  });

  it('records a P1 WhatsApp ping event when an urgent ticket is created', async () => {
    const notifications = {
      notifyP1: vi.fn(async () => ({
        mode: 'dry-run' as const,
        channel: 'whatsapp' as const,
        recipient: '8801712345678',
      })),
    } as unknown as UrgentTicketNotificationService;
    const { service, repository } = createService(notifications);

    const result = await service.handleIncomingMessage({
      id: 'message-p1',
      clientId: 'pilot-client',
      channel: 'messenger',
      externalConversationId: 'customer-p1',
      externalSenderId: 'customer-p1',
      text: 'I want refund for wrong product',
      receivedAt: new Date().toISOString(),
    });
    const detail = await repository.getTicketDetail(result.ticket!.id);

    expect(result.ticket?.priority).toBe('P1');
    expect(notifications.notifyP1).toHaveBeenCalledOnce();
    expect(detail?.events.map((event) => event.eventType)).toContain('ticket.p1_whatsapp_ping');
  });

  it('updates ticket status', async () => {
    const { service, repository } = createService();
    const ticket = await service.handleIncomingMessage({
      id: 'message-3',
      clientId: 'pilot-client',
      channel: 'messenger',
      externalConversationId: 'customer-3',
      externalSenderId: 'customer-3',
      text: 'eta gift wrap hobe?',
      receivedAt: new Date().toISOString(),
    });

    const updated = await repository.updateTicketStatus({
      ticketId: ticket.ticket!.id,
      status: 'resolved',
      actorId: 'test-operator',
    });
    const detail = await repository.getTicketDetail(ticket.ticket!.id);

    expect(updated.status).toBe('resolved');
    expect(detail?.events.map((event) => event.eventType)).toEqual(['ticket.created', 'ticket.status_updated']);
  });

  it('does not generate a duplicate outbound reply for the same inbound message id', async () => {
    const { service, repository } = createService();
    const message = {
      id: 'message-duplicate',
      clientId: 'pilot-client',
      channel: 'messenger' as const,
      externalConversationId: 'customer-duplicate',
      externalSenderId: 'customer-duplicate',
      text: 'delivery charge koto?',
      receivedAt: new Date().toISOString(),
    };

    const first = await service.handleIncomingMessage(message);
    const second = await service.handleIncomingMessage(message);
    const detail = await repository.listConversations();
    const conversation = detail.find((item) => item.id === first.conversation.id);

    expect(second.alreadyProcessed).toBe(true);
    expect(conversation?.messages.filter((item) => item.direction === 'outbound')).toHaveLength(1);
  });

  it('captures CSAT against an existing Messenger conversation', async () => {
    const { service } = createService();
    await service.handleIncomingMessage({
      id: 'message-csat',
      clientId: 'pilot-client',
      channel: 'messenger',
      externalConversationId: 'customer-csat',
      externalSenderId: 'customer-csat',
      text: 'delivery charge koto?',
      receivedAt: new Date().toISOString(),
    });

    const conversation = await service.captureCsatFromChannel({
      clientId: 'pilot-client',
      channel: 'messenger',
      externalConversationId: 'customer-csat',
      score: 5,
      comment: 'csat_5',
    });

    expect(conversation?.csatScore).toBe(5);
    expect(conversation?.csatComment).toBe('csat_5');
  });

  it('auto-scores completed AI replies when auto QA is enabled', async () => {
    const { service } = createService(undefined, new AutoQaService());

    const result = await service.handleIncomingMessage({
      id: 'message-auto-qa',
      clientId: 'pilot-client',
      channel: 'messenger',
      externalConversationId: 'customer-auto-qa',
      externalSenderId: 'customer-auto-qa',
      text: 'delivery charge koto?',
      receivedAt: new Date().toISOString(),
    });
    const conversations = await service.listConversations();
    const conversation = conversations.find((item) => item.id === result.conversation.id);

    expect(conversation?.autoQaGrade).toBe('pass');
    expect(conversation?.autoQaScore).toBe(100);
    expect(conversation?.autoQaDefects).toEqual([]);
    expect(conversation?.autoQaVersion).toBe('rule-v1');
  });
});
