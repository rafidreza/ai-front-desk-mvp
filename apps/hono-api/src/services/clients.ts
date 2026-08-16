import { and, asc, count, desc, eq, ne, or, sql } from 'drizzle-orm';
import type {
  Channel,
  ClientChannelSummary,
  ClientDashboardSummary,
  ClientProfile,
  ConversationLog,
  TicketDetail,
  Ticket,
  TicketStatus,
} from '@ai-front-desk/shared';
import type { AppDb } from '../db/client';
import { clients, conversations, messages, ticketComments, ticketEvents, tickets } from '../db/schema';
import { ConflictError, NotFoundError } from '../errors';
import { randomId } from '../utils/crypto';
import { toClientProfile, toConversation, toTicket, toTicketComment, toTicketEvent } from './mappers';

export const pilotClientFallback: ClientProfile = {
  id: 'pilot-abc',
  businessName: 'ABC Telecom',
  pageId: 'pilot-abc-page',
  status: 'active',
  lifecycleStage: 'live',
  defaultLanguage: 'mixed',
  tone: 'friendly, concise, helpful, and natural for Bangladeshi telecom support',
  escalationKeywords: ['refund', 'complaint', 'cancel', 'human'],
  onboardingStatus: 'live',
};

const defaultTone = 'friendly, concise, helpful, and natural for Bangladeshi Messenger commerce';
const defaultEscalationKeywords = ['refund', 'complaint', 'wrong product', 'cancel', 'human'];

export class ClientService {
  constructor(
    private readonly db: AppDb,
    private readonly env: { WHATSAPP_PHONE_NUMBER_ID?: string },
  ) {}

  async list() {
    const rows = await this.db.select().from(clients).orderBy(desc(clients.createdAt));
    return rows.map(toClientProfile);
  }

  async create(input: {
    businessName: string;
    pageId?: string;
    ownerName?: string;
    ownerEmail?: string;
    ownerPhone?: string;
    businessCategory?: string;
    defaultLanguage?: ClientProfile['defaultLanguage'];
    tone?: string;
    whatsappPoc?: string;
    digestEmail?: string;
  }) {
    const id = randomId('client-');
    const now = new Date();
    const [client] = await this.db
      .insert(clients)
      .values({
        id,
        businessName: input.businessName,
        pageId: input.pageId?.trim() || `${id}-page-pending`,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
        ownerPhone: input.ownerPhone,
        businessCategory: input.businessCategory,
        onboardingStatus: 'signup_started',
        defaultLanguage: input.defaultLanguage ?? 'english',
        tone: input.tone ?? defaultTone,
        escalationKeywords: defaultEscalationKeywords,
        whatsappPoc: input.whatsappPoc,
        digestEmail: input.digestEmail ?? input.ownerEmail,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return toClientProfile(client!);
  }

  async findById(clientId: string) {
    const [client] = await this.db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (client === undefined) throw new NotFoundError(`Client not found: ${clientId}`);
    return toClientProfile(client);
  }

  async updateOnboarding(
    clientId: string,
    input: {
      businessCategory?: string;
      pageId?: string;
      whatsappPoc?: string;
      onboardingStatus?: string;
      onboardingProfile?: Record<string, unknown>;
    },
  ) {
    const [existing] = await this.db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (existing === undefined) throw new NotFoundError(`Client not found: ${clientId}`);

    const [client] = await this.db
      .update(clients)
      .set({
        businessCategory: input.businessCategory,
        pageId: input.pageId,
        whatsappPoc: input.whatsappPoc,
        onboardingStatus: input.onboardingStatus,
        onboardingProfile:
          input.onboardingProfile === undefined
            ? undefined
            : {
                ...(existing.onboardingProfile ?? {}),
                ...input.onboardingProfile,
              },
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId))
      .returning();

    return toClientProfile(client!);
  }

  async disconnectWhatsApp(clientId: string) {
    const [existing] = await this.db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (existing === undefined) throw new NotFoundError(`Client not found: ${clientId}`);

    const [client] = await this.db
      .update(clients)
      .set({
        whatsappPoc: null,
        onboardingProfile: {
          ...(existing.onboardingProfile ?? {}),
          whatsappSetup: 'skip',
        },
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId))
      .returning();

    return toClientProfile(client!);
  }

  async findByPageId(pageId: string) {
    const [client] = await this.db.select().from(clients).where(eq(clients.pageId, pageId)).limit(1);
    if (client === undefined) throw new NotFoundError(`Client not found for page: ${pageId}`);
    return toClientProfile(client);
  }

  async findByWhatsAppIdentifier(identifier: string) {
    const [client] = await this.db
      .select()
      .from(clients)
      .where(or(eq(clients.pageId, identifier), eq(clients.id, identifier)))
      .limit(1);
    if (client !== undefined) return toClientProfile(client);
    // Single-number MVP: inbound on the configured WhatsApp Cloud API number routes to the pilot client.
    if (identifier === this.env.WHATSAPP_PHONE_NUMBER_ID) return pilotClientFallback;
    throw new NotFoundError(`Client not found for WhatsApp identifier: ${identifier}`);
  }
}

export class DashboardService {
  constructor(
    private readonly db: AppDb,
    private readonly clientsService: ClientService,
  ) {}

  async getDashboard(clientId: string): Promise<ClientDashboardSummary> {
    const client = await this.clientsService.findById(clientId);
    const [recentConversations, recentTickets, totals] = await Promise.all([
      this.listClientConversations(clientId, 10),
      this.listClientTickets(clientId),
      this.getTotals(clientId),
    ]);
    const channelCounts = new Map<Channel, number>(
      (
        await this.db
          .select({ channel: conversations.channel, total: count() })
          .from(conversations)
          .where(eq(conversations.clientId, clientId))
          .groupBy(conversations.channel)
      ).map((item) => [item.channel as Channel, item.total]),
    );

    const openTickets = recentTickets.filter((ticket) => ticket.status !== 'resolved').length;
    const resolvedTickets = recentTickets.filter((ticket) => ticket.status === 'resolved').length;
    const p1Tickets = recentTickets.filter((ticket) => ticket.priority === 'P1').length;

    return {
      client,
      totals: {
        conversations: totals.conversations,
        tickets: totals.tickets,
        openTickets,
        resolvedTickets,
        p1Tickets,
        containmentRate: totals.conversations === 0 ? 0 : Math.round((totals.contained / totals.conversations) * 100),
        averageConfidence: Math.round((totals.averageConfidence ?? 0) * 100),
        averageCsat: totals.averageCsat === null ? null : Number(totals.averageCsat.toFixed(1)),
        salesRecoveredEstimate: totals.salesRecoveredEstimate ?? 0,
      },
      channels: this.buildChannelSummaries(client, channelCounts),
      recentTickets: recentTickets.slice(0, 8),
      recentConversations,
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
    const where =
      status === undefined || status === 'all'
        ? eq(tickets.clientId, clientId)
        : status === 'open'
          ? and(eq(tickets.clientId, clientId), ne(tickets.status, 'resolved'))
          : and(eq(tickets.clientId, clientId), eq(tickets.status, status as TicketStatus));
    const rows = await this.db.select().from(tickets).where(where).orderBy(desc(tickets.updatedAt));
    return rows.map(toTicket);
  }

  async getClientTicketDetail(clientId: string, ticketId: string): Promise<TicketDetail & { conversation: ConversationLog }> {
    const [ticket] = await this.db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.clientId, clientId)))
      .limit(1);
    if (ticket === undefined) throw new NotFoundError('Ticket not found for this client');

    const [events, comments, conversation] = await Promise.all([
      this.db.select().from(ticketEvents).where(eq(ticketEvents.ticketId, ticketId)).orderBy(asc(ticketEvents.createdAt)),
      this.db.select().from(ticketComments).where(eq(ticketComments.ticketId, ticketId)).orderBy(desc(ticketComments.createdAt)),
      this.getConversation(ticket.conversationId),
    ]);

    return {
      ticket: toTicket(ticket),
      events: events.map(toTicketEvent),
      comments: comments.map(toTicketComment),
      conversation,
    };
  }

  async captureCsat(input: { clientId: string; conversationId: string; score: number; comment?: string }): Promise<ConversationLog> {
    const now = new Date();
    const [updated] = await this.db
      .update(conversations)
      .set({ csatScore: input.score, csatComment: input.comment, csatAt: now, updatedAt: now })
      .where(and(eq(conversations.id, input.conversationId), eq(conversations.clientId, input.clientId)))
      .returning();
    if (updated === undefined) throw new NotFoundError('Conversation not found for this client');
    return this.getConversation(updated.id);
  }

  async updateClientTicketStatus(input: {
    clientId: string;
    ticketId: string;
    status: TicketStatus;
    expectedVersion?: number;
  }) {
    const now = new Date();
    const where =
      input.expectedVersion === undefined
        ? and(eq(tickets.id, input.ticketId), eq(tickets.clientId, input.clientId))
        : and(eq(tickets.id, input.ticketId), eq(tickets.clientId, input.clientId), eq(tickets.version, input.expectedVersion));
    const [ticket] = await this.db
      .update(tickets)
      .set({ status: input.status, version: sql`${tickets.version} + 1`, updatedAt: now })
      .where(where)
      .returning();
    if (ticket === undefined) throw new ConflictError(`Ticket update conflict: ${input.ticketId}`);
    await this.db.insert(ticketEvents).values({
      id: `${input.ticketId}:client-status:${input.status}:${Date.now()}`,
      ticketId: input.ticketId,
      eventType: 'ticket.status_updated',
      payload: { status: input.status, actorId: `client:${input.clientId}` },
      createdAt: now,
    });
    return toTicket(ticket);
  }

  private async getConversation(conversationId: string) {
    const [conversation] = await this.db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (conversation === undefined) throw new NotFoundError(`Conversation not found: ${conversationId}`);
    const messageRows = await this.db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
    return toConversation(conversation, messageRows);
  }

  private async listClientConversations(clientId: string, take: number): Promise<ConversationLog[]> {
    const rows = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.clientId, clientId))
      .orderBy(desc(conversations.updatedAt))
      .limit(take);
    const result = [];
    for (const row of rows) {
      const messageRows = await this.db.select().from(messages).where(eq(messages.conversationId, row.id)).orderBy(asc(messages.createdAt));
      result.push(toConversation(row, messageRows));
    }
    return result;
  }

  private async getTotals(clientId: string) {
    const [conversationCount] = await this.db.select({ total: count() }).from(conversations).where(eq(conversations.clientId, clientId));
    const [ticketCount] = await this.db.select({ total: count() }).from(tickets).where(eq(tickets.clientId, clientId));
    const [containedCount] = await this.db
      .select({ total: count() })
      .from(conversations)
      .where(and(eq(conversations.clientId, clientId), sql`${conversations.ticketId} IS NULL`));
    const [averages] = await this.db
      .select({
        averageConfidence: sql<number | null>`avg(${conversations.lastConfidence})`,
        averageCsat: sql<number | null>`avg(${conversations.csatScore})`,
      })
      .from(conversations)
      .where(eq(conversations.clientId, clientId));
    const [sales] = await this.db
      .select({ total: sql<number | null>`coalesce(sum(${tickets.salesRecoveredEstimate}), 0)` })
      .from(tickets)
      .where(eq(tickets.clientId, clientId));

    return {
      conversations: conversationCount?.total ?? 0,
      tickets: ticketCount?.total ?? 0,
      contained: containedCount?.total ?? 0,
      averageConfidence: averages?.averageConfidence ?? null,
      averageCsat: averages?.averageCsat ?? null,
      salesRecoveredEstimate: sales?.total ?? 0,
    };
  }

  private buildChannelSummaries(client: ClientProfile, conversationsByChannel: Map<Channel, number>): ClientChannelSummary[] {
    const messengerConnected = client.pageId.trim().length > 0 && !client.pageId.endsWith('-page-pending');
    const whatsappContact = client.whatsappPoc;
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
        status: whatsappConnected ? 'contact_only' : 'needs_setup',
        conversations: conversationsByChannel.get('whatsapp') ?? 0,
        setupLabel: whatsappConnected ? 'Contact set (handoff only)' : 'Business contact needed',
        detail: whatsappConnected
          ? `Handoff contact: ${whatsappContact}. No WhatsApp API connected, so AI does not reply here yet.`
          : 'Add a WhatsApp POC or owner phone number for handoff routing.',
        actionLabel: whatsappConnected ? 'Used for human handoff' : 'Add WhatsApp contact',
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
