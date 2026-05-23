'use client';

import { ArrowLeft, BadgeCheck, KeyRound, RefreshCw, Store } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { signupClient } from '@/lib/api';
import { ClientProfile } from '@/types/domain';

type AuthChannel = 'email' | 'whatsapp';

interface Challenge {
  sent: true;
  challengeId: string;
  channel: AuthChannel;
  destination: string;
  expiresAt: string;
  deliveryMode?: 'dry-run' | 'sent' | 'skipped';
  devCode?: string;
}

export default function SignupPage() {
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [deliveryChannel, setDeliveryChannel] = useState<AuthChannel>('email');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function requestCode(clientId: string, channel: AuthChannel) {
    const response = await fetch('/api/client-auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: clientId, channel }),
    });
    const data = (await response.json()) as { challenge?: Challenge; error?: string };
    if (!response.ok || data.challenge === undefined) {
      throw new Error(data.error ?? 'Unable to send verification code.');
    }
    setChallenge(data.challenge);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await signupClient({
        businessName: String(form.get('businessName') ?? ''),
        ownerName: String(form.get('ownerName') ?? ''),
        ownerEmail: String(form.get('ownerEmail') ?? ''),
        ownerPhone: String(form.get('ownerPhone') ?? ''),
      });
      setClient(created);
      await requestCode(created.id, deliveryChannel);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Signup failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendCode() {
    if (client === null) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await requestCode(client.id, deliveryChannel);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Unable to resend verification code.');
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
        throw new Error(data.error ?? 'Unable to verify signup code.');
      }
      window.location.href = `/client/onboarding?clientId=${data.client.id}`;
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Unable to verify signup code.');
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
          <p className="eyebrow">Client signup</p>
          <h1>Open a workspace for the conversations that need your business context.</h1>
          <p>Start with the owner contact and a verified code. Channel setup and business knowledge come next.</p>
        </div>
        <div className="client-auth-rail" aria-label="Signup steps">
          <span data-active="true">
            <BadgeCheck size={15} />
            Owner
          </span>
          <span>Verify</span>
          <span>Onboard</span>
        </div>
      </section>

      <section className="client-auth-workspace">
        <div className="client-auth-topline">
          <a className="auth-text-link" href="/client/login">
            <ArrowLeft size={15} />
            Back to client login
          </a>
          <span>{client === null ? 'New workspace' : 'Verification'}</span>
        </div>

        <section className="client-panel auth-form-panel">
          {client === null ? (
            <form className="stack-form" onSubmit={handleSubmit}>
              <div className="section-label">
                <Store size={15} />
                Seller profile
              </div>
              <label>
                Business name
                <input name="businessName" required placeholder="Example Fashion BD" />
              </label>
              <label>
                Owner name
                <input name="ownerName" required placeholder="Owner or manager" />
              </label>
              <label>
                Owner email
                <input name="ownerEmail" required type="email" placeholder="owner@example.com" />
              </label>
              <label>
                WhatsApp number
                <input name="ownerPhone" required placeholder="+8801..." />
              </label>
              <label>
                Verification code delivery
                <select value={deliveryChannel} onChange={(event) => setDeliveryChannel(event.target.value as AuthChannel)}>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </label>
              {error !== null && <div className="inline-alert">{error}</div>}
              <button className="icon-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Sending...' : 'Create workspace and send code'}
              </button>
              <p className="auth-switch-copy">
                Already have a workspace? <a href="/client/login">Log in</a>
              </p>
            </form>
          ) : (
            <form className="stack-form" onSubmit={verifyCode}>
              <div className="section-label">
                <KeyRound size={15} />
                Verify {client.businessName}
              </div>
              {challenge !== null && (
                <div className="inline-success">
                  Code sent to {challenge.destination}. Expires at {new Date(challenge.expiresAt).toLocaleTimeString()}.
                </div>
              )}
              {challenge?.devCode !== undefined && <div className="inline-alert">Dev code: {challenge.devCode}</div>}
              <label>
                6-digit code
                <input name="code" inputMode="numeric" maxLength={6} minLength={6} required />
              </label>
              <label>
                Resend to
                <select value={deliveryChannel} onChange={(event) => setDeliveryChannel(event.target.value as AuthChannel)}>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </label>
              {error !== null && <div className="inline-alert">{error}</div>}
              <div className="form-actions">
                <button className="icon-button" disabled={isSubmitting || challenge === null} type="submit">
                  {isSubmitting ? 'Verifying...' : 'Continue to onboarding'}
                </button>
                <button className="icon-button" disabled={isSubmitting} type="button" onClick={() => void resendCode()}>
                  <RefreshCw size={15} />
                  Resend code
                </button>
              </div>
              <p className="auth-switch-copy">
                Need a different account? <a href="/client/login">Return to login</a>
              </p>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
