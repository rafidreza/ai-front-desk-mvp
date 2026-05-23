import { Ticket } from '@/types/domain';

export type EscalationCategory =
  | 'low_confidence'
  | 'sensitive_intent'
  | 'unknown_product'
  | 'escalation_keyword'
  | 'manual_takeover'
  | 'other';

export interface EscalationSummary {
  category: EscalationCategory;
  label: string;
  reason: string;
}

const REFUND_PATTERNS = ['refund', 'complaint', 'angry', 'রিফান্ড', 'অভিযোগ', 'damage'];
const PAYMENT_PATTERNS = ['payment', 'bkash', 'nagad', 'cod', 'cash on delivery'];
const PRODUCT_PATTERNS = ['stock', 'available', 'unknown product', 'no product', 'out of stock'];

export function summarizeEscalation(ticket: Ticket): EscalationSummary {
  const normalized = ticket.reason.toLowerCase();

  if (normalized.includes('manual') && normalized.includes('takeover')) {
    return {
      category: 'manual_takeover',
      label: 'Manual takeover',
      reason: ticket.reason,
    };
  }

  if (REFUND_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return {
      category: 'sensitive_intent',
      label: 'Sensitive intent',
      reason: ticket.reason,
    };
  }

  if (PAYMENT_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return {
      category: 'sensitive_intent',
      label: 'Payment issue',
      reason: ticket.reason,
    };
  }

  if (PRODUCT_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return {
      category: 'unknown_product',
      label: 'Unknown product',
      reason: ticket.reason,
    };
  }

  if (normalized.includes('low knowledge confidence') || normalized.includes('low confidence')) {
    return {
      category: 'low_confidence',
      label: 'Low confidence',
      reason: ticket.reason,
    };
  }

  if (normalized.includes('escalat')) {
    return {
      category: 'escalation_keyword',
      label: 'Escalation keyword',
      reason: ticket.reason,
    };
  }

  return {
    category: 'other',
    label: ticket.reason.length > 32 ? `${ticket.reason.slice(0, 30)}…` : ticket.reason,
    reason: ticket.reason,
  };
}

export function formatConfidence(confidence: number | undefined): string | null {
  if (confidence === undefined || Number.isNaN(confidence)) return null;
  const pct = Math.max(0, Math.min(1, confidence)) * 100;
  return `${Math.round(pct)}%`;
}

export function confidenceTone(confidence: number | undefined): 'low' | 'medium' | 'high' | 'unknown' {
  if (confidence === undefined || Number.isNaN(confidence)) return 'unknown';
  if (confidence < 0.45) return 'low';
  if (confidence < 0.75) return 'medium';
  return 'high';
}
