'use client';

import { ArrowRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getClients, updateClientLifecycleStage } from '@/lib/api';
import {
  CLIENT_LIFECYCLE_STAGES,
  ClientLifecycleStage,
  ClientProfile,
} from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';
import { getErrorMessage } from '../_lib/helpers';

const STAGE_META: Record<ClientLifecycleStage, { label: string; hint: string }> = {
  lead: { label: 'Lead', hint: 'New signup, no setup work yet' },
  onboarding: { label: 'Onboarding', hint: 'Sales call done, gathering channels' },
  kb_building: { label: 'KB building', hint: 'Knowledge entries being curated' },
  shadow: { label: 'Shadow', hint: 'AI replies hidden, operator reviews' },
  live: { label: 'Live', hint: 'AI answering customers in production' },
  paid: { label: 'Paid', hint: 'Converted to paying subscription' },
  churned: { label: 'Churned', hint: 'Cancelled or paused indefinitely' },
};

function nextStage(stage: ClientLifecycleStage): ClientLifecycleStage | null {
  const index = CLIENT_LIFECYCLE_STAGES.indexOf(stage);
  if (index < 0 || index >= CLIENT_LIFECYCLE_STAGES.length - 1) return null;
  return CLIENT_LIFECYCLE_STAGES[index + 1];
}

export default function PipelinePage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyClientId, setBusyClientId] = useState<string | null>(null);

  async function loadClients() {
    setIsLoading(true);
    setError(null);
    try {
      setClients(await getClients());
    } catch (loadError) {
      setError(
        getErrorMessage(
          loadError,
          'Pipeline could not load. Fix: confirm the API is reachable, then refresh.',
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  const grouped = useMemo(() => {
    const buckets: Record<ClientLifecycleStage, ClientProfile[]> = {
      lead: [],
      onboarding: [],
      kb_building: [],
      shadow: [],
      live: [],
      paid: [],
      churned: [],
    };
    for (const client of clients) {
      buckets[client.lifecycleStage].push(client);
    }
    return buckets;
  }, [clients]);

  async function handleMove(client: ClientProfile, stage: ClientLifecycleStage) {
    setBusyClientId(client.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateClientLifecycleStage(client.id, stage);
      setClients((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setNotice(`${updated.businessName} moved to ${STAGE_META[stage].label}.`);
    } catch (moveError) {
      setError(getErrorMessage(moveError, `Could not move ${client.businessName} to a new stage.`));
    } finally {
      setBusyClientId(null);
    }
  }

  return (
    <InternalShell
      activeView="pipeline"
      eyebrow="Lifecycle pipeline"
      title="Client onboarding to live to paid"
      action={
        <div className="page-actions">
          <button
            className="icon-button"
            disabled={isLoading}
            onClick={() => void loadClients()}
            type="button"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      }
    >
      {error !== null && <div className="inline-alert">{error}</div>}
      {notice !== null && <div className="inline-success">{notice}</div>}

      <section className="pipeline-board" aria-label="Client lifecycle pipeline">
        {CLIENT_LIFECYCLE_STAGES.map((stage) => {
          const stageClients = grouped[stage];
          return (
            <article className="pipeline-column" data-stage={stage} key={stage}>
              <header>
                <div>
                  <strong>{STAGE_META[stage].label}</strong>
                  <small>{STAGE_META[stage].hint}</small>
                </div>
                <span className="pipeline-count">{stageClients.length}</span>
              </header>
              <div className="pipeline-cards">
                {stageClients.length === 0 && (
                  <div className="pipeline-empty">No clients</div>
                )}
                {stageClients.map((client) => {
                  const next = nextStage(client.lifecycleStage);
                  return (
                    <article className="pipeline-card" key={client.id}>
                      <div className="pipeline-card__head">
                        <strong>{client.businessName}</strong>
                        {client.businessCategory !== undefined && (
                          <span className="pipeline-card__cat">{client.businessCategory}</span>
                        )}
                      </div>
                      <div className="pipeline-card__meta">
                        <span>onboarding: {client.onboardingStatus}</span>
                        <span>channels: {client.channels?.length ?? 0}</span>
                      </div>
                      <div className="pipeline-card__actions">
                        <Link className="mini-button" href={`/internal/clients?clientId=${client.id}`}>
                          Open
                        </Link>
                        <Link className="mini-button" href={`/internal/onboarding?clientId=${client.id}`}>
                          Onboarding
                        </Link>
                        {client.lifecycleStage === 'shadow' && (
                          <Link className="mini-button" href={`/internal/shadow?clientId=${client.id}`}>
                            Shadow QA
                          </Link>
                        )}
                        <Link className="mini-button" href={`/internal/conversion?clientId=${client.id}`}>
                          Checklist
                        </Link>
                        {next !== null && (
                          <button
                            className="btn-primary"
                            disabled={busyClientId === client.id}
                            onClick={() => void handleMove(client, next)}
                            type="button"
                          >
                            <ArrowRight size={13} />
                            Move to {STAGE_META[next].label}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>
    </InternalShell>
  );
}
