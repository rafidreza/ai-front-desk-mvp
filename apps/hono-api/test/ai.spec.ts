import { describe, expect, it } from 'vitest';
import type { ClientProfile, KnowledgeEntry } from '@ai-front-desk/shared';
import { AiService } from '../src/services/ai';

const client: ClientProfile = {
  id: 'pilot-abc',
  businessName: 'ABC Telecom',
  pageId: 'pilot-abc-page',
  status: 'active',
  onboardingStatus: 'live',
  lifecycleStage: 'live',
  defaultLanguage: 'mixed',
  tone: 'friendly',
  escalationKeywords: ['refund', 'complaint', 'cancel'],
};

function entry(overrides: Partial<KnowledgeEntry>): KnowledgeEntry {
  return {
    id: overrides.id ?? 'kb-test',
    clientId: 'pilot-abc',
    title: overrides.title ?? 'Coverage area',
    answer: overrides.answer ?? 'ঢাকা এবং চট্টগ্রাম সিটি এলাকায় সেবা পাওয়া যাচ্ছে।',
    keywords: overrides.keywords ?? ['coverage', 'area', 'elaka'],
    category: overrides.category ?? 'service',
    status: 'active',
    version: 1,
  };
}

describe('AiService response decisions', () => {
  const ai = new AiService({});

  it('treats Bengali thanks as a conversational close instead of an escalation', async () => {
    const reply = await ai.generateReply({
      client,
      customerText: 'ধন্যবাদ',
      knowledgeEntries: [],
      retrievalConfidence: 0.3,
    });

    expect(reply.shouldEscalate).toBe(false);
    expect(reply.matchedKnowledgeIds).toEqual([]);
    expect(reply.text).toContain('স্বাগতম');
  });

  it('asks for location after a coverage answer', async () => {
    const reply = await ai.generateReply({
      client,
      customerText: 'service area kothay?',
      knowledgeEntries: [entry({ title: 'Coverage area', keywords: ['coverage', 'area', 'elaka'] })],
      retrievalConfidence: 0.9,
    });

    expect(reply.shouldEscalate).toBe(false);
    expect(reply.text).toContain('কোন এলাকায়');
  });

  it('asks package preference after a pricing answer', async () => {
    const reply = await ai.generateReply({
      client,
      customerText: 'package er dam koto?',
      knowledgeEntries: [
        entry({
          title: 'Package prices',
          answer: 'পাঁচশো এমবিপিএস প্যাকেজ মাসিক পনেরোশো টাকা।',
          keywords: ['price', 'cost', 'package'],
          category: 'pricing',
        }),
      ],
      retrievalConfidence: 0.9,
    });

    expect(reply.text).toContain('500 Mbps');
    expect(reply.text).toContain('1 Gbps');
  });

  it('asks installation area after an installation answer', async () => {
    const reply = await ai.generateReply({
      client,
      customerText: 'installation free kina?',
      knowledgeEntries: [
        entry({
          title: 'Installation charge',
          answer: 'এই মাসে ইনস্টলেশন সম্পূর্ণ ফ্রি।',
          keywords: ['installation', 'setup', 'free'],
          category: 'pricing',
        }),
      ],
      retrievalConfidence: 0.9,
    });

    expect(reply.text).toContain('installation নিতে চান');
  });
});
