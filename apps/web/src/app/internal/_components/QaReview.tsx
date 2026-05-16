import { CheckCircle2, Flag, RefreshCw, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import { ConversationLog, ConversationQaGrade } from '@/types/domain';
import { PanelError } from './PanelError';

interface QaReviewProps {
  conversations: ConversationLog[];
  qaNotice: string | null;
  conversationsError: string | null;
  isConversationsLoading: boolean;
  isGrading: boolean;
  onReload: () => void;
  onGrade: (conversation: ConversationLog, qaGrade: ConversationQaGrade, hallucinationFlag?: boolean) => void;
}

export function QaReview({
  conversations,
  qaNotice,
  conversationsError,
  isConversationsLoading,
  isGrading,
  onReload,
  onGrade,
}: QaReviewProps) {
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
            Last 100 Conversations
          </div>
          <div className="panel-actions">
            {isConversationsLoading && <span className="badge">Loading</span>}
            <span className="count">{conversations.length}</span>
            <button className="mini-button" type="button" onClick={onReload} disabled={isConversationsLoading}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

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
