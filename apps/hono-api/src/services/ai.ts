import Anthropic from '@anthropic-ai/sdk';
import type { AgentReply, ClientProfile, ConversationQaDefect, KnowledgeEntry, PromptProfile, Ticket } from '@ai-front-desk/shared';
import type { Env } from '../env';
import { envString } from '../env';

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
    const apiKey = envString(this.env, 'ANTHROPIC_API_KEY');

    if (apiKey !== undefined && input.knowledgeEntries.length > 0) {
      const reply = await this.generateClaudeReply(input, new Anthropic({ apiKey }));
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

  private async generateClaudeReply(
    input: {
      client: ClientProfile;
      customerText: string;
      knowledgeEntries: KnowledgeEntry[];
      promptProfile?: PromptProfile;
    },
    anthropic: Anthropic,
  ) {
    const knowledge = input.knowledgeEntries.map((entry) => `- ${entry.title}: ${entry.answer}`).join('\n');
    const message = await anthropic.messages.create({
      model: envString(this.env, 'ANTHROPIC_MODEL', 'claude-3-5-haiku-latest') ?? 'claude-3-5-haiku-latest',
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
      messages: [{ role: 'user', content: `Knowledge:\n${knowledge}\n\nCustomer message:\n${input.customerText}` }],
    });
    const firstBlock = message.content[0];
    return firstBlock?.type === 'text' ? firstBlock.text.trim() : 'Thanks for your message. Our team will check and get back to you shortly.';
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
