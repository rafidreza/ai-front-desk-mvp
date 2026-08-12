import { assertClientId, type TenantContext } from '../db/tenant';

/**
 * Grounded answer engine (T5).
 *
 * Decides WHAT the AI says: answers only from the client's KB (never improvised), phrased for
 * speech. When the KB does not support an answer, it does NOT fabricate — it returns a safe
 * fallback and signals escalation. Pairs with the groundedness detector (T14), which verifies the
 * returned text against the returned evidence before it is spoken.
 *
 * Retrieval and the LLM are injected interfaces (the runtime wires the existing embedding/KB
 * search + Claude). This keeps the engine testable without keys and vendor-swappable. It is
 * composed by the voice loop (T2), not a request-scoped singleton, so it is intentionally not in
 * the services barrel.
 */

export type Evidence = { id: string; text: string; score?: number };

export interface Retriever {
  retrieve(input: { clientId: string; query: string }): Promise<Evidence[]>;
}

export interface LanguageModel {
  complete(input: { system: string; prompt: string }): Promise<string>;
}

export type AnswerContext = {
  question: string;
  language?: string; // e.g. 'bn', 'en'
  priorTurns?: string[];
  threadFields?: Record<string, unknown>;
};

export type AnswerResult = {
  text: string;
  evidence: Evidence[];
  escalate?: { reason: string };
};

export interface AnswerEngine {
  respond(ctx: TenantContext, context: AnswerContext): Promise<AnswerResult>;
}

/** A retriever that returns nothing — safe default so an unconfigured engine escalates rather than
 *  invents. Replace with the real KB/embedding retriever at runtime. */
export class NullRetriever implements Retriever {
  async retrieve(): Promise<Evidence[]> {
    return [];
  }
}

function safeFallback(language?: string): string {
  if (language?.toLowerCase().startsWith('bn')) {
    return 'এটা আমি ঠিক নিশ্চিত নই — একজন সহকর্মীর সাথে সংযোগ করিয়ে দিচ্ছি।';
  }
  return "I'm not sure about that — let me connect you to a colleague.";
}

const SYSTEM_INSTRUCTIONS = [
  'You are a phone support agent. Answer ONLY using the provided knowledge-base evidence.',
  'If the evidence does not support an answer, say you are not sure — never invent facts.',
  'Keep answers short and natural for speech: one idea at a time, no lists, no markdown.',
  'Reply in the same language the caller used (Bangla, English, or a mix).',
].join(' ');

export class GroundedAnswerEngine implements AnswerEngine {
  constructor(
    private readonly retriever: Retriever,
    private readonly llm: LanguageModel,
  ) {}

  async respond(ctx: TenantContext, context: AnswerContext): Promise<AnswerResult> {
    const clientId = assertClientId(ctx.clientId);
    const evidence = await this.retriever.retrieve({ clientId, query: context.question });

    // No grounding -> do not call the LLM, do not guess. Hedge + signal escalation.
    if (evidence.length === 0) {
      return { text: safeFallback(context.language), evidence: [], escalate: { reason: 'out_of_kb' } };
    }

    const prompt = [
      `Caller question: ${context.question}`,
      context.language ? `Caller language: ${context.language}` : '',
      '',
      'Knowledge-base evidence:',
      ...evidence.map((e, i) => `[${i + 1}] ${e.text}`),
    ]
      .filter(Boolean)
      .join('\n');

    const text = (await this.llm.complete({ system: SYSTEM_INSTRUCTIONS, prompt })).trim();
    return { text, evidence };
  }
}
