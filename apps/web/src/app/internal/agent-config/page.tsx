'use client';

import { Archive, BotMessageSquare, History, Plus, RefreshCw, RotateCcw, Save, Send } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createPromptProfile,
  getPromptProfiles,
  getPromptProfileVersions,
  rollbackPromptProfile,
  setPromptProfileStatus,
  updatePromptProfile,
} from '@/lib/api';
import { PromptProfile, PromptProfileVersion } from '@/types/domain';

function profileFromForm(form: FormData) {
  return {
    name: String(form.get('name') ?? ''),
    systemInstructions: String(form.get('systemInstructions') ?? ''),
    toneRules: String(form.get('toneRules') ?? ''),
    escalationRules: String(form.get('escalationRules') ?? ''),
    forbiddenClaims: String(form.get('forbiddenClaims') ?? ''),
    fallbackBehavior: String(form.get('fallbackBehavior') ?? ''),
    actorId: 'internal-console',
  };
}

export default function AgentConfigPage() {
  const [profiles, setProfiles] = useState<PromptProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PromptProfile | null>(null);
  const [versions, setVersions] = useState<PromptProfileVersion[]>([]);
  const [status, setStatus] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-client';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-client';
  }, []);

  async function loadProfiles(nextStatus = status, selectedId = selectedProfile?.id) {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getPromptProfiles(clientId, nextStatus);
      setProfiles(loaded);
      const nextSelected = loaded.find((profile) => profile.id === selectedId) ?? loaded[0] ?? null;
      setSelectedProfile(nextSelected);
      if (nextSelected !== null) {
        setVersions(await getPromptProfileVersions(clientId, nextSelected.id));
      } else {
        setVersions([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load prompt profiles.');
    } finally {
      setIsLoading(false);
    }
  }

  async function selectProfile(profile: PromptProfile) {
    setSelectedProfile(profile);
    setError(null);
    setNotice(null);
    setVersions(await getPromptProfileVersions(clientId, profile.id));
  }

  useEffect(() => {
    void loadProfiles();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createPromptProfile(clientId, profileFromForm(new FormData(event.currentTarget)));
      event.currentTarget.reset();
      setNotice('Prompt draft created.');
      await loadProfiles(status, created.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create prompt profile.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedProfile === null) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updatePromptProfile(clientId, selectedProfile.id, profileFromForm(new FormData(event.currentTarget)));
      setNotice('Prompt saved as draft.');
      await loadProfiles(status, updated.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save prompt profile.');
    } finally {
      setIsSaving(false);
    }
  }

  async function changeStatus(nextStatus: PromptProfile['status']) {
    if (selectedProfile === null) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await setPromptProfileStatus(clientId, selectedProfile.id, nextStatus);
      setNotice(nextStatus === 'active' ? 'Prompt published.' : nextStatus === 'archived' ? 'Prompt archived.' : 'Prompt moved to draft.');
      await loadProfiles(status, updated.id);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update prompt status.');
    } finally {
      setIsSaving(false);
    }
  }

  async function rollback(versionId: string) {
    if (selectedProfile === null) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await rollbackPromptProfile(clientId, selectedProfile.id, versionId);
      setNotice('Prompt version restored as a new draft.');
      await loadProfiles(status, updated.id);
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : 'Unable to roll back prompt.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div>
          <p className="eyebrow">Agent configuration</p>
          <h1>Prompt profiles</h1>
        </div>
        <button className="icon-button" type="button" onClick={() => void loadProfiles()} disabled={isLoading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {error !== null && <div className="inline-alert">{error}</div>}
      {notice !== null && <div className="inline-success">{notice}</div>}

      <section className="knowledge-layout">
        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <BotMessageSquare size={16} />
              Profiles
            </div>
            <select
              className="owner-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                void loadProfiles(event.target.value);
              }}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="client-list">
            {profiles.map((profile) => (
              <button
                className="knowledge-row"
                data-selected={selectedProfile?.id === profile.id}
                key={profile.id}
                type="button"
                onClick={() => void selectProfile(profile)}
              >
                <strong>{profile.name}</strong>
                <small>{profile.status} | v{profile.version}</small>
              </button>
            ))}
            {profiles.length === 0 && <div className="empty">No prompt profiles</div>}
          </div>
        </section>

        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Save size={16} />
              Prompt detail
            </div>
          </div>
          {selectedProfile === null ? (
            <div className="empty">Select a prompt profile to edit</div>
          ) : (
            <form className="stack-form knowledge-editor" key={selectedProfile.id} onSubmit={handleSave}>
              <label>
                Name
                <input name="name" required defaultValue={selectedProfile.name} />
              </label>
              <label>
                System instructions
                <textarea name="systemInstructions" required rows={6} defaultValue={selectedProfile.systemInstructions} />
              </label>
              <label>
                Tone rules
                <textarea name="toneRules" required rows={4} defaultValue={selectedProfile.toneRules} />
              </label>
              <label>
                Escalation rules
                <textarea name="escalationRules" required rows={4} defaultValue={selectedProfile.escalationRules} />
              </label>
              <label>
                Forbidden claims
                <textarea name="forbiddenClaims" required rows={4} defaultValue={selectedProfile.forbiddenClaims} />
              </label>
              <label>
                Fallback behavior
                <textarea name="fallbackBehavior" required rows={4} defaultValue={selectedProfile.fallbackBehavior} />
              </label>
              <div className="filter-row">
                <button className="icon-button" disabled={isSaving} type="submit">
                  <Save size={15} />
                  Save draft
                </button>
                <button className="icon-button" disabled={isSaving} type="button" onClick={() => void changeStatus('active')}>
                  <Send size={15} />
                  Publish
                </button>
                <button className="icon-button" disabled={isSaving} type="button" onClick={() => void changeStatus('archived')}>
                  <Archive size={15} />
                  Archive
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <History size={16} />
              Version history
            </div>
          </div>
          <div className="version-list">
            {versions.map((version) => (
              <article className="version-card" key={version.id}>
                <div>
                  <strong>v{version.version} | {version.action}</strong>
                  <small>{new Date(version.createdAt).toLocaleString()} | {version.actorId}</small>
                </div>
                <p>{version.name}</p>
                <small>{version.status}</small>
                <button className="mini-button" disabled={isSaving} type="button" onClick={() => void rollback(version.id)}>
                  <RotateCcw size={13} />
                  Restore
                </button>
              </article>
            ))}
            {versions.length === 0 && <div className="empty">No history yet</div>}
          </div>
        </section>

        <form className="client-panel stack-form knowledge-create" onSubmit={handleCreate}>
          <div className="section-label">
            <Plus size={15} />
            New prompt draft
          </div>
          <label>
            Name
            <input name="name" required placeholder="Holiday sales prompt" />
          </label>
          <label>
            System instructions
            <textarea name="systemInstructions" required rows={4} />
          </label>
          <label>
            Tone rules
            <textarea name="toneRules" required rows={3} />
          </label>
          <label>
            Escalation rules
            <textarea name="escalationRules" required rows={3} />
          </label>
          <label>
            Forbidden claims
            <textarea name="forbiddenClaims" required rows={3} />
          </label>
          <label>
            Fallback behavior
            <textarea name="fallbackBehavior" required rows={3} />
          </label>
          <button className="icon-button" disabled={isSaving} type="submit">
            Create draft
          </button>
        </form>
      </section>
    </main>
  );
}
