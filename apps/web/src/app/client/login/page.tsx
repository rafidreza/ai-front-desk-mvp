'use client';

import { KeyRound, LogIn } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { ClientProfile } from '@/types/domain';

interface ChallengeResponse {
  challenge: {
    challengeId: string;
    clientId: string;
    channel: 'email' | 'whatsapp';
    destination: string;
    expiresAt: string;
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
        throw new Error('error' in data && data.error !== undefined ? data.error : 'Unable to send login code.');
      }
      setChallenge(data.challenge);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send login code.');
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
        throw new Error(data.error ?? 'Unable to verify login code.');
      }
      setClient(data.client);
      window.location.href = nextPath ?? `/client/dashboard?clientId=${data.client.id}`;
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Unable to verify login code.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="client-shell">
      <section className="client-hero">
        <div>
          <p className="eyebrow">Client login</p>
          <h1>AI Front Desk</h1>
          <p>Enter your workspace email, phone, or client ID to open your support dashboard.</p>
        </div>
      </section>

      <section className="client-panel signup-panel">
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
          </form>
        )}
      </section>
    </main>
  );
}
