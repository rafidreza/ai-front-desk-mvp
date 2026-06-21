import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiService } from './ai.service';
import { ClientProfile, KnowledgeEntry } from '../types/domain';

const baseClient: ClientProfile = {
  id: 'pilot-client',
  businessName: 'Test Seller',
  pageId: 'test-page',
  status: 'active',
  lifecycleStage: 'live',
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
  let originalOpenRouterKey: string | undefined;
  let originalProvider: string | undefined;
  let originalModel: string | undefined;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalKey = process.env.ANTHROPIC_API_KEY;
    originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
    originalProvider = process.env.AI_PROVIDER;
    originalModel = process.env.OPENROUTER_MODEL;
    originalFetch = globalThis.fetch;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.AI_PROVIDER;
    delete process.env.OPENROUTER_MODEL;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
    if (originalOpenRouterKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
    }
    if (originalProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = originalProvider;
    }
    if (originalModel === undefined) {
      delete process.env.OPENROUTER_MODEL;
    } else {
      process.env.OPENROUTER_MODEL = originalModel;
    }
    globalThis.fetch = originalFetch;
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

  it('uses OpenRouter chat completions when an OpenRouter key is configured', async () => {
    process.env.OPENROUTER_API_KEY = 'openrouter-key';
    process.env.OPENROUTER_MODEL = 'anthropic/claude-3.5-haiku';
    let requestedBody: { model?: string; messages?: Array<{ role: string; content: string }> } | undefined;
    globalThis.fetch = (async (_url, init) => {
      requestedBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'OpenRouter says Dhaka delivery is BDT 80.' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof globalThis.fetch;

    const service = new AiService();
    const reply = await service.generateReply({
      client: baseClient,
      customerText: 'delivery charge?',
      knowledgeEntries: [sampleEntry],
      retrievalConfidence: 0.9,
    });

    expect(requestedBody?.model).toBe('anthropic/claude-3.5-haiku');
    expect(requestedBody?.messages?.[0]?.role).toBe('system');
    expect(reply.text).toContain('OpenRouter');
    expect(reply.shouldEscalate).toBe(false);
  });
});
