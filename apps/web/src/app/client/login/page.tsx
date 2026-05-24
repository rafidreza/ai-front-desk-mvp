'use client';

import { BadgeCheck, Info, KeyRound, LogIn, Store } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
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

type CodeRequest = {
  identifier: string;
  channel: 'email' | 'whatsapp';
};

const identifierExamples = 'Examples: client ID pilot-client, owner email owner@example.com, or WhatsApp +8801XXXXXXXXX.';

function channelLabel(channel: CodeRequest['channel']) {
  return channel === 'email' ? 'email' : 'WhatsApp';
}

function fallbackChannelLabelFor(channel: CodeRequest['channel']) {
  return channel === 'email' ? 'WhatsApp' : 'email';
}

function deliveryIssueMessage(input: CodeRequest) {
  return `No live login code was sent for that ${channelLabel(input.channel)} request. Check that the client ID, owner email, or WhatsApp number matches the workspace, then try again. ${identifierExamples}`;
}

function requestFailureMessage(message: string, input: CodeRequest) {
  if (message.includes(identifierExamples)) return message;

  if (/does not have an? (email|whatsapp) destination configured/i.test(message)) {
    return `${channelLabel(input.channel)} login is not configured for this workspace yet. Try ${fallbackChannelLabelFor(input.channel)} instead, or ask the team to add a ${channelLabel(input.channel)} destination to the client profile.`;
  }

  if (/inactive/i.test(message)) {
    return 'This client workspace is inactive. Ask the internal team to reactivate the client before requesting another code.';
  }

  if (/fetch failed|failed to fetch|backend request failed|internal server error|econnrefused|service is unavailable/i.test(message)) {
    return `The client login service is unavailable right now. Check that the API server is running, then retry. ${identifierExamples}`;
  }

  return `${message} ${identifierExamples}`;
}

function verifyFailureMessage(message: string) {
  if (/invalid|expired|already used/i.test(message)) {
    return 'That code did not match, expired, or was already used. Request a new code, then enter the latest 6-digit code.';
  }

  if (/fetch failed|failed to fetch|backend request failed|internal server error|econnrefused|service is unavailable/i.test(message)) {
    return 'The client login service is unavailable right now. Check that the API server is running, then retry verification.';
  }

  return message;
}

export default function ClientLoginPage() {
  const [challenge, setChallenge] = useState<ChallengeResponse['challenge'] | null>(null);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [lastRequest, setLastRequest] = useState<CodeRequest | null>(null);
  const [failedRequest, setFailedRequest] = useState<CodeRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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

  const challengeExpired = challenge !== null && new Date(challenge.expiresAt).getTime() <= now;
  const resendLabel = challenge === null
    ? 'Send code'
    : `Send a new code to ${challenge.destination}`;
  const fallbackRequest = lastRequest ?? failedRequest;
  const fallbackChannel = fallbackRequest?.channel === 'email' ? 'whatsapp' : 'email';
  const fallbackChannelLabel = fallbackChannel === 'email' ? 'email' : 'WhatsApp';

  useEffect(() => {
    if (challenge === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  async function requestCodeFor(input: CodeRequest) {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/client-auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await response.json()) as ChallengeResponse | { error?: string };
      if (!response.ok || !('challenge' in data)) {
        throw new Error(
          'error' in data && data.error !== undefined
            ? data.error
            : 'Could not send your code. Check the email or phone is right, or switch the delivery channel and try again.',
        );
      }
      if (data.challenge.deliveryMode === 'dry-run' && data.challenge.devCode === undefined) {
        throw new Error(deliveryIssueMessage(input));
      }
      setLastRequest(input);
      setFailedRequest(null);
      setChallenge(data.challenge);
      setNotice(
        data.challenge.deliveryMode === 'skipped'
          ? `Code created for ${data.challenge.destination}, but ${channelLabel(data.challenge.channel)} delivery is not fully configured. Try ${fallbackChannelLabelFor(data.challenge.channel)} if you do not receive it.`
          : data.challenge.deliveryMode === 'dry-run'
            ? `Code created for ${data.challenge.destination} in local/dev delivery mode. Use the dev code shown below.`
            : `New code sent to ${data.challenge.destination}.`,
      );
      setNow(Date.now());
    } catch (requestError) {
      setFailedRequest(input);
      setError(
        requestError instanceof Error
          ? requestFailureMessage(requestError.message, input)
          : 'Could not send your code. Check the email or phone is right, or switch the delivery channel and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const channel = form.get('channel') === 'whatsapp' ? 'whatsapp' : 'email';
    await requestCodeFor({
      identifier: String(form.get('identifier') ?? '').trim(),
      channel,
    });
  }

  async function requestNewCode() {
    if (lastRequest === null) {
      setChallenge(null);
      setError(null);
      setNotice(null);
      return;
    }
    await requestCodeFor(lastRequest);
  }

  async function requestFallbackCode() {
    if (fallbackRequest === null) return;
    await requestCodeFor({
      ...fallbackRequest,
      channel: fallbackChannel,
    });
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (challenge === null) return;
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      if (challengeExpired) {
        throw new Error('This code expired. Request a new code to continue.');
      }
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
            'That code did not match, expired, or was already used. Request a new code to continue.',
        );
      }
      setClient(data.client);
      window.location.href = nextPath ?? `/client/dashboard?clientId=${data.client.id}`;
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyFailureMessage(verifyError.message)
          : 'That code did not match, expired, or was already used. Request a new code to continue.',
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
                <span className="auth-field-hint">{identifierExamples}</span>
              </label>
              <label>
                Delivery channel
                <select name="channel" defaultValue="email">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </label>
              {error !== null && <div className="inline-alert">{error}</div>}
              {notice !== null && <div className="inline-success">{notice}</div>}
              <button className="icon-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Sending...' : 'Send code'}
              </button>
              {error !== null && failedRequest !== null && (
                <button className="icon-button" disabled={isSubmitting} type="button" onClick={() => void requestFallbackCode()}>
                  {isSubmitting ? 'Sending...' : `Try ${fallbackChannelLabel} instead`}
                </button>
              )}
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
              {challengeExpired && (
                <div className="inline-alert">
                  This code expired. Request a new code to continue.
                </div>
              )}
              {notice !== null && <div className="inline-success">{notice}</div>}
              {challenge.devCode !== undefined && <div className="inline-alert">Dev code: {challenge.devCode}</div>}
              <label>
                6-digit code
                <input name="code" inputMode="numeric" maxLength={6} minLength={6} required disabled={challengeExpired} />
              </label>
              {error !== null && <div className="inline-alert">{error}</div>}
              <button className="icon-button" disabled={isSubmitting || client !== null || challengeExpired} type="submit">
                {isSubmitting ? 'Verifying...' : 'Open dashboard'}
              </button>
              {(error !== null || challengeExpired) && (
                <button className="icon-button" disabled={isSubmitting} type="button" onClick={() => void requestNewCode()}>
                  {isSubmitting ? 'Sending...' : resendLabel}
                </button>
              )}
              {(error !== null || challengeExpired || challenge.deliveryMode === 'skipped') && fallbackRequest !== null && (
                <button className="icon-button" disabled={isSubmitting} type="button" onClick={() => void requestFallbackCode()}>
                  {isSubmitting ? 'Sending...' : `Try ${fallbackChannelLabel} instead`}
                </button>
              )}
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
