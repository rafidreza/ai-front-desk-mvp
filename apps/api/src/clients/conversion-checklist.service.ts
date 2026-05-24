import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConversionChecklistItem } from '../types/domain';

interface AutoItemSpec {
  id: string;
  label: string;
  detail: (data: Snapshot) => string | undefined;
  done: (data: Snapshot) => boolean;
}

interface Snapshot {
  onboardingStatus: string;
  lifecycleStage: string;
  updatedAt: Date;
  connectedChannelCount: number;
  activeKnowledgeCount: number;
  approvedTemplateCount: number;
}

const AUTO_ITEMS: AutoItemSpec[] = [
  {
    id: 'profile_complete',
    label: 'Business profile completed',
    detail: (data) => `Onboarding status: ${data.onboardingStatus}`,
    done: (data) =>
      data.onboardingStatus === 'profile_complete' ||
      data.onboardingStatus === 'channels_complete' ||
      data.onboardingStatus === 'onboarding_complete' ||
      data.onboardingStatus === 'active' ||
      data.onboardingStatus === 'live',
  },
  {
    id: 'channels_connected',
    label: 'At least one channel connected',
    detail: (data) => `${data.connectedChannelCount} channel(s) connected`,
    done: (data) => data.connectedChannelCount >= 1,
  },
  {
    id: 'kb_v1_active',
    label: 'Knowledge base v1 active (≥10 entries)',
    detail: (data) => `${data.activeKnowledgeCount} active entries`,
    done: (data) => data.activeKnowledgeCount >= 10,
  },
  {
    id: 'whatsapp_template_approved',
    label: 'WhatsApp template approved (if WhatsApp in use)',
    detail: (data) => `${data.approvedTemplateCount} approved template(s)`,
    done: (data) => data.approvedTemplateCount >= 1,
  },
  {
    id: 'live_two_weeks',
    label: 'Live for ≥14 days without churn flag',
    detail: (data) => {
      const days = Math.floor((Date.now() - data.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      return `${days} day(s) in current stage`;
    },
    done: (data) => {
      if (data.lifecycleStage !== 'live' && data.lifecycleStage !== 'paid') return false;
      const days = (Date.now() - data.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      return days >= 14;
    },
  },
];

const MANUAL_ITEMS: Omit<ConversionChecklistItem, 'done' | 'updatedAt'>[] = [
  { id: 'shadow_qa_passed', label: 'Shadow QA review passed', source: 'manual' },
  { id: 'meta_app_review_submitted', label: 'Meta App Review submitted', source: 'manual' },
  { id: 'dpa_signed', label: 'DPA signed by client', source: 'manual' },
  { id: 'billing_set_up', label: 'Billing set up (SSLCommerz / bKash)', source: 'manual' },
  { id: 'first_digest_delivered', label: 'First daily digest delivered', source: 'manual' },
];

@Injectable()
export class ConversionChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(clientId: string): Promise<ConversionChecklistItem[]> {
    if (this.prisma?.enabled !== true) {
      return this.fallbackList();
    }
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        onboardingStatus: true,
        lifecycleStage: true,
        updatedAt: true,
        conversionChecklist: true,
      },
    });
    if (client === null) {
      throw new NotFoundException(`Client not found: ${clientId}`);
    }

    const [connectedChannelCount, activeKnowledgeCount, approvedTemplateCount] = await Promise.all([
      this.prisma.clientChannel.count({
        where: { clientId, status: { in: ['connected', 'available'] } },
      }),
      this.prisma.knowledgeEntry.count({ where: { clientId, status: 'active' } }),
      this.prisma.whatsAppTemplate.count({ where: { clientId, status: 'approved' } }),
    ]);

    const snapshot: Snapshot = {
      onboardingStatus: client.onboardingStatus,
      lifecycleStage: client.lifecycleStage,
      updatedAt: client.updatedAt,
      connectedChannelCount,
      activeKnowledgeCount,
      approvedTemplateCount,
    };

    const manualMap = new Map<string, ConversionChecklistItem>();
    if (Array.isArray(client.conversionChecklist)) {
      for (const raw of client.conversionChecklist) {
        if (typeof raw !== 'object' || raw === null) continue;
        const entry = raw as Record<string, unknown>;
        const id = String(entry.id ?? '');
        if (id.length === 0) continue;
        manualMap.set(id, {
          id,
          label: String(entry.label ?? id),
          done: entry.done === true,
          source: entry.source === 'auto' ? 'auto' : 'manual',
          detail: typeof entry.detail === 'string' ? entry.detail : undefined,
          updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : undefined,
        });
      }
    }

    const autoItems: ConversionChecklistItem[] = AUTO_ITEMS.map((spec) => ({
      id: spec.id,
      label: spec.label,
      done: spec.done(snapshot),
      source: 'auto',
      detail: spec.detail(snapshot),
    }));

    const manualItems: ConversionChecklistItem[] = MANUAL_ITEMS.map((spec) => {
      const stored = manualMap.get(spec.id);
      return {
        id: spec.id,
        label: spec.label,
        source: 'manual',
        done: stored?.done === true,
        detail: stored?.detail,
        updatedAt: stored?.updatedAt,
      };
    });

    return [...autoItems, ...manualItems];
  }

  private fallbackList(): ConversionChecklistItem[] {
    return [
      ...AUTO_ITEMS.map((spec) => ({
        id: spec.id,
        label: spec.label,
        done: false,
        source: 'auto' as const,
        detail: 'No database connection — auto check skipped',
      })),
      ...MANUAL_ITEMS.map((spec) => ({
        id: spec.id,
        label: spec.label,
        done: false,
        source: 'manual' as const,
      })),
    ];
  }
}
