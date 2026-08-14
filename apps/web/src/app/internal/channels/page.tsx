import { ExternalLink, PauseCircle } from 'lucide-react';
import { InternalShell } from '../_components/InternalShell';

export default function InternalChannelsPage() {
  return (
    <InternalShell activeView="channels" eyebrow="Integration operations" title="Channel integrations paused">
      <section className="panel-stack">
        <article className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <PauseCircle size={16} />
              Retired channel setup
            </div>
          </div>
          <div className="empty-state">
            <ExternalLink size={28} />
            <h3>External messaging setup is no longer active</h3>
            <p>
              This build now focuses on the web support console, tickets, QA, knowledge, client
              onboarding, and internal operations. Legacy messaging channel administration has been
              removed from the shared preview experience.
            </p>
          </div>
        </article>
      </section>
    </InternalShell>
  );
}
