import {
  BotMessageSquare,
  DatabaseZap,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Settings2,
  ShieldCheck,
  TicketCheck,
} from 'lucide-react';
import Link from 'next/link';
import { ApiHealth } from '@/types/domain';

type ActiveView = 'operations' | 'qa' | 'tickets' | 'conversations' | 'knowledge' | 'agent-config';

interface SidebarProps {
  activeView: ActiveView;
  onChangeView?: (view: 'operations' | 'qa') => void;
  health: ApiHealth | null;
  healthError: string | null;
  onLogout: () => void;
}

export function Sidebar({ activeView, onChangeView, health, healthError, onLogout }: SidebarProps) {
  const topLinks = [
    { view: 'operations' as const, label: 'Operations', icon: <LayoutDashboard size={17} />, href: '/internal' },
    { view: 'tickets' as const, label: 'Tickets', icon: <TicketCheck size={17} />, href: '/internal/tickets' },
    { view: 'conversations' as const, label: 'Conversations', icon: <MessagesSquare size={17} />, href: '/internal/conversations' },
    { view: 'qa' as const, label: 'QA Review', icon: <ShieldCheck size={17} />, href: '/internal?view=qa' },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <BotMessageSquare size={19} />
        </div>
        <div>
          <h1>AI Front Desk</h1>
          <span>Ops console</span>
        </div>
      </div>

      <nav className="side-nav" aria-label="Internal sections">
        {topLinks.map((item) =>
          onChangeView !== undefined && (item.view === 'operations' || item.view === 'qa') ? (
            <button
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
            <Link className="side-link" data-active={activeView === item.view} href={item.href} key={item.view}>
              {item.icon}
              {item.label}
            </Link>
          ),
        )}
        <Link className="side-link" data-active={activeView === 'knowledge'} href="/internal/knowledge">
          <DatabaseZap size={17} />
          Knowledge
        </Link>
        <Link className="side-link" data-active={activeView === 'agent-config'} href="/internal/agent-config">
          <Settings2 size={17} />
          Agent Config
        </Link>
      </nav>

      <div className="sidebar-footer">
        <div className="side-status" data-ok={health?.database.ok === true}>
          <span />
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
