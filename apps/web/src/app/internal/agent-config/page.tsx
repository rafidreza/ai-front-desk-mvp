'use client';

import { Archive, BotMessageSquare, History, Plus, RefreshCw, RotateCcw, Save, Send, Sparkles } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createPromptProfile,
  getClients,
  getPromptProfiles,
  getPromptProfileVersions,
  rollbackPromptProfile,
  setPromptProfileStatus,
  updatePromptProfile,
} from '@/lib/api';
import { ClientProfile, PromptProfile, PromptProfileVersion } from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';
import { UiSelect } from '../_components/UiSelect';
import { FormErrorSummary, FormField, useFormErrors } from '../_components/form-validation';

const CREATE_FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  systemInstructions: 'Opening conversation and role',
  toneRules: 'Greeting and tone',
  escalationRules: 'Handoff rules',
  forbiddenClaims: 'Never say',
  fallbackBehavior: 'Fallback and review request',
};

const CREATE_REQUIRED_RULES = Object.entries(CREATE_FIELD_LABELS).map(([name, label]) => ({
  name,
  label,
}));

function profileFromForm(form: FormData): Omit<PromptProfile, 'id' | 'clientId' | 'status' | 'version' | 'archivedAt' | 'createdAt' | 'updatedAt'> & {
  actorId: string;
} {
  const parsedTrafficWeight = Number(form.get('trafficWeight') ?? 100);
  const trafficWeight = Number.isFinite(parsedTrafficWeight)
    ? Math.max(0, Math.min(100, parsedTrafficWeight))
    : 100;
  const aiProvider = String(form.get('aiProvider') ?? '').trim();

  return {
    name: String(form.get('name') ?? ''),
    systemInstructions: String(form.get('systemInstructions') ?? ''),
    toneRules: String(form.get('toneRules') ?? ''),
    escalationRules: String(form.get('escalationRules') ?? ''),
    forbiddenClaims: String(form.get('forbiddenClaims') ?? ''),
    fallbackBehavior: String(form.get('fallbackBehavior') ?? ''),
    aiProvider:
      aiProvider === 'openrouter' || aiProvider === 'anthropic' || aiProvider === 'local'
        ? aiProvider
        : undefined,
    aiModel: String(form.get('aiModel') ?? '').trim() || undefined,
    experimentEnabled: form.get('experimentEnabled') === 'on',
    experimentKey: String(form.get('experimentKey') ?? '').trim() || undefined,
    trafficWeight,
    actorId: 'internal-console',
  };
}

export default function AgentConfigPage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('pilot-abc');
  const [profiles, setProfiles] = useState<PromptProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PromptProfile | null>(null);
  const [versions, setVersions] = useState<PromptProfileVersion[]>([]);
  const [status, setStatus] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const createErrors = useFormErrors();
  const [createResetToken, setCreateResetToken] = useState(0);
  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.status === 'active') ?? null,
    [profiles],
  );
  const activeClient = clients.find((client) => client.id === selectedClientId);

  async function loadProfiles(nextStatus = status, selectedId = selectedProfile?.id, nextClientId = selectedClientId) {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getPromptProfiles(nextClientId, nextStatus);
      setProfiles(loaded);
      const nextSelected = loaded.find((profile) => profile.id === selectedId) ?? loaded[0] ?? null;
      setSelectedProfile(nextSelected);
      if (nextSelected !== null) {
        setVersions(await getPromptProfileVersions(nextClientId, nextSelected.id));
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
    setVersions(await getPromptProfileVersions(selectedClientId, profile.id));
  }

  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      setError(null);
      try {
        const clientData = await getClients();
        const requestedClientId = new URLSearchParams(window.location.search).get('clientId');
        const initialClientId =
          clientData.find((client) => client.id === requestedClientId)?.id ??
          clientData[0]?.id ??
          'pilot-abc';
        setClients(clientData);
        setSelectedClientId(initialClientId);
        await loadProfiles(status, undefined, initialClientId);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load prompt profiles.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadInitialData();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const rule of CREATE_REQUIRED_RULES) {
      values[rule.name] = String(formData.get(rule.name) ?? '');
    }
    const validationErrors = createErrors.validateRequired(values, CREATE_REQUIRED_RULES);
    if (Object.keys(validationErrors).length > 0) {
      createErrors.focusField(Object.keys(validationErrors)[0]);
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createPromptProfile(selectedClientId, profileFromForm(formData));
      createErrors.clearAll();
      setCreateResetToken((token) => token + 1);
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
      const updated = await updatePromptProfile(selectedClientId, selectedProfile.id, profileFromForm(new FormData(event.currentTarget)));
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
      const updated = await setPromptProfileStatus(selectedClientId, selectedProfile.id, nextStatus);
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
      const updated = await rollbackPromptProfile(selectedClientId, selectedProfile.id, versionId);
      setNotice('Prompt version restored as a new draft.');
      await loadProfiles(status, updated.id);
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : 'Unable to roll back prompt.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <InternalShell
      activeView="agent-config"
      eyebrow="Agent configuration"
      title="Conversation behavior setup"
      action={
        <div className="page-actions">
          <UiSelect
            aria-label="Select client for prompt profiles"
            className="page-select"
            disabled={clients.length === 0}
            value={selectedClientId}
            onChange={(event) => {
              const nextClientId = event.target.value;
              setSelectedClientId(nextClientId);
              setSelectedProfile(null);
              setVersions([]);
              setNotice(null);
              void loadProfiles(status, undefined, nextClientId);
            }}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.businessName}
              </option>
            ))}
          </UiSelect>
          <button className="icon-button" type="button" onClick={() => void loadProfiles()} disabled={isLoading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      }
    >

      {error !== null && <div className="inline-alert">{error}</div>}
      {notice !== null && <div className="inline-success">{notice}</div>}

      <section className="knowledge-client-strip">
        <div>
          <span>Client</span>
          <strong>{activeClient?.businessName ?? selectedClientId}</strong>
          <small>{activeClient?.pageId ?? 'No page ID'} | {activeClient?.businessCategory ?? 'No category'}</small>
        </div>
        <div>
          <span>Prompt profiles</span>
          <strong>{profiles.length}</strong>
          <small>{activeProfile?.name ?? 'No active profile'}</small>
          {activeProfile?.aiProvider !== undefined && (
            <small>{activeProfile.aiProvider}{activeProfile.aiModel !== undefined ? ` | ${activeProfile.aiModel}` : ''}</small>
          )}
        </div>
        <div>
          <span>Status</span>
          <strong>{status === 'all' ? 'All profiles' : status}</strong>
          <small>{selectedProfile?.name ?? 'No profile selected'}</small>
        </div>
      </section>

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
                <small>
                  {profile.status} | v{profile.version}
                  {profile.experimentEnabled === true ? ` | A/B ${profile.trafficWeight ?? 100}%` : ''}
                </small>
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
                Opening conversation and role
                <textarea name="systemInstructions" required rows={6} defaultValue={selectedProfile.systemInstructions} />
                <span className="form-hint">Define how the agent starts, what it can answer, and when it should ask one clarifying question.</span>
              </label>
              <label>
                Greeting and tone
                <textarea name="toneRules" required rows={4} defaultValue={selectedProfile.toneRules} />
                <span className="form-hint">Example: friendly, concise, and English-only even when the customer uses another language.</span>
              </label>
              <label>
                Handoff rules
                <textarea name="escalationRules" required rows={4} defaultValue={selectedProfile.escalationRules} />
                <span className="form-hint">List the exact moments when a human should take over: refund, angry customer, missing answer, payment issue.</span>
              </label>
              <label>
                Never say
                <textarea name="forbiddenClaims" required rows={4} defaultValue={selectedProfile.forbiddenClaims} />
                <span className="form-hint">Block promises the business cannot guarantee, such as fake stock, exact delivery dates, or refund approval.</span>
              </label>
              <label>
                Fallback and review request
                <textarea name="fallbackBehavior" required rows={4} defaultValue={selectedProfile.fallbackBehavior} />
                <span className="form-hint">Tell the agent what to do when unsure, and how it should ask for a short review after a resolved conversation.</span>
              </label>
              <label>
                AI provider
                <UiSelect name="aiProvider" defaultValue={selectedProfile.aiProvider ?? ''}>
                  <option value="">Use environment default</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="anthropic">Anthropic direct</option>
                  <option value="local">Local fallback only</option>
                </UiSelect>
                <span className="form-hint">OpenRouter lets one API key route to Anthropic, OpenAI, Google, Meta, and other model providers.</span>
              </label>
              <label>
                AI model
                <input name="aiModel" defaultValue={selectedProfile.aiModel ?? ''} placeholder="anthropic/claude-3.5-haiku" />
                <span className="form-hint">Leave blank for env default, or paste any OpenRouter model slug such as anthropic/claude-3.5-haiku.</span>
              </label>
              <label className="checkbox-row">
                <input name="experimentEnabled" type="checkbox" defaultChecked={selectedProfile.experimentEnabled === true} />
                Include in A/B traffic
              </label>
              <label>
                Experiment key
                <input name="experimentKey" defaultValue={selectedProfile.experimentKey ?? ''} placeholder="checkout-tone-test" />
              </label>
              <label>
                Traffic weight
                <input name="trafficWeight" inputMode="numeric" defaultValue={selectedProfile.trafficWeight ?? 100} />
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

        <form
          className="client-panel stack-form knowledge-create"
          key={`create-${activeProfile?.id ?? 'empty'}-${createResetToken}`}
          noValidate
          onSubmit={handleCreate}
        >
          <div className="section-label">
            <Plus size={15} />
            New prompt draft
          </div>

          {activeProfile !== null && (
            <div className="form-prefill-hint">
              <Sparkles size={14} />
              <span>
                Pre-filled from active profile <strong>{activeProfile.name}</strong> — edit only what
                you need.
              </span>
            </div>
          )}

          <FormField
            error={createErrors.errors.name}
            label="Name"
            name="name"
            required
          >
            <input
              defaultValue={activeProfile?.name ?? ''}
              id="name"
              name="name"
              placeholder="Holiday sales prompt"
              type="text"
            />
          </FormField>

          <FormField
            error={createErrors.errors.systemInstructions}
            hint="Define how the agent starts, what it can answer, and when it should ask one clarifying question."
            label="Opening conversation and role"
            name="systemInstructions"
            required
          >
            <textarea
              defaultValue={activeProfile?.systemInstructions ?? ''}
              id="systemInstructions"
              name="systemInstructions"
              placeholder="Start with a short greeting, identify the business, answer only from approved knowledge, and ask one clarifying question when needed."
              rows={4}
            />
          </FormField>

          <FormField
            error={createErrors.errors.toneRules}
            hint="Example: friendly, concise, and English-only even when the customer uses another language."
            label="Greeting and tone"
            name="toneRules"
            required
          >
            <textarea
              defaultValue={activeProfile?.toneRules ?? ''}
              id="toneRules"
              name="toneRules"
              placeholder="Warm, direct, and helpful. Mirror the customer's language. Keep replies short unless the customer asks for detail."
              rows={3}
            />
          </FormField>

          <FormField
            error={createErrors.errors.escalationRules}
            hint="List the exact moments when a human should take over: refund, angry customer, missing answer, payment issue."
            label="Handoff rules"
            name="escalationRules"
            required
          >
            <textarea
              defaultValue={activeProfile?.escalationRules ?? ''}
              id="escalationRules"
              name="escalationRules"
              placeholder="Hand off when refund, complaint, delivery failure, payment confusion, or low-confidence answer appears."
              rows={3}
            />
          </FormField>

          <FormField
            error={createErrors.errors.forbiddenClaims}
            hint="Block promises the business cannot guarantee, such as fake stock, exact delivery dates, or refund approval."
            label="Never say"
            name="forbiddenClaims"
            required
          >
            <textarea
              defaultValue={activeProfile?.forbiddenClaims ?? ''}
              id="forbiddenClaims"
              name="forbiddenClaims"
              placeholder="Do not promise exact stock, delivery date, discount, refund approval, or policy exceptions unless present in knowledge."
              rows={3}
            />
          </FormField>

          <FormField
            error={createErrors.errors.fallbackBehavior}
            hint="Tell the agent what to do when unsure, and how it should ask for a short review after a resolved conversation."
            label="Fallback and review request"
            name="fallbackBehavior"
            required
          >
            <textarea
              defaultValue={activeProfile?.fallbackBehavior ?? ''}
              id="fallbackBehavior"
              name="fallbackBehavior"
              placeholder="If unsure, say a human will confirm. After solving the request, ask the customer to rate the support experience."
              rows={3}
            />
          </FormField>

          <label>
            AI provider
            <UiSelect name="aiProvider" defaultValue={activeProfile?.aiProvider ?? ''}>
              <option value="">Use environment default</option>
              <option value="openrouter">OpenRouter</option>
              <option value="anthropic">Anthropic direct</option>
              <option value="local">Local fallback only</option>
            </UiSelect>
          </label>
          <label>
            AI model
            <input
              name="aiModel"
              defaultValue={activeProfile?.aiModel ?? ''}
              placeholder="anthropic/claude-3.5-haiku"
            />
          </label>

          <label className="checkbox-row">
            <input name="experimentEnabled" type="checkbox" defaultChecked={activeProfile?.experimentEnabled === true} />
            Include in A/B traffic
          </label>
          <label>
            Experiment key
            <input name="experimentKey" defaultValue={activeProfile?.experimentKey ?? ''} placeholder="checkout-tone-test" />
          </label>
          <label>
            Traffic weight
            <input name="trafficWeight" inputMode="numeric" defaultValue={activeProfile?.trafficWeight ?? 100} />
          </label>

          <FormErrorSummary
            errors={createErrors.errors}
            fieldLabels={CREATE_FIELD_LABELS}
            onFocusField={createErrors.focusField}
          />

          <button className="btn-primary" disabled={isSaving} type="submit">
            {isSaving ? 'Creating…' : 'Create draft'}
          </button>
        </form>
      </section>
    </InternalShell>
  );
}
