'use client';

import { ReactNode, useEffect, useState } from 'react';
import { getDatabaseHealth } from '@/lib/api';
import { ApiHealth } from '@/types/domain';
import { Sidebar } from './Sidebar';

interface InternalShellProps {
  activeView:
    | 'operations'
    | 'qa'
    | 'clients'
    | 'team'
    | 'tickets'
    | 'conversations'
    | 'knowledge'
    | 'agent-config';
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function InternalShell({ activeView, eyebrow, title, action, children }: InternalShellProps) {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  async function loadHealth() {
    setHealthError(null);
    try {
      setHealth(await getDatabaseHealth());
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
  }, []);

  return (
    <main className="app-frame">
      <Sidebar
        activeView={activeView}
        health={health}
        healthError={healthError}
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
        {children}
      </section>
    </main>
  );
}
