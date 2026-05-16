import { describe, expect, it, vi } from 'vitest';
import { TicketService } from './ticket.service';
import { Ticket, TicketDetail, TicketStatus } from '../types/domain';

const baseTicket: Ticket = {
  id: 'ticket-1',
  clientId: 'pilot-client',
  conversationId: 'conv-1',
  version: 1,
  priority: 'P2',
  status: 'open',
  reason: 'Low knowledge confidence',
  customerMessage: 'do you ship to Sylhet on Friday?',
  suggestedReply: 'Let me check with the team and confirm shortly.',
  salesRecoveredEstimate: 1200,
  createdAt: '2026-05-16T10:00:00.000Z',
  updatedAt: '2026-05-16T10:00:00.000Z',
};

function withStatus(status: TicketStatus): Ticket {
  return { ...baseTicket, status };
}

function createRepositoryMock(detail: TicketDetail | null = null) {
  return {
    updateTicketStatus: vi.fn(async ({ status }: { status: TicketStatus }) => withStatus(status)),
    getTicketDetail: vi.fn(async () => detail),
    updateTicketAssignee: vi.fn(),
    addTicketComment: vi.fn(),
    saveTicket: vi.fn(),
  };
}

function createKnowledgeMock() {
  return {
    harvestFromResolvedTicket: vi.fn(async () => ({
      id: 'kb-1',
      clientId: 'pilot-client',
      title: 'Live learning: do you ship to Sylhet on Friday?',
      answer: 'Yes, Sylhet delivery runs on Fridays.',
      keywords: ['sylhet', 'friday', 'ship'],
      status: 'draft' as const,
      version: 1,
      sourceTicketId: 'ticket-1',
    })),
  };
}

function createLoggerMock() {
  return { event: vi.fn() };
}

describe('TicketService.updateStatus live-learning hook', () => {
  it('harvests a knowledge candidate when the ticket is resolved', async () => {
    const repository = createRepositoryMock({
      ticket: withStatus('resolved'),
      events: [],
      comments: [
        {
          id: 'c1',
          ticketId: 'ticket-1',
          body: 'Yes, Sylhet delivery runs on Fridays.',
          authorId: 'op-1',
          createdAt: '2026-05-16T10:05:00.000Z',
        },
      ],
    });
    const knowledge = createKnowledgeMock();
    const logger = createLoggerMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new TicketService(repository as any, knowledge as any, logger as any);

    const ticket = await service.updateStatus({ ticketId: 'ticket-1', status: 'resolved' });

    expect(ticket.status).toBe('resolved');
    expect(knowledge.harvestFromResolvedTicket).toHaveBeenCalledTimes(1);
    expect(knowledge.harvestFromResolvedTicket).toHaveBeenCalledWith({
      clientId: 'pilot-client',
      ticketId: 'ticket-1',
      customerMessage: 'do you ship to Sylhet on Friday?',
      resolutionAnswer: 'Yes, Sylhet delivery runs on Fridays.',
      actorId: 'live-learning',
    });
    expect(logger.event).toHaveBeenCalledWith(
      'knowledge.live_learning.captured',
      expect.objectContaining({ ticketId: 'ticket-1', knowledgeEntryId: 'kb-1' }),
    );
  });

  it('falls back to the suggested reply when no operator comment exists', async () => {
    const repository = createRepositoryMock({
      ticket: withStatus('resolved'),
      events: [],
      comments: [],
    });
    const knowledge = createKnowledgeMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new TicketService(repository as any, knowledge as any);

    await service.updateStatus({ ticketId: 'ticket-1', status: 'resolved' });

    expect(knowledge.harvestFromResolvedTicket).toHaveBeenCalledWith(
      expect.objectContaining({ resolutionAnswer: baseTicket.suggestedReply }),
    );
  });

  it('does not harvest on non-resolved status transitions', async () => {
    const repository = createRepositoryMock();
    const knowledge = createKnowledgeMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new TicketService(repository as any, knowledge as any);

    await service.updateStatus({ ticketId: 'ticket-1', status: 'assigned' });
    await service.updateStatus({ ticketId: 'ticket-1', status: 'waiting_client' });

    expect(knowledge.harvestFromResolvedTicket).not.toHaveBeenCalled();
  });

  it('swallows harvest errors so the ticket update still succeeds', async () => {
    const repository = createRepositoryMock({
      ticket: withStatus('resolved'),
      events: [],
      comments: [],
    });
    const knowledge = {
      harvestFromResolvedTicket: vi.fn(async () => {
        throw new Error('embedding upstream down');
      }),
    };
    const logger = createLoggerMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new TicketService(repository as any, knowledge as any, logger as any);

    const ticket = await service.updateStatus({ ticketId: 'ticket-1', status: 'resolved' });

    expect(ticket.status).toBe('resolved');
    expect(logger.event).toHaveBeenCalledWith(
      'knowledge.live_learning.failed',
      expect.objectContaining({ ticketId: 'ticket-1', error: 'embedding upstream down' }),
    );
  });
});
