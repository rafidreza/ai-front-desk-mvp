import { BookOpenText, ClipboardList, LayoutDashboard, TicketCheck } from 'lucide-react';
import { getClientPortalCopy } from '@/lib/client-portal-copy';
import { ClientProfile } from '@/types/domain';

type ClientPortalView = 'dashboard' | 'tickets' | 'knowledge' | 'onboarding';

const navItems: Array<{
  id: ClientPortalView;
  labelKey: 'overview' | 'tickets' | 'knowledge' | 'setup';
  href: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', labelKey: 'overview', href: '/client/dashboard', icon: LayoutDashboard },
  { id: 'tickets', labelKey: 'tickets', href: '/client/tickets', icon: TicketCheck },
  { id: 'knowledge', labelKey: 'knowledge', href: '/client/knowledge', icon: BookOpenText },
  { id: 'onboarding', labelKey: 'setup', href: '/client/onboarding', icon: ClipboardList },
];

function withClientId(path: string, clientId: string) {
  if (clientId.trim() === '') return path;
  return `${path}?clientId=${encodeURIComponent(clientId)}`;
}

export function ClientPortalNav({ active, clientId, language }: { active: ClientPortalView; clientId: string; language?: ClientProfile['defaultLanguage'] }) {
  const copy = getClientPortalCopy(language);

  return (
    <nav className="client-nav" aria-label={copy.nav.aria}>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <a
            aria-current={active === item.id ? 'page' : undefined}
            className="client-nav-link"
            data-active={active === item.id}
            href={withClientId(item.href, clientId)}
            key={item.id}
          >
            <Icon aria-hidden="true" size={15} />
            {copy.nav[item.labelKey]}
          </a>
        );
      })}
    </nav>
  );
}
