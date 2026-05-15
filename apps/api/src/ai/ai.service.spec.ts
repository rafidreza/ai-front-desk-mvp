import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiService } from './ai.service';
import { ClientProfile, KnowledgeEntry } from '../types/domain';

const baseClient: ClientProfile = {
  id: 'pilot-client',
  businessName: 'Test Seller',
  pageId: 'test-page',
  defaultLanguage: 'mixed',
  tone: 'friendly',
  escalationKeywords: ['refund', 'cancel', 'রিফান্ড'],
  onboardingStatus: 'live',
};

const sampleEntry: KnowledgeEntry = {
  id: 'sample',
  clientId: 'pilot-client',
  title: 'Delivery',
  answer: 'BDT 80 inside Dhaka.',
  keywords: ['delivery'],
  status: 'active',
  version: 1,
};

describe('AiService (fallback path, no Anthropic key)', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it('uses the first knowledge entry as the fallback reply when no key is set', async () => {
    const service = new AiService();
    const reply = await service.generateReply({
      client: baseClient,
      customerText: 'delivery charge?',
      knowledgeEntries: [sampleEntry],
      retrievalConfidence: 0.9,
    });

    expect(reply.text).toContain('BDT 80');
    expect(reply.shouldEscalate).toBe(false);
  });

  it('escalates when an escalation keyword appears in the customer message', async () => {
    const service = new AiService();
    const reply = await service.generateReply({
      client: baseClient,
      customerText: 'I want a refund please',
      knowledgeEntries: [sampleEntry],
      retrievalConfidence: 0.9,
    });

    expect(reply.shouldEscalate).toBe(true);
    expect(reply.escalationReason).toMatch(/refund/i);
  });

  it('escalates when retrieval confidence is too low', async () => {
    const service = new AiService();
    const reply = await service.generateReply({
      client: baseClient,
      customerText: 'something random',
      knowledgeEntries: [],
      retrievalConfidence: 0.3,
    });

    expect(reply.shouldEscalate).toBe(true);
    expect(reply.escalationReason).toMatch(/confidence/i);
  });
});
