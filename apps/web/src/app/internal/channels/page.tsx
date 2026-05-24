'use client';

import { CalendarDays, MessageCircle, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getClients } from '@/lib/api';
import { ClientProfile } from '@/types/domain';
import { EmptyState } from '../_components/EmptyState';
import { InternalShell } from '../_components/InternalShell';
import { ListSkeleton } from '../_components/ListSkeleton';
import { UiSelect } from '../_components/UiSelect';

type WhatsAppTemplateStatus = 'pending' | 'approved' | 'rejected';

type WhatsAppTemplate = {
  id: string;
  clientId: string;
  name: string;
  languageCode: string;
  category: string;
  status: WhatsAppTemplateStatus;
  body: string;
  rejectionReason?: string;
  updatedAt: string;
};

type ChannelHealthCheck = {
  clientId: string;
  businessName: string;
  channel: 'messenger' | 'whatsapp';
  status: 'healthy' | 'warning' | 'needs_setup';
  setupLabel: string;
  detail: string;
  tokenExpiresAt?: string;
  tokenDaysRemaining?: number;
  webhookLastSeenAt?: string;
  eventsLast24h: number;
  failuresLast24h: number | null;
  templateCounts?: {
    approved: number;
    pending: number;
    rejected: number;
  };
};

type TemplateForm = {
  name: string;
  languageCode: string;
  category: string;
  status: WhatsAppTemplateStatus;
  body: string;
  rejectionReason: string;
};

type AutoReplyRuleType = 'holiday' | 'off_hours';

type AutoReplyRule = {
  id: string;
  clientId: string;
  ruleType: AutoReplyRuleType;
  label: string;
  timezone: string;
  startDate?: string;
  endDate?: string;
  dayOfWeek?: number;
  startMinute: number;
  endMinute: number;
  replyText: string;
  enabled: boolean;
  updatedAt: string;
};

type AutoReplyForm = {
  id?: string;
  ruleType: AutoReplyRuleType;
  label: string;
  timezone: string;
  startDate: string;
  endDate: string;
  dayOfWeek: string;
  startMinute: number;
  endMinute: number;
  replyText: string;
  enabled: boolean;
};

const emptyTemplateForm: TemplateForm = {
  name: '',
  languageCode: 'en_US',
  category: 'utility',
  status: 'pending',
  body: '',
  rejectionReason: '',
};

const emptyAutoReplyForm: AutoReplyForm = {
  ruleType: 'holiday',
  label: '',
  timezone: 'Asia/Dhaka',
  startDate: '',
  endDate: '',
  dayOfWeek: '',
  startMinute: 0,
  endMinute: 1440,
  replyText: 'Thanks for your message. Our team is offline right now, but we will follow up when support resumes.',
  enabled: false,
};

function statusTone(status: WhatsAppTemplateStatus) {
  if (status === 'approved') return 'green';
  if (status === 'rejected') return 'coral';
  return 'amber';
}

function healthTone(status: ChannelHealthCheck['status']) {
  if (status === 'healthy') return 'green';
  if (status === 'warning') return 'amber';
  return 'coral';
}

function formFromRule(rule: AutoReplyRule): AutoReplyForm {
  return {
    id: rule.id,
    ruleType: rule.ruleType,
    label: rule.label,
    timezone: rule.timezone,
    startDate: rule.startDate ?? '',
    endDate: rule.endDate ?? '',
    dayOfWeek: rule.dayOfWeek === undefined ? '' : String(rule.dayOfWeek),
    startMinute: rule.startMinute,
    endMinute: rule.endMinute,
    replyText: rule.replyText,
    enabled: rule.enabled,
  };
}

function formatMinute(value: number) {
  if (value === 1440) return '24:00';
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export default function InternalChannelsPage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [healthChecks, setHealthChecks] = useState<ChannelHealthCheck[]>([]);
  const [autoReplyRules, setAutoReplyRules] = useState<AutoReplyRule[]>([]);
  const [form, setForm] = useState<TemplateForm>(emptyTemplateForm);
  const [autoReplyForm, setAutoReplyForm] = useState<AutoReplyForm>(emptyAutoReplyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId),
    [clients, selectedClientId],
  );

  async function loadClients() {
    setIsLoading(true);
    setError(null);
    try {
      const nextClients = await getClients();
      const healthData = await apiFetch<{ generatedAt: string; checks: ChannelHealthCheck[] }>('/internal/channel-health');
      setClients(nextClients);
      setHealthChecks(healthData.checks);
      const nextClientId = selectedClientId || nextClients[0]?.id || '';
      setSelectedClientId(nextClientId);
      if (nextClientId !== '') {
        await Promise.all([loadTemplates(nextClientId), loadAutoReplyRules(nextClientId)]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load channel settings.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTemplates(clientId = selectedClientId) {
    if (clientId === '') return;
    const data = await apiFetch<{ templates: WhatsAppTemplate[] }>(`/clients/${clientId}/whatsapp/templates`);
    setTemplates(data.templates);
  }

  async function loadAutoReplyRules(clientId = selectedClientId) {
    if (clientId === '') return;
    const data = await apiFetch<{ rules: AutoReplyRule[] }>(`/clients/${clientId}/auto-replies`);
    setAutoReplyRules(data.rules);
  }

  useEffect(() => {
    void loadClients();
  }, []);

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedClientId === '') return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch<{ template: WhatsAppTemplate }>(`/clients/${selectedClientId}/whatsapp/templates`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          languageCode: form.languageCode,
          category: form.category,
          status: form.status,
          body: form.body,
          rejectionReason: form.status === 'rejected' ? form.rejectionReason : undefined,
        }),
      });
      setNotice('WhatsApp template status saved.');
      setForm(emptyTemplateForm);
      await loadTemplates();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save WhatsApp template.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTemplate(templateId: string) {
    if (selectedClientId === '') return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/clients/${selectedClientId}/whatsapp/templates/${templateId}`, { method: 'DELETE' });
      setNotice('WhatsApp template removed.');
      await loadTemplates();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to remove WhatsApp template.');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAutoReplyRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedClientId === '') return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = {
        ruleType: autoReplyForm.ruleType,
        label: autoReplyForm.label,
        timezone: autoReplyForm.timezone,
        startDate: autoReplyForm.ruleType === 'holiday' ? autoReplyForm.startDate : undefined,
        endDate: autoReplyForm.ruleType === 'holiday' ? autoReplyForm.endDate || autoReplyForm.startDate : undefined,
        dayOfWeek: autoReplyForm.ruleType === 'off_hours' && autoReplyForm.dayOfWeek !== '' ? Number(autoReplyForm.dayOfWeek) : undefined,
        startMinute: autoReplyForm.startMinute,
        endMinute: autoReplyForm.endMinute,
        replyText: autoReplyForm.replyText,
        enabled: autoReplyForm.enabled,
      };
      const path =
        autoReplyForm.id === undefined
          ? `/clients/${selectedClientId}/auto-replies`
          : `/clients/${selectedClientId}/auto-replies/${autoReplyForm.id}`;
      await apiFetch<{ rule: AutoReplyRule }>(path, {
        method: autoReplyForm.id === undefined ? 'POST' : 'PATCH',
        body: JSON.stringify(body),
      });
      setNotice('Auto-reply calendar rule saved.');
      setAutoReplyForm(emptyAutoReplyForm);
      await loadAutoReplyRules();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save auto-reply rule.');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleAutoReplyRule(rule: AutoReplyRule) {
    if (selectedClientId === '') return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch<{ rule: AutoReplyRule }>(`/clients/${selectedClientId}/auto-replies/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      setNotice(!rule.enabled ? 'Auto-reply rule enabled.' : 'Auto-reply rule disabled.');
      await loadAutoReplyRules();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update auto-reply rule.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAutoReplyRule(ruleId: string) {
    if (selectedClientId === '') return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/clients/${selectedClientId}/auto-replies/${ruleId}`, { method: 'DELETE' });
      setNotice('Auto-reply rule removed.');
      setAutoReplyForm(emptyAutoReplyForm);
      await loadAutoReplyRules();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to remove auto-reply rule.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <InternalShell
      activeView="channels"
      eyebrow="Channel operations"
      title="WhatsApp template approvals"
      action={
        <div className="panel-actions">
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
        {healthChecks.map((check) => (
          <article className="metric" key={`${check.clientId}:${check.channel}`}>
            <span>{check.businessName}</span>
            <strong>{check.channel === 'messenger' ? 'Messenger' : 'WhatsApp'}</strong>
            <small>
              <span className="badge" data-tone={healthTone(check.status)}>
                {check.status.replace('_', ' ')}
              </span>
            </small>
            <small>{check.setupLabel}</small>
            <small>{check.detail}</small>
            <small>
              Webhook: {check.webhookLastSeenAt === undefined ? 'no recent traffic' : new Date(check.webhookLastSeenAt).toLocaleString('en-BD')}
            </small>
            <small>{check.eventsLast24h} events in 24h</small>
          </article>
        ))}
        {!isLoading && healthChecks.length === 0 && (
          <article className="metric">
            <span>Channel health</span>
            <strong>No clients</strong>
            <small>Create a client before channel checks appear.</small>
          </article>
        )}
      </section>

      <section className="client-portal-grid">
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <MessageCircle size={16} />
              Template registry
            </div>
            <UiSelect
              aria-label="Select client"
              className="client-jump-select"
              compact
              disabled={clients.length === 0}
              value={selectedClientId}
              onChange={(event) => {
                setSelectedClientId(event.target.value);
                void Promise.all([loadTemplates(event.target.value), loadAutoReplyRules(event.target.value)]);
              }}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.businessName}
                </option>
              ))}
            </UiSelect>
          </div>

          <div className="client-list">
            {isLoading && templates.length === 0 && <ListSkeleton rows={4} variant="default" />}
            {templates.map((template) => (
              <article className="client-row" key={template.id}>
                <div>
                  <strong>{template.name}</strong>
                  <small>
                    {template.languageCode} | {template.category} | Updated {new Date(template.updatedAt).toLocaleDateString('en-BD')}
                  </small>
                  <small>{template.body}</small>
                  {template.rejectionReason !== undefined && <small>Rejected: {template.rejectionReason}</small>}
                </div>
                <div className="panel-actions">
                  <span className="badge" data-tone={statusTone(template.status)}>
                    {template.status}
                  </span>
                  <button className="mini-button" type="button" disabled={isSaving} onClick={() => void deleteTemplate(template.id)}>
                    <Trash2 size={13} />
                    Remove
                  </button>
                </div>
              </article>
            ))}
            {!isLoading && templates.length === 0 && (
              <EmptyState
                icon={<MessageCircle size={20} />}
                title="No WhatsApp templates yet"
                description="Register approved Meta templates here before using them for outbound WhatsApp sends."
              />
            )}
          </div>
        </section>

        <section className="detail-panel client-detail-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Plus size={16} />
              Manual approval status
            </div>
            {selectedClient !== undefined && <span className="badge">{selectedClient.businessName}</span>}
          </div>

          <form className="stack-form internal-client-form" onSubmit={saveTemplate}>
            <div className="client-management-grid">
              <label>
                Template name
                <input
                  required
                  value={form.name}
                  placeholder="order_update"
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Language
                <input
                  required
                  value={form.languageCode}
                  placeholder="en_US"
                  onChange={(event) => setForm((current) => ({ ...current, languageCode: event.target.value }))}
                />
              </label>
              <label>
                Category
                <input
                  value={form.category}
                  placeholder="utility"
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                />
              </label>
              <label>
                Approval status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as WhatsAppTemplateStatus }))
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            </div>
            <label>
              Template body
              <textarea
                required
                value={form.body}
                placeholder="Your order {{1}} has been confirmed."
                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              />
            </label>
            {form.status === 'rejected' && (
              <label>
                Rejection reason
                <input
                  value={form.rejectionReason}
                  placeholder="Meta rejection reason"
                  onChange={(event) => setForm((current) => ({ ...current, rejectionReason: event.target.value }))}
                />
              </label>
            )}
            <div className="form-actions">
              <button className="btn-primary" type="submit" disabled={isSaving || selectedClientId === ''}>
                <Save size={15} />
                {isSaving ? 'Saving...' : 'Save template'}
              </button>
            </div>
          </form>
        </section>
      </section>

      <section className="client-portal-grid">
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <CalendarDays size={16} />
              Holiday and off-hours auto-replies
            </div>
          </div>
          <div className="client-list">
            {autoReplyRules.map((rule) => (
              <article className="client-row" key={rule.id}>
                <div>
                  <strong>{rule.label}</strong>
                  <small>
                    {rule.ruleType === 'holiday'
                      ? `${rule.startDate ?? 'No date'}${rule.endDate !== undefined && rule.endDate !== rule.startDate ? ` to ${rule.endDate}` : ''}`
                      : `${rule.dayOfWeek === undefined ? 'Every day' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][rule.dayOfWeek]} ${formatMinute(rule.startMinute)}-${formatMinute(rule.endMinute)}`}
                    {' '}| {rule.timezone}
                  </small>
                  <small>{rule.replyText}</small>
                </div>
                <div className="panel-actions">
                  <span className="badge" data-tone={rule.enabled ? 'green' : 'slate'}>
                    {rule.enabled ? 'Enabled' : 'Draft'}
                  </span>
                  <button className="mini-button" type="button" disabled={isSaving} onClick={() => setAutoReplyForm(formFromRule(rule))}>
                    Edit
                  </button>
                  <button className="mini-button" type="button" disabled={isSaving} onClick={() => void toggleAutoReplyRule(rule)}>
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button className="mini-button" type="button" disabled={isSaving} onClick={() => void deleteAutoReplyRule(rule.id)}>
                    <Trash2 size={13} />
                    Remove
                  </button>
                </div>
              </article>
            ))}
            {!isLoading && autoReplyRules.length === 0 && (
              <EmptyState
                icon={<CalendarDays size={20} />}
                title="No auto-reply rules"
                description="Add holiday windows or daily after-hours coverage for this client."
              />
            )}
          </div>
        </section>

        <section className="detail-panel client-detail-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Plus size={16} />
              {autoReplyForm.id === undefined ? 'Add auto-reply rule' : 'Edit auto-reply rule'}
            </div>
          </div>
          <form className="stack-form internal-client-form" onSubmit={saveAutoReplyRule}>
            <div className="client-management-grid">
              <label>
                Rule type
                <select
                  value={autoReplyForm.ruleType}
                  onChange={(event) =>
                    setAutoReplyForm((current) => ({ ...current, ruleType: event.target.value as AutoReplyRuleType }))
                  }
                >
                  <option value="holiday">Holiday</option>
                  <option value="off_hours">Off-hours</option>
                </select>
              </label>
              <label>
                Label
                <input
                  required
                  value={autoReplyForm.label}
                  placeholder="Eid holiday, daily after-hours"
                  onChange={(event) => setAutoReplyForm((current) => ({ ...current, label: event.target.value }))}
                />
              </label>
              <label>
                Timezone
                <input
                  required
                  value={autoReplyForm.timezone}
                  placeholder="Asia/Dhaka"
                  onChange={(event) => setAutoReplyForm((current) => ({ ...current, timezone: event.target.value }))}
                />
              </label>
              <label>
                Status
                <select
                  value={autoReplyForm.enabled ? 'enabled' : 'draft'}
                  onChange={(event) => setAutoReplyForm((current) => ({ ...current, enabled: event.target.value === 'enabled' }))}
                >
                  <option value="draft">Draft</option>
                  <option value="enabled">Enabled</option>
                </select>
              </label>
              {autoReplyForm.ruleType === 'holiday' ? (
                <>
                  <label>
                    Start date
                    <input
                      required
                      type="date"
                      value={autoReplyForm.startDate}
                      onChange={(event) => setAutoReplyForm((current) => ({ ...current, startDate: event.target.value }))}
                    />
                  </label>
                  <label>
                    End date
                    <input
                      type="date"
                      value={autoReplyForm.endDate}
                      onChange={(event) => setAutoReplyForm((current) => ({ ...current, endDate: event.target.value }))}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Day
                    <select
                      value={autoReplyForm.dayOfWeek}
                      onChange={(event) => setAutoReplyForm((current) => ({ ...current, dayOfWeek: event.target.value }))}
                    >
                      <option value="">Every day</option>
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </label>
                  <label>
                    Start minute
                    <input
                      type="number"
                      min={0}
                      max={1440}
                      value={autoReplyForm.startMinute}
                      onChange={(event) => setAutoReplyForm((current) => ({ ...current, startMinute: Number(event.target.value) }))}
                    />
                  </label>
                  <label>
                    End minute
                    <input
                      type="number"
                      min={0}
                      max={1440}
                      value={autoReplyForm.endMinute}
                      onChange={(event) => setAutoReplyForm((current) => ({ ...current, endMinute: Number(event.target.value) }))}
                    />
                  </label>
                </>
              )}
            </div>
            <label>
              Auto-reply message
              <textarea
                required
                value={autoReplyForm.replyText}
                onChange={(event) => setAutoReplyForm((current) => ({ ...current, replyText: event.target.value }))}
              />
            </label>
            <div className="form-actions">
              <button className="mini-button" type="button" onClick={() => setAutoReplyForm(emptyAutoReplyForm)}>
                Clear
              </button>
              <button className="btn-primary" type="submit" disabled={isSaving || selectedClientId === ''}>
                <Save size={15} />
                {isSaving ? 'Saving...' : 'Save auto-reply'}
              </button>
            </div>
          </form>
        </section>
      </section>
    </InternalShell>
  );
}
