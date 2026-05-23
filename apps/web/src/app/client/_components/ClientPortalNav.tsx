import { BookOpenText, ClipboardList, LayoutDashboard, TicketCheck } from 'lucide-react';

type ClientPortalView = 'dashboard' | 'tickets' | 'knowledge' | 'onboarding';

const navItems: Array<{
  id: ClientPortalView;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Overview', href: '/client/dashboard', icon: LayoutDashboard },
  { id: 'tickets', label: 'Tickets', href: '/client/tickets', icon: TicketCheck },
  { id: 'knowledge', label: 'Knowledge', href: '/client/knowledge', icon: BookOpenText },
  { id: 'onboarding', label: 'Setup', href: '/client/onboarding', icon: ClipboardList },
];

function withClientId(path: string, clientId: string) {
  if (clientId.trim() === '') return path;
  return `${path}?clientId=${encodeURIComponent(clientId)}`;
}

export function ClientPortalNav({ active, clientId }: { active: ClientPortalView; clientId: string }) {
  return (
    <nav className="client-nav" aria-label="Client portal">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <a className="client-nav-link" data-active={active === item.id} href={withClientId(item.href, clientId)} key={item.id}>
            <Icon size={15} />
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
