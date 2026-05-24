'use client';

import { AlertTriangle } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { getAiProviderHealth, getDatabaseHealth } from '@/lib/api';
import { AiProviderHealth, ApiHealth } from '@/types/domain';
import { P1AlertCenter } from './P1AlertCenter';
import { Sidebar } from './Sidebar';

type InternalSessionUser = {
  id: string;
  label: string;
  email?: string;
  role: 'admin' | 'operator' | 'read-only';
};

interface InternalShellProps {
  activeView:
    | 'operations'
    | 'qa'
    | 'clients'
    | 'pipeline'
    | 'channels'
    | 'team'
    | 'tickets'
    | 'conversations'
    | 'knowledge'
    | 'kb-review'
    | 'audit-log'
    | 'data-sources'
    | 'agent-config';
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function InternalShell({ activeView, eyebrow, title, action, children }: InternalShellProps) {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [aiHealth, setAiHealth] = useState<AiProviderHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<InternalSessionUser | null>(null);

  async function loadHealth() {
    setHealthError(null);
    try {
      const [databaseHealth, providerHealth] = await Promise.all([
        getDatabaseHealth(),
        getAiProviderHealth(),
      ]);
      setHealth(databaseHealth);
      setAiHealth(providerHealth);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : 'Unable to check database health.');
    }
  }

  async function handleLogout() {
    await fetch('/api/internal-logout', { method: 'POST' });
    window.location.href = '/internal/login';
  }

  useEffect(() => {
    void loadHealth();
    void fetch('/api/internal-session')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: InternalSessionUser | null } | null) => setSessionUser(data?.user ?? null))
      .catch(() => setSessionUser(null));
  }, []);

  return (
    <main className="app-frame">
      <Sidebar
        activeView={activeView}
        health={health}
        healthError={healthError}
        sessionUser={sessionUser}
        onLogout={() => void handleLogout()}
      />

      <section className="workspace">
        <header className="page-head">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          {action}
        </header>
        {aiHealth?.isDegraded === true && (
          <div className="degradation-banner">
            <AlertTriangle size={16} />
            <span>AI is slow right now — using fallback replies.</span>
            <a href="/internal">Internal status</a>
          </div>
        )}
        {children}
      </section>
      <P1AlertCenter />
    </main>
  );
}
