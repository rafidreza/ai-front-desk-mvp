import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { AgentReply, AiProviderHealth, ClientProfile, KnowledgeEntry, PromptProfile } from '../types/domain';

type ProviderEvent = {
  ok: boolean;
  at: number;
};

type AiProvider = 'anthropic' | 'openrouter' | 'local';

type AiRuntimeConfig = {
  provider: AiProvider;
  model?: string;
  apiKey?: string;
};

@Injectable()
export class AiService {
  private readonly providerEvents: ProviderEvent[] = [];

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
      const providerHealth = this.getProviderHealth();
      if (!providerHealth.isDegraded) {
        try {
          const reply =
            runtime.provider === 'openrouter'
              ? await this.generateOpenRouterReply(input, runtime)
              : await this.generateClaudeReply(input, new Anthropic({ apiKey: runtime.apiKey }), runtime.model);
          this.recordProviderEvent(true);
          return {
            text: reply,
            confidence: input.retrievalConfidence,
            matchedKnowledgeIds: input.knowledgeEntries.map((entry) => entry.id),
            shouldEscalate: escalationReason !== null,
            escalationReason: escalationReason ?? undefined,
          };
        } catch {
          this.recordProviderEvent(false);
        }
      }
    }

    const fallback = this.generateLocalFallback(input.knowledgeEntries, escalationReason, input.promptProfile);
    return {
      text: fallback,
      confidence: input.retrievalConfidence,
      matchedKnowledgeIds: input.knowledgeEntries.map((entry) => entry.id),
      shouldEscalate: escalationReason !== null,
      escalationReason: escalationReason ?? undefined,
    };
  }

  getProviderHealth(now = new Date()): AiProviderHealth {
    const windowMinutes = Number(process.env.AI_DEGRADATION_WINDOW_MINUTES ?? 5);
    const threshold = Number(process.env.AI_DEGRADATION_FAILURE_THRESHOLD ?? 3);
    const windowMs = Math.max(windowMinutes, 1) * 60 * 1000;
    const cutoff = now.getTime() - windowMs;
    this.trimProviderEvents(cutoff);

    const failures = this.providerEvents.filter((event) => !event.ok);
    const lastFailure = failures.at(-1);
    const runtime = this.getRuntimeConfig();
    const hasConfiguredProvider = runtime.provider !== 'local' && runtime.apiKey !== undefined;
    const isDegraded = hasConfiguredProvider && failures.length >= Math.max(threshold, 1);

    if (!hasConfiguredProvider) {
      return {
        status: 'local_fallback',
        isDegraded: false,
        failureCount: 0,
        windowMinutes,
        threshold,
        fallbackActive: true,
        message: 'No AI provider API key is configured; local fallback replies are active.',
      };
    }

    return {
      status: isDegraded ? 'degraded' : 'ok',
      isDegraded,
      failureCount: failures.length,
      windowMinutes,
      threshold,
      fallbackActive: isDegraded,
      lastFailureAt: lastFailure === undefined ? undefined : new Date(lastFailure.at).toISOString(),
      message: isDegraded
        ? `${runtime.provider} failure threshold reached; fallback replies are active.`
        : `${runtime.provider} provider is within the normal failure threshold.`,
    };
  }

  private getRuntimeConfig(promptProfile?: PromptProfile): AiRuntimeConfig {
    const provider = this.normalizeProvider(promptProfile?.aiProvider ?? process.env.AI_PROVIDER);
    if (provider === 'openrouter' || (provider === undefined && (process.env.OPENROUTER_API_KEY ?? '') !== '')) {
      return {
        provider: 'openrouter',
        apiKey: process.env.OPENROUTER_API_KEY,
        model: promptProfile?.aiModel ?? process.env.AI_MODEL ?? process.env.OPENROUTER_MODEL ?? 'anthropic/claude-3.5-haiku',
      };
    }

    if (provider === 'anthropic' || (provider === undefined && (process.env.ANTHROPIC_API_KEY ?? '') !== '')) {
      return {
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: promptProfile?.aiModel ?? process.env.AI_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-latest',
      };
    }

    return { provider: 'local' };
  }

  private normalizeProvider(provider?: string): AiProvider | undefined {
    if (provider === 'anthropic' || provider === 'openrouter' || provider === 'local') return provider;
    return undefined;
  }

  private systemPrompt(input: {
    client: ClientProfile;
    promptProfile?: PromptProfile;
  }) {
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
    const knowledge = input.knowledgeEntries
      .map((entry) => `- ${entry.title}: ${entry.answer}`)
      .join('\n');
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
  ): Promise<string> {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 220,
      temperature: 0.2,
      system: this.systemPrompt(input),
      messages: [
        {
          role: 'user',
          content: this.knowledgePrompt(input),
        },
      ],
    });

    const firstBlock = message.content[0];
    if (firstBlock.type === 'text') {
      return firstBlock.text.trim();
    }

    return 'Thanks for your message. Our team will check and get back to you shortly.';
  }

  private async generateOpenRouterReply(
    input: {
      client: ClientProfile;
      customerText: string;
      knowledgeEntries: KnowledgeEntry[];
      promptProfile?: PromptProfile;
    },
    runtime: AiRuntimeConfig,
  ): Promise<string> {
    const response = await fetch(`${process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${runtime.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? process.env.WEB_APP_URL ?? 'http://localhost:3002',
        'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME ?? 'Daemion',
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

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${data?.error?.message ?? response.status}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim() !== '') return content.trim();
    if (Array.isArray(content)) {
      const text = content
        .map((part) => (typeof part === 'object' && part !== null && 'text' in part ? String((part as { text?: unknown }).text ?? '') : ''))
        .join('')
        .trim();
      if (text !== '') return text;
    }

    return 'Thanks for your message. Our team will check and get back to you shortly.';
  }

  private generateLocalFallback(
    entries: KnowledgeEntry[],
    escalationReason: string | null,
    promptProfile?: PromptProfile,
  ): string {
    if (entries.length === 0) {
      return promptProfile?.fallbackBehavior ?? 'Thanks for your message. Ami team ke check korte dicchi, tara shortly update debe.';
    }

    const answer = entries[0].answer;
    if (escalationReason !== null) {
      return `${answer}\n\nAmi eta team er kache forward kore dicchi so they can confirm details.`;
    }

    return answer;
  }

  private detectEscalation(client: ClientProfile, text: string, confidence: number): string | null {
    const normalizedText = text.toLowerCase();
    const matchedKeyword = client.escalationKeywords.find((keyword) =>
      normalizedText.includes(keyword.toLowerCase()),
    );

    if (matchedKeyword !== undefined) {
      return `Matched escalation keyword: ${matchedKeyword}`;
    }

    if (confidence <= 0.65) {
      return 'Low knowledge confidence';
    }

    return null;
  }

  private recordProviderEvent(ok: boolean) {
    const now = Date.now();
    const windowMinutes = Number(process.env.AI_DEGRADATION_WINDOW_MINUTES ?? 5);
    this.providerEvents.push({ ok, at: now });
    this.trimProviderEvents(now - Math.max(windowMinutes, 1) * 60 * 1000);
  }

  private trimProviderEvents(cutoff: number) {
    while (this.providerEvents.length > 0 && this.providerEvents[0].at < cutoff) {
      this.providerEvents.shift();
    }
  }
}
