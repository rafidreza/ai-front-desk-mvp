'use client';

import { MessageCircle, Send } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type ChatMessage = {
  id: string;
  role: 'customer' | 'agent';
  text: string;
};

function createVisitorId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function WebChatWidgetPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      text: 'Hi, how can we help you today?',
    },
  ]);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-client';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-client';
  }, []);

  useEffect(() => {
    const storageKey = `afd_widget_visitor_${clientId}`;
    const existing = window.localStorage.getItem(storageKey);
    if (existing !== null) {
      setVisitorId(existing);
      return;
    }
    const created = createVisitorId();
    window.localStorage.setItem(storageKey, created);
    setVisitorId(created);
  }, [clientId]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (visitorId === null || isSending) return;
    const form = new FormData(event.currentTarget);
    const text = String(form.get('message') ?? '').trim();
    if (text === '') return;

    event.currentTarget.reset();
    const messageId = `web:${visitorId}:${Date.now()}`;
    setError(null);
    setIsSending(true);
    setMessages((current) => [...current, { id: messageId, role: 'customer', text }]);

    try {
      const response = await fetch('/api/web-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, visitorId, text, messageId }),
      });
      const data = (await response.json()) as { reply?: { text: string }; error?: string };
      if (!response.ok || data.reply === undefined) {
        throw new Error(data.error ?? 'Unable to send message.');
      }
      const replyText = data.reply.text;
      setMessages((current) => [
        ...current,
        {
          id: `${messageId}:reply`,
          role: 'agent',
          text: replyText,
        },
      ]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="widget-shell">
      <section className="widget-frame" aria-label="AI Front Desk web chat">
        <header className="widget-header">
          <div className="widget-mark">
            <MessageCircle size={18} />
          </div>
          <div>
            <strong>AI Front Desk</strong>
            <span>Usually replies instantly</span>
          </div>
        </header>

        <div className="widget-messages">
          {messages.map((message) => (
            <div className="widget-message" data-role={message.role} key={message.id}>
              {message.text}
            </div>
          ))}
          {isSending && (
            <div className="widget-message" data-role="agent">
              Checking...
            </div>
          )}
        </div>

        {error !== null && <div className="widget-error">{error}</div>}

        <form className="widget-input" onSubmit={sendMessage}>
          <input name="message" placeholder="Type your message" autoComplete="off" />
          <button aria-label="Send message" disabled={visitorId === null || isSending} type="submit">
            <Send size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}
