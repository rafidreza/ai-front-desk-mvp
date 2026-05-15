import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { AgentReply, ClientProfile, KnowledgeEntry } from '../types/domain';

@Injectable()
export class AiService {
  async generateReply(input: {
    client: ClientProfile;
    customerText: string;
    knowledgeEntries: KnowledgeEntry[];
    retrievalConfidence: number;
  }): Promise<AgentReply> {
    const escalationReason = this.detectEscalation(input.client, input.customerText, input.retrievalConfidence);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey !== undefined && apiKey !== '' && input.knowledgeEntries.length > 0) {
      const reply = await this.generateClaudeReply(input, new Anthropic({ apiKey }));
      return {
        text: reply,
        confidence: input.retrievalConfidence,
        matchedKnowledgeIds: input.knowledgeEntries.map((entry) => entry.id),
        shouldEscalate: escalationReason !== null,
        escalationReason: escalationReason ?? undefined,
      };
    }

    const fallback = this.generateLocalFallback(input.knowledgeEntries, escalationReason);
    return {
      text: fallback,
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
        `You are the AI front desk agent for ${input.client.businessName}.`,
        `Tone: ${input.client.tone}.`,
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

  private generateLocalFallback(entries: KnowledgeEntry[], escalationReason: string | null): string {
    if (entries.length === 0) {
      return 'Thanks for your message. Ami team ke check korte dicchi, tara shortly update debe.';
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
}
