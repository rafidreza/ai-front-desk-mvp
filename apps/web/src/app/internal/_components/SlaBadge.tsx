import { Clock, TriangleAlert } from 'lucide-react';
import { Ticket } from '@/types/domain';
import { computeSla } from '../_lib/sla';

export interface SlaBadgeProps {
  ticket: Ticket;
  now?: Date;
  size?: 'sm' | 'md';
}

export function SlaBadge({ ticket, now, size = 'sm' }: SlaBadgeProps) {
  const sla = computeSla(ticket, now);
  if (sla.state === 'paused') return null;
  const Icon = sla.state === 'overdue' ? TriangleAlert : Clock;
  return (
    <span
      aria-label={`Waiting ${sla.label} of ${sla.windowMinutes}m SLA window — ${sla.state.replace('_', ' ')}`}
      className="sla-badge"
      data-size={size}
      data-state={sla.state}
      title={
        sla.qualifier !== undefined
          ? `Waiting ${sla.label} (${sla.qualifier})`
          : `Waiting ${sla.label} (SLA window ${sla.windowMinutes}m)`
      }
    >
      <Icon size={size === 'md' ? 13 : 11} />
      <span>{sla.label}</span>
      {sla.qualifier !== undefined && (
        <span className="sla-badge__qualifier">{sla.qualifier}</span>
      )}
    </span>
  );
}
