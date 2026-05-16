import { CheckCircle2, Flag, RefreshCw, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import {
  CalibrationQueueFilter,
  CalibrationQueueSummary,
  ConversationLog,
  ConversationQaGrade,
} from '@/types/domain';
import { PanelError } from './PanelError';

interface QaReviewProps {
  conversations: ConversationLog[];
  queueFilter: CalibrationQueueFilter;
  queueSummary: CalibrationQueueSummary | null;
  qaNotice: string | null;
  conversationsError: string | null;
  isConversationsLoading: boolean;
  isGrading: boolean;
  onChangeFilter: (filter: CalibrationQueueFilter) => void;
  onReload: () => void;
  onGrade: (conversation: ConversationLog, qaGrade: ConversationQaGrade, hallucinationFlag?: boolean) => void;
}

export function QaReview({
  conversations,
  queueFilter,
  queueSummary,
  qaNotice,
  conversationsError,
  isConversationsLoading,
  isGrading,
  onChangeFilter,
  onReload,
  onGrade,
}: QaReviewProps) {
  const filterOptions: Array<{ value: CalibrationQueueFilter; label: string }> = [
    { value: 'needs_review', label: 'Needs review' },
    { value: 'failed', label: 'Failed auto QA' },
    { value: 'hallucination', label: 'Hallucination risk' },
    { value: 'escalation', label: 'Escalation issues' },
    { value: 'ungraded', label: 'Ungraded only' },
    { value: 'all', label: 'All' },
  ];

  return (
    <section className="qa-workspace">
      {qaNotice !== null && (
        <div className="inline-success">
          <CheckCircle2 size={14} />
          {qaNotice}
        </div>
      )}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <ShieldCheck size={16} />
            Calibration Queue
          </div>
          <div className="panel-actions">
            {isConversationsLoading && <span className="badge">Loading</span>}
            <span className="count">{conversations.length}</span>
            <button className="mini-button" type="button" onClick={onReload} disabled={isConversationsLoading}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="qa-filter-bar">
          {filterOptions.map((option) => (
            <button
              className="mini-button"
              data-active={queueFilter === option.value}
              key={option.value}
              type="button"
              onClick={() => onChangeFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {queueSummary !== null && (
          <div className="qa-summary-strip">
            <span>{queueSummary.ungraded} ungraded</span>
            <span>{queueSummary.failed} failed</span>
            <span>{queueSummary.review} review</span>
            <span>{queueSummary.hallucinationRisk} hallucination risk</span>
            <span>{queueSummary.escalationRisk} escalation risk</span>
          </div>
        )}

        <div className="qa-list">
          {conversationsError !== null ? (
            <PanelError
              message={conversationsError}
              isRetrying={isConversationsLoading}
              onRetry={onReload}
            />
          ) : (
            conversations.map((conversation) => {
              const lastMessage = conversation.messages.at(-1);
              return (
                <article className="qa-row" key={conversation.id}>
                  <div className="qa-row-copy">
                    <strong>{conversation.externalSenderId}</strong>
                    <p>{lastMessage?.text ?? 'No messages'}</p>
                    <small>
                      {conversation.ticketId === undefined ? 'Contained by AI' : 'Escalated to ticket'} |{' '}
                      {conversation.lastConfidence !== undefined
                        ? `${Math.round(conversation.lastConfidence * 100)}% confidence`
                        : 'No confidence score'}
                    </small>
                    <div className="qa-auto-line">
                      <span data-grade={conversation.autoQaGrade ?? 'none'}>
                        {conversation.autoQaGrade === undefined
                          ? 'Auto QA pending'
                          : `Auto ${conversation.autoQaGrade} ${conversation.autoQaScore ?? 0}/100`}
                      </span>
                      {conversation.autoQaDefects.map((defect) => (
                        <span key={defect}>{defect.replaceAll('_', ' ')}</span>
                      ))}
                    </div>
                  </div>
                  <div className="qa-actions">
                    <button
                      className="status-button"
                      data-active={conversation.qaGrade === 'good'}
                      disabled={isGrading}
                      type="button"
                      onClick={() => onGrade(conversation, 'good', false)}
                    >
                      <ThumbsUp size={14} />
                      Good
                    </button>
                    <button
                      className="status-button"
                      data-active={conversation.qaGrade === 'bad' && !conversation.hallucinationFlag}
                      disabled={isGrading}
                      type="button"
                      onClick={() => onGrade(conversation, 'bad', false)}
                    >
                      <ThumbsDown size={14} />
                      Bad
                    </button>
                    <button
                      className="status-button"
                      data-active={conversation.hallucinationFlag}
                      disabled={isGrading}
                      type="button"
                      onClick={() => onGrade(conversation, 'bad', !conversation.hallucinationFlag)}
                    >
                      <Flag size={14} />
                      Hallucination
                    </button>
                  </div>
                </article>
              );
            })
          )}
          {conversations.length === 0 && conversationsError === null && (
            <div className="empty">No conversations to grade</div>
          )}
        </div>
      </div>
    </section>
  );
}
