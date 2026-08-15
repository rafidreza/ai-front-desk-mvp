import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  DatabaseZap,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Kanban,
  ListChecks,
  Settings2,
  ShieldCheck,
  TicketCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { DaemionLockup } from '../../_components/DaemionBrand';
import { ApiHealth } from '@/types/domain';

type ActiveView =
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
  | 'agent-config'
  | 'voice-console';

interface SidebarProps {
  activeView: ActiveView;
  onChangeView?: (view: 'operations' | 'qa') => void;
  health: ApiHealth | null;
  healthError: string | null;
  sessionUser?: { label: string; role: 'admin' | 'operator' | 'read-only' } | null;
  onLogout: () => void;
}

export function Sidebar({ activeView, onChangeView, health, healthError, sessionUser, onLogout }: SidebarProps) {
  const topLinks = [
    { view: 'operations' as const, label: 'Operations', icon: <LayoutDashboard size={17} />, href: '/internal' },
    { view: 'clients' as const, label: 'Clients', icon: <Building2 size={17} />, href: '/internal/clients' },
    { view: 'improvement' as const, label: 'Improvement', icon: <ListChecks size={17} />, href: '/internal/improvement' },
    { view: 'pipeline' as const, label: 'Pipeline', icon: <Kanban size={17} />, href: '/internal/pipeline' },
    { view: 'team' as const, label: 'Team', icon: <Users size={17} />, href: '/internal/team' },
    { view: 'tickets' as const, label: 'Tickets', icon: <TicketCheck size={17} />, href: '/internal/tickets' },
    { view: 'conversations' as const, label: 'Conversations', icon: <MessagesSquare size={17} />, href: '/internal/conversations' },
    { view: 'qa' as const, label: 'QA Review', icon: <ShieldCheck size={17} />, href: '/internal?view=qa' },
  ];

  return (
    <aside className="sidebar" aria-label="Internal console navigation">
      <div className="brand">
        <DaemionLockup className="brand-lockup" />
        <span className="brand-subtitle">Ops console</span>
      </div>

      <nav className="side-nav" aria-label="Internal sections">
        {topLinks.map((item) =>
          onChangeView !== undefined && (item.view === 'operations' || item.view === 'qa') ? (
            <button
              aria-pressed={activeView === item.view}
              className="side-link"
              data-active={activeView === item.view}
              key={item.view}
              type="button"
              onClick={() => onChangeView(item.view)}
            >
              {item.icon}
              {item.label}
            </button>
          ) : (
            <Link
              aria-current={activeView === item.view ? 'page' : undefined}
              className="side-link"
              data-active={activeView === item.view}
              href={item.href}
              key={item.view}
            >
              {item.icon}
              {item.label}
            </Link>
          ),
        )}
        <Link
          aria-current={activeView === 'knowledge' ? 'page' : undefined}
          className="side-link"
          data-active={activeView === 'knowledge'}
          href="/internal/knowledge"
        >
          <DatabaseZap size={17} />
          Knowledge
        </Link>
        <Link
          aria-current={activeView === 'kb-review' ? 'page' : undefined}
          className="side-link"
          data-active={activeView === 'kb-review'}
          href="/internal/kb-review"
        >
          <ClipboardCheck size={17} />
          KB Review
        </Link>
        <Link
          aria-current={activeView === 'audit-log' ? 'page' : undefined}
          className="side-link"
          data-active={activeView === 'audit-log'}
          href="/internal/audit-log"
        >
          <ClipboardList size={17} />
          Audit Log
        </Link>
        <Link
          aria-current={activeView === 'agent-config' ? 'page' : undefined}
          className="side-link"
          data-active={activeView === 'agent-config'}
          href="/internal/agent-config"
        >
          <Settings2 size={17} />
          Agent Config
        </Link>
        <Link
          aria-current={activeView === 'voice-console' ? 'page' : undefined}
          className="side-link"
          data-active={activeView === 'voice-console'}
          href="/internal/voice-console"
        >
          <Settings2 size={17} />
          Voice Console
        </Link>
      </nav>

      <div className="sidebar-footer">
        {sessionUser !== undefined && sessionUser !== null && (
          <div className="side-status" data-ok>
            <span aria-hidden="true" />
            <div>
              <strong>{sessionUser.label}</strong>
              <small>{sessionUser.role}</small>
            </div>
          </div>
        )}
        <div className="side-status" data-ok={health?.database.ok === true}>
          <span aria-hidden="true" />
          <div>
            <strong>
              {health?.database.ok ? 'Neon online' : healthError === null ? 'Database check' : 'Health issue'}
            </strong>
            <small>
              {health?.database.latencyMs !== undefined
                ? `${health.database.latencyMs}ms`
                : healthError === null
                  ? 'Waiting'
                  : 'Retry from header'}
            </small>
          </div>
        </div>

        <button className="logout-button" type="button" onClick={onLogout}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
