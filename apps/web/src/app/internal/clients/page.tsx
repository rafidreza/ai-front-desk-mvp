'use client';

import { Building2, Calculator, Plus, Power, RefreshCw, RotateCcw, Save, Search } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ClientManagementInput,
  createClientFromInternal,
  getClientDashboard,
  getClients,
  updateClientFromInternal,
  updateClientStatus,
} from '@/lib/api';
import { ClientDashboardSummary, ClientProfile, ClientStatus } from '@/types/domain';
import { EmptyState } from '../_components/EmptyState';
import { ListSkeleton } from '../_components/ListSkeleton';
import { InternalShell } from '../_components/InternalShell';
import { UiSelect } from '../_components/UiSelect';

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

const emptyClientForm: ClientFormState = {
  businessName: '',
  pageId: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  businessCategory: '',
  defaultLanguage: 'mixed',
  tone: 'friendly, concise, helpful, and natural for Bangladeshi Messenger commerce',
  whatsappPoc: '',
  digestEmail: '',
  onboardingStatus: 'onboarding_complete',
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

export default function InternalClientsPage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [dashboards, setDashboards] = useState<ClientDashboardSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [formMode, setFormMode] = useState<'edit' | 'create'>('edit');
  const [form, setForm] = useState<ClientFormState>(emptyClientForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadClients() {
    setIsLoading(true);
    setError(null);
    try {
      const clientData = await getClients();
      const dashboardData = await Promise.all(clientData.map((client) => getClientDashboard(client.id)));
      setClients(clientData);
      setDashboards(dashboardData);
      setSelectedClientId((current) => current ?? clientData[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load clients.');
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

  useEffect(() => {
    if (formMode === 'create') return;
    if (selectedClient !== undefined) {
      setForm(formFromClient(selectedClient));
    }
  }, [formMode, selectedClient]);

  function startCreate() {
    setFormMode('create');
    setSelectedClientId(null);
    setForm(emptyClientForm);
    setNotice(null);
    setError(null);
  }

  function startEdit(client: ClientProfile) {
    setFormMode('edit');
    setSelectedClientId(client.id);
    setForm(formFromClient(client));
    setNotice(null);
    setError(null);
  }

  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
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
      setFormMode('edit');
      setSelectedClientId(saved.id);
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
      {error !== null && <div className="inline-alert">{error}</div>}
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
                  onClick={() => setSelectedClientId(client.id)}
                >
                  <div>
                    <strong>{client.businessName}</strong>
                    <small>{client.pageId} | {client.businessCategory ?? 'Uncategorized'}</small>
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
                      <span>Facebook/Page ID</span>
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
                      <span>WhatsApp POC</span>
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
                    Facebook/Page ID
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
                    WhatsApp POC
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
                  <button className="icon-button" disabled={isSaving} type="submit">
                    <Save size={15} />
                    {isSaving ? 'Saving...' : formMode === 'create' ? 'Onboard client' : 'Save changes'}
                  </button>
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
              </form>

              {formMode === 'edit' && selectedDashboard !== undefined && (
                <section className="client-info-grid">
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
