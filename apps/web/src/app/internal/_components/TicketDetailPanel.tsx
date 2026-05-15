import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  MessageSquarePlus,
  RefreshCw,
  Send,
} from 'lucide-react';
import { ConversationLog, InternalUser, Ticket, TicketDetail, TicketStatus } from '@/types/domain';
import { assigneeLabel, eventTitle, formatTime, priorityTone, statusLabels, statuses } from '../_lib/helpers';

interface TicketDetailPanelProps {
  activeTicket?: Ticket;
  selectedConversation?: ConversationLog;
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
                <span className="badge" data-tone={priorityTone(activeTicket.priority)}>
                  {activeTicket.priority}
                </span>
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
                {statuses.map((status) => (
                  <button
                    className="status-button"
                    data-active={activeTicket.status === status}
                    disabled={isUpdating}
                    key={status}
                    type="button"
                    onClick={() => onChangeStatus(status)}
                  >
                    {status === 'resolved' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                    {statusLabels[status]}
                  </button>
                ))}
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
              </div>
              <div className="comment-form">
                <textarea
                  value={commentDraft}
                  onChange={(event) => onChangeCommentDraft(event.target.value)}
                  placeholder="Add an operator note"
                  rows={3}
                />
                <button
                  className="mini-button"
                  type="button"
                  onClick={onAddComment}
                  disabled={isCommenting || commentDraft.trim().length === 0}
                >
                  Add note
                </button>
              </div>
              <div className="comment-list">
                {(selectedTicketDetail?.comments ?? []).map((comment) => (
                  <article className="comment-item" key={comment.id}>
                    <div>
                      <strong>{comment.authorId}</strong>
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
                <time>{formatTime(message.createdAt)}</time>
              </article>
            ))}
          </section>
        </div>
      )}
    </section>
  );
}
