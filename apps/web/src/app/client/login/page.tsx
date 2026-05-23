'use client';

import { BadgeCheck, Info, KeyRound, LogIn, Store } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { ClientProfile } from '@/types/domain';

interface ChallengeResponse {
  challenge: {
    sent: true;
    challengeId: string;
    channel: 'email' | 'whatsapp';
    destination: string;
    expiresAt: string;
    deliveryMode?: 'dry-run' | 'sent' | 'skipped';
    devCode?: string;
  };
}

export default function ClientLoginPage() {
  const [challenge, setChallenge] = useState<ChallengeResponse['challenge'] | null>(null);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('next');
  }, []);

  const redirectedFromLabel = useMemo(() => {
    if (nextPath === null || nextPath === '' || nextPath === '/client/login') return null;
    if (nextPath.startsWith('/client/dashboard')) return 'dashboard';
    if (nextPath.startsWith('/client/tickets')) return 'ticket list';
    if (nextPath.startsWith('/client/knowledge')) return 'knowledge base';
    if (nextPath.startsWith('/client/data-sources')) return 'data sources';
    if (nextPath.startsWith('/client/')) return 'client workspace';
    return null;
  }, [nextPath]);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/client-auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: String(form.get('identifier') ?? ''),
          channel: form.get('channel'),
        }),
      });
      const data = (await response.json()) as ChallengeResponse | { error?: string };
      if (!response.ok || !('challenge' in data)) {
        throw new Error(
          'error' in data && data.error !== undefined
            ? data.error
            : 'Could not send your code. Check the email or phone is right, or switch the delivery channel and try again.',
        );
      }
      setChallenge(data.challenge);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not send your code. Check the email or phone is right, or switch the delivery channel and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (challenge === null) return;
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/client-auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          code: String(form.get('code') ?? ''),
        }),
      });
      const data = (await response.json()) as { client?: ClientProfile; error?: string };
      if (!response.ok || data.client === undefined) {
        throw new Error(
          data.error ??
            'That code did not match. Request a new code or check for typos — codes expire after a few minutes.',
        );
      }
      setClient(data.client);
      window.location.href = nextPath ?? `/client/dashboard?clientId=${data.client.id}`;
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : 'That code did not match. Request a new code or check for typos — codes expire after a few minutes.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="client-auth-shell">
      <section className="client-auth-intro">
        <a className="client-auth-brand" href="/client/login">
          <span>AI</span>
          <strong>AI Front Desk</strong>
        </a>
        <div className="client-auth-copy">
          <p className="eyebrow">Client login</p>
          <h1>Return to the support desk built around your customers.</h1>
          <p>Use a verified email or WhatsApp code to open tickets, knowledge, and channel status.</p>
        </div>
        <div className="client-auth-rail" aria-label="Login access">
          <span data-active="true">
            <BadgeCheck size={15} />
            Verify
          </span>
          <span>Dashboard</span>
        </div>
      </section>

      <section className="client-auth-workspace">
        <div className="client-auth-topline">
          <span>{challenge === null ? 'Workspace access' : 'Confirm access'}</span>
          <a className="auth-text-link" href="/signup">
            <Store size={15} />
            Create account
          </a>
        </div>

        <section className="client-panel auth-form-panel">
          {challenge === null && redirectedFromLabel !== null && (
            <div className="auth-redirect-banner" role="status">
              <Info size={16} />
              <span>
                You were sent here from your <strong>{redirectedFromLabel}</strong>. Verify your
                access code to continue.
              </span>
            </div>
          )}
          {challenge === null ? (
            <form className="stack-form" onSubmit={requestCode}>
              <div className="section-label">
                <LogIn size={15} />
                Request code
              </div>
              <label>
                Email, phone, or client ID
                <input name="identifier" required placeholder="owner@example.com or client-id" />
              </label>
              <label>
                Delivery channel
                <select name="channel" defaultValue="email">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </label>
              {error !== null && <div className="inline-alert">{error}</div>}
              <button className="icon-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Sending...' : 'Send code'}
              </button>
              <p className="auth-switch-copy">
                No workspace yet? <a href="/signup">Create client account</a>
              </p>
            </form>
          ) : (
            <form className="stack-form" onSubmit={verifyCode}>
              <div className="section-label">
                <KeyRound size={15} />
                Verify code
              </div>
              <div className="inline-success">
                Code requested for {challenge.destination}. Expires at {new Date(challenge.expiresAt).toLocaleTimeString()}.
              </div>
              {challenge.devCode !== undefined && <div className="inline-alert">Dev code: {challenge.devCode}</div>}
              <label>
                6-digit code
                <input name="code" inputMode="numeric" maxLength={6} minLength={6} required />
              </label>
              {error !== null && <div className="inline-alert">{error}</div>}
              <button className="icon-button" disabled={isSubmitting || client !== null} type="submit">
                {isSubmitting ? 'Verifying...' : 'Open dashboard'}
              </button>
              <p className="auth-switch-copy">
                Starting fresh? <a href="/signup">Create client account</a>
              </p>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
