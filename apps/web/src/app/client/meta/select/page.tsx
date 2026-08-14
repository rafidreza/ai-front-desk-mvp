import { PauseCircle } from 'lucide-react';
import { DaemionMark } from '../../../_components/DaemionBrand';
import { ClientPortalNav } from '../../_components/ClientPortalNav';

export default function RetiredConnectionPage() {
  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div className="client-title-lockup">
          <span className="client-mark"><DaemionMark /></span>
          <div>
            <p className="eyebrow">Connection paused</p>
            <h1>External messaging setup is retired</h1>
          </div>
        </div>
        <ClientPortalNav active="onboarding" />
      </header>

      <section className="client-panel">
        <div className="empty-state">
          <PauseCircle size={28} />
          <h3>This connection flow is no longer active</h3>
          <p>
            Daemion now focuses this preview on web support, knowledge, ticketing, QA, and internal
            operations. Return to onboarding or the dashboard to continue setup.
          </p>
          <a className="mini-button" href="/client/login">
            Back to client login
          </a>
        </div>
      </section>
    </main>
  );
}
