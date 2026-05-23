import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { AgentReply, AiProviderHealth, ClientProfile, KnowledgeEntry, PromptProfile } from '../types/domain';

type ProviderEvent = {
  ok: boolean;
  at: number;
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey !== undefined && apiKey !== '' && input.knowledgeEntries.length > 0) {
      const providerHealth = this.getProviderHealth();
      if (!providerHealth.isDegraded) {
        try {
          const reply = await this.generateClaudeReply(input, new Anthropic({ apiKey }));
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
    const hasAnthropicKey = this.hasAnthropicKey();
    const isDegraded = hasAnthropicKey && failures.length >= Math.max(threshold, 1);

    if (!hasAnthropicKey) {
      return {
        status: 'local_fallback',
        isDegraded: false,
        failureCount: 0,
        windowMinutes,
        threshold,
        fallbackActive: true,
        message: 'Anthropic is not configured; local fallback replies are active.',
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
        ? 'Anthropic failure threshold reached; fallback replies are active.'
        : 'Anthropic provider is within the normal failure threshold.',
    };
  }

  private async generateClaudeReply(
    input: {
      client: ClientProfile;
      customerText: string;
      knowledgeEntries: KnowledgeEntry[];
      promptProfile?: PromptProfile;
    },
    anthropic: Anthropic,
  ): Promise<string> {
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-latest';
    const knowledge = input.knowledgeEntries
      .map((entry) => `- ${entry.title}: ${entry.answer}`)
      .join('\n');

    const message = await anthropic.messages.create({
      model,
      max_tokens: 220,
      temperature: 0.2,
      system: [
        input.promptProfile?.systemInstructions ?? `You are the AI front desk agent for ${input.client.businessName}.`,
        `Tone rules: ${input.promptProfile?.toneRules ?? input.client.tone}.`,
        `Escalation rules: ${input.promptProfile?.escalationRules ?? 'Escalate when confidence is low or the customer needs a human.'}.`,
        `Forbidden claims: ${input.promptProfile?.forbiddenClaims ?? 'Do not invent prices, stock, delivery promises, discounts, or policy details.'}.`,
        `Fallback behavior: ${input.promptProfile?.fallbackBehavior ?? 'If the answer is missing, politely say a team member will check.'}.`,
        'Only answer from the supplied knowledge. If the answer is missing, politely say a team member will check.',
        'Reply naturally in Bangla/Banglish/English based on the customer message.',
        'Keep replies short enough for Messenger commerce.',
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: `Knowledge:\n${knowledge}\n\nCustomer message:\n${input.customerText}`,
        },
      ],
    });

    const firstBlock = message.content[0];
    if (firstBlock.type === 'text') {
      return firstBlock.text.trim();
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

  private hasAnthropicKey() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    return apiKey !== undefined && apiKey !== '';
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
