import { Injectable } from '@nestjs/common';
import { AgentReply, ConversationAutoQaGrade, ConversationQaDefect, Ticket } from '../types/domain';

export interface AutoQaResult {
  score: number;
  grade: ConversationAutoQaGrade;
  defects: ConversationQaDefect[];
  reason: string;
  version: string;
}

const AUTO_QA_VERSION = 'rule-v1';

@Injectable()
export class AutoQaService {
  score(input: {
    customerText: string;
    reply: AgentReply;
    ticket?: Ticket;
  }): AutoQaResult {
    const defects = new Set<ConversationQaDefect>();
    let score = 100;

    if (input.reply.confidence < 0.45) {
      score -= 30;
      defects.add('low_confidence');
    } else if (input.reply.confidence < 0.66) {
      score -= 15;
      defects.add('low_confidence');
    }

    if (input.reply.matchedKnowledgeIds.length === 0) {
      score -= 25;
      defects.add('no_knowledge_match');
      if (!input.reply.shouldEscalate) {
        score -= 20;
        defects.add('hallucination_risk');
      }
    }

    if (input.reply.text.trim().length < 8) {
      score -= 25;
      defects.add('incomplete_answer');
    }

    if (input.reply.shouldEscalate) {
      defects.add('escalation_needed');
      if (input.ticket === undefined) {
        score -= 45;
        defects.add('escalation_miss');
      } else {
        score -= 8;
      }
    }

    if (this.hasToneRisk(input.reply.text, input.customerText)) {
      score -= 10;
      defects.add('tone_risk');
    }

    const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
    const grade: ConversationAutoQaGrade =
      normalizedScore >= 80 ? 'pass' : normalizedScore >= 60 ? 'review' : 'fail';

    return {
      score: normalizedScore,
      grade,
      defects: [...defects],
      reason: this.reasonFor([...defects], normalizedScore),
      version: AUTO_QA_VERSION,
    };
  }

  private hasToneRisk(replyText: string, customerText: string) {
    const normalizedReply = replyText.toLowerCase();
    const harshPhrases = ['you are wrong', 'not possible', 'stop', 'obviously'];
    if (harshPhrases.some((phrase) => normalizedReply.includes(phrase))) return true;

    const customerLooksBangla = /[\u0980-\u09FF]/.test(customerText);
    const replyLooksBangla = /[\u0980-\u09FF]/.test(replyText);
    return customerLooksBangla && !replyLooksBangla && !normalizedReply.includes('ami');
  }

  private reasonFor(defects: ConversationQaDefect[], score: number) {
    if (defects.length === 0) return `Auto QA passed with score ${score}.`;
    return `Auto QA flagged ${defects.join(', ')} with score ${score}.`;
  }
}
