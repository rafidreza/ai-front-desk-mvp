'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  getClients,
  getFlaggedVoiceCalls,
  getVoiceQueue,
  resolveVoiceEscalation,
  takeVoiceEscalation,
  type VoiceEscalation,
} from '@/lib/api';
import type { ClientProfile } from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';

/**
 * Anchor Console — voice (T10). Escalation queue + flagged calls for a selected client.
 * Takeover/approvals detail is a follow-up; this is the live queue an anchor works from.
 */
export default function VoiceConsolePage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [clientId, setClientId] = useState('');
  const [queue, setQueue] = useState<VoiceEscalation[]>([]);
  const [flagged, setFlagged] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void getClients()
      .then((list) => {
        setClients(list);
        if (list.length > 0) setClientId((current) => current || list[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load clients'));
  }, []);

  const load = useCallback(async () => {
    if (clientId === '') return;
    setIsLoading(true);
    setError(null);
    try {
      const [q, f] = await Promise.all([getVoiceQueue(clientId), getFlaggedVoiceCalls(clientId)]);
      setQueue(q);
      setFlagged(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the queue');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onTake(id: string) {
    try {
      await takeVoiceEscalation(clientId, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to take escalation');
    }
  }

  async function onResolve(id: string) {
    try {
      await resolveVoiceEscalation(clientId, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resolve escalation');
    }
  }

  return (
    <InternalShell
      activeView="voice-console"
      eyebrow="Voice"
      title="Anchor console"
      action={
        <button className="icon-button" type="button" onClick={() => void load()} disabled={isLoading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      }
    >
      {error !== null && <div className="inline-alert">{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <label>
          Client{' '}
          <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.businessName ?? client.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h3>Escalation queue ({queue.length})</h3>
        {queue.length === 0 ? (
          <p>No open escalations.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Reason</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((esc) => (
                <tr key={esc.id}>
                  <td>{esc.reason}</td>
                  <td>{esc.status}</td>
                  <td>{new Date(esc.createdAt).toLocaleString()}</td>
                  <td>
                    <button className="icon-button" type="button" onClick={() => void onTake(esc.id)}>
                      Take
                    </button>{' '}
                    <button className="icon-button" type="button" onClick={() => void onResolve(esc.id)}>
                      Resolve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>Flagged calls ({flagged.length})</h3>
        {flagged.length === 0 ? <p>No low-scoring calls flagged.</p> : <p>{flagged.length} call(s) flagged for review.</p>}
      </section>
    </InternalShell>
  );
}
