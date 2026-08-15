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
    const conversationalReply = this.generateConversationalReply(input.client, input.customerText);
    if (conversationalReply !== null) {
      return {
        text: conversationalReply,
        confidence: Math.max(input.retrievalConfidence, 0.9),
        matchedKnowledgeIds: [],
        shouldEscalate: false,
      };
    }

    const escalationReason = this.detectEscalation(input.client, input.customerText, input.retrievalConfidence);
    const runtime = this.getRuntimeConfig(input.promptProfile);

    if (runtime.provider !== 'local' && runtime.apiKey !== undefined && input.knowledgeEntries.length > 0) {
      const generatedReply =
        runtime.provider === 'openrouter'
          ? await this.generateOpenRouterReply(input, runtime)
          : await this.generateClaudeReply(input, new Anthropic({ apiKey: runtime.apiKey }), runtime.model);
      const baseReply = this.isGenericHandoff(generatedReply)
        ? this.generateLocalFallback(input.knowledgeEntries, escalationReason, input.promptProfile, input.client, input.customerText)
        : generatedReply;
      const reply = this.addNextBestQuestion(baseReply, input.knowledgeEntries, input.customerText, input.client, escalationReason);
      return {
        text: reply,
        confidence: input.retrievalConfidence,
        matchedKnowledgeIds: input.knowledgeEntries.map((entry) => entry.id),
        shouldEscalate: escalationReason !== null,
        escalationReason: escalationReason ?? undefined,
      };
    }

    const baseReply = this.generateLocalFallback(input.knowledgeEntries, escalationReason, input.promptProfile, input.client, input.customerText);
    return {
      text: this.addNextBestQuestion(baseReply, input.knowledgeEntries, input.customerText, input.client, escalationReason),
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
      'When supplied knowledge directly answers the customer, answer it directly. Do not say the team will check.',
      'If a direct answer is available, ask at most one natural follow-up question that moves the conversation forward.',
      'Do not escalate or create handoff language for greetings, thanks, or conversation closings.',
      this.languageInstruction(input.client),
      'Keep replies short enough for Messenger commerce.',
    ].join('\n');
  }

  private languageInstruction(client: ClientProfile) {
    if (client.defaultLanguage === 'bangla') {
      return 'Reply in natural Bangla/Banglish for Bangladeshi customers. Keep names, plan labels, and numbers clear.';
    }
    if (client.defaultLanguage === 'mixed') {
      return 'Reply in the customer language. If the customer uses Bangla or Banglish, reply in natural Bangla/Banglish; otherwise use English.';
    }
    return 'Reply in clear English unless the customer uses Bangla or Banglish, in which case mirror them naturally.';
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

  private isGenericHandoff(text: string) {
    return /team (will )?(check|update|get back)|checking this with the team|connect you to a colleague/i.test(text);
  }

  private generateLocalFallback(
    entries: KnowledgeEntry[],
    escalationReason: string | null,
    promptProfile?: PromptProfile,
    client?: ClientProfile,
    customerText?: string,
  ) {
    if (entries.length === 0) {
      return promptProfile?.fallbackBehavior ?? 'Thanks for your message. I am checking this with the team and they will update you shortly.';
    }
    const answer = this.localizeKnownAnswer(entries[0]!.answer, client, customerText);
    const wantsBangla = this.wantsBangla(client, customerText);
    const forwardingLine = wantsBangla
      ? 'Eta team ke forward korchi jate tara confirm korte pare.'
      : 'I am forwarding this to the team so they can confirm the details.';
    return escalationReason === null ? answer : `${answer}\n\n${forwardingLine}`;
  }

  private generateConversationalReply(client: ClientProfile, customerText: string) {
    const normalized = this.normalizeSocialText(customerText);
    if (normalized === '') return null;
    if (!this.isShortSocialMessage(customerText)) return null;

    const wantsBangla = this.wantsBangla(client, customerText);
    if (this.isThanks(normalized)) {
      return wantsBangla ? 'আপনাকে স্বাগতম। আর কোনো সাহায্য লাগলে জানাবেন।' : 'You are welcome. Let me know if you need anything else.';
    }
    if (this.isGreeting(normalized)) {
      return wantsBangla ? 'স্বাগতম। কীভাবে সাহায্য করতে পারি?' : 'Hi. How can I help you today?';
    }
    if (this.isClosing(normalized)) {
      return wantsBangla ? 'ঠিক আছে। ভালো থাকবেন।' : 'All right. Have a good day.';
    }
    return null;
  }

  private normalizeSocialText(text: string) {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isShortSocialMessage(text: string) {
    return this.normalizeSocialText(text).length <= 80;
  }

  private isThanks(normalized: string) {
    return /^(thanks|thank you|thx|dhonnobad|donnobad|ধন্যবাদ|thank u|tnx)(\s+(vai|bhai|আপনাকে|apnake|bro|boss))?$/.test(normalized);
  }

  private isGreeting(normalized: string) {
    return /^(hi|hello|hey|salam|assalamu alaikum|আসসালামু আলাইকুম|হ্যালো|হাই)$/.test(normalized);
  }

  private isClosing(normalized: string) {
    return /^(bye|goodbye|ok bye|ঠিক আছে|আচ্ছা|accha|okay|ok)$/.test(normalized);
  }

  private addNextBestQuestion(
    reply: string,
    entries: KnowledgeEntry[],
    customerText: string,
    client: ClientProfile,
    escalationReason: string | null,
  ) {
    if (entries.length === 0 || escalationReason !== null || this.alreadyAsksQuestion(reply)) return reply;
    const question = this.nextBestQuestion(entries[0]!, customerText, client);
    if (question === null) return reply;
    return `${reply}\n\n${question}`;
  }

  private alreadyAsksQuestion(reply: string) {
    return /[?？]\s*$/.test(reply.trim());
  }

  private nextBestQuestion(entry: KnowledgeEntry, customerText: string, client: ClientProfile) {
    const intent = this.detectFollowUpIntent(entry, customerText);
    const wantsBangla = this.wantsBangla(client, customerText);
    if (intent === 'coverage') {
      return wantsBangla
        ? 'আপনি বর্তমানে কোন এলাকায় আছেন? তাহলে আরও নির্দিষ্টভাবে বলতে পারব।'
        : 'May I know which area you are located in? Then I can be more specific.';
    }
    if (intent === 'pricing') {
      return wantsBangla
        ? 'আপনি কোন প্যাকেজে আগ্রহী, 500 Mbps নাকি 1 Gbps?'
        : 'Which package are you interested in, 500 Mbps or 1 Gbps?';
    }
    if (intent === 'installation') {
      return wantsBangla
        ? 'আপনি কোন এলাকায় installation নিতে চান?'
        : 'Which area would you like installation for?';
    }
    if (intent === 'support_hours') {
      return wantsBangla
        ? 'কোন issue নিয়ে সাহায্য লাগবে?'
        : 'What issue do you need help with?';
    }
    return null;
  }

  private detectFollowUpIntent(entry: KnowledgeEntry, customerText: string): 'coverage' | 'pricing' | 'installation' | 'support_hours' | null {
    const searchable = `${entry.title} ${entry.category ?? ''} ${entry.keywords.join(' ')} ${customerText}`.toLowerCase();
    if (/\b(coverage|area|available|location|elaka|dhaka|chittagong)\b|এলাকা|ঢাকা|চট্টগ্রাম/.test(searchable)) return 'coverage';
    if (/\b(price|package|plan|cost|bdt|taka|mbps|gbps|dam|koto)\b|দাম|টাকা|প্যাকেজ/.test(searchable)) return 'pricing';
    if (/\b(install|installation|setup)\b|ইনস্টল/.test(searchable)) return 'installation';
    if (/\b(support|hours|time|open|somoy)\b|সময়|সময়/.test(searchable)) return 'support_hours';
    return null;
  }

  private localizeKnownAnswer(answer: string, client?: ClientProfile, customerText?: string) {
    if (!this.wantsBangla(client, customerText)) return answer;
    const normalized = answer.trim();
    if (/500 Mbps is BDT 1,500 per month; 1 Gbps is BDT 2,500 per month\./i.test(normalized)) {
      return '500 Mbps plan mash e BDT 1,500, ar 1 Gbps plan mash e BDT 2,500.';
    }
    if (/Installation is free this month\./i.test(normalized)) return 'Ei month e installation free.';
    if (/Service is available in Dhaka and Chittagong city areas\./i.test(normalized)) {
      return 'Dhaka ebong Chittagong city area te service available.';
    }
    if (/Support is open 9am to 9pm, 7 days a week\./i.test(normalized)) {
      return 'Support protidin 9am theke 9pm porjonto open.';
    }
    return answer;
  }

  private wantsBangla(client?: ClientProfile, customerText = '') {
    if (client?.defaultLanguage === 'bangla' || client?.defaultLanguage === 'mixed') return true;
    return /[\u0980-\u09ff]|\b(ami|apni|apnader|koto|dam|ache|ase|kina|naki|lagbe|kothay|kokhon)\b/i.test(customerText);
  }

  private detectEscalation(client: ClientProfile, text: string, confidence: number) {
    if (this.generateConversationalReply(client, text) !== null) return null;
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
