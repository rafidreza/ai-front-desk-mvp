'use client';

import { BookOpenText, Filter, Pencil, Plus, RefreshCw, Search, Send, ShieldCheck } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { DaemionMark } from '../../_components/DaemionBrand';
import { ClientPortalNav } from '../_components/ClientPortalNav';
import {
  getClientKnowledgeEntries,
  getClientKnowledgeRequests,
  getClientDashboard,
  submitClientKnowledgeEditRequest,
  submitClientKnowledgeRequest,
} from '@/lib/api';
import { getClientPortalCopy } from '@/lib/client-portal-copy';
import { formatLocalizedNumber } from '@/lib/localized-format';
import {
  ClientKnowledgeEntry,
  ClientProfile,
  KnowledgeChangeRequest,
  KnowledgeChangeRequestStatus,
  KnowledgeChangeRequestUrgency,
} from '@/types/domain';

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

type RequestFormState = {
  title: string;
  answer: string;
  keywords: string;
  category: string;
  urgency: KnowledgeChangeRequestUrgency;
  note: string;
};

const emptyForm: RequestFormState = {
  title: '',
  answer: '',
  keywords: '',
  category: 'general',
  urgency: 'normal',
  note: '',
};

function formFromEntry(entry: ClientKnowledgeEntry): RequestFormState {
  return {
    title: entry.title,
    answer: entry.answer,
    keywords: entry.keywords.join(', '),
    category: entry.category ?? 'general',
    urgency: 'normal',
    note: '',
  };
}

function parseKeywords(input: string) {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    ),
  );
}

export default function ClientKnowledgePage() {
  const [entries, setEntries] = useState<ClientKnowledgeEntry[]>([]);
  const [requests, setRequests] = useState<KnowledgeChangeRequest[]>([]);
  const [language, setLanguage] = useState<ClientProfile['defaultLanguage']>('english');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [requestStatus, setRequestStatus] = useState<KnowledgeChangeRequestStatus | 'all'>('all');
  const [editingEntry, setEditingEntry] = useState<ClientKnowledgeEntry | null>(null);
  const [form, setForm] = useState<RequestFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-abc';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-abc';
  }, []);
  const copy = getClientPortalCopy(language);
  const knowledgeCopy = copy.knowledge;

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
      const [loadedEntries, loadedRequests, dashboard] = await Promise.all([
        getClientKnowledgeEntries(clientId),
        getClientKnowledgeRequests(clientId, { status: nextStatus }),
        getClientDashboard(clientId),
      ]);
      setEntries(loadedEntries);
      setRequests(loadedRequests);
      setLanguage(dashboard.client.defaultLanguage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : knowledgeCopy.loadError);
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

  function resetForm() {
    setEditingEntry(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function selectEdit(entry: ClientKnowledgeEntry) {
    setEditingEntry(entry);
    setForm(formFromEntry(entry));
    setFormError(null);
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const proposedTitle = form.title.trim();
    const proposedAnswer = form.answer.trim();
    const proposedCategory = form.category.trim() || 'general';
    const proposedKeywords = parseKeywords(form.keywords);

    if (proposedTitle.length < 2) {
      setFormError(knowledgeCopy.titleError);
      return;
    }
    if (proposedAnswer.length < 2) {
      setFormError(knowledgeCopy.answerError);
      return;
    }
    if (proposedKeywords.length === 0) {
      setFormError(knowledgeCopy.keywordError);
      return;
    }

    setIsSubmitting(true);
    try {
      const input = {
        proposedTitle,
        proposedAnswer,
        proposedKeywords,
        proposedCategory,
        urgency: form.urgency,
        requesterNote: form.note.trim() === '' ? undefined : form.note.trim(),
      };
      if (editingEntry === null) {
        await submitClientKnowledgeRequest(clientId, input);
      } else {
        await submitClientKnowledgeEditRequest(clientId, editingEntry.id, input);
      }
      setNotice(editingEntry === null ? knowledgeCopy.requestSubmitted : knowledgeCopy.editSubmitted);
      resetForm();
      await loadKnowledge(requestStatus);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : knowledgeCopy.submitError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div className="client-title-lockup">
          <span className="client-mark"><DaemionMark /></span>
          <div>
            <p className="eyebrow">{knowledgeCopy.eyebrow}</p>
            <h1>{knowledgeCopy.title}</h1>
          </div>
        </div>
        <ClientPortalNav active="knowledge" clientId={clientId} language={language} />
        <div className="panel-actions">
          <button className="icon-button" disabled={isLoading} type="button" onClick={() => void loadKnowledge()}>
            <RefreshCw size={16} />
            {copy.common.refresh}
          </button>
          <button className="icon-button" type="button" onClick={() => void logout()}>
            {copy.common.signOut}
          </button>
        </div>
      </header>

      {error !== null && <div className="inline-alert">{error}</div>}
      {notice !== null && <div className="inline-success">{notice}</div>}

      <section className="client-knowledge-command">
        <div>
          <p className="eyebrow">{knowledgeCopy.approvedAnswers}</p>
          <h2>{knowledgeCopy.commandTitle(filteredEntries.length)}</h2>
          <p>{knowledgeCopy.commandDescription}</p>
        </div>
        <div className="knowledge-command-stats">
          <div>
            <span>{knowledgeCopy.published}</span>
            <strong>{formatLocalizedNumber(entries.length, language)}</strong>
          </div>
          <div>
            <span>{knowledgeCopy.requests}</span>
            <strong>{formatLocalizedNumber(requests.length, language)}</strong>
          </div>
        </div>
      </section>

      <section className="client-knowledge-grid">
        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <BookOpenText size={16} />
              {knowledgeCopy.publishedKnowledge}
            </div>
            <span className="count">{formatLocalizedNumber(filteredEntries.length, language)}</span>
          </div>

          <div className="client-knowledge-tools">
            <label className="search-control">
              <Search size={14} />
              <input value={query} placeholder={knowledgeCopy.searchPlaceholder} onChange={(event) => setQuery(event.target.value)} />
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
                    <small>{entry.category ?? 'general'} | v{formatLocalizedNumber(entry.version, language)}</small>
                  </div>
                  <span className="badge" data-tone="green">
                    <ShieldCheck size={12} />
                    {knowledgeCopy.approved}
                  </span>
                </div>
                <p>{entry.answer}</p>
                <div className="keyword-row">
                  {entry.keywords.slice(0, 6).map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
                <button className="mini-button knowledge-edit-button" type="button" onClick={() => selectEdit(entry)}>
                  <Pencil size={13} />
                  {knowledgeCopy.suggestEdit}
                </button>
              </article>
            ))}
            {!isLoading && filteredEntries.length === 0 && <div className="empty">{knowledgeCopy.emptyEntries}</div>}
          </div>
        </section>

        <div className="client-knowledge-side">
          <section className="client-panel">
            <div className="panel-header">
              <div className="panel-title">
                {editingEntry === null ? <Plus size={16} /> : <Pencil size={16} />}
                {editingEntry === null ? knowledgeCopy.addRequest : knowledgeCopy.suggestEdit}
              </div>
              {editingEntry !== null && (
                <button className="mini-button" type="button" onClick={resetForm}>
                  {knowledgeCopy.new}
                </button>
              )}
            </div>

            <form className="stack-form knowledge-request-form" onSubmit={handleSubmit}>
              {formError !== null && <div className="inline-alert">{formError}</div>}
              {editingEntry !== null && <div className="inline-success">{knowledgeCopy.editingRequest(editingEntry.title)}</div>}

              <label>
                {knowledgeCopy.titleLabel}
                <input
                  value={form.title}
                  placeholder="Delivery cutoff, return policy, sizing note"
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              <label>
                {knowledgeCopy.answer}
                <textarea
                  value={form.answer}
                  placeholder="Write the exact customer-facing answer you want reviewed."
                  onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))}
                />
              </label>

              <label>
                {knowledgeCopy.keywords}
                <input
                  value={form.keywords}
                  placeholder="delivery, eid, cutoff"
                  onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))}
                />
              </label>

              <div className="knowledge-form-row">
                <label>
                  {knowledgeCopy.category}
                  <input
                    value={form.category}
                    placeholder="delivery"
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  />
                </label>
                <label>
                  {knowledgeCopy.urgency}
                  <select
                    value={form.urgency}
                    onChange={(event) => setForm((current) => ({ ...current, urgency: event.target.value as KnowledgeChangeRequestUrgency }))}
                  >
                    <option value="normal">{knowledgeCopy.normal}</option>
                    <option value="urgent">{knowledgeCopy.urgent}</option>
                  </select>
                </label>
              </div>

              <label>
                {knowledgeCopy.businessNote}
                <textarea
                  value={form.note}
                  placeholder="Add context for the operations team."
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                />
              </label>

              <div className="form-actions">
                <button className="icon-button" disabled={isSubmitting} type="submit">
                  <Send size={15} />
                  {isSubmitting ? knowledgeCopy.submitting : editingEntry === null ? knowledgeCopy.submitRequest : knowledgeCopy.submitEdit}
                </button>
                <button className="mini-button" disabled={isSubmitting} type="button" onClick={resetForm}>
                  {knowledgeCopy.clear}
                </button>
              </div>
            </form>
          </section>

          <section className="client-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Filter size={16} />
                {knowledgeCopy.updateRequests}
              </div>
              <span className="count">{formatLocalizedNumber(requests.length, language)}</span>
            </div>

            <div className="client-filter-bar knowledge-request-filter">
              <div>
                <Filter size={15} />
                {knowledgeCopy.status}
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
                  <div className="knowledge-request-feedback">
                    <span>{knowledgeCopy.feedback}</span>
                    <p>{request.clientVisibleMessage ?? request.reviewerNote}</p>
                  </div>
                )}
              </article>
            ))}
              {!isLoading && requests.length === 0 && <div className="empty">{knowledgeCopy.noRequests}</div>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
