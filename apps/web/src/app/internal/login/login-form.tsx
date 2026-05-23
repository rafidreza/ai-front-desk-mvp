'use client';

import { BotMessageSquare, LockKeyhole, LockKeyholeOpen } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

type FeedbackTone = 'idle' | 'info' | 'error' | 'success';

export function InternalLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string }>({
    tone: 'idle',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isUnlocked = feedback.tone === 'success';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback({ tone: 'info', message: 'Checking passcode…' });

    const response = await fetch('/api/internal-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.trim() }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setFeedback({ tone: 'error', message: data?.error ?? 'Password did not match.' });
      setIsSubmitting(false);
      return;
    }

    setFeedback({ tone: 'success', message: 'Access confirmed. Opening operations console…' });
    await new Promise((resolve) => setTimeout(resolve, 220));
    router.replace(searchParams.get('next') ?? '/internal');
    router.refresh();
  }

  const isDisabled = isSubmitting || password.length === 0;

  return (
    <section className="login-panel">
      <div className="brand login-brand">
        <div className="brand-mark">
          <BotMessageSquare size={19} />
        </div>
        <div>
          <h1>AI Front Desk</h1>
          <span>Internal access</span>
        </div>
      </div>

      <div className="login-copy">
        <span className="login-lock" data-unlocked={isUnlocked}>
          {isUnlocked ? <LockKeyholeOpen size={24} /> : <LockKeyhole size={24} />}
        </span>
        <h2>Operations Console</h2>
        <p>Sign in to manage conversations, tickets, knowledge, and client operations.</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <label htmlFor="password">Passcode</label>
        <input
          autoComplete="current-password"
          autoFocus
          disabled={isSubmitting}
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter passcode"
          type="password"
          value={password}
        />

        <div
          aria-live="polite"
          className="login-feedback"
          data-tone={feedback.tone === 'idle' ? undefined : feedback.tone}
          role="status"
        >
          {feedback.message}
        </div>

        <button
          className="btn-primary"
          data-loading={isSubmitting ? 'true' : undefined}
          disabled={isDisabled}
          type="submit"
        >
          {isSubmitting ? (
            <>
              <span aria-hidden="true" className="btn-spinner" />
              Opening…
            </>
          ) : (
            'Open console'
          )}
        </button>
      </form>
    </section>
  );
}
