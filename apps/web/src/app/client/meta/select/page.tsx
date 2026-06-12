'use client';

import { CheckCircle2, MessageSquareText, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DaemionMark } from '../../../_components/DaemionBrand';
import { ClientPortalNav } from '../../_components/ClientPortalNav';
import { getClientDashboard, getMetaOAuthSession, MetaOAuthSession, selectMetaOAuthPage } from '@/lib/api';
import { ClientProfile } from '@/types/domain';

export default function MetaPageSelectionPage() {
  const [session, setSession] = useState<MetaOAuthSession | null>(null);
  const [language, setLanguage] = useState<ClientProfile['defaultLanguage']>('mixed');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const params = useMemo(() => {
    if (typeof window === 'undefined') return { clientId: '', sessionId: '', status: '', message: '' };
    const search = new URLSearchParams(window.location.search);
    return {
      clientId: search.get('clientId') ?? '',
      sessionId: search.get('sessionId') ?? '',
      status: search.get('status') ?? '',
      message: search.get('message') ?? '',
    };
  }, []);

  async function loadSession() {
    if (params.clientId === '' || params.sessionId === '') {
      setError(params.message || 'The Meta connection session is missing. Start again from your dashboard.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [nextSession, dashboard] = await Promise.all([
        getMetaOAuthSession(params.clientId, params.sessionId),
        getClientDashboard(params.clientId),
      ]);
      setSession(nextSession);
      setLanguage(dashboard.client.defaultLanguage);
      setSelectedPageId(nextSession.selectedPageId ?? nextSession.pages[0]?.id ?? '');
      if (nextSession.error !== undefined && nextSession.error !== null) setError(nextSession.error);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Facebook Pages from Meta.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSession();
  }, []);

  async function connectSelectedPage() {
    if (session === null || selectedPageId === '') return;
    setIsSaving(true);
    setError(null);
    try {
      await selectMetaOAuthPage(params.clientId, session.id, selectedPageId);
      window.location.href = `/client/dashboard?clientId=${encodeURIComponent(params.clientId)}`;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to connect the selected Facebook Page.');
      setIsSaving(false);
    }
  }

  const isReady = session?.status === 'pages_ready' || session?.status === 'completed';

  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div className="client-title-lockup">
          <span className="client-mark"><DaemionMark /></span>
          <div>
            <p className="eyebrow">Meta connection</p>
            <h1>Connect Facebook Page</h1>
          </div>
        </div>
        <ClientPortalNav active="onboarding" clientId={params.clientId} language={language} />
      </header>

      <section className="client-panel">
        <div className="panel-header">
          <div className="panel-title">
            <MessageSquareText size={16} />
            Facebook Page Messenger
          </div>
          <button className="icon-button" disabled={isLoading} type="button" onClick={() => void loadSession()}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {error !== null && (
          <div className="inline-alert">
            <TriangleAlert size={15} />
            {error}
          </div>
        )}

        {isLoading && <div className="empty">Loading Facebook Pages...</div>}

        {!isLoading && session?.status === 'completed' && (
          <div className="inline-success">
            <CheckCircle2 size={15} />
            Facebook Page connected. Returning to the dashboard is safe.
          </div>
        )}

        {!isLoading && isReady && session.pages.length > 0 && (
          <div className="meta-page-picker">
            <p>
              Choose the Facebook Page Daemion should use for Messenger automation. Daemion will only save the Page ID,
              Page name, and an encrypted Page token.
            </p>
            <div className="choice-grid">
              {session.pages.map((page) => (
                <label className="choice-control" key={page.id}>
                  <input
                    checked={selectedPageId === page.id}
                    name="facebookPage"
                    type="radio"
                    value={page.id}
                    onChange={() => setSelectedPageId(page.id)}
                  />
                  <span>
                    <strong>{page.name}</strong>
                    <small>{page.id}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="form-actions">
              <button className="icon-button" disabled={selectedPageId === '' || isSaving} type="button" onClick={() => void connectSelectedPage()}>
                {isSaving ? 'Connecting...' : 'Connect selected Page'}
              </button>
              <a className="mini-button" href={`/client/dashboard?clientId=${encodeURIComponent(params.clientId)}`}>
                Back to dashboard
              </a>
            </div>
          </div>
        )}

        {!isLoading && session !== null && session.pages.length === 0 && (
          <div className="empty">Meta did not return any Facebook Pages for this login.</div>
        )}
      </section>
    </main>
  );
}
