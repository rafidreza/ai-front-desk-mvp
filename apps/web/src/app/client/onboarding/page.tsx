'use client';

import { BookOpenText, Building2, Link2, MessageCircle } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { ClientPortalNav } from '../_components/ClientPortalNav';
import { submitClientKnowledgeRequest, updateClientOnboarding } from '@/lib/api';
import {
  ClientFacebookSetupPreference,
  ClientFocusChannel,
  ClientWhatsAppSetupPreference,
} from '@/types/domain';

type Step = 'profile' | 'channels' | 'knowledge';

function optionalValue(value: FormDataEntryValue | null) {
  const next = String(value ?? '').trim();
  return next === '' ? undefined : next;
}

function parseKeywords(value: string) {
  const keywords = value
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  return keywords.length === 0 ? ['onboarding', 'business'] : Array.from(new Set(keywords));
}

export default function ClientOnboardingPage() {
  const [step, setStep] = useState<Step>('profile');
  const [focusChannels, setFocusChannels] = useState<ClientFocusChannel[]>(['whatsapp']);
  const [whatsappSetup, setWhatsappSetup] = useState<ClientWhatsAppSetupPreference>('assisted');
  const [facebookSetup, setFacebookSetup] = useState<ClientFacebookSetupPreference>('oauth');
  const [businessCategory, setBusinessCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('clientId') ?? '';
  }, []);

  function toggleFocus(channel: ClientFocusChannel) {
    setFocusChannels((current) =>
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel],
    );
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (clientId === '') {
      setError('Client session is missing.');
      return;
    }
    if (focusChannels.length === 0) {
      setError('Select at least one customer channel.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const category = String(form.get('businessCategory') ?? '').trim();
      await updateClientOnboarding(clientId, {
        businessCategory: category,
        onboardingStatus: 'profile_complete',
        onboardingProfile: {
          focusChannels,
          websiteUrl: optionalValue(form.get('websiteUrl')),
          facebookPageUrl: optionalValue(form.get('facebookPageUrl')),
        },
      });
      setBusinessCategory(category);
      setStep('channels');
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Unable to save business profile.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveChannels(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await updateClientOnboarding(clientId, {
        pageId: optionalValue(form.get('pageId')),
        whatsappPoc: optionalValue(form.get('whatsappPoc')),
        onboardingStatus: 'channels_complete',
        onboardingProfile: {
          ...(focusChannels.includes('whatsapp') ? { whatsappSetup } : {}),
          ...(focusChannels.includes('facebook') ? { facebookSetup } : {}),
        },
      });
      setStep('knowledge');
    } catch (channelError) {
      setError(channelError instanceof Error ? channelError.message : 'Unable to save channel setup.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function skipChannels() {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await updateClientOnboarding(clientId, {
        onboardingStatus: 'channels_complete',
        onboardingProfile: {
          ...(focusChannels.includes('whatsapp') ? { whatsappSetup: 'skip' } : {}),
          ...(focusChannels.includes('facebook') ? { facebookSetup: 'skip' } : {}),
        },
      });
      setWhatsappSetup('skip');
      setFacebookSetup('skip');
      setStep('knowledge');
    } catch (channelError) {
      setError(channelError instanceof Error ? channelError.message : 'Unable to skip channel setup.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function finishOnboarding(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const form = event === undefined ? null : new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const knowledge = optionalValue(form?.get('knowledge') ?? null);
      if (knowledge !== undefined) {
        await submitClientKnowledgeRequest(clientId, {
          proposedTitle: optionalValue(form?.get('knowledgeTitle') ?? null) ?? `${businessCategory || 'Business'} onboarding knowledge`,
          proposedAnswer: knowledge,
          proposedKeywords: parseKeywords(String(form?.get('keywords') ?? '')),
          proposedCategory: businessCategory || 'general',
          requesterNote: 'Submitted during client onboarding.',
        });
      }
      await updateClientOnboarding(clientId, { onboardingStatus: 'onboarding_complete' });
      window.location.href = `/client/dashboard?clientId=${clientId}`;
    } catch (knowledgeError) {
      setError(knowledgeError instanceof Error ? knowledgeError.message : 'Unable to finish onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div className="client-title-lockup">
          <span className="client-mark">ST</span>
          <div>
            <p className="eyebrow">Client onboarding</p>
            <h1>Set up your business</h1>
          </div>
        </div>
        <ClientPortalNav active="onboarding" clientId={clientId} />
      </header>

      <section className="client-setup-brief">
        <p>Share the business context, channel setup path, and first knowledge notes for your workspace.</p>
      </section>

      <section className="client-panel onboarding-panel">
        <div className="onboarding-steps" aria-label="Onboarding progress">
          {(['profile', 'channels', 'knowledge'] as const).map((item, index) => (
            <span data-active={step === item} key={item}>
              {index + 1}. {item}
            </span>
          ))}
        </div>

        {error !== null && <div className="inline-alert">{error}</div>}
        {notice !== null && <div className="inline-success">{notice}</div>}

        {step === 'profile' && (
          <form className="stack-form" onSubmit={saveProfile}>
            <div className="section-label">
              <Building2 size={15} />
              Business profile
            </div>
            <label>
              Business category
              <input name="businessCategory" required placeholder="Fashion, dental clinic, electronics" />
            </label>
            <fieldset className="choice-fieldset">
              <legend>Customer channels</legend>
              <div className="choice-grid">
                <label className="choice-control">
                  <input checked={focusChannels.includes('whatsapp')} type="checkbox" onChange={() => toggleFocus('whatsapp')} />
                  WhatsApp
                </label>
                <label className="choice-control">
                  <input checked={focusChannels.includes('facebook')} type="checkbox" onChange={() => toggleFocus('facebook')} />
                  Facebook
                </label>
                <label className="choice-control">
                  <input checked={focusChannels.includes('website')} type="checkbox" onChange={() => toggleFocus('website')} />
                  Website
                </label>
              </div>
            </fieldset>
            <label>
              Website URL
              <input name="websiteUrl" placeholder="https://example.com" type="url" />
            </label>
            <label>
              Facebook page URL
              <input name="facebookPageUrl" placeholder="https://facebook.com/your-page" type="url" />
            </label>
            <button className="icon-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Saving...' : 'Continue to channels'}
            </button>
          </form>
        )}

        {step === 'channels' && (
          <form className="stack-form" onSubmit={saveChannels}>
            <div className="section-label">
              <MessageCircle size={15} />
              Channel setup
            </div>
            {focusChannels.includes('whatsapp') && (
              <>
                <label>
                  WhatsApp setup path
                  <select value={whatsappSetup} onChange={(event) => setWhatsappSetup(event.target.value as ClientWhatsAppSetupPreference)}>
                    <option value="self">I will provide setup details</option>
                    <option value="assisted">Set it up with me</option>
                    <option value="skip">Skip for now</option>
                  </select>
                </label>
                {whatsappSetup === 'self' && (
                  <label>
                    WhatsApp support number
                    <input name="whatsappPoc" placeholder="+8801..." />
                  </label>
                )}
              </>
            )}
            {focusChannels.includes('facebook') && (
              <>
                <label>
                  Facebook setup path
                  <select value={facebookSetup} onChange={(event) => setFacebookSetup(event.target.value as ClientFacebookSetupPreference)}>
                    <option value="oauth">Connect with Facebook OAuth</option>
                    <option value="assisted">Set it up with me</option>
                    <option value="skip">Skip for now</option>
                  </select>
                </label>
                {facebookSetup === 'oauth' && <div className="inline-success">Facebook OAuth setup requested.</div>}
                {facebookSetup !== 'skip' && (
                  <label>
                    Facebook Page ID
                    <input name="pageId" placeholder="Optional until the page connection is ready" />
                  </label>
                )}
              </>
            )}
            {!focusChannels.includes('whatsapp') && !focusChannels.includes('facebook') && (
              <div className="inline-success">
                <Link2 size={14} />
                Website channel noted. The dashboard will keep the web widget ready.
              </div>
            )}
            <div className="form-actions">
              <button className="icon-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Saving...' : 'Continue to knowledge'}
              </button>
              <button className="icon-button" disabled={isSubmitting} type="button" onClick={() => void skipChannels()}>
                Skip channel setup
              </button>
            </div>
          </form>
        )}

        {step === 'knowledge' && (
          <form className="stack-form" onSubmit={finishOnboarding}>
            <div className="section-label">
              <BookOpenText size={15} />
              First knowledge notes
            </div>
            <label>
              Knowledge title
              <input name="knowledgeTitle" placeholder="Delivery, returns, pricing, support hours" />
            </label>
            <label>
              Business knowledge
              <textarea name="knowledge" placeholder="Share policies, process notes, FAQ answers, product details, and anything customers ask often." />
            </label>
            <label>
              Keywords
              <input name="keywords" placeholder="delivery, refund, support hours" />
            </label>
            <div className="form-actions">
              <button className="icon-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Finishing...' : 'Finish onboarding'}
              </button>
              <button className="icon-button" disabled={isSubmitting} type="button" onClick={() => void finishOnboarding()}>
                Skip knowledge for now
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
