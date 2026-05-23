import { AlertTriangle, Brain, FileQuestion, HelpCircle, ShieldQuestion, UserCog } from 'lucide-react';
import { Ticket } from '@/types/domain';
import { EscalationCategory, confidenceTone, formatConfidence, summarizeEscalation } from '../_lib/escalation';

const CATEGORY_ICON: Record<EscalationCategory, typeof AlertTriangle> = {
  low_confidence: Brain,
  sensitive_intent: AlertTriangle,
  unknown_product: FileQuestion,
  escalation_keyword: ShieldQuestion,
  manual_takeover: UserCog,
  other: HelpCircle,
};

export interface EscalationChipsProps {
  ticket: Ticket;
  size?: 'sm' | 'md';
  showConfidence?: boolean;
}

export function EscalationChips({ ticket, size = 'sm', showConfidence = true }: EscalationChipsProps) {
  const summary = summarizeEscalation(ticket);
  const Icon = CATEGORY_ICON[summary.category];
  const confidenceLabel = showConfidence ? formatConfidence(ticket.confidence) : null;
  const tone = confidenceTone(ticket.confidence);

  return (
    <span className="escalation-chips" data-size={size}>
      <span
        aria-label={`Reason: ${summary.label}`}
        className="escalation-chip"
        data-kind={summary.category}
        title={summary.reason}
      >
        <Icon size={size === 'md' ? 13 : 11} />
        <span>{summary.label}</span>
      </span>
      {confidenceLabel !== null && (
        <span
          aria-label={`AI confidence ${confidenceLabel}`}
          className="escalation-chip escalation-chip--confidence"
          data-tone={tone}
          title={`AI confidence on the last reply: ${confidenceLabel}`}
        >
          <Brain size={size === 'md' ? 13 : 11} />
          <span>{confidenceLabel}</span>
        </span>
      )}
    </span>
  );
}
