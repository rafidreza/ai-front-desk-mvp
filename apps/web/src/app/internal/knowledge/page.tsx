'use client';

import { DatabaseZap, Plus, RefreshCw } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createKnowledgeDraft, getKnowledgeEntries, setKnowledgeStatus } from '@/lib/api';
import { KnowledgeEntry } from '@/types/domain';

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [status, setStatus] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-client';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-client';
  }, []);

  async function loadEntries(nextStatus = status) {
    setIsLoading(true);
    setError(null);
    try {
      setEntries(await getKnowledgeEntries(clientId, nextStatus));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load knowledge.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadEntries();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await createKnowledgeDraft(clientId, {
      title: String(form.get('title') ?? ''),
      answer: String(form.get('answer') ?? ''),
      keywords: String(form.get('keywords') ?? '')
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    });
    event.currentTarget.reset();
    await loadEntries();
  }

  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div>
          <p className="eyebrow">Knowledge base</p>
          <h1>Draft and active answers</h1>
        </div>
        <button className="icon-button" type="button" onClick={() => void loadEntries()} disabled={isLoading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <section className="client-grid">
        <form className="client-panel stack-form" onSubmit={handleCreate}>
          <div className="section-label">
            <Plus size={15} />
            New draft
          </div>
          <label>
            Title
            <input name="title" required />
          </label>
          <label>
            Answer
            <textarea name="answer" required rows={5} />
          </label>
          <label>
            Keywords
            <input name="keywords" required placeholder="delivery, charge, courier" />
          </label>
          <button className="icon-button" type="submit">
            Create draft
          </button>
        </form>

        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <DatabaseZap size={16} />
              Entries
            </div>
            <select
              className="owner-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                void loadEntries(event.target.value);
              }}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          {error !== null && <div className="inline-alert">{error}</div>}
          <div className="client-list">
            {entries.map((entry) => (
              <article className="client-row" key={entry.id}>
                <div>
                  <strong>{entry.title}</strong>
                  <small>{entry.status} | v{entry.version} | {entry.keywords.join(', ')}</small>
                </div>
                <div className="csat-buttons">
                  <button className="mini-button" type="button" onClick={() => void setKnowledgeStatus(clientId, entry.id, 'active').then(() => loadEntries())}>
                    Publish
                  </button>
                  <button className="mini-button" type="button" onClick={() => void setKnowledgeStatus(clientId, entry.id, 'archived').then(() => loadEntries())}>
                    Archive
                  </button>
                </div>
              </article>
            ))}
            {entries.length === 0 && <div className="empty">No knowledge entries</div>}
          </div>
        </section>
      </section>
    </main>
  );
}
