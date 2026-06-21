import Anthropic from '@anthropic-ai/sdk';
import type { AgentReply, ClientProfile, ConversationQaDefect, KnowledgeEntry, PromptProfile, Ticket } from '@ai-front-desk/shared';
import type { Env } from '../env';
import { envString } from '../env';

type AiProvider = 'anthropic' | 'openrouter' | 'local';

type AiRuntimeConfig = {
  provider: AiProvider;
  model?: string;
  apiKey?: string;
};

export class AiService {
  constructor(private readonly env: Env) {}

  async generateReply(input: {
    client: ClientProfile;
    customerText: string;
    knowledgeEntries: KnowledgeEntry[];
    promptProfile?: PromptProfile;
    retrievalConfidence: number;
  }): Promise<AgentReply> {
    const escalationReason = this.detectEscalation(input.client, input.customerText, input.retrievalConfidence);
    const runtime = this.getRuntimeConfig(input.promptProfile);

    if (runtime.provider !== 'local' && runtime.apiKey !== undefined && input.knowledgeEntries.length > 0) {
      const reply =
        runtime.provider === 'openrouter'
          ? await this.generateOpenRouterReply(input, runtime)
          : await this.generateClaudeReply(input, new Anthropic({ apiKey: runtime.apiKey }), runtime.model);
      return {
        text: reply,
        confidence: input.retrievalConfidence,
        matchedKnowledgeIds: input.knowledgeEntries.map((entry) => entry.id),
        shouldEscalate: escalationReason !== null,
        escalationReason: escalationReason ?? undefined,
      };
    }

    return {
      text: this.generateLocalFallback(input.knowledgeEntries, escalationReason, input.promptProfile),
      confidence: input.retrievalConfidence,
      matchedKnowledgeIds: input.knowledgeEntries.map((entry) => entry.id),
      shouldEscalate: escalationReason !== null,
      escalationReason: escalationReason ?? undefined,
    };
  }

  private getRuntimeConfig(promptProfile?: PromptProfile): AiRuntimeConfig {
    const provider = this.normalizeProvider(promptProfile?.aiProvider ?? envString(this.env, 'AI_PROVIDER'));
    if (provider === 'openrouter' || (provider === undefined && envString(this.env, 'OPENROUTER_API_KEY') !== undefined)) {
      return {
        provider: 'openrouter',
        apiKey: envString(this.env, 'OPENROUTER_API_KEY'),
        model:
          promptProfile?.aiModel ??
          envString(this.env, 'AI_MODEL') ??
          envString(this.env, 'OPENROUTER_MODEL') ??
          'anthropic/claude-3.5-haiku',
      };
    }

    if (provider === 'anthropic' || (provider === undefined && envString(this.env, 'ANTHROPIC_API_KEY') !== undefined)) {
      return {
        provider: 'anthropic',
        apiKey: envString(this.env, 'ANTHROPIC_API_KEY'),
        model:
          promptProfile?.aiModel ??
          envString(this.env, 'AI_MODEL') ??
          envString(this.env, 'ANTHROPIC_MODEL') ??
          'claude-3-5-haiku-latest',
      };
    }

    return { provider: 'local' };
  }

  private normalizeProvider(provider?: string): AiProvider | undefined {
    if (provider === 'anthropic' || provider === 'openrouter' || provider === 'local') return provider;
    return undefined;
  }

  private systemPrompt(input: { client: ClientProfile; promptProfile?: PromptProfile }) {
    return [
      input.promptProfile?.systemInstructions ?? `You are the Daemion support agent for ${input.client.businessName}.`,
      `Tone rules: ${input.promptProfile?.toneRules ?? input.client.tone}.`,
      `Escalation rules: ${input.promptProfile?.escalationRules ?? 'Escalate when confidence is low or the customer needs a human.'}.`,
      `Forbidden claims: ${input.promptProfile?.forbiddenClaims ?? 'Do not invent prices, stock, delivery promises, discounts, or policy details.'}.`,
      `Fallback behavior: ${input.promptProfile?.fallbackBehavior ?? 'If the answer is missing, politely say a team member will check.'}.`,
      'Only answer from the supplied knowledge. If the answer is missing, politely say a team member will check.',
      'Reply naturally in Bangla/Banglish/English based on the customer message.',
      'Keep replies short enough for Messenger commerce.',
    ].join('\n');
  }

  private knowledgePrompt(input: { customerText: string; knowledgeEntries: KnowledgeEntry[] }) {
    const knowledge = input.knowledgeEntries.map((entry) => `- ${entry.title}: ${entry.answer}`).join('\n');
    return `Knowledge:\n${knowledge}\n\nCustomer message:\n${input.customerText}`;
  }

  private async generateClaudeReply(
    input: {
      client: ClientProfile;
      customerText: string;
      knowledgeEntries: KnowledgeEntry[];
      promptProfile?: PromptProfile;
    },
    anthropic: Anthropic,
    model = 'claude-3-5-haiku-latest',
  ) {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 220,
      temperature: 0.2,
      system: this.systemPrompt(input),
      messages: [{ role: 'user', content: this.knowledgePrompt(input) }],
    });
    const firstBlock = message.content[0];
    return firstBlock?.type === 'text' ? firstBlock.text.trim() : 'Thanks for your message. Our team will check and get back to you shortly.';
  }

  private async generateOpenRouterReply(
    input: {
      client: ClientProfile;
      customerText: string;
      knowledgeEntries: KnowledgeEntry[];
      promptProfile?: PromptProfile;
    },
    runtime: AiRuntimeConfig,
  ) {
    const baseUrl = envString(this.env, 'OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1') ?? 'https://openrouter.ai/api/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${runtime.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': envString(this.env, 'OPENROUTER_SITE_URL') ?? envString(this.env, 'WEB_APP_URL', 'http://localhost:3002') ?? 'http://localhost:3002',
        'X-OpenRouter-Title': envString(this.env, 'OPENROUTER_APP_NAME', 'Daemion') ?? 'Daemion',
      },
      body: JSON.stringify({
        model: runtime.model ?? 'anthropic/claude-3.5-haiku',
        max_tokens: 220,
        temperature: 0.2,
        messages: [
          { role: 'system', content: this.systemPrompt(input) },
          { role: 'user', content: this.knowledgePrompt(input) },
        ],
      }),
    });

    const data = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      error?: { message?: string };
    } | null;
    if (!response.ok) throw new Error(`OpenRouter request failed: ${data?.error?.message ?? response.status}`);
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim() !== '') return content.trim();
    return 'Thanks for your message. Our team will check and get back to you shortly.';
  }

  private generateLocalFallback(entries: KnowledgeEntry[], escalationReason: string | null, promptProfile?: PromptProfile) {
    if (entries.length === 0) {
      return promptProfile?.fallbackBehavior ?? 'Thanks for your message. Ami team ke check korte dicchi, tara shortly update debe.';
    }
    const answer = entries[0]!.answer;
    return escalationReason === null ? answer : `${answer}\n\nAmi eta team er kache forward kore dicchi so they can confirm details.`;
  }

  private detectEscalation(client: ClientProfile, text: string, confidence: number) {
    const normalizedText = text.toLowerCase();
    const matchedKeyword = client.escalationKeywords.find((keyword) => normalizedText.includes(keyword.toLowerCase()));
    if (matchedKeyword !== undefined) return `Matched escalation keyword: ${matchedKeyword}`;
    if (confidence <= 0.65) return 'Low knowledge confidence';
    return null;
  }
}

export class AutoQaService {
  score(input: { customerText: string; reply: AgentReply; ticket?: Ticket }) {
    const defects: ConversationQaDefect[] = [];
    if (input.reply.confidence <= 0.65) defects.push('low_confidence');
    if (input.reply.matchedKnowledgeIds.length === 0) defects.push('no_knowledge_match');
    if (input.reply.shouldEscalate) defects.push('escalation_needed');
    if (input.ticket === undefined && this.customerSeemsEscalation(input.customerText)) defects.push('escalation_miss');
    if (this.replySeemsUnsupported(input.reply.text)) defects.push('hallucination_risk');
    const score = Math.max(0, 100 - defects.length * 22 - (input.reply.confidence < 0.8 ? 8 : 0));
    return {
      score,
      grade: score >= 85 ? 'pass' as const : score >= 60 ? 'review' as const : 'fail' as const,
      defects,
      reason: defects.length === 0 ? 'No obvious QA defects detected.' : `Detected: ${defects.join(', ')}`,
      version: 'auto-qa-v1',
    };
  }

  private customerSeemsEscalation(text: string) {
    return /(refund|complaint|wrong product|cancel|human|রিফান্ড|অভিযোগ)/i.test(text);
  }

  private replySeemsUnsupported(text: string) {
    return /(guaranteed|always|definitely|free delivery everywhere|100%)/i.test(text);
  }
}
