'use client';

import { AlertTriangle } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { getAiProviderHealth, getDatabaseHealth } from '@/lib/api';
import { AiProviderHealth, ApiHealth } from '@/types/domain';
import { P1AlertCenter } from './P1AlertCenter';
import { Sidebar } from './Sidebar';

const idleWarningMs = 25 * 60 * 1000;
const idleLogoutMs = 30 * 60 * 1000;

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
    | 'improvement'
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
  const [idleWarningVisible, setIdleWarningVisible] = useState(false);
  const [idleRemainingSeconds, setIdleRemainingSeconds] = useState(5 * 60);
  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const idleWarningVisibleRef = useRef(false);
  const logoutAtRef = useRef(Date.now() + idleLogoutMs);

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

  const handleLogout = useCallback(async () => {
    await fetch('/api/internal-logout', { method: 'POST' });
    window.location.href = '/internal/login';
  }, []);

  const clearIdleTimers = useCallback(() => {
    if (warningTimerRef.current !== null) window.clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current !== null) window.clearTimeout(logoutTimerRef.current);
    if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimers();
    idleWarningVisibleRef.current = false;
    setIdleWarningVisible(false);
    setIdleRemainingSeconds(5 * 60);
    logoutAtRef.current = Date.now() + idleLogoutMs;

    warningTimerRef.current = window.setTimeout(() => {
      idleWarningVisibleRef.current = true;
      setIdleWarningVisible(true);
      setIdleRemainingSeconds(Math.max(0, Math.ceil((logoutAtRef.current - Date.now()) / 1000)));
      countdownTimerRef.current = window.setInterval(() => {
        setIdleRemainingSeconds(Math.max(0, Math.ceil((logoutAtRef.current - Date.now()) / 1000)));
      }, 1000);
    }, idleWarningMs);

    logoutTimerRef.current = window.setTimeout(() => {
      void handleLogout();
    }, idleLogoutMs);
  }, [clearIdleTimers, handleLogout]);

  useEffect(() => {
    void loadHealth();
    void fetch('/api/internal-session')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: InternalSessionUser | null } | null) => setSessionUser(data?.user ?? null))
      .catch(() => setSessionUser(null));
  }, []);

  useEffect(() => {
    resetIdleTimer();

    const activityEvents: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => {
      if (!idleWarningVisibleRef.current) resetIdleTimer();
    };

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, handleActivity);
      }
      clearIdleTimers();
    };
  }, [clearIdleTimers, resetIdleTimer]);

  return (
    <main className="app-frame">
      <a className="skip-link" href="#main-content">Skip to console content</a>
      <Sidebar
        activeView={activeView}
        health={health}
        healthError={healthError}
        sessionUser={sessionUser}
        onLogout={() => void handleLogout()}
      />

      <section className="workspace" id="main-content" tabIndex={-1}>
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
        <P1AlertCenter />
        {children}
      </section>
      {idleWarningVisible && (
        <div className="idle-timeout-overlay" role="presentation">
          <section
            aria-labelledby="idle-timeout-title"
            aria-modal="true"
            className="idle-timeout-modal"
            role="dialog"
          >
            <div className="section-label">
              <AlertTriangle size={15} />
              Session timeout
            </div>
            <h3 id="idle-timeout-title">You will be signed out soon</h3>
            <p>
              No activity has been detected. For shared-laptop safety, this internal console will
              sign out in {Math.ceil(idleRemainingSeconds / 60)} minute{Math.ceil(idleRemainingSeconds / 60) === 1 ? '' : 's'}.
            </p>
            <div className="idle-timeout-actions">
              <button className="btn-primary" type="button" onClick={resetIdleTimer}>
                Stay signed in
              </button>
              <button className="icon-button" type="button" onClick={() => void handleLogout()}>
                Sign out now
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
