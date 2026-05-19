'use client';

import { CheckCircle2, ClipboardCheck, Edit3, MessageSquareWarning, RefreshCw, Search, XCircle } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  editThenPublishKnowledgeRequest,
  getClients,
  getInternalKnowledgeRequestDetail,
  getInternalKnowledgeRequests,
  updateInternalKnowledgeRequest,
} from '@/lib/api';
import {
  ClientProfile,
  KnowledgeChangeRequest,
  KnowledgeChangeRequestReviewDetail,
  KnowledgeChangeRequestStatus,
  KnowledgeChangeRequestUrgency,
} from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';

const statuses: Array<KnowledgeChangeRequestStatus | 'all'> = [
  'all',
  'submitted',
  'in_review',
  'needs_clarification',
  'approved',
  'edited_then_published',
  'rejected',
  'published',
];

const urgencies: Array<KnowledgeChangeRequestUrgency | 'all'> = ['all', 'urgent', 'normal'];

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function statusTone(status: KnowledgeChangeRequestStatus) {
  if (status === 'approved' || status === 'edited_then_published' || status === 'published') return 'green';
  if (status === 'rejected') return 'coral';
  if (status === 'needs_clarification') return 'amber';
  return 'blue';
}

function parseKeywords(value: string) {
  return value
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

export default function InternalKbReviewPage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [requests, setRequests] = useState<KnowledgeChangeRequest[]>([]);
  const [detail, setDetail] = useState<KnowledgeChangeRequestReviewDetail | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('all');
  const [status, setStatus] = useState<KnowledgeChangeRequestStatus | 'all'>('all');
  const [urgency, setUrgency] = useState<KnowledgeChangeRequestUrgency | 'all'>('all');
  const [query, setQuery] = useState('');
  const [reviewerNote, setReviewerNote] = useState('');
  const [clientVisibleMessage, setClientVisibleMessage] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [finalTitle, setFinalTitle] = useState('');
  const [finalAnswer, setFinalAnswer] = useState('');
  const [finalKeywords, setFinalKeywords] = useState('');
  const [finalCategory, setFinalCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadRequests(nextSelectedId = detail?.request.id) {
    setIsLoading(true);
    setError(null);
    try {
      const [clientData, requestData] = await Promise.all([
        clients.length === 0 ? getClients() : Promise.resolve(clients),
        getInternalKnowledgeRequests({
          clientId: selectedClientId === 'all' ? undefined : selectedClientId,
          status,
          urgency,
        }),
      ]);
      setClients(clientData);
      setRequests(requestData);
      const nextSelected = requestData.find((request) => request.id === nextSelectedId) ?? requestData[0];
      if (nextSelected !== undefined) {
        await selectRequest(nextSelected.id);
      } else {
        setDetail(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load KB review queue.');
    } finally {
      setIsLoading(false);
    }
  }

  async function selectRequest(requestId: string) {
    setError(null);
    setNotice(null);
    const loaded = await getInternalKnowledgeRequestDetail(requestId);
    setDetail(loaded);
    setReviewerNote(loaded.request.reviewerNote ?? '');
    setClientVisibleMessage(loaded.request.clientVisibleMessage ?? '');
    setInternalNote(loaded.request.internalNote ?? '');
    setFinalTitle(String(loaded.request.decisionSnapshot?.proposedTitle ?? loaded.proposed.title));
    setFinalAnswer(String(loaded.request.decisionSnapshot?.proposedAnswer ?? loaded.proposed.answer));
    setFinalKeywords(
      Array.isArray(loaded.request.decisionSnapshot?.proposedKeywords)
        ? loaded.request.decisionSnapshot.proposedKeywords.filter((item): item is string => typeof item === 'string').join(', ')
        : loaded.proposed.keywords.join(', '),
    );
    setFinalCategory(String(loaded.request.decisionSnapshot?.proposedCategory ?? loaded.proposed.category));
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized === '') return requests;
    return requests.filter((request) =>
      [request.proposedTitle, request.proposedAnswer, request.proposedCategory, request.status, request.urgency]
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query, requests]);

  async function runAction(action: 'in-review' | 'approve' | 'reject' | 'clarify') {
    if (detail === null) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateInternalKnowledgeRequest(detail.request.id, action, {
        reviewerNote: reviewerNote.trim() || undefined,
        clientVisibleMessage: clientVisibleMessage.trim() || undefined,
        internalNote: internalNote.trim() || undefined,
        reviewedBy: 'internal-console',
      });
      setNotice(`Request marked ${formatLabel(updated.status)}.`);
      await loadRequests(updated.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update request.');
    } finally {
      setIsSaving(false);
    }
  }

  async function runEditThenPublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (detail === null) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await editThenPublishKnowledgeRequest(detail.request.id, {
        proposedTitle: finalTitle,
        proposedAnswer: finalAnswer,
        proposedKeywords: parseKeywords(finalKeywords),
        proposedCategory: finalCategory,
        reviewerNote: reviewerNote.trim() || undefined,
        clientVisibleMessage: clientVisibleMessage.trim() || undefined,
        internalNote: internalNote.trim() || undefined,
        reviewedBy: 'internal-console',
      });
      setNotice(`Request marked ${formatLabel(updated.status)}.`);
      await loadRequests(updated.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to save review decision.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <InternalShell
      activeView="kb-review"
      eyebrow="Knowledge approval"
      title="Client KB review queue"
      action={
        <button className="icon-button" disabled={isLoading} type="button" onClick={() => void loadRequests()}>
          <RefreshCw size={16} />
          Refresh
        </button>
      }
    >
      {error !== null && <div className="inline-alert">{error}</div>}
      {notice !== null && <div className="inline-success">{notice}</div>}

      <section className="kb-review-layout">
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <ClipboardCheck size={16} />
              Review queue
            </div>
            <span className="count">{filteredRequests.length}</span>
          </div>

          <div className="kb-review-filters">
            <label className="search-control">
              <Search size={14} />
              <input value={query} placeholder="Search requests" onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
              <option value="all">All clients</option>
              {clients.map((client) => (
                <option value={client.id} key={client.id}>
                  {client.businessName}
                </option>
              ))}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value as KnowledgeChangeRequestStatus | 'all')}>
              {statuses.map((item) => (
                <option value={item} key={item}>
                  {formatLabel(item)}
                </option>
              ))}
            </select>
            <select value={urgency} onChange={(event) => setUrgency(event.target.value as KnowledgeChangeRequestUrgency | 'all')}>
              {urgencies.map((item) => (
                <option value={item} key={item}>
                  {formatLabel(item)}
                </option>
              ))}
            </select>
            <button className="mini-button" type="button" onClick={() => void loadRequests()}>
              Apply
            </button>
          </div>

          <div className="client-list">
            {filteredRequests.map((request) => (
              <button
                className="kb-review-row"
                data-selected={detail?.request.id === request.id}
                key={request.id}
                type="button"
                onClick={() => void selectRequest(request.id)}
              >
                <div>
                  <strong>{request.proposedTitle}</strong>
                  <small>
                    {request.clientId} | {request.requestType} | {request.urgency}
                  </small>
                </div>
                <span className="badge" data-tone={statusTone(request.status)}>
                  {formatLabel(request.status)}
                </span>
              </button>
            ))}
            {!isLoading && filteredRequests.length === 0 && <div className="empty">No requests found</div>}
          </div>
        </section>

        <section className="detail-panel kb-review-detail">
          {detail === null ? (
            <div className="empty">Select a request</div>
          ) : (
            <>
              <div className="panel-header">
                <div className="panel-title">
                  <Edit3 size={16} />
                  Review detail
                </div>
                <span className="badge" data-tone={statusTone(detail.request.status)}>
                  {formatLabel(detail.request.status)}
                </span>
              </div>

              <div className="kb-review-body">
                <section className="kb-diff-grid">
                  <article>
                    <span>Current</span>
                    <strong>{detail.current?.title ?? 'New entry'}</strong>
                    <p>{detail.current?.answer ?? 'No live entry yet.'}</p>
                    <small>{detail.current?.category ?? 'none'} | v{detail.current?.version ?? '-'}</small>
                  </article>
                  <article>
                    <span>Proposed</span>
                    <strong>{detail.proposed.title}</strong>
                    <p>{detail.proposed.answer}</p>
                    <small>{detail.proposed.category} | {detail.proposed.keywords.join(', ')}</small>
                  </article>
                </section>

                <section className="kb-event-list">
                  <div className="section-label">
                    <ClipboardCheck size={14} />
                    Audit trail
                  </div>
                  {detail.events.map((event) => (
                    <article className="kb-event-row" key={event.id}>
                      <div>
                        <strong>{formatLabel(event.eventType)}</strong>
                        <small>{event.actorId} | {new Date(event.createdAt).toLocaleString()}</small>
                      </div>
                      {event.note !== undefined && <p>{event.note}</p>}
                    </article>
                  ))}
                  {detail.events.length === 0 && <div className="timeline-empty">No audit events yet</div>}
                </section>

                <form className="stack-form" onSubmit={runEditThenPublish}>
                  <label>
                    Final title
                    <input value={finalTitle} onChange={(event) => setFinalTitle(event.target.value)} />
                  </label>
                  <label>
                    Final answer
                    <textarea value={finalAnswer} onChange={(event) => setFinalAnswer(event.target.value)} />
                  </label>
                  <div className="kb-review-form-row">
                    <label>
                      Final keywords
                      <input value={finalKeywords} onChange={(event) => setFinalKeywords(event.target.value)} />
                    </label>
                    <label>
                      Final category
                      <input value={finalCategory} onChange={(event) => setFinalCategory(event.target.value)} />
                    </label>
                  </div>
                  <label>
                    Client-visible message
                    <textarea value={clientVisibleMessage} onChange={(event) => setClientVisibleMessage(event.target.value)} />
                  </label>
                  <label>
                    Reviewer note
                    <textarea value={reviewerNote} onChange={(event) => setReviewerNote(event.target.value)} />
                  </label>
                  <label>
                    Internal note
                    <textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} />
                  </label>

                  <div className="kb-review-actions">
                    <button className="icon-button" disabled={isSaving} type="button" onClick={() => void runAction('in-review')}>
                      <ClipboardCheck size={15} />
                      In review
                    </button>
                    <button className="icon-button" disabled={isSaving} type="button" onClick={() => void runAction('approve')}>
                      <CheckCircle2 size={15} />
                      Approve
                    </button>
                    <button className="icon-button" disabled={isSaving} type="submit">
                      <Edit3 size={15} />
                      Edit then publish
                    </button>
                    <button className="icon-button" disabled={isSaving} type="button" onClick={() => void runAction('clarify')}>
                      <MessageSquareWarning size={15} />
                      Clarify
                    </button>
                    <button className="icon-button" disabled={isSaving} type="button" onClick={() => void runAction('reject')}>
                      <XCircle size={15} />
                      Reject
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </section>
      </section>
    </InternalShell>
  );
}
