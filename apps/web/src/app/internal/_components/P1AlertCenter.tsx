'use client';

import { Bell, BellRing, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getTickets } from '@/lib/api';
import { Ticket } from '@/types/domain';

const POLL_INTERVAL_MS = 30_000;
const SEEN_STORAGE_KEY = 'afd:p1-seen-ticket-ids';
const PERMISSION_PROMPT_KEY = 'afd:p1-notification-permission-asked';

function readSeenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    if (raw === null) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSeenIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-200)));
  } catch {
    /* quota — ignore */
  }
}

function browserNotify(ticket: Ticket) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const notification = new Notification('P1 ticket — needs your decision', {
      body: ticket.customerMessage,
      tag: ticket.id,
      requireInteraction: false,
    });
    notification.onclick = () => {
      window.focus();
      window.location.href = `/internal/tickets?ticketId=${ticket.id}`;
      notification.close();
    };
  } catch {
    /* ignore */
  }
}

export function P1AlertCenter() {
  const [pendingAlerts, setPendingAlerts] = useState<Ticket[]>([]);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>(
    'default',
  );
  const [isPermissionNudgeHidden, setIsPermissionNudgeHidden] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    seenRef.current = readSeenIds();
    setIsPermissionNudgeHidden(window.localStorage.getItem(PERMISSION_PROMPT_KEY) === '1');
    if (!('Notification' in window)) {
      setPermissionState('unsupported');
      return;
    }
    setPermissionState(Notification.permission);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const tickets = await getTickets();
        if (cancelled) return;
        const seen = seenRef.current;
        const fresh = tickets.filter(
          (ticket) =>
            ticket.priority === 'P1' &&
            ticket.status !== 'resolved' &&
            !seen.has(ticket.id),
        );
        if (fresh.length === 0) {
          // Still mark every visible P1 ticket as seen so we don't blast on
          // the first poll. Skip when seen was empty + tickets has prior P1
          // history (first load suppresses) — but tickets is fresh DB state,
          // so adding them all is safe.
          tickets.forEach((ticket) => {
            if (ticket.priority === 'P1') seen.add(ticket.id);
          });
          writeSeenIds(seen);
          return;
        }
        const isFirstRun = seen.size === 0;
        fresh.forEach((ticket) => seen.add(ticket.id));
        writeSeenIds(seen);
        if (isFirstRun) return; // suppress initial avalanche
        setPendingAlerts((current) => [...fresh.reverse(), ...current].slice(0, 5));
        fresh.forEach(browserNotify);
      } catch {
        /* polling failures are silent — next tick retries */
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  function dismiss(ticketId: string) {
    setPendingAlerts((current) => current.filter((alert) => alert.id !== ticketId));
  }

  async function requestPermission() {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    try {
      const next = await Notification.requestPermission();
      setPermissionState(next);
      window.localStorage.setItem(PERMISSION_PROMPT_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  function dismissPermissionNudge() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PERMISSION_PROMPT_KEY, '1');
    }
    setIsPermissionNudgeHidden(true);
  }

  return (
    <>
      {permissionState === 'default' && pendingAlerts.length === 0 && !isPermissionNudgeHidden && (
        <div className="p1-permission-nudge">
          <Bell size={14} />
          <span>Turn on browser alerts so you never miss a P1.</span>
          <button onClick={() => void requestPermission()} type="button">
            Enable
          </button>
          <button
            aria-label="Dismiss browser alert suggestion"
            className="p1-permission-nudge__dismiss"
            onClick={dismissPermissionNudge}
            type="button"
          >
            <X size={13} />
          </button>
        </div>
      )}
      {pendingAlerts.length > 0 && (
        <div className="p1-alert-stack" aria-live="assertive" role="status">
          {pendingAlerts.map((alert) => (
            <article className="p1-alert" key={alert.id}>
              <header>
                <BellRing size={16} />
                <strong>P1 ticket — {alert.reason}</strong>
                <button aria-label="Dismiss alert" onClick={() => dismiss(alert.id)} type="button">
                  <X size={14} />
                </button>
              </header>
              <p>{alert.customerMessage}</p>
              <footer>
                <Link href={`/internal/tickets?ticketId=${alert.id}`} onClick={() => dismiss(alert.id)}>
                  Open ticket →
                </Link>
              </footer>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
