import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Channel, ClientChannelSummary, ClientDashboardSummary, ClientProfile, ConversationLog, Ticket, TicketStatus } from '../types/domain';
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
    const [
      totalConversations,
      totalTickets,
      contained,
      confidence,
      csat,
      sales,
      channelCounts,
    ] = await Promise.all([
      this.prisma.conversation.count({ where: { clientId } }),
      this.prisma.ticket.count({ where: { clientId } }),
      this.prisma.conversation.count({ where: { clientId, ticketId: null } }),
      this.prisma.conversation.aggregate({ where: { clientId }, _avg: { lastConfidence: true } }),
      this.prisma.conversation.aggregate({ where: { clientId, csatScore: { not: null } }, _avg: { csatScore: true } }),
      this.prisma.ticket.aggregate({ where: { clientId }, _sum: { salesRecoveredEstimate: true } }),
      this.prisma.conversation.groupBy({
        by: ['channel'],
        where: { clientId },
        _count: { _all: true },
      }),
    ]);
    const openTickets = tickets.filter((ticket) => ticket.status !== 'resolved').length;
    const resolvedTickets = tickets.filter((ticket) => ticket.status === 'resolved').length;
    const p1Tickets = tickets.filter((ticket) => ticket.priority === 'P1').length;
    const conversationsByChannel = new Map(
      channelCounts.map((item) => [item.channel as Channel, item._count._all]),
    );

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
      channels: this.buildChannelSummaries(client, conversationsByChannel),
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
      autoQaScore: conversation.autoQaScore ?? undefined,
      autoQaGrade: conversation.autoQaGrade as ConversationLog['autoQaGrade'],
      autoQaDefects: conversation.autoQaDefects as ConversationLog['autoQaDefects'],
      autoQaReason: conversation.autoQaReason ?? undefined,
      autoQaAt: conversation.autoQaAt?.toISOString(),
      autoQaVersion: conversation.autoQaVersion ?? undefined,
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
      autoQaScore: conversation.autoQaScore ?? undefined,
      autoQaGrade: conversation.autoQaGrade as ConversationLog['autoQaGrade'],
      autoQaDefects: conversation.autoQaDefects as ConversationLog['autoQaDefects'],
      autoQaReason: conversation.autoQaReason ?? undefined,
      autoQaAt: conversation.autoQaAt?.toISOString(),
      autoQaVersion: conversation.autoQaVersion ?? undefined,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        direction: message.direction as ConversationLog['messages'][number]['direction'],
        text: message.text,
        createdAt: message.createdAt.toISOString(),
      })),
    }));
  }

  private buildChannelSummaries(client: ClientProfile, conversationsByChannel: Map<Channel, number>): ClientChannelSummary[] {
    const messengerConnected = client.pageId.trim().length > 0 && !client.pageId.endsWith('-page-pending');
    const whatsappContact = client.whatsappPoc ?? client.ownerPhone;
    const whatsappConnected = whatsappContact !== undefined && whatsappContact.trim().length > 0;

    return [
      {
        channel: 'messenger',
        label: 'Messenger',
        status: messengerConnected ? 'connected' : 'needs_setup',
        conversations: conversationsByChannel.get('messenger') ?? 0,
        setupLabel: messengerConnected ? 'Page linked' : 'Page setup needed',
        detail: messengerConnected ? `Page ID: ${client.pageId}` : 'Add the Facebook Page ID before Messenger traffic can go live.',
        actionLabel: messengerConnected ? 'Ready for inbox automation' : 'Connect Facebook Page',
      },
      {
        channel: 'whatsapp',
        label: 'WhatsApp',
        status: whatsappConnected ? 'connected' : 'needs_setup',
        conversations: conversationsByChannel.get('whatsapp') ?? 0,
        setupLabel: whatsappConnected ? 'Business contact set' : 'Business contact needed',
        detail: whatsappConnected ? `Support contact: ${whatsappContact}` : 'Add a WhatsApp POC or owner phone number for handoff routing.',
        actionLabel: whatsappConnected ? 'Ready for WhatsApp support' : 'Add WhatsApp contact',
      },
      {
        channel: 'web',
        label: 'Web widget',
        status: 'available',
        conversations: conversationsByChannel.get('web') ?? 0,
        setupLabel: 'Widget available',
        detail: `Embed URL: /widget?clientId=${client.id}`,
        actionLabel: 'Copy embed link',
        actionHref: `/widget?clientId=${client.id}`,
      },
    ];
  }
}
