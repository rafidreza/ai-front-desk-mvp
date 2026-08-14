'use client';

import { ArrowLeft, RefreshCw, Save } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getClients, updateClientOnboarding } from '@/lib/api';
import { ClientProfile } from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';
import { UiSelect } from '../_components/UiSelect';
import { getErrorMessage } from '../_lib/helpers';

const FOCUS_CHANNELS = ['website'] as const;

type FormState = {
  businessCategory: string;
  pageId: string;
  whatsappPoc: string;
  websiteUrl: string;
  facebookPageUrl: string;
  whatsappSetup: 'self' | 'assisted' | 'skip' | '';
  facebookSetup: 'oauth' | 'assisted' | 'skip' | '';
  focusChannels: Set<(typeof FOCUS_CHANNELS)[number]>;
};

function formFromClient(client: ClientProfile): FormState {
  const profile = client.onboardingProfile ?? {};
  return {
    businessCategory: client.businessCategory ?? '',
    pageId: client.pageId ?? '',
    whatsappPoc: client.whatsappPoc ?? '',
    websiteUrl: profile.websiteUrl ?? '',
    facebookPageUrl: profile.facebookPageUrl ?? '',
    whatsappSetup: profile.whatsappSetup ?? '',
    facebookSetup: profile.facebookSetup ?? '',
    focusChannels: new Set(profile.focusChannels ?? []),
  };
}

export default function OnboardingReviewPage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [form, setForm] = useState<FormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadClients() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getClients();
      setClients(data);
      const requested =
        typeof window === 'undefined'
          ? null
          : new URLSearchParams(window.location.search).get('clientId');
      const initial = data.find((entry) => entry.id === requested) ?? data[0] ?? null;
      if (initial !== null) {
        setSelectedClientId(initial.id);
        setForm(formFromClient(initial));
      } else {
        setSelectedClientId('');
        setForm(null);
      }
    } catch (loadError) {
      setClients([]);
      setSelectedClientId('');
      setForm(null);
      setError(getErrorMessage(loadError, 'Could not load client list.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  const activeClient = useMemo(
    () => clients.find((entry) => entry.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  function selectClient(clientId: string) {
    setSelectedClientId(clientId);
    setError(null);
    setNotice(null);
    const client = clients.find((entry) => entry.id === clientId);
    if (client !== undefined) setForm(formFromClient(client));
  }

  function toggleFocus(channel: (typeof FOCUS_CHANNELS)[number], next: boolean) {
    if (form === null) return;
    const updatedSet = new Set(form.focusChannels);
    if (next) updatedSet.add(channel);
    else updatedSet.delete(channel);
    setForm({ ...form, focusChannels: updatedSet });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form === null || activeClient === null) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateClientOnboarding(activeClient.id, {
        businessCategory: form.businessCategory.trim() || undefined,
        pageId: form.pageId.trim() || undefined,
        whatsappPoc: form.whatsappPoc.trim() || undefined,
        onboardingProfile: {
          focusChannels: Array.from(form.focusChannels),
          websiteUrl: form.websiteUrl.trim() || undefined,
          facebookPageUrl: form.facebookPageUrl.trim() || undefined,
          whatsappSetup: form.whatsappSetup === '' ? undefined : form.whatsappSetup,
          facebookSetup: form.facebookSetup === '' ? undefined : form.facebookSetup,
        },
      });
      setClients((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setForm(formFromClient(updated));
      setNotice('Onboarding profile saved.');
    } catch (saveError) {
      setError(
        getErrorMessage(saveError, 'Could not save onboarding profile. Check the fields and retry.'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <InternalShell
      activeView="clients"
      eyebrow="Onboarding review"
      title="Profile + setup answers collected from each seller"
      action={
        <div className="page-actions">
          <Link className="icon-button" href="/internal/pipeline">
            <ArrowLeft size={15} />
            Back to pipeline
          </Link>
        </div>
      }
    >
      {error !== null && activeClient !== null && <div className="inline-alert">{error}</div>}
      {notice !== null && <div className="inline-success">{notice}</div>}

      {isLoading && form === null && <div className="empty">Loading clients…</div>}
      {!isLoading && error !== null && activeClient === null && (
        <section className="empty-state empty-state--panel">
          <strong>Client list did not load</strong>
          <p>{error}</p>
          <button className="mini-button" type="button" onClick={() => void loadClients()}>
            <RefreshCw size={14} />
            Retry clients
          </button>
        </section>
      )}

      {activeClient !== null && form !== null && (
        <section className="onboarding-review-layout">
          <aside className="onboarding-review-side">
            <UiSelect
              aria-label="Pick client"
              onChange={(event) => selectClient(event.target.value)}
              value={selectedClientId}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.businessName}
                </option>
              ))}
            </UiSelect>

            <dl className="onboarding-review-meta">
              <dt>Business name</dt>
              <dd>{activeClient.businessName}</dd>
              <dt>Onboarding status</dt>
              <dd>{activeClient.onboardingStatus.replace(/_/g, ' ')}</dd>
              <dt>Lifecycle stage</dt>
              <dd>{activeClient.lifecycleStage.replace(/_/g, ' ')}</dd>
              <dt>Owner</dt>
              <dd>{activeClient.ownerName ?? activeClient.ownerEmail ?? '—'}</dd>
              <dt>Default language</dt>
              <dd>{activeClient.defaultLanguage}</dd>
            </dl>
          </aside>

          <form className="onboarding-review-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label>Business category</label>
              <input
                onChange={(event) => setForm({ ...form, businessCategory: event.target.value })}
                placeholder="Saree boutique, electronics shop…"
                type="text"
                value={form.businessCategory}
              />
            </div>

            <div className="form-field">
              <label>Focus channels</label>
              <div className="focus-channels-row">
                {FOCUS_CHANNELS.map((channel) => (
                  <label className="focus-channel-pill" key={channel}>
                    <input
                      checked={form.focusChannels.has(channel)}
                      onChange={(event) => toggleFocus(channel, event.target.checked)}
                      type="checkbox"
                    />
                    {channel}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label>Website URL</label>
              <input
                onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })}
                placeholder="https://"
                type="url"
                value={form.websiteUrl}
              />
            </div>

            <div className="onboarding-review-actions">
              <button
                className="btn-primary"
                data-loading={isSaving ? 'true' : undefined}
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={14} />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save profile
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}
    </InternalShell>
  );
}
