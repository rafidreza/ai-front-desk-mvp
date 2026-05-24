'use client';

import { ArrowLeft, CheckCheck, Circle, RefreshCw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  getClientConversionChecklist,
  getClients,
  updateClientConversionChecklist,
} from '@/lib/api';
import { ClientProfile, ConversionChecklistItem } from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';
import { UiSelect } from '../_components/UiSelect';
import { getErrorMessage } from '../_lib/helpers';

export default function ConversionChecklistPage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [items, setItems] = useState<ConversionChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      setIsLoading(true);
      try {
        const data = await getClients();
        setClients(data);
        const requested =
          typeof window === 'undefined'
            ? null
            : new URLSearchParams(window.location.search).get('clientId');
        const initialId = data.find((entry) => entry.id === requested)?.id ?? data[0]?.id;
        if (initialId !== undefined) {
          setSelectedClientId(initialId);
          await loadChecklist(initialId);
        }
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Could not load clients.'));
      } finally {
        setIsLoading(false);
      }
    }
    void bootstrap();
  }, []);

  async function loadChecklist(clientId: string) {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await getClientConversionChecklist(clientId));
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Could not load the conversion checklist.'));
    } finally {
      setIsLoading(false);
    }
  }

  async function selectClient(clientId: string) {
    setSelectedClientId(clientId);
    setNotice(null);
    setError(null);
    await loadChecklist(clientId);
  }

  async function toggleManual(item: ConversionChecklistItem, next: boolean) {
    if (item.source !== 'manual' || selectedClientId === '') return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    const previousItems = items;
    const manualPayload: ConversionChecklistItem[] = items
      .filter((entry) => entry.source === 'manual')
      .map((entry) => ({
        ...entry,
        done: entry.id === item.id ? next : entry.done,
        updatedAt: entry.id === item.id ? new Date().toISOString() : entry.updatedAt,
      }));
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, done: next, updatedAt: new Date().toISOString() } : entry,
      ),
    );
    try {
      await updateClientConversionChecklist(selectedClientId, manualPayload);
      await loadChecklist(selectedClientId);
      setNotice(`${item.label} ${next ? 'marked done.' : 'reopened.'}`);
    } catch (saveError) {
      setItems(previousItems);
      setError(getErrorMessage(saveError, 'Could not save the checklist update.'));
    } finally {
      setIsSaving(false);
    }
  }

  const activeClient = useMemo(
    () => clients.find((entry) => entry.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const doneCount = items.filter((item) => item.done).length;
  const autoItems = items.filter((item) => item.source === 'auto');
  const manualItems = items.filter((item) => item.source === 'manual');
  const blockedAutoCount = autoItems.filter((item) => !item.done).length;

  return (
    <InternalShell
      activeView="clients"
      eyebrow="Pilot → paid conversion"
      title="Per-client readiness checklist"
      action={
        <div className="page-actions">
          <Link className="icon-button" href="/internal/pipeline">
            <ArrowLeft size={15} />
            Back to pipeline
          </Link>
          {selectedClientId !== '' && (
            <button
              className="icon-button"
              disabled={isLoading}
              onClick={() => void loadChecklist(selectedClientId)}
              type="button"
            >
              <RefreshCw size={15} />
              Recompute
            </button>
          )}
        </div>
      }
    >
      {error !== null && <div className="inline-alert">{error}</div>}
      {notice !== null && <div className="inline-success">{notice}</div>}

      <section className="conversion-shell">
        <header className="conversion-header">
          <UiSelect
            aria-label="Pick client"
            onChange={(event) => void selectClient(event.target.value)}
            value={selectedClientId}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.businessName} · {client.lifecycleStage.replace(/_/g, ' ')}
              </option>
            ))}
          </UiSelect>
          <div className="conversion-meter" data-blocked={blockedAutoCount > 0 ? 'true' : undefined}>
            <strong>
              {doneCount}/{items.length}
            </strong>
            <span>complete</span>
            {blockedAutoCount > 0 && <small>{blockedAutoCount} auto check(s) still failing</small>}
          </div>
        </header>

        {activeClient !== null && (
          <>
            <section className="conversion-group">
              <h3>
                <Sparkles size={16} />
                Auto checks
              </h3>
              <p className="conversion-group__hint">
                Derived from current data. To clear these, fix the underlying state — they cannot be
                toggled by hand.
              </p>
              <ul className="conversion-list">
                {autoItems.map((item) => (
                  <li className="conversion-item" data-done={item.done ? 'true' : undefined} key={item.id}>
                    <span className="conversion-item__icon">
                      {item.done ? <CheckCheck size={16} /> : <Circle size={16} />}
                    </span>
                    <div>
                      <strong>{item.label}</strong>
                      {item.detail !== undefined && <small>{item.detail}</small>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="conversion-group">
              <h3>Manual checks</h3>
              <p className="conversion-group__hint">
                Off-system signals. Tick when the contract / billing / submission lands.
              </p>
              <ul className="conversion-list">
                {manualItems.map((item) => (
                  <li className="conversion-item" data-done={item.done ? 'true' : undefined} key={item.id}>
                    <label>
                      <input
                        checked={item.done}
                        disabled={isSaving}
                        onChange={(event) => void toggleManual(item, event.target.checked)}
                        type="checkbox"
                      />
                      <div>
                        <strong>{item.label}</strong>
                        {item.updatedAt !== undefined && (
                          <small>last set {new Date(item.updatedAt).toLocaleString()}</small>
                        )}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </section>
    </InternalShell>
  );
}
