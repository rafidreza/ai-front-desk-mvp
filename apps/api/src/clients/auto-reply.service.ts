import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AgentReply, AutoReplyRuleType, ClientAutoReplyRule } from '../types/domain';

export interface AutoReplyRuleInput {
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
}

const defaultReply =
  'Thanks for your message. Our team is offline right now, but Daemon has logged your request and we will follow up when support resumes.';

const seedRules = [
  {
    ruleType: 'holiday' as const,
    label: 'Eid-ul-Fitr holiday 2026',
    startDate: '2026-03-19',
    endDate: '2026-03-23',
    replyText: 'Eid Mubarak. Our team is away for Eid-ul-Fitr holidays and will reply when support resumes.',
  },
  {
    ruleType: 'holiday' as const,
    label: 'Eid-ul-Adha holiday 2026',
    startDate: '2026-05-25',
    endDate: '2026-05-30',
    replyText: 'Eid Mubarak. Our team is away for Eid-ul-Adha holidays and will reply when support resumes.',
  },
  {
    ruleType: 'holiday' as const,
    label: 'Durga Puja holiday 2026',
    startDate: '2026-10-20',
    endDate: '2026-10-21',
    replyText: 'Thanks for your message. Our team is away for Durga Puja holidays and will reply when support resumes.',
  },
  {
    ruleType: 'off_hours' as const,
    label: 'Daily after-hours',
    startMinute: 21 * 60,
    endMinute: 9 * 60,
    replyText: defaultReply,
  },
];

function toRule(row: {
  id: string;
  clientId: string;
  ruleType: string;
  label: string;
  timezone: string;
  startDate: string | null;
  endDate: string | null;
  dayOfWeek: number | null;
  startMinute: number;
  endMinute: number;
  replyText: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ClientAutoReplyRule {
  return {
    id: row.id,
    clientId: row.clientId,
    ruleType: row.ruleType === 'off_hours' ? 'off_hours' : 'holiday',
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

@Injectable()
export class AutoReplyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(clientId: string): Promise<ClientAutoReplyRule[]> {
    await this.ensureSeedRules(clientId);
    const rules = await this.prisma.clientAutoReplyRule.findMany({
      where: { clientId },
      orderBy: [{ enabled: 'desc' }, { ruleType: 'asc' }, { updatedAt: 'desc' }],
    });
    return rules.map(toRule);
  }

  async create(clientId: string, input: AutoReplyRuleInput): Promise<ClientAutoReplyRule> {
    await this.ensureClient(clientId);
    const rule = await this.prisma.clientAutoReplyRule.create({
      data: {
        id: `auto-reply-${randomUUID()}`,
        clientId,
        ...this.ruleData(input),
      },
    });
    return toRule(rule);
  }

  async update(clientId: string, ruleId: string, input: Partial<AutoReplyRuleInput>): Promise<ClientAutoReplyRule> {
    await this.ensureClient(clientId);
    const existing = await this.prisma.clientAutoReplyRule.findFirst({ where: { id: ruleId, clientId } });
    if (existing === null) {
      throw new NotFoundException(`Auto-reply rule not found: ${ruleId}`);
    }
    const rule = await this.prisma.clientAutoReplyRule.update({
      where: { id: ruleId },
      data: this.ruleData({
        ruleType: input.ruleType ?? (existing.ruleType === 'off_hours' ? 'off_hours' : 'holiday'),
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
    });
    return toRule(rule);
  }

  async delete(clientId: string, ruleId: string): Promise<void> {
    const deleted = await this.prisma.clientAutoReplyRule.deleteMany({ where: { id: ruleId, clientId } });
    if (deleted.count === 0) {
      throw new NotFoundException(`Auto-reply rule not found: ${ruleId}`);
    }
  }

  async findActiveReply(input: { clientId: string; at: Date }): Promise<AgentReply | undefined> {
    const rules = await this.prisma.clientAutoReplyRule.findMany({
      where: { clientId: input.clientId, enabled: true },
      orderBy: [{ ruleType: 'asc' }, { updatedAt: 'desc' }],
    });
    const matched = rules.map(toRule).find((rule) => ruleMatches(rule, input.at));
    if (matched === undefined) return undefined;

    return {
      text: matched.replyText,
      confidence: 1,
      matchedKnowledgeIds: [`auto-reply:${matched.id}`],
      shouldEscalate: false,
    };
  }

  private ruleData(input: AutoReplyRuleInput) {
    return {
      ruleType: input.ruleType,
      label: input.label.trim(),
      timezone: input.timezone?.trim() || 'Asia/Dhaka',
      startDate: input.startDate?.trim() || null,
      endDate: input.endDate?.trim() || null,
      dayOfWeek: input.ruleType === 'off_hours' ? input.dayOfWeek ?? null : null,
      startMinute: input.startMinute ?? 0,
      endMinute: input.endMinute ?? 1440,
      replyText: input.replyText.trim(),
      enabled: input.enabled ?? false,
    };
  }

  private async ensureSeedRules(clientId: string): Promise<void> {
    await this.ensureClient(clientId);
    const count = await this.prisma.clientAutoReplyRule.count({ where: { clientId } });
    if (count > 0) return;

    await this.prisma.clientAutoReplyRule.createMany({
      data: seedRules.map((rule) => ({
        id: `auto-reply-${randomUUID()}`,
        clientId,
        timezone: 'Asia/Dhaka',
        enabled: false,
        startMinute: 0,
        endMinute: 1440,
        ...rule,
      })),
    });
  }

  private async ensureClient(clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (client === null) {
      throw new NotFoundException(`Client not found: ${clientId}`);
    }
  }
}

function ruleMatches(rule: ClientAutoReplyRule, at: Date): boolean {
  const local = localParts(at, rule.timezone);
  if (rule.ruleType === 'holiday') {
    if (rule.startDate === undefined) return false;
    const endDate = rule.endDate ?? rule.startDate;
    return local.date >= rule.startDate && local.date <= endDate;
  }

  if (rule.dayOfWeek !== undefined && rule.dayOfWeek !== local.dayOfWeek) return false;
  if (rule.startMinute <= rule.endMinute) {
    return local.minuteOfDay >= rule.startMinute && local.minuteOfDay < rule.endMinute;
  }
  return local.minuteOfDay >= rule.startMinute || local.minuteOfDay < rule.endMinute;
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday')),
    minuteOfDay: hour * 60 + minute,
  };
}
