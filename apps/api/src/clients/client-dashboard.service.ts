import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ClientDashboardSummary, ConversationLog, Ticket, TicketStatus } from '../types/domain';
import { PilotClientService } from './pilot-client.service';

@Injectable()
export class ClientDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: PilotClientService,
  ) {}

  async getDashboard(clientId: string): Promise<ClientDashboardSummary> {
    const client = await this.clients.findById(clientId);
    const [conversations, tickets] = await Promise.all([
      this.listClientConversations(clientId, 10),
      this.listClientTickets(clientId),
    ]);
    const totalConversations = await this.prisma.conversation.count({ where: { clientId } });
    const totalTickets = await this.prisma.ticket.count({ where: { clientId } });
    const openTickets = tickets.filter((ticket) => ticket.status !== 'resolved').length;
    const resolvedTickets = tickets.filter((ticket) => ticket.status === 'resolved').length;
    const p1Tickets = tickets.filter((ticket) => ticket.priority === 'P1').length;
    const contained = await this.prisma.conversation.count({ where: { clientId, ticketId: null } });
    const confidence = await this.prisma.conversation.aggregate({ where: { clientId }, _avg: { lastConfidence: true } });
    const csat = await this.prisma.conversation.aggregate({ where: { clientId, csatScore: { not: null } }, _avg: { csatScore: true } });
    const sales = await this.prisma.ticket.aggregate({ where: { clientId }, _sum: { salesRecoveredEstimate: true } });

    return {
      client,
      totals: {
        conversations: totalConversations,
        tickets: totalTickets,
        openTickets,
        resolvedTickets,
        p1Tickets,
        containmentRate: totalConversations === 0 ? 0 : Math.round((contained / totalConversations) * 100),
        averageConfidence: Math.round((confidence._avg.lastConfidence ?? 0) * 100),
        averageCsat: csat._avg.csatScore === null ? null : Number(csat._avg.csatScore.toFixed(1)),
        salesRecoveredEstimate: sales._sum.salesRecoveredEstimate ?? 0,
      },
      recentTickets: tickets.slice(0, 8),
      recentConversations: conversations,
    };
  }

  async getDigestPreview(clientId: string, cadence: 'daily' | 'weekly') {
    const dashboard = await this.getDashboard(clientId);
    return {
      cadence,
      clientId,
      subject:
        cadence === 'weekly'
          ? `${dashboard.client.businessName} weekly support recovery report`
          : `${dashboard.client.businessName} daily support summary`,
      generatedAt: new Date().toISOString(),
      summary: dashboard.totals,
      narrative: `${dashboard.totals.conversations} conversations handled, ${dashboard.totals.openTickets} open tickets, estimated BDT ${dashboard.totals.salesRecoveredEstimate} sales protected.`,
    };
  }

  async listClientTickets(clientId: string, status?: string): Promise<Ticket[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        clientId,
        ...(status === undefined || status === 'all'
          ? {}
          : status === 'open'
            ? { status: { not: 'resolved' } }
            : { status: status as TicketStatus }),
      },
      orderBy: { updatedAt: 'desc' },
    });

    return tickets.map((ticket) => ({
      id: ticket.id,
      clientId: ticket.clientId,
      conversationId: ticket.conversationId,
      assigneeId: ticket.assigneeId ?? undefined,
      version: ticket.version,
      priority: ticket.priority,
      status: ticket.status,
      reason: ticket.reason,
      customerMessage: ticket.customerMessage,
      suggestedReply: ticket.suggestedReply,
      salesRecoveredEstimate: ticket.salesRecoveredEstimate,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    }));
  }

  async captureCsat(input: { clientId: string; conversationId: string; score: number; comment?: string }): Promise<ConversationLog> {
    const result = await this.prisma.conversation.updateMany({
      where: { id: input.conversationId, clientId: input.clientId },
      data: {
        csatScore: input.score,
        csatComment: input.comment,
        csatAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Conversation not found for this client');
    }

    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: input.conversationId },
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
      qaGrade: conversation.qaGrade as ConversationLog['qaGrade'],
      hallucinationFlag: conversation.hallucinationFlag,
      gradedBy: conversation.gradedBy ?? undefined,
      gradedAt: conversation.gradedAt?.toISOString(),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        direction: message.direction as ConversationLog['messages'][number]['direction'],
        text: message.text,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  async updateClientTicketStatus(input: {
    clientId: string;
    ticketId: string;
    status: TicketStatus;
    expectedVersion?: number;
  }): Promise<Ticket> {
    const now = new Date();
    const result = await this.prisma.ticket.updateMany({
      where: {
        id: input.ticketId,
        clientId: input.clientId,
        ...(input.expectedVersion === undefined ? {} : { version: input.expectedVersion }),
      },
      data: {
        status: input.status,
        version: { increment: 1 },
        updatedAt: now,
      },
    });

    if (result.count === 0) {
      throw new ConflictException(`Ticket update conflict: ${input.ticketId}`);
    }

    await this.prisma.ticketEvent.create({
      data: {
        id: `${input.ticketId}:client-status:${input.status}:${Date.now()}`,
        ticketId: input.ticketId,
        eventType: 'ticket.status_updated',
        payload: {
          status: input.status,
          actorId: `client:${input.clientId}`,
        },
        createdAt: now,
      },
    });

    const ticket = await this.prisma.ticket.findUniqueOrThrow({ where: { id: input.ticketId } });
    return {
      id: ticket.id,
      clientId: ticket.clientId,
      conversationId: ticket.conversationId,
      assigneeId: ticket.assigneeId ?? undefined,
      version: ticket.version,
      priority: ticket.priority,
      status: ticket.status,
      reason: ticket.reason,
      customerMessage: ticket.customerMessage,
      suggestedReply: ticket.suggestedReply,
      salesRecoveredEstimate: ticket.salesRecoveredEstimate,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  private async listClientConversations(clientId: string, take: number): Promise<ConversationLog[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { clientId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
      take,
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
      qaGrade: conversation.qaGrade as ConversationLog['qaGrade'],
      hallucinationFlag: conversation.hallucinationFlag,
      gradedBy: conversation.gradedBy ?? undefined,
      gradedAt: conversation.gradedAt?.toISOString(),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        direction: message.direction as ConversationLog['messages'][number]['direction'],
        text: message.text,
        createdAt: message.createdAt.toISOString(),
      })),
    }));
  }
}
