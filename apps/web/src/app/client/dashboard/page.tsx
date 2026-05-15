'use client';

import { MessageSquareText, RefreshCw, TicketCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { captureCsat, getClientDashboard } from '@/lib/api';
import { ClientDashboardSummary } from '@/types/domain';

export default function ClientDashboardPage() {
  const [dashboard, setDashboard] = useState<ClientDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-client';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-client';
  }, []);

  async function loadDashboard() {
    setIsLoading(true);
    setError(null);
    try {
      setDashboard(await getClientDashboard(clientId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function handleCsat(conversationId: string, score: number) {
    await captureCsat(clientId, conversationId, { score });
    await loadDashboard();
  }

  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div>
          <p className="eyebrow">Client dashboard</p>
          <h1>{dashboard?.client.businessName ?? 'AI Front Desk'}</h1>
        </div>
        <button className="icon-button" disabled={isLoading} type="button" onClick={() => void loadDashboard()}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {error !== null && <div className="inline-alert">{error}</div>}

      <section className="metrics">
        <article className="metric">
          <span>Conversations</span>
          <strong>{dashboard?.totals.conversations ?? 0}</strong>
          <small>Handled by AI</small>
        </article>
        <article className="metric">
          <span>Containment</span>
          <strong>{dashboard?.totals.containmentRate ?? 0}%</strong>
          <small>No handoff needed</small>
        </article>
        <article className="metric">
          <span>Open Tickets</span>
          <strong>{dashboard?.totals.openTickets ?? 0}</strong>
          <small>P1: {dashboard?.totals.p1Tickets ?? 0}</small>
        </article>
        <article className="metric">
          <span>Sales Protected</span>
          <strong>{dashboard?.totals.salesRecoveredEstimate ?? 0}</strong>
          <small>BDT estimate</small>
        </article>
      </section>

      <section className="client-grid">
        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <TicketCheck size={16} />
              Recent tickets
            </div>
            <a className="mini-button" href={`/client/tickets?clientId=${clientId}`}>
              Delegate
            </a>
          </div>
          <div className="client-list">
            {(dashboard?.recentTickets ?? []).map((ticket) => (
              <article className="client-row" key={ticket.id}>
                <div>
                  <strong>{ticket.customerMessage}</strong>
                  <small>{ticket.status} | {ticket.priority} | BDT {ticket.salesRecoveredEstimate}</small>
                </div>
              </article>
            ))}
            {dashboard !== null && dashboard.recentTickets.length === 0 && <div className="empty">No tickets yet</div>}
          </div>
        </section>

        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <MessageSquareText size={16} />
              Recent conversations
            </div>
          </div>
          <div className="client-list">
            {(dashboard?.recentConversations ?? []).map((conversation) => {
              const last = conversation.messages.at(-1);
              return (
                <article className="client-row" key={conversation.id}>
                  <div>
                    <strong>{conversation.externalSenderId}</strong>
                    <small>{last?.text ?? 'No messages'}</small>
                  </div>
                  <div className="csat-buttons">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button className="mini-button" key={score} type="button" onClick={() => void handleCsat(conversation.id, score)}>
                        {score}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
