interface MetricCardsProps {
  activeView: 'operations' | 'qa';
  openTickets: number;
  p1Tickets: number;
  totalTickets: number;
  totalConversations: number;
  containmentRate: number;
  reviewedCount: number;
  hallucinationRate: number;
  averageConfidence: number;
  ticketsError: string | null;
  conversationsError: string | null;
}

export function MetricCards({
  activeView,
  openTickets,
  p1Tickets,
  totalTickets,
  totalConversations,
  containmentRate,
  reviewedCount,
  hallucinationRate,
  averageConfidence,
  ticketsError,
  conversationsError,
}: MetricCardsProps) {
  return (
    <section className="metrics" aria-label="Operations summary">
      <article className="metric">
        <span>{activeView === 'operations' ? 'Open Tickets' : 'Containment'}</span>
        <strong>{activeView === 'operations' ? openTickets : `${containmentRate}%`}</strong>
        <small>
          {activeView === 'operations'
            ? ticketsError === null
              ? `${totalTickets} total`
              : 'Panel unavailable'
            : 'No human handoff'}
        </small>
      </article>
      <article className="metric">
        <span>{activeView === 'operations' ? 'P1 Incidents' : 'Reviewed'}</span>
        <strong>{activeView === 'operations' ? p1Tickets : reviewedCount}</strong>
        <small>{activeView === 'operations' ? 'Immediate attention' : 'Last 100 conversations'}</small>
      </article>
      <article className="metric">
        <span>{activeView === 'operations' ? 'Conversations' : 'Hallucination'}</span>
        <strong>{activeView === 'operations' ? totalConversations : `${hallucinationRate}%`}</strong>
        <small>
          {activeView === 'operations'
            ? conversationsError === null
              ? 'Persisted in Neon'
              : 'Panel unavailable'
            : 'Flagged by QA'}
        </small>
      </article>
      <article className="metric">
        <span>AI Confidence</span>
        <strong>{averageConfidence}%</strong>
        <small>Conversation average</small>
      </article>
    </section>
  );
}
