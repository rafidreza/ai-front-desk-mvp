import { Inbox, MessagesSquare, RefreshCw } from 'lucide-react';
import { ConversationLog } from '@/types/domain';
import { PanelError } from './PanelError';

interface ConversationsPanelProps {
  conversations: ConversationLog[];
  activeConversationId?: string;
  isConversationsLoading: boolean;
  conversationsError: string | null;
  onReload: () => void;
  onSelect: (conversation: ConversationLog) => void;
}

export function ConversationsPanel({
  conversations,
  activeConversationId,
  isConversationsLoading,
  conversationsError,
  onReload,
  onSelect,
}: ConversationsPanelProps) {
  return (
    <aside className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <MessagesSquare size={16} />
          Conversations
        </div>
        <div className="panel-actions">
          {isConversationsLoading && <span className="badge">Loading</span>}
          <span className="count">{conversations.length}</span>
          <button className="mini-button" type="button" onClick={onReload} disabled={isConversationsLoading}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="conversation-list">
        {conversationsError !== null ? (
          <PanelError message={conversationsError} isRetrying={isConversationsLoading} onRetry={onReload} />
        ) : (
          <>
            {conversations.length === 0 && <div className="empty">No conversations</div>}
            {conversations.map((conversation) => {
              const lastMessage = conversation.messages.at(-1);
              return (
                <button
                  className="conversation-row"
                  data-selected={conversation.id === activeConversationId}
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelect(conversation)}
                >
                  <span className="avatar">
                    <Inbox size={16} />
                  </span>
                  <span className="conversation-copy">
                    <strong>{conversation.externalSenderId}</strong>
                    <small>{lastMessage?.text ?? 'No messages'}</small>
                  </span>
                  {conversation.lastConfidence !== undefined && (
                    <span className="confidence" data-low={conversation.lastConfidence < 0.8}>
                      {Math.round(conversation.lastConfidence * 100)}%
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
}
