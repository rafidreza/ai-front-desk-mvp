'use client';

import { Mic, MessageCircle, PhoneCall, PhoneOff, Send } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useVoiceCall } from './_lib/use-voice-call';

type ChatMessage = {
  id: string;
  role: 'customer' | 'agent';
  text: string;
};

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

// Bumped to v2 when voice calling was added: the v1 copy covered text only, so anyone who agreed
// to it never consented to sharing their voice. The bump forces a re-prompt rather than silently
// reusing text consent for audio.
const consentVersion = 'pdpa-widget-v2';

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
  const [hasConsent, setHasConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-client';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-client';
  }, []);

  const call = useVoiceCall(clientId, visitorId);
  const isCallActive = call.status !== 'idle' && call.status !== 'error';

  useEffect(() => {
    const storageKey = `afd_widget_visitor_${clientId}`;
    const consentKey = `afd_widget_pdpa_consent_${clientId}`;
    setHasConsent(window.localStorage.getItem(consentKey) === consentVersion);
    const existing = window.localStorage.getItem(storageKey);
    if (existing !== null) {
      setVisitorId(existing);
      return;
    }
    const created = createVisitorId();
    window.localStorage.setItem(storageKey, created);
    setVisitorId(created);
  }, [clientId]);

  function acceptConsent() {
    window.localStorage.setItem(`afd_widget_pdpa_consent_${clientId}`, consentVersion);
    setHasConsent(true);
    setError(null);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (visitorId === null || isSending) return;
    if (!hasConsent) {
      setError('Please agree to share your message and contact details before starting the chat.');
      return;
    }
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
        body: JSON.stringify({ clientId, visitorId, text, messageId, pdpaConsent: true, consentVersion }),
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
      <h1 className="sr-only">Daemion web chat</h1>
      <section className="widget-frame" aria-label="Daemion web chat">
        <header className="widget-header">
          <div className="widget-mark">
            <MessageCircle size={18} />
          </div>
          <div>
            <strong>Daemion</strong>
            <span>{isCallActive ? 'Voice call in progress' : 'Usually replies instantly'}</span>
          </div>
          {hasConsent && !isCallActive && (
            <button className="widget-call-start" onClick={call.startCall} type="button">
              <PhoneCall size={15} aria-hidden="true" />
              Call
            </button>
          )}
          {isCallActive && (
            <button className="widget-call-end" onClick={call.endCall} type="button">
              <PhoneOff size={15} aria-hidden="true" />
              End
            </button>
          )}
        </header>

        {isCallActive && (
          <div className="widget-call-panel" aria-live="polite">
            <span className="widget-call-state" data-speaking={call.isAgentSpeaking}>
              <Mic size={14} aria-hidden="true" />
              {call.status === 'requesting-mic' && 'Waiting for microphone access…'}
              {call.status === 'connecting' && 'Connecting…'}
              {call.status === 'ending' && 'Ending call…'}
              {call.status === 'live' && (call.isAgentSpeaking ? 'Agent speaking…' : 'Listening…')}
            </span>
            {call.status === 'live' && call.secondsLeft !== null && (
              <span className="widget-call-timer">{formatCountdown(call.secondsLeft)}</span>
            )}
          </div>
        )}

        <div className="widget-messages">
          {messages.map((message) => (
            <div className="widget-message" data-role={message.role} key={message.id}>
              {message.text}
            </div>
          ))}
          {call.transcript.map((line) => (
            <div className="widget-message" data-role={line.role} data-voice="true" key={line.id}>
              {line.text}
            </div>
          ))}
          {isSending && (
            <div className="widget-message" data-role="agent">
              Checking...
            </div>
          )}
        </div>

        {error !== null && <div className="widget-error">{error}</div>}
        {call.error !== null && <div className="widget-error">{call.error}</div>}

        {!hasConsent && (
          <div className="widget-consent" role="region" aria-label="Privacy consent">
            <p>
              By starting this chat or a voice call, you agree to share your message, your voice, and any contact
              details with this business so they can respond.
            </p>
            <button type="button" onClick={acceptConsent}>
              Agree and start
            </button>
          </div>
        )}

        {hasConsent && (
          <form className="widget-input" onSubmit={sendMessage}>
            <input name="message" placeholder="Type your message" autoComplete="off" />
            <button aria-label="Send message" disabled={visitorId === null || isSending} type="submit">
              <Send size={16} />
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
