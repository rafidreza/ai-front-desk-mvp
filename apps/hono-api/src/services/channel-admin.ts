import { and, asc, count, desc, eq, gte } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { clientAutoReplyRules, clients, conversations, whatsAppTemplates } from '../db/schema';
import type { Env } from '../env';
import { envString } from '../env';
import { NotFoundError } from '../errors';
import { randomId } from '../utils/crypto';

type HealthChannel = 'messenger' | 'whatsapp';
type HealthStatus = 'healthy' | 'warning' | 'needs_setup';
type WhatsAppTemplateStatus = 'pending' | 'approved' | 'rejected';
type AutoReplyRuleType = 'holiday' | 'off_hours';

type AutoReplyRuleInput = {
  ruleType: AutoReplyRuleType;
  label: string;
  timezone?: string;
  startDate?: string;
  endDate?: string;
  dayOfWeek?: number;
  startMinute?: number;
  endMinute?: number;
  replyText: string;
  enabled?: boolean;
};

const defaultReply =
  'Thanks for your message. Our team is offline right now, but Daemion has logged your request and we will follow up when support resumes.';

const seedRules: AutoReplyRuleInput[] = [
  {
    ruleType: 'holiday',
    label: 'Eid-ul-Fitr holiday 2026',
    startDate: '2026-03-19',
    endDate: '2026-03-23',
    replyText: 'Eid Mubarak. Our team is away for Eid-ul-Fitr holidays and will reply when support resumes.',
  },
  {
    ruleType: 'holiday',
    label: 'Eid-ul-Adha holiday 2026',
    startDate: '2026-05-25',
    endDate: '2026-05-30',
    replyText: 'Eid Mubarak. Our team is away for Eid-ul-Adha holidays and will reply when support resumes.',
  },
  {
    ruleType: 'holiday',
    label: 'Durga Puja holiday 2026',
    startDate: '2026-10-20',
    endDate: '2026-10-21',
    replyText: 'Thanks for your message. Our team is away for Durga Puja holidays and will reply when support resumes.',
  },
  {
    ruleType: 'off_hours',
    label: 'Daily after-hours',
    startMinute: 21 * 60,
    endMinute: 9 * 60,
    replyText: defaultReply,
  },
];

function normalizeTemplateStatus(status: string): WhatsAppTemplateStatus {
  if (status === 'approved' || status === 'rejected' || status === 'pending') return status;
  return 'pending';
}

function normalizeRuleType(ruleType: string): AutoReplyRuleType {
  return ruleType === 'off_hours' ? 'off_hours' : 'holiday';
}

function toTemplate(row: typeof whatsAppTemplates.$inferSelect) {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    languageCode: row.languageCode,
    category: row.category,
    status: normalizeTemplateStatus(row.status),
    body: row.body,
    rejectionReason: row.rejectionReason ?? undefined,
    lastSyncedAt: row.lastSyncedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAutoReplyRule(row: typeof clientAutoReplyRules.$inferSelect) {
  return {
    id: row.id,
    clientId: row.clientId,
    ruleType: normalizeRuleType(row.ruleType),
    label: row.label,
    timezone: row.timezone,
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    dayOfWeek: row.dayOfWeek ?? undefined,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    replyText: row.replyText,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseDate(value?: string) {
  if (value === undefined || value.trim() === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function daysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function ruleData(input: AutoReplyRuleInput) {
  return {
    ruleType: input.ruleType,
    label: input.label.trim(),
    timezone: input.timezone?.trim() || 'Asia/Dhaka',
    startDate: input.ruleType === 'holiday' ? input.startDate?.trim() || null : null,
    endDate: input.ruleType === 'holiday' ? input.endDate?.trim() || input.startDate?.trim() || null : null,
    dayOfWeek: input.ruleType === 'off_hours' ? input.dayOfWeek ?? null : null,
    startMinute: input.startMinute ?? 0,
    endMinute: input.endMinute ?? 1440,
    replyText: input.replyText.trim(),
    enabled: input.enabled ?? false,
  };
}

export class ChannelAdminService {
  constructor(
    private readonly db: AppDb,
    private readonly env: Env,
  ) {}

  async getHealthDashboard() {
    const clientRows = await this.db.select().from(clients).orderBy(desc(clients.createdAt));
    const checks = await Promise.all(
      clientRows.flatMap((client) => [this.buildMessengerCheck(client), this.buildWhatsappCheck(client)]),
    );
    return { generatedAt: new Date().toISOString(), checks };
  }

  async listWhatsAppTemplates(clientId: string) {
    await this.ensureClient(clientId);
    const rows = await this.db
      .select()
      .from(whatsAppTemplates)
      .where(eq(whatsAppTemplates.clientId, clientId))
      .orderBy(asc(whatsAppTemplates.status), desc(whatsAppTemplates.updatedAt));
    return rows.map(toTemplate);
  }

  async saveWhatsAppTemplate(
    clientId: string,
    input: {
      name: string;
      languageCode?: string;
      category?: string;
      status?: WhatsAppTemplateStatus;
      body: string;
      rejectionReason?: string;
      lastSyncedAt?: string;
    },
  ) {
    await this.ensureClient(clientId);
    const now = new Date();
    const name = input.name.trim();
    const languageCode = input.languageCode?.trim() || 'en_US';
    const status = input.status ?? 'pending';
    const [template] = await this.db
      .insert(whatsAppTemplates)
      .values({
        id: randomId('wa-template-'),
        clientId,
        name,
        languageCode,
        category: input.category?.trim() || 'utility',
        status,
        body: input.body.trim(),
        rejectionReason: status === 'rejected' ? input.rejectionReason?.trim() || null : null,
        lastSyncedAt: parseDate(input.lastSyncedAt),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [whatsAppTemplates.clientId, whatsAppTemplates.name, whatsAppTemplates.languageCode],
        set: {
          category: input.category?.trim() || 'utility',
          status,
          body: input.body.trim(),
          rejectionReason: status === 'rejected' ? input.rejectionReason?.trim() || null : null,
          lastSyncedAt: parseDate(input.lastSyncedAt),
          updatedAt: now,
        },
      })
      .returning();
    return toTemplate(template!);
  }

  async deleteWhatsAppTemplate(clientId: string, templateId: string) {
    const deleted = await this.db
      .delete(whatsAppTemplates)
      .where(and(eq(whatsAppTemplates.id, templateId), eq(whatsAppTemplates.clientId, clientId)))
      .returning({ id: whatsAppTemplates.id });
    if (deleted.length === 0) throw new NotFoundError(`WhatsApp template not found: ${templateId}`);
  }

  async listAutoReplyRules(clientId: string) {
    await this.ensureSeedRules(clientId);
    const rows = await this.db
      .select()
      .from(clientAutoReplyRules)
      .where(eq(clientAutoReplyRules.clientId, clientId))
      .orderBy(desc(clientAutoReplyRules.enabled), asc(clientAutoReplyRules.ruleType), desc(clientAutoReplyRules.updatedAt));
    return rows.map(toAutoReplyRule);
  }

  async createAutoReplyRule(clientId: string, input: AutoReplyRuleInput) {
    await this.ensureClient(clientId);
    const now = new Date();
    const [rule] = await this.db
      .insert(clientAutoReplyRules)
      .values({
        id: randomId('auto-reply-'),
        clientId,
        ...ruleData(input),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toAutoReplyRule(rule!);
  }

  async updateAutoReplyRule(clientId: string, ruleId: string, input: Partial<AutoReplyRuleInput>) {
    await this.ensureClient(clientId);
    const [existing] = await this.db
      .select()
      .from(clientAutoReplyRules)
      .where(and(eq(clientAutoReplyRules.id, ruleId), eq(clientAutoReplyRules.clientId, clientId)))
      .limit(1);
    if (existing === undefined) throw new NotFoundError(`Auto-reply rule not found: ${ruleId}`);

    const [rule] = await this.db
      .update(clientAutoReplyRules)
      .set({
        ...ruleData({
          ruleType: input.ruleType ?? normalizeRuleType(existing.ruleType),
          label: input.label ?? existing.label,
          timezone: input.timezone ?? existing.timezone,
          startDate: input.startDate ?? existing.startDate ?? undefined,
          endDate: input.endDate ?? existing.endDate ?? undefined,
          dayOfWeek: input.dayOfWeek ?? existing.dayOfWeek ?? undefined,
          startMinute: input.startMinute ?? existing.startMinute,
          endMinute: input.endMinute ?? existing.endMinute,
          replyText: input.replyText ?? existing.replyText,
          enabled: input.enabled ?? existing.enabled,
        }),
        updatedAt: new Date(),
      })
      .where(eq(clientAutoReplyRules.id, ruleId))
      .returning();
    return toAutoReplyRule(rule!);
  }

  async deleteAutoReplyRule(clientId: string, ruleId: string) {
    const deleted = await this.db
      .delete(clientAutoReplyRules)
      .where(and(eq(clientAutoReplyRules.id, ruleId), eq(clientAutoReplyRules.clientId, clientId)))
      .returning({ id: clientAutoReplyRules.id });
    if (deleted.length === 0) throw new NotFoundError(`Auto-reply rule not found: ${ruleId}`);
  }

  private async buildMessengerCheck(client: typeof clients.$inferSelect) {
    const tokenExpiresAt = parseDate(envString(this.env, 'MESSENGER_PAGE_TOKEN_EXPIRES_AT'));
    const tokenDaysRemaining = tokenExpiresAt === undefined ? undefined : daysUntil(tokenExpiresAt);
    const webhook = await this.getWebhookStats(client.id, 'messenger');
    const pageLinked = client.pageId.trim() !== '' && !client.pageId.includes('-page-pending');
    const tokenConfigured = envString(this.env, 'MESSENGER_PAGE_ACCESS_TOKEN') !== undefined;
    const status: HealthStatus =
      !pageLinked || !tokenConfigured
        ? 'needs_setup'
        : tokenDaysRemaining !== undefined && tokenDaysRemaining <= 7
          ? 'warning'
          : 'healthy';

    return {
      clientId: client.id,
      businessName: client.businessName,
      channel: 'messenger' as const,
      status,
      setupLabel: pageLinked ? '1 page linked' : 'Page setup needed',
      detail: tokenConfigured
        ? tokenDaysRemaining === undefined
          ? 'Page token configured. Add MESSENGER_PAGE_TOKEN_EXPIRES_AT to show TTL.'
          : `Page token ${tokenDaysRemaining < 0 ? 'expired' : 'expires'} in ${tokenDaysRemaining} days.`
        : 'Messenger page token is not configured.',
      tokenExpiresAt: tokenExpiresAt?.toISOString(),
      tokenDaysRemaining,
      webhookLastSeenAt: webhook.lastSeenAt,
      eventsLast24h: webhook.eventsLast24h,
      failuresLast24h: null,
    };
  }

  private async buildWhatsappCheck(client: typeof clients.$inferSelect) {
    const accessTokenConfigured = envString(this.env, 'WHATSAPP_ACCESS_TOKEN') !== undefined;
    const numberId = envString(this.env, 'WHATSAPP_PHONE_NUMBER_ID');
    const webhook = await this.getWebhookStats(client.id, 'whatsapp');
    const templateCounts = await this.getTemplateCounts(client.id);
    const status: HealthStatus =
      accessTokenConfigured && numberId !== undefined
        ? templateCounts.approved > 0 || webhook.eventsLast24h > 0
          ? 'healthy'
          : 'warning'
        : 'needs_setup';

    return {
      clientId: client.id,
      businessName: client.businessName,
      channel: 'whatsapp' as const,
      status,
      setupLabel: numberId !== undefined ? `Number ID ${numberId}` : 'Number ID missing',
      detail:
        accessTokenConfigured && numberId !== undefined
          ? `${templateCounts.approved} approved templates, ${templateCounts.pending} pending, ${templateCounts.rejected} rejected.`
          : 'WhatsApp access token or phone number ID is missing.',
      webhookLastSeenAt: webhook.lastSeenAt,
      eventsLast24h: webhook.eventsLast24h,
      failuresLast24h: null,
      templateCounts,
    };
  }

  private async getWebhookStats(clientId: string, channel: HealthChannel) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [lastConversation] = await this.db
      .select({ updatedAt: conversations.updatedAt })
      .from(conversations)
      .where(and(eq(conversations.clientId, clientId), eq(conversations.channel, channel)))
      .orderBy(desc(conversations.updatedAt))
      .limit(1);
    const [eventCount] = await this.db
      .select({ value: count() })
      .from(conversations)
      .where(and(eq(conversations.clientId, clientId), eq(conversations.channel, channel), gte(conversations.updatedAt, since)));
    return {
      lastSeenAt: lastConversation?.updatedAt.toISOString(),
      eventsLast24h: eventCount?.value ?? 0,
    };
  }

  private async getTemplateCounts(clientId: string) {
    const rows = await this.db
      .select({ status: whatsAppTemplates.status, value: count() })
      .from(whatsAppTemplates)
      .where(eq(whatsAppTemplates.clientId, clientId))
      .groupBy(whatsAppTemplates.status);
    return {
      approved: rows.find((row) => row.status === 'approved')?.value ?? 0,
      pending: rows.find((row) => row.status === 'pending')?.value ?? 0,
      rejected: rows.find((row) => row.status === 'rejected')?.value ?? 0,
    };
  }

  private async ensureSeedRules(clientId: string) {
    await this.ensureClient(clientId);
    const [existing] = await this.db
      .select({ value: count() })
      .from(clientAutoReplyRules)
      .where(eq(clientAutoReplyRules.clientId, clientId));
    if ((existing?.value ?? 0) > 0) return;

    const now = new Date();
    await this.db.insert(clientAutoReplyRules).values(
      seedRules.map((rule) => ({
        id: randomId('auto-reply-'),
        clientId,
        ...ruleData(rule),
        timezone: rule.timezone ?? 'Asia/Dhaka',
        enabled: false,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  private async ensureClient(clientId: string) {
    const [client] = await this.db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
    if (client === undefined) throw new NotFoundError(`Client not found: ${clientId}`);
  }
}
