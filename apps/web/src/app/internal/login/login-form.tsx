'use client';

import { BotMessageSquare, LockKeyhole } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

export function InternalLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const response = await fetch('/api/internal-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      setError('Password did not match.');
      setIsSubmitting(false);
      return;
    }

    router.replace(searchParams.get('next') ?? '/internal');
    router.refresh();
  }

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
        <LockKeyhole size={24} />
        <h2>Operations Console</h2>
        <p>Enter the internal passcode to continue.</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <label htmlFor="password">Passcode</label>
        <input
          autoComplete="current-password"
          autoFocus
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter passcode"
          type="password"
          value={password}
        />

        {error !== null && <div className="login-error">{error}</div>}

        <button className="icon-button" disabled={isSubmitting || password.length === 0} type="submit">
          {isSubmitting ? 'Checking...' : 'Unlock console'}
        </button>
      </form>
    </section>
  );
}
