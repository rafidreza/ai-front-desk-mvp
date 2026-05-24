import { History, Mail, Phone, UserRound } from 'lucide-react';
import { CustomerHistory } from '@/types/domain';
import { formatTime } from '../_lib/helpers';

function confidenceLabel(confidence: CustomerHistory['identity']['confidence']) {
  if (confidence === 'verified_phone') return 'Merged by verified phone';
  if (confidence === 'verified_email') return 'Merged by verified email';
  if (confidence === 'sender_only') return 'Sender-only history';
  return 'No verified identity';
}

interface CustomerHistoryPanelProps {
  history: CustomerHistory | null;
  isLoading?: boolean;
  error?: string | null;
}

export function CustomerHistoryPanel({ history, isLoading = false, error = null }: CustomerHistoryPanelProps) {
  return (
    <section className="customer-history-panel">
      <div className="section-label">
        <History size={15} />
        Customer History
      </div>
      {isLoading ? (
        <div className="timeline-empty">Loading customer history</div>
      ) : error !== null ? (
        <div className="inline-alert">{error}</div>
      ) : history === null ? (
        <div className="timeline-empty">Select a customer conversation to see history</div>
      ) : (
        <>
          <div className="customer-identity-strip">
            <span>
              <UserRound size={13} />
              {confidenceLabel(history.identity.confidence)}
            </span>
            {history.identity.phone !== undefined && (
              <span>
                <Phone size={13} />
                {history.identity.phone}
              </span>
            )}
            {history.identity.email !== undefined && (
              <span>
                <Mail size={13} />
                {history.identity.email}
              </span>
            )}
          </div>
          <div className="customer-history-list">
            {history.events.map((event) => (
              <article className="customer-history-item" data-type={event.type} key={event.id}>
                <div>
                  <strong>{event.title}</strong>
                  <time>{formatTime(event.occurredAt)}</time>
                </div>
                {event.description !== undefined && <p>{event.description}</p>}
                {event.status !== undefined && <small>{event.status.replace(/_/g, ' ')}</small>}
              </article>
            ))}
            {history.events.length === 0 && (
              <div className="timeline-empty">No linked orders, tickets, or conversations yet</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
