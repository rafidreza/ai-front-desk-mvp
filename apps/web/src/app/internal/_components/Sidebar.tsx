import { BotMessageSquare, DatabaseZap, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { ApiHealth } from '@/types/domain';

type ActiveView = 'operations' | 'qa';

interface SidebarProps {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  health: ApiHealth | null;
  healthError: string | null;
  onLogout: () => void;
}

export function Sidebar({ activeView, onChangeView, health, healthError, onLogout }: SidebarProps) {
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
        <button
          className="side-link"
          data-active={activeView === 'operations'}
          type="button"
          onClick={() => onChangeView('operations')}
        >
          <LayoutDashboard size={17} />
          Operations
        </button>
        <button
          className="side-link"
          data-active={activeView === 'qa'}
          type="button"
          onClick={() => onChangeView('qa')}
        >
          <ShieldCheck size={17} />
          QA Review
        </button>
        <Link className="side-link" href="/internal/knowledge">
          <DatabaseZap size={17} />
          Knowledge
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
