'use client';

import { CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getClientTickets, updateClientTicketStatus } from '@/lib/api';
import { Ticket, TicketStatus } from '@/types/domain';

const statuses: TicketStatus[] = ['assigned', 'waiting_client', 'resolved'];

export default function ClientTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-client';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-client';
  }, []);

  async function loadTickets(nextFilter = filter) {
    setIsLoading(true);
    setError(null);
    try {
      setTickets(await getClientTickets(clientId, nextFilter));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load tickets.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  async function delegate(ticket: Ticket, status: TicketStatus) {
    await updateClientTicketStatus(clientId, ticket.id, status, ticket.version);
    await loadTickets();
  }

  async function logout() {
    await fetch('/api/client-auth/logout', { method: 'POST' });
    window.location.href = '/client/login';
  }

  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div>
          <p className="eyebrow">Client delegation</p>
          <h1>Tickets</h1>
        </div>
        <div className="panel-actions">
          <button className="icon-button" disabled={isLoading} type="button" onClick={() => void loadTickets()}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="icon-button" type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="filter-row">
        {['all', 'open', 'assigned', 'waiting_client', 'resolved'].map((item) => (
          <button
            className="status-button"
            data-active={filter === item}
            key={item}
            type="button"
            onClick={() => {
              setFilter(item);
              void loadTickets(item);
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {error !== null && <div className="inline-alert">{error}</div>}

      <section className="ticket-delegation-list">
        {tickets.map((ticket) => (
          <article className="delegation-card" key={ticket.id}>
            <div>
              <span className="badge" data-tone={ticket.priority === 'P1' ? 'coral' : ticket.priority === 'P2' ? 'amber' : 'blue'}>
                {ticket.priority}
              </span>
              <h2>{ticket.customerMessage}</h2>
              <p>{ticket.reason}</p>
              <small>BDT {ticket.salesRecoveredEstimate} protected estimate</small>
            </div>
            <div className="delegation-actions">
              {statuses.map((status) => (
                <button
                  className="status-button"
                  data-active={ticket.status === status}
                  key={status}
                  type="button"
                  onClick={() => void delegate(ticket, status)}
                >
                  {status === 'resolved' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                  {status}
                </button>
              ))}
            </div>
          </article>
        ))}
        {tickets.length === 0 && <div className="empty">No tickets</div>}
      </section>
    </main>
  );
}
