'use client';

import { ArrowLeft, BookOpenText, Filter, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getClientKnowledgeEntries, getClientKnowledgeRequests } from '@/lib/api';
import { ClientKnowledgeEntry, KnowledgeChangeRequest, KnowledgeChangeRequestStatus } from '@/types/domain';

const statusFilters: Array<KnowledgeChangeRequestStatus | 'all'> = [
  'all',
  'submitted',
  'in_review',
  'needs_clarification',
  'published',
  'rejected',
];

function statusTone(status: KnowledgeChangeRequestStatus) {
  if (status === 'published' || status === 'approved' || status === 'edited_then_published') return 'green';
  if (status === 'rejected') return 'coral';
  if (status === 'needs_clarification') return 'amber';
  return 'blue';
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

export default function ClientKnowledgePage() {
  const [entries, setEntries] = useState<ClientKnowledgeEntry[]>([]);
  const [requests, setRequests] = useState<KnowledgeChangeRequest[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [requestStatus, setRequestStatus] = useState<KnowledgeChangeRequestStatus | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-client';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-client';
  }, []);

  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(entries.map((entry) => entry.category ?? 'general'))).sort()];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesCategory = category === 'all' || (entry.category ?? 'general') === category;
      const searchable = [entry.title, entry.answer, entry.category ?? 'general', ...entry.keywords].join(' ').toLowerCase();
      return matchesCategory && (normalizedQuery === '' || searchable.includes(normalizedQuery));
    });
  }, [category, entries, query]);

  async function loadKnowledge(nextStatus = requestStatus) {
    setIsLoading(true);
    setError(null);
    try {
      const [loadedEntries, loadedRequests] = await Promise.all([
        getClientKnowledgeEntries(clientId),
        getClientKnowledgeRequests(clientId, { status: nextStatus }),
      ]);
      setEntries(loadedEntries);
      setRequests(loadedRequests);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load knowledge.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadKnowledge();
  }, []);

  async function logout() {
    await fetch('/api/client-auth/logout', { method: 'POST' });
    window.location.href = '/client/login';
  }

  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div>
          <p className="eyebrow">Business knowledge</p>
          <h1>Knowledge Base</h1>
        </div>
        <div className="panel-actions">
          <a className="icon-button" href={`/client/dashboard?clientId=${clientId}`}>
            <ArrowLeft size={16} />
            Dashboard
          </a>
          <button className="icon-button" disabled={isLoading} type="button" onClick={() => void loadKnowledge()}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="icon-button" type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>

      {error !== null && <div className="inline-alert">{error}</div>}

      <section className="client-knowledge-command">
        <div>
          <p className="eyebrow">Approved answers</p>
          <h2>{filteredEntries.length} published entries available to your AI support agent</h2>
          <p>These are the customer-facing facts currently approved for replies. Submitted updates stay in review until the operations team publishes them.</p>
        </div>
        <div className="knowledge-command-stats">
          <div>
            <span>Published</span>
            <strong>{entries.length}</strong>
          </div>
          <div>
            <span>Requests</span>
            <strong>{requests.length}</strong>
          </div>
        </div>
      </section>

      <section className="client-knowledge-grid">
        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <BookOpenText size={16} />
              Published knowledge
            </div>
            <span className="count">{filteredEntries.length}</span>
          </div>

          <div className="client-knowledge-tools">
            <label className="search-control">
              <Search size={14} />
              <input value={query} placeholder="Search entries" onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="filter-row">
              {categories.map((item) => (
                <button
                  className="status-button"
                  data-active={category === item}
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="knowledge-entry-list">
            {filteredEntries.map((entry) => (
              <article className="knowledge-client-entry" key={entry.id}>
                <div className="knowledge-client-entry-head">
                  <div>
                    <strong>{entry.title}</strong>
                    <small>{entry.category ?? 'general'} | v{entry.version}</small>
                  </div>
                  <span className="badge" data-tone="green">
                    <ShieldCheck size={12} />
                    approved
                  </span>
                </div>
                <p>{entry.answer}</p>
                <div className="keyword-row">
                  {entry.keywords.slice(0, 6).map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </article>
            ))}
            {!isLoading && filteredEntries.length === 0 && <div className="empty">No published entries match this view</div>}
          </div>
        </section>

        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Filter size={16} />
              Update requests
            </div>
            <span className="count">{requests.length}</span>
          </div>

          <div className="client-filter-bar knowledge-request-filter">
            <div>
              <Filter size={15} />
              Status
            </div>
            <div className="filter-row">
              {statusFilters.map((status) => (
                <button
                  className="status-button"
                  data-active={requestStatus === status}
                  key={status}
                  type="button"
                  onClick={() => {
                    setRequestStatus(status);
                    void loadKnowledge(status);
                  }}
                >
                  {formatStatus(status)}
                </button>
              ))}
            </div>
          </div>

          <div className="client-list">
            {requests.map((request) => (
              <article className="knowledge-request-row" key={request.id}>
                <div>
                  <strong>{request.proposedTitle}</strong>
                  <small>
                    {request.requestType} | {request.proposedCategory} | {request.urgency}
                  </small>
                </div>
                <span className="badge" data-tone={statusTone(request.status)}>
                  {formatStatus(request.status)}
                </span>
                {(request.clientVisibleMessage ?? request.reviewerNote) !== undefined && (
                  <p>{request.clientVisibleMessage ?? request.reviewerNote}</p>
                )}
              </article>
            ))}
            {!isLoading && requests.length === 0 && <div className="empty">No update requests yet</div>}
          </div>
        </section>
      </section>
    </main>
  );
}
