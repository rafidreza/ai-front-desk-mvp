'use client';

import { MessageSquareText, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  getClients,
  getFlaggedVoiceCalls,
  getVoiceCallDetail,
  getVoiceCalls,
  getVoiceQueue,
  resolveVoiceEscalation,
  takeVoiceEscalation,
  type VoiceCallDetail,
  type VoiceCallSummary,
  type VoiceEscalation,
} from '@/lib/api';
import type { ClientProfile } from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';

/**
 * Anchor Console — voice (T10). Escalation queue + flagged calls for a selected client.
 * Takeover/approvals detail is a follow-up; this is the live queue an anchor works from.
 */
function formatDuration(seconds: number | null) {
  if (seconds === null) return 'In progress';
  const minutes = Math.floor(seconds / 60);
  const remaining = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function speakerLabel(speaker: string) {
  if (speaker === 'caller') return 'Customer';
  if (speaker === 'ai') return 'AI agent';
  return 'Human';
}

export default function VoiceConsolePage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [clientId, setClientId] = useState('');
  const [queue, setQueue] = useState<VoiceEscalation[]>([]);
  const [calls, setCalls] = useState<VoiceCallSummary[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [callDetail, setCallDetail] = useState<VoiceCallDetail | null>(null);
  const [flagged, setFlagged] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

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
      const [q, f, recent] = await Promise.all([
        getVoiceQueue(clientId),
        getFlaggedVoiceCalls(clientId),
        getVoiceCalls(clientId),
      ]);
      setQueue(q);
      setFlagged(f);
      setCalls(recent);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the queue');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedCallId(null);
    setCallDetail(null);
  }, [clientId]);

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

  async function onSelectCall(id: string) {
    setSelectedCallId(id);
    setIsDetailLoading(true);
    setError(null);
    try {
      setCallDetail(await getVoiceCallDetail(clientId, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the call transcript');
    } finally {
      setIsDetailLoading(false);
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

      <section style={{ marginBottom: 24 }}>
        <h3>Recent voice calls ({calls.length})</h3>
        {calls.length === 0 ? (
          <p>No voice calls tracked yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Visitor</th>
                <th>Transcript</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id}>
                  <td>{new Date(call.startedAt).toLocaleString()}</td>
                  <td>{call.status}</td>
                  <td>{formatDuration(call.durationS)}</td>
                  <td>{call.callerIdMasked ?? 'Web visitor'}</td>
                  <td>
                    <button className="icon-button" type="button" onClick={() => void onSelectCall(call.id)}>
                      <MessageSquareText size={16} />
                      View transcript
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selectedCallId !== null && (
        <section style={{ marginBottom: 24 }}>
          <h3>Call transcript</h3>
          {isDetailLoading ? (
            <p>Loading transcript...</p>
          ) : callDetail === null ? (
            <p>No transcript found for this call.</p>
          ) : callDetail.transcript.length === 0 ? (
            <p>No transcript turns saved yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Turn</th>
                  <th>Speaker</th>
                  <th>Text</th>
                </tr>
              </thead>
              <tbody>
                {callDetail.transcript.map((segment) => (
                  <tr key={segment.id}>
                    <td>{segment.turnIndex + 1}</td>
                    <td>{speakerLabel(segment.speaker)}</td>
                    <td>{segment.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section>
        <h3>Flagged calls ({flagged.length})</h3>
        {flagged.length === 0 ? <p>No low-scoring calls flagged.</p> : <p>{flagged.length} call(s) flagged for review.</p>}
      </section>
    </InternalShell>
  );
}
