import { describe, expect, it } from 'vitest';
import { AiService } from '../ai/ai.service';
import { PilotClientService } from '../clients/pilot-client.service';
import { PrismaService } from '../database/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { TicketService } from '../tickets/ticket.service';
import { ClientProfile } from '../types/domain';
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

function createService() {
  const disabledPrisma = { enabled: false } as unknown as PrismaService;
  const clients = { findById: async () => pilotClient } as unknown as PilotClientService;
  const repository = new ConversationRepository();
  const service = new ConversationService(
    new AiService(),
    clients,
    new KnowledgeService(disabledPrisma),
    repository,
    new TicketService(repository),
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
});
