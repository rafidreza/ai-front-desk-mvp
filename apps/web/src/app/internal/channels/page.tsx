'use client';

import { MessageCircle, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
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

type TemplateForm = {
  name: string;
  languageCode: string;
  category: string;
  status: WhatsAppTemplateStatus;
  body: string;
  rejectionReason: string;
};

const emptyTemplateForm: TemplateForm = {
  name: '',
  languageCode: 'en_US',
  category: 'utility',
  status: 'pending',
  body: '',
  rejectionReason: '',
};

function statusTone(status: WhatsAppTemplateStatus) {
  if (status === 'approved') return 'green';
  if (status === 'rejected') return 'coral';
  return 'amber';
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
  const [form, setForm] = useState<TemplateForm>(emptyTemplateForm);
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
      setClients(nextClients);
      const nextClientId = selectedClientId || nextClients[0]?.id || '';
      setSelectedClientId(nextClientId);
      if (nextClientId !== '') {
        await loadTemplates(nextClientId);
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
                void loadTemplates(event.target.value);
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
    </InternalShell>
  );
}
