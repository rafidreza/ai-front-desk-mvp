'use client';

import { BookOpenText, Building2, Link2, MessageCircle } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DaemionMark } from '../../_components/DaemionBrand';
import { ClientPortalNav } from '../_components/ClientPortalNav';
import { getClientDashboard, submitClientKnowledgeRequest, updateClientOnboarding } from '@/lib/api';
import { getClientPortalCopy } from '@/lib/client-portal-copy';
import { ClientFocusChannel, ClientProfile } from '@/types/domain';

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
  const [focusChannels] = useState<ClientFocusChannel[]>(['website']);
  const [businessCategory, setBusinessCategory] = useState('');
  const [language, setLanguage] = useState<ClientProfile['defaultLanguage']>('english');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('clientId') ?? '';
  }, []);
  const copy = getClientPortalCopy(language);
  const onboardingCopy = copy.onboarding;

  useEffect(() => {
    if (clientId === '') return;
    void getClientDashboard(clientId)
      .then((dashboard) => setLanguage(dashboard.client.defaultLanguage))
      .catch(() => undefined);
  }, [clientId]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (clientId === '') {
      setError(onboardingCopy.missingSession);
      return;
    }
    if (focusChannels.length === 0) {
      setError(onboardingCopy.selectChannel);
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
        },
      });
      setBusinessCategory(category);
      setStep('channels');
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : onboardingCopy.profileError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveChannels(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await updateClientOnboarding(clientId, {
        onboardingStatus: 'channels_complete',
      });
      setStep('knowledge');
    } catch (channelError) {
      setError(channelError instanceof Error ? channelError.message : onboardingCopy.channelError);
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
      });
      setStep('knowledge');
    } catch (channelError) {
      setError(channelError instanceof Error ? channelError.message : onboardingCopy.skipError);
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
      setError(knowledgeError instanceof Error ? knowledgeError.message : onboardingCopy.finishError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div className="client-title-lockup">
          <span className="client-mark"><DaemionMark /></span>
          <div>
            <p className="eyebrow">{onboardingCopy.eyebrow}</p>
            <h1>{onboardingCopy.title}</h1>
          </div>
        </div>
        <ClientPortalNav active="onboarding" clientId={clientId} language={language} />
      </header>

      <section className="client-setup-brief">
        <p>{onboardingCopy.brief}</p>
      </section>

      <section className="client-panel onboarding-panel">
        <div className="onboarding-steps" aria-label="Onboarding progress">
          {(['profile', 'channels', 'knowledge'] as const).map((item, index) => (
            <span data-active={step === item} key={item}>
              {index + 1}. {onboardingCopy.steps[item]}
            </span>
          ))}
        </div>

        {error !== null && <div className="inline-alert">{error}</div>}
        {notice !== null && <div className="inline-success">{notice}</div>}

        {step === 'profile' && (
          <form className="stack-form" onSubmit={saveProfile}>
            <div className="section-label">
              <Building2 size={15} />
              {onboardingCopy.businessProfile}
            </div>
            <label>
              {onboardingCopy.businessCategory}
              <input name="businessCategory" required placeholder={onboardingCopy.businessCategoryPlaceholder} />
            </label>
            <fieldset className="choice-fieldset">
              <legend>{onboardingCopy.customerChannels}</legend>
              <div className="choice-grid">
                <label className="choice-control">
                  <input checked readOnly type="checkbox" />
                  Website
                </label>
              </div>
            </fieldset>
            <label>
              {onboardingCopy.websiteUrl}
              <input name="websiteUrl" placeholder="https://example.com" type="url" />
            </label>
            <button className="icon-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? onboardingCopy.saving : onboardingCopy.continueChannels}
            </button>
          </form>
        )}

        {step === 'channels' && (
          <form className="stack-form" onSubmit={saveChannels}>
            <div className="section-label">
              <MessageCircle size={15} />
              {onboardingCopy.channelSetup}
            </div>
            <div className="inline-success">
              <Link2 size={14} />
              {onboardingCopy.websiteNoted}
            </div>
            <div className="form-actions">
              <button className="icon-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? onboardingCopy.saving : onboardingCopy.continueKnowledge}
              </button>
              <button className="icon-button" disabled={isSubmitting} type="button" onClick={() => void skipChannels()}>
                {onboardingCopy.skipChannelSetup}
              </button>
            </div>
          </form>
        )}

        {step === 'knowledge' && (
          <form className="stack-form" onSubmit={finishOnboarding}>
            <div className="section-label">
              <BookOpenText size={15} />
              {onboardingCopy.firstKnowledge}
            </div>
            <label>
              {onboardingCopy.knowledgeTitle}
              <input name="knowledgeTitle" placeholder="Delivery, returns, pricing, support hours" />
            </label>
            <label>
              {onboardingCopy.businessKnowledge}
              <textarea name="knowledge" placeholder="Share policies, process notes, FAQ answers, product details, and anything customers ask often." />
            </label>
            <label>
              {onboardingCopy.keywords}
              <input name="keywords" placeholder="delivery, refund, support hours" />
            </label>
            <div className="form-actions">
              <button className="icon-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? onboardingCopy.finishing : onboardingCopy.finish}
              </button>
              <button className="icon-button" disabled={isSubmitting} type="button" onClick={() => void finishOnboarding()}>
                {onboardingCopy.skipKnowledge}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
