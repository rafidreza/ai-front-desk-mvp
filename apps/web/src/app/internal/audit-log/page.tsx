'use client';

import { ClipboardList, RefreshCw, Search } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getAuditLogEntries, getClients } from '@/lib/api';
import { AuditLogEntry, ClientProfile } from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [clientId, setClientId] = useState('');
  const [actorId, setActorId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.businessName])),
    [clients],
  );

  async function loadEntries(filters = { clientId, actorId, entityType, action }) {
    setIsLoading(true);
    setError(null);
    try {
      const [loadedEntries, loadedClients] = await Promise.all([
        getAuditLogEntries({
          clientId: filters.clientId || undefined,
          actorId: filters.actorId || undefined,
          entityType: filters.entityType || undefined,
          action: filters.action || undefined,
          limit: 150,
        }),
        clients.length === 0 ? getClients() : Promise.resolve(clients),
      ]);
      setEntries(loadedEntries);
      setClients(loadedClients);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load audit log.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadEntries({ clientId: '', actorId: '', entityType: '', action: '' });
  }, []);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadEntries();
  }

  return (
    <InternalShell
      activeView="audit-log"
      eyebrow="Compliance"
      title="Audit log"
      action={
        <button className="icon-button" type="button" onClick={() => void loadEntries()} disabled={isLoading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      }
    >
      {error !== null && <div className="inline-alert">{error}</div>}

      <form className="audit-filter-bar" onSubmit={applyFilters}>
        <label>
          Client
          <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.businessName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Actor
          <input value={actorId} onChange={(event) => setActorId(event.target.value)} placeholder="ops-admin" />
        </label>
        <label>
          Entity
          <input value={entityType} onChange={(event) => setEntityType(event.target.value)} placeholder="ticket" />
        </label>
        <label>
          Action
          <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="ticket.status_changed" />
        </label>
        <button className="icon-button" type="submit" disabled={isLoading}>
          <Search size={15} />
          Filter
        </button>
      </form>

      <section className="audit-log-panel">
        <div className="panel-header">
          <div className="panel-title">
            <ClipboardList size={16} />
            Events
          </div>
          {isLoading && <span className="badge">Loading</span>}
        </div>
        <div className="audit-log-list">
          {entries.map((entry) => (
            <article className="audit-log-row" key={entry.id}>
              <div className="audit-log-row__main">
                <strong>{entry.summary}</strong>
                <p>
                  {entry.actorId} · {entry.actorRole} · {entry.action}
                </p>
              </div>
              <div className="audit-log-row__meta">
                <span>{entry.entityType}</span>
                <span>{entry.clientId === undefined ? 'No client' : clientById.get(entry.clientId) ?? entry.clientId}</span>
                <time>{formatTime(entry.createdAt)}</time>
              </div>
            </article>
          ))}
          {entries.length === 0 && !isLoading && (
            <div className="empty">No audit events match these filters</div>
          )}
        </div>
      </section>
    </InternalShell>
  );
}
