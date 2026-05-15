'use client';

import { CheckCircle2, Store } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { signupClient } from '@/lib/api';
import { ClientProfile } from '@/types/domain';

export default function SignupPage() {
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        businessCategory: String(form.get('businessCategory') ?? ''),
        pageId: String(form.get('pageId') ?? ''),
      });
      setClient(created);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Signup failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="client-shell">
      <section className="client-hero">
        <div>
          <p className="eyebrow">Client onboarding</p>
          <h1>AI Front Desk</h1>
          <p>Register a seller workspace and start the managed support setup.</p>
        </div>
      </section>

      <section className="client-panel signup-panel">
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
              <input name="ownerName" placeholder="Owner or manager" />
            </label>
            <label>
              Owner email
              <input name="ownerEmail" type="email" placeholder="owner@example.com" />
            </label>
            <label>
              WhatsApp / phone
              <input name="ownerPhone" placeholder="+8801..." />
            </label>
            <label>
              Category
              <input name="businessCategory" placeholder="Clothing, cosmetics, electronics" />
            </label>
            <label>
              Facebook Page ID
              <input name="pageId" placeholder="Optional until Meta connection" />
            </label>
            {error !== null && <div className="inline-alert">{error}</div>}
            <button className="icon-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Creating...' : 'Create workspace'}
            </button>
          </form>
        ) : (
          <div className="success-state">
            <CheckCircle2 size={32} />
            <h2>{client.businessName}</h2>
            <p>Workspace created. Client ID: {client.id}</p>
            <a className="icon-button" href={`/client/dashboard?clientId=${client.id}`}>
              Open dashboard
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
