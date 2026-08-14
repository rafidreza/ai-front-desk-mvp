'use client';

import { Building2, Calculator, FileCheck2, Plus, Power, RefreshCw, RotateCcw, Save, Search, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ClientManagementInput,
  createClientFromInternal,
  getClientDashboard,
  getClients,
  previewClientRetentionCleanup,
  runClientRetentionCleanup,
  updateClientDpaProfile,
  updateClientFromInternal,
  updateClientRetentionPolicy,
  updateClientStatus,
} from '@/lib/api';
import {
  ClientDashboardSummary,
  ClientDpaProfile,
  ClientProfile,
  ClientRetentionMode,
  ClientRetentionPolicy,
  ClientStatus,
  DpaSigningStatus,
} from '@/types/domain';
import { EmptyState } from '../_components/EmptyState';
import { ListSkeleton } from '../_components/ListSkeleton';
import { InternalShell } from '../_components/InternalShell';
import { LoadErrorNotice } from '../_components/LoadErrorNotice';
import { UiSelect } from '../_components/UiSelect';
import { getErrorMessage, getSafeErrorDiagnostic } from '../_lib/helpers';

const baseMonthlyFee = 1500;
const conversationRate = 8;
const ticketHandlingRate = 50;

function money(value: number) {
  return new Intl.NumberFormat('en-BD', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'BDT',
  }).format(value);
}

function estimateMonthlyPrice(summary: ClientDashboardSummary) {
  const usage =
    summary.totals.conversations * conversationRate +
    summary.totals.tickets * ticketHandlingRate;
  return Math.max(baseMonthlyFee, usage);
}

type ClientFormState = {
  businessName: string;
  pageId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  businessCategory: string;
  defaultLanguage: ClientProfile['defaultLanguage'];
  tone: string;
  whatsappPoc: string;
  digestEmail: string;
  onboardingStatus: string;
};

type DpaFormState = {
  status: DpaSigningStatus;
  templateUrl: string;
  sentAt: string;
  signerName: string;
  signerEmail: string;
  signedAt: string;
  countersignedAt: string;
  countersignedPdfUrl: string;
  notes: string;
};

type RetentionFormState = {
  mode: ClientRetentionMode;
  days: string;
};

const emptyClientForm: ClientFormState = {
  businessName: '',
  pageId: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  businessCategory: '',
  defaultLanguage: 'mixed',
  tone: 'friendly, concise, helpful, and natural for Bangladeshi customer support',
  whatsappPoc: '',
  digestEmail: '',
  onboardingStatus: 'onboarding_complete',
};

const emptyDpaForm: DpaFormState = {
  status: 'not_sent',
  templateUrl: '',
  sentAt: '',
  signerName: '',
  signerEmail: '',
  signedAt: '',
  countersignedAt: '',
  countersignedPdfUrl: '',
  notes: '',
};

const emptyRetentionForm: RetentionFormState = {
  mode: 'disabled',
  days: '90',
};

function formFromClient(client: ClientProfile): ClientFormState {
  return {
    businessName: client.businessName,
    pageId: client.pageId,
    ownerName: client.ownerName ?? '',
    ownerEmail: client.ownerEmail ?? '',
    ownerPhone: client.ownerPhone ?? '',
    businessCategory: client.businessCategory ?? '',
    defaultLanguage: client.defaultLanguage,
    tone: client.tone,
    whatsappPoc: client.whatsappPoc ?? '',
    digestEmail: client.digestEmail ?? '',
    onboardingStatus: client.onboardingStatus === 'live' ? 'onboarding_complete' : client.onboardingStatus,
  };
}

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function dateInputFromIso(value?: string) {
  if (value === undefined) return '';
  return value.slice(0, 10);
}

function isoFromDateInput(value: string) {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return new Date(`${trimmed}T00:00:00.000Z`).toISOString();
}

function dpaFormFromClient(client?: ClientProfile): DpaFormState {
  const dpa = client?.complianceProfile?.dpa;
  return {
    status: dpa?.status ?? 'not_sent',
    templateUrl: dpa?.templateUrl ?? '',
    sentAt: dateInputFromIso(dpa?.sentAt),
    signerName: dpa?.signerName ?? '',
    signerEmail: dpa?.signerEmail ?? '',
    signedAt: dateInputFromIso(dpa?.signedAt),
    countersignedAt: dateInputFromIso(dpa?.countersignedAt),
    countersignedPdfUrl: dpa?.countersignedPdfUrl ?? '',
    notes: dpa?.notes ?? '',
  };
}

function retentionFormFromClient(client?: ClientProfile): RetentionFormState {
  const retention = client?.complianceProfile?.retention;
  return {
    mode: retention?.mode ?? 'disabled',
    days: String(retention?.days ?? 90),
  };
}

function payloadFromForm(form: ClientFormState): ClientManagementInput & { businessName: string } {
  return {
    businessName: form.businessName.trim(),
    pageId: optional(form.pageId),
    ownerName: optional(form.ownerName),
    ownerEmail: optional(form.ownerEmail),
    ownerPhone: optional(form.ownerPhone),
    businessCategory: optional(form.businessCategory),
    defaultLanguage: form.defaultLanguage,
    tone: optional(form.tone),
    whatsappPoc: optional(form.whatsappPoc),
    digestEmail: optional(form.digestEmail),
    onboardingStatus: form.onboardingStatus,
  };
}

function dpaPayloadFromForm(form: DpaFormState): Omit<ClientDpaProfile, 'updatedAt'> {
  return {
    status: form.status,
    templateUrl: optional(form.templateUrl),
    sentAt: isoFromDateInput(form.sentAt),
    signerName: optional(form.signerName),
    signerEmail: optional(form.signerEmail),
    signedAt: isoFromDateInput(form.signedAt),
    countersignedAt: isoFromDateInput(form.countersignedAt),
    countersignedPdfUrl: optional(form.countersignedPdfUrl),
    notes: optional(form.notes),
  };
}

function retentionPayloadFromForm(form: RetentionFormState): Pick<ClientRetentionPolicy, 'mode' | 'days'> {
  return {
    mode: form.mode,
    days: Number.parseInt(form.days, 10),
  };
}

export default function InternalClientsPage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [dashboards, setDashboards] = useState<ClientDashboardSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [formMode, setFormMode] = useState<'edit' | 'create'>('edit');
  const [form, setForm] = useState<ClientFormState>(emptyClientForm);
  const [savedForm, setSavedForm] = useState<ClientFormState>(emptyClientForm);
  const [dpaForm, setDpaForm] = useState<DpaFormState>(emptyDpaForm);
  const [savedDpaForm, setSavedDpaForm] = useState<DpaFormState>(emptyDpaForm);
  const [retentionForm, setRetentionForm] = useState<RetentionFormState>(emptyRetentionForm);
  const [savedRetentionForm, setSavedRetentionForm] = useState<RetentionFormState>(emptyRetentionForm);
  const [retentionPreview, setRetentionPreview] = useState<{ cutoff: string; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadErrorDiagnostic, setLoadErrorDiagnostic] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadClients() {
    setIsLoading(true);
    setError(null);
    setLoadErrorDiagnostic(null);
    try {
      const clientData = await getClients();
      const dashboardData = await Promise.all(clientData.map((client) => getClientDashboard(client.id)));
      setClients(clientData);
      setDashboards(dashboardData);
      setSelectedClientId((current) => current ?? clientData[0]?.id ?? null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Client workspaces could not load. Check that the API server is running and database migrations are current, then retry.'));
      setLoadErrorDiagnostic(getSafeErrorDiagnostic(loadError, 'Clients page /clients and dashboard summary requests'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized === '') return clients;
    return clients.filter((client) =>
      [
        client.businessName,
        client.id,
        client.pageId,
        client.ownerName,
        client.ownerEmail,
        client.ownerPhone,
        client.businessCategory,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [clients, query]);

  const selectedDashboard = useMemo(
    () =>
      dashboards.find((dashboard) => dashboard.client.id === selectedClientId) ??
      dashboards[0],
    [dashboards, selectedClientId],
  );
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? selectedDashboard?.client,
    [clients, selectedClientId, selectedDashboard],
  );
  const portfolio = useMemo(
    () => ({
      conversations: dashboards.reduce((sum, dashboard) => sum + dashboard.totals.conversations, 0),
      tickets: dashboards.reduce((sum, dashboard) => sum + dashboard.totals.tickets, 0),
      projectedRevenue: dashboards.reduce((sum, dashboard) => sum + estimateMonthlyPrice(dashboard), 0),
      activeClients: clients.filter((client) => client.status !== 'inactive').length,
    }),
    [clients, dashboards],
  );
  const isClientFormDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(savedForm);
  }, [form, savedForm]);
  const isDpaFormDirty = useMemo(() => {
    return JSON.stringify(dpaForm) !== JSON.stringify(savedDpaForm);
  }, [dpaForm, savedDpaForm]);
  const isRetentionFormDirty = useMemo(() => {
    return JSON.stringify(retentionForm) !== JSON.stringify(savedRetentionForm);
  }, [retentionForm, savedRetentionForm]);
  const canSubmitClientForm =
    formMode === 'create'
      ? isClientFormDirty && form.businessName.trim().length >= 2
      : isClientFormDirty;

  useEffect(() => {
    if (formMode === 'create') return;
    if (selectedClient !== undefined) {
      const nextForm = formFromClient(selectedClient);
      const nextDpaForm = dpaFormFromClient(selectedClient);
      const nextRetentionForm = retentionFormFromClient(selectedClient);
      setForm(nextForm);
      setSavedForm(nextForm);
      setDpaForm(nextDpaForm);
      setSavedDpaForm(nextDpaForm);
      setRetentionForm(nextRetentionForm);
      setSavedRetentionForm(nextRetentionForm);
      setRetentionPreview(null);
    }
  }, [formMode, selectedClient]);

  function startCreate() {
    setFormMode('create');
    setSelectedClientId(null);
    setForm(emptyClientForm);
    setSavedForm(emptyClientForm);
    setDpaForm(emptyDpaForm);
    setSavedDpaForm(emptyDpaForm);
    setRetentionForm(emptyRetentionForm);
    setSavedRetentionForm(emptyRetentionForm);
    setRetentionPreview(null);
    setNotice(null);
    setError(null);
    setLoadErrorDiagnostic(null);
  }

  function startEdit(client: ClientProfile) {
    const nextForm = formFromClient(client);
    setFormMode('edit');
    setSelectedClientId(client.id);
    setForm(nextForm);
    setSavedForm(nextForm);
    const nextDpaForm = dpaFormFromClient(client);
    setDpaForm(nextDpaForm);
    setSavedDpaForm(nextDpaForm);
    const nextRetentionForm = retentionFormFromClient(client);
    setRetentionForm(nextRetentionForm);
    setSavedRetentionForm(nextRetentionForm);
    setRetentionPreview(null);
    setNotice(null);
    setError(null);
    setLoadErrorDiagnostic(null);
  }

  function discardClientChanges() {
    setForm(savedForm);
    setError(null);
    setLoadErrorDiagnostic(null);
    setNotice(null);
  }

  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setLoadErrorDiagnostic(null);
    setNotice(null);
    try {
      const payload = payloadFromForm(form);
      if (payload.businessName.length < 2) {
        throw new Error('Business name is required.');
      }
      const saved =
        formMode === 'create'
          ? await createClientFromInternal(payload)
          : selectedClientId === null
            ? await createClientFromInternal(payload)
            : await updateClientFromInternal(selectedClientId, payload);
      setNotice(formMode === 'create' ? 'Client onboarded directly from the internal portal.' : 'Client information updated.');
      const nextForm = formFromClient(saved);
      setFormMode('edit');
      setSelectedClientId(saved.id);
      setForm(nextForm);
      setSavedForm(nextForm);
      await loadClients();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save client.');
    } finally {
      setIsSaving(false);
    }
  }

  async function changeStatus(status: ClientStatus) {
    if (selectedClientId === null) return;
    setIsSaving(true);
    setError(null);
    setLoadErrorDiagnostic(null);
    setNotice(null);
    try {
      const updated = await updateClientStatus(selectedClientId, status);
      setNotice(status === 'inactive' ? 'Client account deactivated. Client login is blocked.' : 'Client account reactivated.');
      setSelectedClientId(updated.id);
      await loadClients();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update client status.');
    } finally {
      setIsSaving(false);
    }
  }


  async function saveDpaProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedClientId === null) return;
    setIsSaving(true);
    setError(null);
    setLoadErrorDiagnostic(null);
    setNotice(null);
    try {
      const saved = await updateClientDpaProfile(selectedClientId, dpaPayloadFromForm(dpaForm));
      const nextDpaForm = dpaFormFromClient(saved);
      setDpaForm(nextDpaForm);
      setSavedDpaForm(nextDpaForm);
      setSelectedClientId(saved.id);
      setNotice('DPA signing status updated.');
      await loadClients();
    } catch (dpaError) {
      setError(dpaError instanceof Error ? dpaError.message : 'Unable to update DPA status.');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveRetentionPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedClientId === null) return;
    const payload = retentionPayloadFromForm(retentionForm);
    if (!Number.isInteger(payload.days) || payload.days < 30 || payload.days > 3650) {
      setError('Retention days must be between 30 and 3650.');
      return;
    }
    setIsSaving(true);
    setError(null);
    setLoadErrorDiagnostic(null);
    setNotice(null);
    try {
      const saved = await updateClientRetentionPolicy(selectedClientId, payload);
      const nextRetentionForm = retentionFormFromClient(saved);
      setRetentionForm(nextRetentionForm);
      setSavedRetentionForm(nextRetentionForm);
      setRetentionPreview(null);
      setSelectedClientId(saved.id);
      setNotice('Data retention policy updated.');
      await loadClients();
    } catch (retentionError) {
      setError(retentionError instanceof Error ? retentionError.message : 'Unable to update retention policy.');
    } finally {
      setIsSaving(false);
    }
  }

  async function previewRetention() {
    if (selectedClientId === null) return;
    setIsSaving(true);
    setError(null);
    setLoadErrorDiagnostic(null);
    setNotice(null);
    try {
      const preview = await previewClientRetentionCleanup(selectedClientId);
      setRetentionPreview({ cutoff: preview.cutoff, count: preview.count });
      setNotice(`${preview.count} old message${preview.count === 1 ? '' : 's'} match the current retention policy.`);
    } catch (retentionError) {
      setError(retentionError instanceof Error ? retentionError.message : 'Unable to preview retention cleanup.');
    } finally {
      setIsSaving(false);
    }
  }

  async function runRetention() {
    if (selectedClientId === null) return;
    setIsSaving(true);
    setError(null);
    setLoadErrorDiagnostic(null);
    setNotice(null);
    try {
      const result = await runClientRetentionCleanup(selectedClientId);
      const nextRetentionForm = retentionFormFromClient(result.client);
      setRetentionForm(nextRetentionForm);
      setSavedRetentionForm(nextRetentionForm);
      setRetentionPreview({ cutoff: result.cutoff, count: 0 });
      setSelectedClientId(result.client.id);
      setNotice(`${result.count} old message${result.count === 1 ? '' : 's'} redacted by retention policy.`);
      await loadClients();
    } catch (retentionError) {
      setError(retentionError instanceof Error ? retentionError.message : 'Unable to run retention cleanup.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <InternalShell
      activeView="clients"
      eyebrow="Client operations"
      title="Clients, pages, usage, and pricing"
      action={
        <div className="panel-actions">
          <button className="icon-button" type="button" onClick={startCreate}>
            <Plus size={16} />
            New client
          </button>
          <button className="icon-button" type="button" onClick={() => void loadClients()} disabled={isLoading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      }
    >
      {error !== null && loadErrorDiagnostic !== null ? (
        <LoadErrorNotice
          title="Client records did not load"
          message={error}
          diagnostic={loadErrorDiagnostic}
          retryLabel="Retry clients"
          isRetrying={isLoading}
          onRetry={() => void loadClients()}
        />
      ) : error !== null ? (
        <div className="inline-alert">{error}</div>
      ) : null}
      {notice !== null && <div className="inline-success">{notice}</div>}

      <section className="metrics">
        <article className="metric">
          <span>Clients</span>
          <strong>{portfolio.activeClients}</strong>
          <small>{clients.length} total workspaces</small>
        </article>
        <article className="metric">
          <span>Conversations</span>
          <strong>{portfolio.conversations}</strong>
          <small>Billable usage signal</small>
        </article>
        <article className="metric">
          <span>Tickets</span>
          <strong>{portfolio.tickets}</strong>
          <small>Human support workload</small>
        </article>
        <article className="metric">
          <span>Projected MRR</span>
          <strong>{money(portfolio.projectedRevenue)}</strong>
          <small>Base + usage estimate</small>
        </article>
      </section>

      <section className="client-portal-grid">
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <Building2 size={16} />
              Client Directory
            </div>
            <div className="client-directory-tools">
              <UiSelect
                aria-label="Jump to client"
                className="client-jump-select"
                compact
                disabled={clients.length === 0}
                value={selectedClientId ?? ''}
                onChange={(event) => {
                  const nextClient = clients.find((client) => client.id === event.target.value);
                  if (nextClient !== undefined) startEdit(nextClient);
                }}
              >
                <option disabled value="">
                  Choose client
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.businessName}
                  </option>
                ))}
              </UiSelect>
              <div className="search-control">
                <Search size={14} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search clients"
                />
              </div>
            </div>
          </div>
          <div className="client-list">
            {isLoading && filteredClients.length === 0 && <ListSkeleton rows={5} variant="default" />}
            {filteredClients.map((client) => {
              const dashboard = dashboards.find((item) => item.client.id === client.id);
              return (
                <button
                  className="client-directory-row"
                  data-selected={client.id === selectedDashboard?.client.id}
                  key={client.id}
                  type="button"
                  onClick={() => startEdit(client)}
                >
                  <div>
                    <strong>{client.businessName}</strong>
                    <small>
                      {client.pageId} | {client.channels?.filter((channel) => channel.channel === 'messenger').length ?? 0} FB pages |{' '}
                      {client.businessCategory ?? 'Uncategorized'}
                    </small>
                  </div>
                  <span>
                    {client.status === 'inactive' ? 'Inactive' : `${dashboard?.totals.conversations ?? 0} conv.`}
                  </span>
                </button>
              );
            })}
            {!isLoading && filteredClients.length === 0 && (
              <EmptyState
                icon={<Building2 size={20} />}
                title="No clients found"
                description="Create a client workspace or clear the search to see existing clients."
                action={<button className="mini-button" type="button" onClick={startCreate}>New client</button>}
              />
            )}
          </div>
        </section>

        <section className="detail-panel client-detail-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Calculator size={16} />
              {formMode === 'create' ? 'Onboard Client' : 'Client Detail'}
            </div>
            {selectedClient !== undefined && (
              <span className="badge" data-tone={selectedClient.status === 'inactive' ? 'coral' : 'green'}>
                {selectedClient.status}
              </span>
            )}
          </div>

          {formMode === 'edit' && selectedDashboard === undefined ? (
            <div className="empty">Select a client</div>
          ) : (
            <div className="client-detail-body">
              {formMode === 'edit' && selectedDashboard !== undefined && (
                <>
                  <section className="client-info-grid">
                    <div>
                      <span>Business</span>
                      <strong>{selectedDashboard.client.businessName}</strong>
                    </div>
                    <div>
                      <span>Client ID</span>
                      <strong>{selectedDashboard.client.id}</strong>
                    </div>
                    <div>
                      <span>Primary page</span>
                      <strong>{selectedDashboard.client.pageId}</strong>
                    </div>
                    <div>
                      <span>Owner</span>
                      <strong>{selectedDashboard.client.ownerName ?? 'Not set'}</strong>
                    </div>
                    <div>
                      <span>Email</span>
                      <strong>{selectedDashboard.client.ownerEmail ?? selectedDashboard.client.digestEmail ?? 'Not set'}</strong>
                    </div>
                    <div>
                      <span>Support phone</span>
                      <strong>{selectedDashboard.client.whatsappPoc ?? selectedDashboard.client.ownerPhone ?? 'Not set'}</strong>
                    </div>
                  </section>

                  <section className="pricing-panel">
                    <div>
                      <p className="eyebrow">Pricing Estimate</p>
                      <h3>{money(estimateMonthlyPrice(selectedDashboard))}</h3>
                      <small>
                        {money(baseMonthlyFee)} minimum, {money(conversationRate)} per conversation, {money(ticketHandlingRate)} per ticket.
                      </small>
                    </div>
                    <div className="pricing-breakdown">
                      <span>{selectedDashboard.totals.conversations} conversations</span>
                      <span>{selectedDashboard.totals.tickets} tickets</span>
                      <span>{selectedDashboard.totals.openTickets} open</span>
                      <span>{selectedDashboard.totals.containmentRate}% containment</span>
                    </div>
                  </section>

                  <form className="client-channel-panel" onSubmit={saveDpaProfile}>
                    <div className="section-label">
                      <FileCheck2 size={15} />
                      DPA signing
                    </div>
                    <div className="client-management-grid">
                      <label>
                        Status
                        <UiSelect
                          value={dpaForm.status}
                          onChange={(event) =>
                            setDpaForm((current) => ({ ...current, status: event.target.value as DpaSigningStatus }))
                          }
                        >
                          <option value="not_sent">Not sent</option>
                          <option value="sent">Sent to seller</option>
                          <option value="signed">Seller signed</option>
                          <option value="countersigned">Countersigned PDF stored</option>
                        </UiSelect>
                      </label>
                      <label>
                        Template URL
                        <input
                          value={dpaForm.templateUrl}
                          placeholder="https://..."
                          type="url"
                          onChange={(event) => setDpaForm((current) => ({ ...current, templateUrl: event.target.value }))}
                        />
                      </label>
                      <label>
                        Sent date
                        <input
                          value={dpaForm.sentAt}
                          type="date"
                          onChange={(event) => setDpaForm((current) => ({ ...current, sentAt: event.target.value }))}
                        />
                      </label>
                      <label>
                        Seller signed date
                        <input
                          value={dpaForm.signedAt}
                          type="date"
                          onChange={(event) => setDpaForm((current) => ({ ...current, signedAt: event.target.value }))}
                        />
                      </label>
                      <label>
                        Signer name
                        <input
                          value={dpaForm.signerName}
                          placeholder="Owner or authorized signer"
                          onChange={(event) => setDpaForm((current) => ({ ...current, signerName: event.target.value }))}
                        />
                      </label>
                      <label>
                        Signer email
                        <input
                          value={dpaForm.signerEmail}
                          placeholder="signer@example.com"
                          type="email"
                          onChange={(event) => setDpaForm((current) => ({ ...current, signerEmail: event.target.value }))}
                        />
                      </label>
                      <label>
                        Countersigned date
                        <input
                          value={dpaForm.countersignedAt}
                          type="date"
                          onChange={(event) => setDpaForm((current) => ({ ...current, countersignedAt: event.target.value }))}
                        />
                      </label>
                      <label>
                        Countersigned PDF URL
                        <input
                          value={dpaForm.countersignedPdfUrl}
                          placeholder="https://..."
                          type="url"
                          onChange={(event) => setDpaForm((current) => ({ ...current, countersignedPdfUrl: event.target.value }))}
                        />
                      </label>
                    </div>
                    <label>
                      Notes
                      <textarea
                        value={dpaForm.notes}
                        placeholder="Manual follow-up notes, signer authority, or document location details"
                        onChange={(event) => setDpaForm((current) => ({ ...current, notes: event.target.value }))}
                      />
                    </label>
                    <div className="form-actions">
                      <button
                        className="mini-button"
                        disabled={!isDpaFormDirty || isSaving}
                        type="button"
                        onClick={() => setDpaForm(savedDpaForm)}
                      >
                        <RotateCcw size={14} />
                        Discard
                      </button>
                      <button className="mini-button" disabled={!isDpaFormDirty || isSaving} type="submit">
                        <Save size={14} />
                        Save DPA
                      </button>
                    </div>
                  </form>

                  <form className="client-channel-panel" onSubmit={saveRetentionPolicy}>
                    <div className="section-label">
                      <ShieldCheck size={15} />
                      Data retention
                    </div>
                    <div className="client-management-grid">
                      <label>
                        Policy
                        <UiSelect
                          value={retentionForm.mode}
                          onChange={(event) =>
                            setRetentionForm((current) => ({
                              ...current,
                              mode: event.target.value as ClientRetentionMode,
                            }))
                          }
                        >
                          <option value="disabled">Disabled</option>
                          <option value="redact">Redact old chat messages</option>
                        </UiSelect>
                      </label>
                      <label>
                        Retain chats for
                        <input
                          min={30}
                          max={3650}
                          type="number"
                          value={retentionForm.days}
                          onChange={(event) => setRetentionForm((current) => ({ ...current, days: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="client-info-grid">
                      <div>
                        <span>Preview match</span>
                        <strong>{retentionPreview === null ? 'Not previewed' : `${retentionPreview.count} messages`}</strong>
                      </div>
                      <div>
                        <span>Cutoff</span>
                        <strong>{retentionPreview === null ? 'Use preview' : retentionPreview.cutoff.slice(0, 10)}</strong>
                      </div>
                      <div>
                        <span>Last run</span>
                        <strong>
                          {selectedClient?.complianceProfile?.retention?.lastRunAt === undefined
                            ? 'Never'
                            : `${selectedClient.complianceProfile.retention.lastRunAt.slice(0, 10)} (${selectedClient.complianceProfile.retention.lastRunCount ?? 0})`}
                        </strong>
                      </div>
                    </div>
                    <div className="form-actions">
                      <button
                        className="mini-button"
                        disabled={!isRetentionFormDirty || isSaving}
                        type="button"
                        onClick={() => setRetentionForm(savedRetentionForm)}
                      >
                        <RotateCcw size={14} />
                        Discard
                      </button>
                      <button className="mini-button" disabled={!isRetentionFormDirty || isSaving} type="submit">
                        <Save size={14} />
                        Save policy
                      </button>
                      <button
                        className="mini-button"
                        disabled={isSaving || isRetentionFormDirty || retentionForm.mode === 'disabled'}
                        type="button"
                        onClick={() => void previewRetention()}
                      >
                        Preview cleanup
                      </button>
                      <button
                        className="mini-button"
                        disabled={isSaving || isRetentionFormDirty || retentionForm.mode === 'disabled'}
                        type="button"
                        onClick={() => void runRetention()}
                      >
                        Redact now
                      </button>
                    </div>
                  </form>

                </>
              )}

              <form className="stack-form internal-client-form" onSubmit={saveClient}>
                <div className="section-label">
                  <Building2 size={15} />
                  {formMode === 'create' ? 'Create workspace without client signup' : 'Edit client information'}
                </div>
                <div className="client-management-grid">
                  <label>
                    Business name
                    <input
                      required
                      value={form.businessName}
                      placeholder="Client business name"
                      onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
                    />
                  </label>
                  <label>
                    Page ID
                    <input
                      value={form.pageId}
                      placeholder="page-id or pending-page-id"
                      onChange={(event) => setForm((current) => ({ ...current, pageId: event.target.value }))}
                    />
                  </label>
                  <label>
                    Owner name
                    <input
                      value={form.ownerName}
                      placeholder="Owner or operator name"
                      onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
                    />
                  </label>
                  <label>
                    Owner email
                    <input
                      value={form.ownerEmail}
                      placeholder="owner@example.com"
                      type="email"
                      onChange={(event) => setForm((current) => ({ ...current, ownerEmail: event.target.value }))}
                    />
                  </label>
                  <label>
                    Owner phone
                    <input
                      value={form.ownerPhone}
                      placeholder="+8801..."
                      onChange={(event) => setForm((current) => ({ ...current, ownerPhone: event.target.value }))}
                    />
                  </label>
                  <label>
                    Support phone
                    <input
                      value={form.whatsappPoc}
                      placeholder="+8801..."
                      onChange={(event) => setForm((current) => ({ ...current, whatsappPoc: event.target.value }))}
                    />
                  </label>
                  <label>
                    Business category
                    <input
                      value={form.businessCategory}
                      placeholder="Fashion, electronics, clinic"
                      onChange={(event) => setForm((current) => ({ ...current, businessCategory: event.target.value }))}
                    />
                  </label>
                  <label>
                    Digest email
                    <input
                      value={form.digestEmail}
                      placeholder="reports@example.com"
                      type="email"
                      onChange={(event) => setForm((current) => ({ ...current, digestEmail: event.target.value }))}
                    />
                  </label>
                  <label>
                    Default language
                    <select
                      value={form.defaultLanguage}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, defaultLanguage: event.target.value as ClientProfile['defaultLanguage'] }))
                      }
                    >
                      <option value="mixed">Mixed</option>
                      <option value="bangla">Bangla</option>
                      <option value="english">English</option>
                    </select>
                  </label>
                  <label>
                    Onboarding status
                    <select
                      value={form.onboardingStatus}
                      onChange={(event) => setForm((current) => ({ ...current, onboardingStatus: event.target.value }))}
                    >
                      <option value="signup_started">Signup started</option>
                      <option value="profile_complete">Profile complete</option>
                      <option value="channels_complete">Channels complete</option>
                      <option value="onboarding_complete">Onboarding complete</option>
                    </select>
                  </label>
                </div>
                <label>
                  AI tone
                  <textarea
                    value={form.tone}
                    onChange={(event) => setForm((current) => ({ ...current, tone: event.target.value }))}
                  />
                </label>
                <div className="form-actions client-management-actions">
                  {formMode === 'create' ? (
                    <button
                      className="mini-button"
                      disabled={selectedClient === undefined}
                      type="button"
                      onClick={() => selectedClient !== undefined && startEdit(selectedClient)}
                    >
                      <RotateCcw size={14} />
                      Cancel
                    </button>
                  ) : (
                    selectedClient !== undefined && (
                      <button
                        className="mini-button"
                        disabled={isSaving}
                        type="button"
                        onClick={() => void changeStatus(selectedClient.status === 'inactive' ? 'active' : 'inactive')}
                      >
                        <Power size={14} />
                        {selectedClient.status === 'inactive' ? 'Reactivate account' : 'Deactivate account'}
                      </button>
                    )
                  )}
                </div>
                <div className="sticky-save-bar" data-dirty={isClientFormDirty}>
                  <div>
                    <strong>
                      {isClientFormDirty
                        ? formMode === 'create'
                          ? 'New client draft ready'
                          : 'Unsaved client changes'
                        : 'No unsaved changes'}
                    </strong>
                    <span>
                      {isClientFormDirty
                        ? 'Save to update this workspace.'
                        : 'Edit any field to enable saving.'}
                    </span>
                  </div>
                  <div className="sticky-save-actions">
                    <button
                      className="mini-button"
                      disabled={!isClientFormDirty || isSaving}
                      type="button"
                      onClick={discardClientChanges}
                    >
                      <RotateCcw size={14} />
                      Discard
                    </button>
                    <button
                      className="btn-primary"
                      disabled={!canSubmitClientForm || isSaving}
                      type="submit"
                    >
                      <Save size={15} />
                      {isSaving ? 'Saving...' : formMode === 'create' ? 'Onboard client' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </form>

              {formMode === 'edit' && selectedDashboard !== undefined && (
                <section className="client-info-grid client-health-grid">
                  <div>
                    <span>Average Confidence</span>
                    <strong>{selectedDashboard.totals.averageConfidence}%</strong>
                  </div>
                  <div>
                    <span>Average CSAT</span>
                    <strong>{selectedDashboard.totals.averageCsat ?? 'Not rated'}</strong>
                  </div>
                  <div>
                    <span>Sales Protected</span>
                    <strong>{money(selectedDashboard.totals.salesRecoveredEstimate)}</strong>
                  </div>
                  <div>
                    <span>Language</span>
                    <strong>{selectedDashboard.client.defaultLanguage}</strong>
                  </div>
                </section>
              )}
            </div>
          )}
        </section>
      </section>
    </InternalShell>
  );
}
