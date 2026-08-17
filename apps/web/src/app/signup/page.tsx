'use client';

import { ArrowLeft, BadgeCheck, KeyRound, RefreshCw, Store } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { DaemionLockup } from '../_components/DaemionBrand';
import { signupClient } from '@/lib/api';
import { ClientProfile } from '@/types/domain';

type AuthChannel = 'email';

interface Challenge {
  sent: true;
  challengeId: string;
  channel: AuthChannel;
  destination: string;
  expiresAt: string;
  deliveryMode?: 'dry-run' | 'sent' | 'skipped';
  devCode?: string;
}

function signupErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || error.message.trim().length === 0) return fallback;

  const detail = error.message.trim();
  if (/^(Signup failed|Unable to send verification code|Unable to verify signup code)/i.test(detail)) {
    return fallback;
  }

  return `${fallback} Detail: ${detail}`;
}

function deliveryIssueMessage(channel: AuthChannel) {
  return `No live verification code was sent by ${channel}. Email delivery is not configured for production yet. Ask the internal team to finish Postmark setup, then resend the code.`;
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
      throw new Error(data.error ?? 'Verification code could not be sent.');
    }
    if (data.challenge.deliveryMode === 'dry-run' && data.challenge.devCode === undefined) {
      throw new Error(deliveryIssueMessage(channel));
    }
    setChallenge(data.challenge);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError(null);
    let createdClient: ClientProfile | null = null;
    try {
      const created = await signupClient({
        businessName: String(form.get('businessName') ?? ''),
        ownerName: String(form.get('ownerName') ?? ''),
        ownerEmail: String(form.get('ownerEmail') ?? ''),
        ownerPhone: String(form.get('ownerPhone') ?? ''),
      });
      createdClient = created;
      setClient(created);
      await requestCode(created.id, deliveryChannel);
    } catch (submitError) {
      setError(signupErrorMessage(
        submitError,
        createdClient === null
          ? 'Workspace was not created. Fix: verify business name, owner email, and phone number, then try again.'
          : 'Workspace was created, but the verification code could not be sent.',
      ));
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
      setError(signupErrorMessage(resendError, 'Verification code could not be resent. Fix: check the selected delivery channel and destination, then retry.'));
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
        throw new Error(data.error ?? 'Signup code could not be verified.');
      }
      window.location.href = `/client/onboarding?clientId=${data.client.id}`;
    } catch (verifyError) {
      setError(signupErrorMessage(verifyError, 'Signup code was not accepted. Fix: enter the latest 6-digit code or resend a fresh code.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="client-auth-shell">
      <section className="client-auth-intro">
        <a className="client-auth-brand" href="/">
          <DaemionLockup />
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
          <a className="auth-text-link" href="/login">
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
                Phone number
                <input name="ownerPhone" required placeholder="+8801..." />
              </label>
              <label>
                Verification code delivery
                <select value={deliveryChannel} onChange={(event) => setDeliveryChannel(event.target.value as AuthChannel)}>
                  <option value="email">Email</option>
                </select>
              </label>
              {error !== null && <div className="inline-alert">{error}</div>}
              <button className="icon-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Sending...' : 'Create workspace and send code'}
              </button>
              <p className="auth-switch-copy">
                Already have a workspace? <a href="/login">Log in</a>
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
                  {challenge.deliveryMode === 'skipped'
                    ? `Email delivery is temporarily limited while the mail account is under approval. Use the temporary access code shown below. Expires at ${new Date(challenge.expiresAt).toLocaleTimeString()}.`
                    : `Verification code sent to ${challenge.destination}. Expires at ${new Date(challenge.expiresAt).toLocaleTimeString()}.`}
                </div>
              )}
              {challenge?.devCode !== undefined && (
                <div className="inline-alert">
                  {challenge.deliveryMode === 'skipped' ? 'Temporary access code' : 'Dev code'}: {challenge.devCode}
                </div>
              )}
              <label>
                6-digit code
                <input
                  name="code"
                  autoComplete="one-time-code"
                  disabled={challenge === null}
                  inputMode="numeric"
                  maxLength={6}
                  minLength={6}
                  pattern="[0-9]*"
                  placeholder={challenge === null ? 'Code unavailable' : '123456'}
                  required
                />
              </label>
              <label>
                Resend to
                <select value={deliveryChannel} onChange={(event) => setDeliveryChannel(event.target.value as AuthChannel)}>
                  <option value="email">Email</option>
                </select>
              </label>
              {error !== null && <div className="inline-alert">{error}</div>}
              <div className="form-actions">
                <button className="icon-button" disabled={isSubmitting || challenge === null} type="submit">
                  {isSubmitting ? 'Verifying...' : challenge === null ? 'Waiting for code' : 'Continue to onboarding'}
                </button>
                <button className="icon-button" disabled={isSubmitting} type="button" onClick={() => void resendCode()}>
                  <RefreshCw size={15} />
                  Resend code
                </button>
              </div>
              <p className="auth-switch-copy">
                Need a different account? <a href="/login">Return to login</a>
              </p>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
