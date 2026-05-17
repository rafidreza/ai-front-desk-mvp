'use client';

import { Building2, Calculator, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getClientDashboard, getClients } from '@/lib/api';
import { ClientDashboardSummary, ClientProfile } from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';

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

export default function InternalClientsPage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [dashboards, setDashboards] = useState<ClientDashboardSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  const portfolio = useMemo(
    () => ({
      conversations: dashboards.reduce((sum, dashboard) => sum + dashboard.totals.conversations, 0),
      tickets: dashboards.reduce((sum, dashboard) => sum + dashboard.totals.tickets, 0),
      projectedRevenue: dashboards.reduce((sum, dashboard) => sum + estimateMonthlyPrice(dashboard), 0),
    }),
    [dashboards],
  );

  return (
    <InternalShell
      activeView="clients"
      eyebrow="Client operations"
      title="Clients, pages, usage, and pricing"
      action={
        <button className="icon-button" type="button" onClick={() => void loadClients()} disabled={isLoading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      }
    >
      {error !== null && <div className="inline-alert">{error}</div>}

      <section className="metrics">
        <article className="metric">
          <span>Clients</span>
          <strong>{clients.length}</strong>
          <small>Active workspaces</small>
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
            <div className="search-control">
              <Search size={14} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search clients"
              />
            </div>
          </div>
          <div className="client-list">
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
                  <span>{dashboard?.totals.conversations ?? 0} conv.</span>
                </button>
              );
            })}
            {filteredClients.length === 0 && <div className="empty">No clients found</div>}
          </div>
        </section>

        <section className="detail-panel client-detail-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Calculator size={16} />
              Client Detail
            </div>
          </div>

          {selectedDashboard === undefined ? (
            <div className="empty">Select a client</div>
          ) : (
            <div className="client-detail-body">
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
            </div>
          )}
        </section>
      </section>
    </InternalShell>
  );
}
