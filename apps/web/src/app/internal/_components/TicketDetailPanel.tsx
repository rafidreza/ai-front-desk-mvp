import {
  Activity,
  AlertTriangle,
  AtSign,
  CheckCircle2,
  Clock3,
  History,
  Image as ImageIcon,
  Lock,
  MessageSquarePlus,
  RefreshCw,
  RotateCcw,
  Send,
  Volume2,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { ConversationLog, CustomerHistory, InternalUser, Ticket, TicketDetail, TicketStatus } from '@/types/domain';
import { assigneeLabel, eventTitle, formatTime, operatorLabel, priorityTone, statusLabels, statuses } from '../_lib/helpers';
import { CustomerHistoryPanel } from './CustomerHistoryPanel';
import { EscalationChips } from './EscalationChips';
import { SlaBadge } from './SlaBadge';

function formatProductPrice(product: NonNullable<ConversationLog['messages'][number]['matchedProducts']>[number]) {
  if (product.price === undefined) return null;
  return `${product.currency ?? 'BDT'} ${product.price}`;
}

interface TicketDetailPanelProps {
  activeTicket?: Ticket;
  selectedConversation?: ConversationLog;
  customerHistory?: CustomerHistory | null;
  isCustomerHistoryLoading?: boolean;
  customerHistoryError?: string | null;
  selectedTicketDetail: TicketDetail | null;
  assigneeOptions: InternalUser[];
  isDetailLoading: boolean;
  detailError: string | null;
  updateNotice: string | null;
  isUpdating: boolean;
  isCommenting: boolean;
  commentDraft: string;
  onReloadDetail: (ticketId: string) => void;
  onChangeStatus: (status: TicketStatus) => void;
  onChangeAssignee: (assigneeId: string) => void;
  onChangeCommentDraft: (value: string) => void;
  onAddComment: () => void;
}

export function TicketDetailPanel({
  activeTicket,
  selectedConversation,
  customerHistory = null,
  isCustomerHistoryLoading = false,
  customerHistoryError = null,
  selectedTicketDetail,
  assigneeOptions,
  isDetailLoading,
  detailError,
  updateNotice,
  isUpdating,
  isCommenting,
  commentDraft,
  onReloadDetail,
  onChangeStatus,
  onChangeAssignee,
  onChangeCommentDraft,
  onAddComment,
}: TicketDetailPanelProps) {
  const [mentionOpen, setMentionOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const mentionableUsers = useMemo(() => {
    const trimmed = commentDraft.trimEnd();
    const match = /@(\w*)$/.exec(trimmed);
    if (match === null) return null;
    const query = match[1].toLowerCase();
    return assigneeOptions.filter((option) =>
      option.label.toLowerCase().includes(query) || option.id.toLowerCase().includes(query),
    );
  }, [commentDraft, assigneeOptions]);

  const showMentionMenu = mentionOpen && mentionableUsers !== null && mentionableUsers.length > 0;

  function insertMention(user: InternalUser) {
    const replaced = commentDraft.replace(/@(\w*)$/, `@${user.label.replace(/\s+/g, '_')} `);
    onChangeCommentDraft(replaced);
    setMentionOpen(false);
    textareaRef.current?.focus();
  }

  return (
    <section className="detail-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Activity size={16} />
          Active Case
        </div>
        <div className="panel-actions">
          {isDetailLoading && <span className="badge">Loading</span>}
          {activeTicket !== undefined && (
            <button
              className="mini-button"
              type="button"
              onClick={() => onReloadDetail(activeTicket.id)}
              disabled={isDetailLoading}
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>

      {activeTicket === undefined && selectedConversation === undefined ? (
        <div className="empty">No active item</div>
      ) : (
        <div className="case-layout">
          {activeTicket !== undefined && (
            <section className="case-summary">
              <div className="case-heading">
                <div>
                  <p className="eyebrow">Ticket</p>
                  <h3>{activeTicket.customerMessage}</h3>
                </div>
                <div className="case-heading__meta">
                  <span className="badge" data-tone={priorityTone(activeTicket.priority)}>
                    {activeTicket.priority}
                  </span>
                  <SlaBadge ticket={activeTicket} size="md" />
                  <EscalationChips ticket={activeTicket} size="md" />
                </div>
              </div>

              {detailError !== null && (
                <div className="inline-alert">
                  <AlertTriangle size={14} />
                  {detailError}
                </div>
              )}

              {updateNotice !== null && (
                <div className="inline-success">
                  <CheckCircle2 size={14} />
                  {updateNotice}
                </div>
              )}

              <div className="detail-grid">
                <div className="field">
                  <span>Status</span>
                  <strong>{statusLabels[activeTicket.status]}</strong>
                </div>
                <div className="field">
                  <span>Updated</span>
                  <strong>{formatTime(activeTicket.updatedAt)}</strong>
                </div>
                <label className="field owner-field">
                  <span>Assignee</span>
                  <select
                    value={activeTicket.assigneeId ?? 'unassigned'}
                    onChange={(event) => onChangeAssignee(event.target.value)}
                    disabled={isUpdating}
                  >
                    <option value="unassigned">Unassigned</option>
                    {assigneeOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field field-wide">
                  <span>Escalation reason</span>
                  <strong>{activeTicket.reason}</strong>
                </div>
              </div>

              <div className="status-actions">
                {statuses.map((status) => {
                  const isReopen = status === 'reopened';
                  const isResolve = status === 'resolved';
                  // Hide "Reopened" action unless the ticket is currently resolved.
                  if (isReopen && activeTicket.status !== 'resolved') return null;
                  const Icon = isResolve ? CheckCircle2 : isReopen ? RotateCcw : Clock3;
                  return (
                    <button
                      className="status-button"
                      data-active={activeTicket.status === status}
                      disabled={isUpdating}
                      key={status}
                      type="button"
                      onClick={() => onChangeStatus(status)}
                    >
                      <Icon size={14} />
                      {statusLabels[status]}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {activeTicket !== undefined && (
            <section className="reply-panel">
              <div className="section-label">
                <Send size={15} />
                Suggested Reply
              </div>
              <p>{activeTicket.suggestedReply}</p>
            </section>
          )}

          <CustomerHistoryPanel
            history={customerHistory}
            isLoading={isCustomerHistoryLoading}
            error={customerHistoryError}
          />

          {activeTicket !== undefined && (
            <section className="timeline-panel">
              <div className="section-label">
                <History size={15} />
                Ticket Timeline
              </div>
              {isDetailLoading ? (
                <div className="timeline-empty">Loading timeline</div>
              ) : (
                <div className="timeline">
                  {(selectedTicketDetail?.events ?? []).map((event) => (
                    <article className="timeline-item" key={event.id}>
                      <span className="timeline-dot" />
                      <div>
                        <strong>{eventTitle(event.eventType)}</strong>
                        <small>{formatTime(event.createdAt)}</small>
                        {'status' in event.payload && typeof event.payload.status === 'string' && (
                          <p>
                            Status changed to{' '}
                            {statusLabels[event.payload.status as TicketStatus] ?? event.payload.status}
                          </p>
                        )}
                        {'actorId' in event.payload && typeof event.payload.actorId === 'string' && (
                          <p>By {event.payload.actorId}</p>
                        )}
                        {'assigneeId' in event.payload && (
                          <p>
                            Owner{' '}
                            {typeof event.payload.assigneeId === 'string'
                              ? assigneeLabel(assigneeOptions, event.payload.assigneeId)
                              : 'Unassigned'}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                  {(selectedTicketDetail?.events ?? []).length === 0 && (
                    <div className="timeline-empty">No events recorded yet</div>
                  )}
                </div>
              )}
            </section>
          )}

          {activeTicket !== undefined && (
            <section className="comments-panel">
              <div className="section-label">
                <MessageSquarePlus size={15} />
                Internal Notes
                <span aria-label="Private to operators" className="comments-private-badge">
                  <Lock size={11} />
                  Private
                </span>
              </div>
              <p className="comments-helper">
                These notes stay between operators. Customers never see them. Use{' '}
                <code>@name</code> to flag a teammate.
              </p>
              <div className="comment-form">
                <div className="comment-form__field">
                  <textarea
                    onBlur={() => window.setTimeout(() => setMentionOpen(false), 120)}
                    onChange={(event) => {
                      onChangeCommentDraft(event.target.value);
                      setMentionOpen(/@(\w*)$/.test(event.target.value.trimEnd()));
                    }}
                    onFocus={() => setMentionOpen(/@(\w*)$/.test(commentDraft.trimEnd()))}
                    placeholder="Add an operator note. Type @ to mention a teammate."
                    ref={textareaRef}
                    rows={3}
                    value={commentDraft}
                  />
                  {showMentionMenu && (
                    <div className="mention-menu" role="listbox">
                      <header>
                        <AtSign size={11} />
                        Mention a teammate
                      </header>
                      {mentionableUsers!.slice(0, 6).map((user) => (
                        <button
                          className="mention-menu__row"
                          key={user.id}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            insertMention(user);
                          }}
                          type="button"
                        >
                          <strong>{user.label}</strong>
                          <small>{user.id}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="btn-primary"
                  disabled={isCommenting || commentDraft.trim().length === 0}
                  onClick={onAddComment}
                  type="button"
                >
                  {isCommenting ? 'Saving…' : 'Add private note'}
                </button>
              </div>
              <div className="comment-list">
                {(selectedTicketDetail?.comments ?? []).map((comment) => (
                  <article className="comment-item" key={comment.id}>
                    <div>
                      <strong>{operatorLabel(assigneeOptions, comment.authorId)}</strong>
                      <time>{formatTime(comment.createdAt)}</time>
                    </div>
                    <p>{comment.body}</p>
                  </article>
                ))}
                {(selectedTicketDetail?.comments ?? []).length === 0 && (
                  <div className="timeline-empty">No internal notes yet</div>
                )}
              </div>
            </section>
          )}

          <section className="thread">
            {selectedConversation?.messages.map((message) => (
              <article className="bubble" data-direction={message.direction} key={message.id}>
                <p>{message.text}</p>
                {message.attachmentType === 'voice' && (
                  <div className="voice-note-card">
                    <div className="section-label">
                      <Volume2 size={14} />
                      Voice note
                    </div>
                    {message.attachmentUrl !== undefined && message.attachmentUrl.startsWith('http') ? (
                      <audio controls src={message.attachmentUrl}>
                        Voice note playback is not supported in this browser.
                      </audio>
                    ) : (
                      <small>{message.attachmentUrl ?? 'Voice media URL pending'}</small>
                    )}
                    <div className="voice-note-card__transcript">
                      <span>Transcript</span>
                      <p>{message.transcript?.trim() || 'Transcript pending'}</p>
                    </div>
                  </div>
                )}
                {message.attachmentType === 'image' && (
                  <div className="image-ocr-card">
                    <div className="section-label">
                      <ImageIcon size={14} />
                      Product photo
                    </div>
                    {message.attachmentUrl !== undefined && message.attachmentUrl.startsWith('http') ? (
                      <img alt="Customer uploaded product" src={message.attachmentUrl} />
                    ) : (
                      <small>{message.attachmentUrl ?? 'Image media URL pending'}</small>
                    )}
                    <div className="image-ocr-card__text">
                      <span>OCR text</span>
                      <p>{message.extractedText?.trim() || 'OCR not configured.'}</p>
                    </div>
                    <div className="image-ocr-card__matches">
                      <span>Matched products</span>
                      {(message.matchedProducts ?? []).length > 0 ? (
                        <div className="product-candidate-list">
                          {(message.matchedProducts ?? []).map((product) => (
                            <article className="product-candidate" key={product.id}>
                              <strong>{[product.productName, product.variant].filter(Boolean).join(' - ')}</strong>
                              <small>
                                {product.sku !== undefined ? `${product.sku} · ` : ''}
                                {product.availabilityStatus.replace(/_/g, ' ')}
                                {formatProductPrice(product) === null ? '' : ` · ${formatProductPrice(product)}`}
                              </small>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p>No product candidates yet</p>
                      )}
                    </div>
                  </div>
                )}
                <time>{formatTime(message.createdAt)}</time>
              </article>
            ))}
          </section>
        </div>
      )}
    </section>
  );
}
