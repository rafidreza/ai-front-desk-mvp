'use client';

import { DatabaseZap, RefreshCw, Save } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { InternalShell } from '../_components/InternalShell';
import { UiSelect } from '../_components/UiSelect';
import {
  getClients,
  getExternalDataSources,
  getExternalOrders,
  getExternalProducts,
  saveGoogleSheetDataSource,
  syncExternalDataSource,
} from '@/lib/api';
import { ClientProfile, ExternalDataSource, ExternalDataSyncRun, OrderRecord, ProductRecord } from '@/types/domain';

type SheetForm = {
  sheetUrl: string;
  productsTabName: string;
  ordersTabName: string;
};

const emptyForm: SheetForm = {
  sheetUrl: '',
  productsTabName: 'Products',
  ordersTabName: 'Orders',
};

function formatTime(value?: string) {
  if (value === undefined) return 'Never';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function InternalDataSourcesPage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [clientId, setClientId] = useState('pilot-client');
  const [sources, setSources] = useState<ExternalDataSource[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [lastSyncRun, setLastSyncRun] = useState<ExternalDataSyncRun | null>(null);
  const [form, setForm] = useState<SheetForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const source = sources[0];
  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId), [clientId, clients]);

  async function loadClients() {
    const loaded = await getClients();
    setClients(loaded);
    if (loaded.length > 0 && !loaded.some((client) => client.id === clientId)) {
      setClientId(loaded[0].id);
    }
  }

  async function loadData(nextClientId = clientId) {
    setIsLoading(true);
    setError(null);
    try {
      const loadedSources = await getExternalDataSources(nextClientId);
      const activeSource = loadedSources[0];
      setSources(loadedSources);
      if (activeSource === undefined) {
        setProducts([]);
        setOrders([]);
        setForm(emptyForm);
      } else {
        const [loadedProducts, loadedOrders] = await Promise.all([
          getExternalProducts(nextClientId, activeSource.id),
          getExternalOrders(nextClientId, activeSource.id),
        ]);
        setProducts(loadedProducts);
        setOrders(loadedOrders);
        setForm({
          sheetUrl: activeSource.sheetUrl,
          productsTabName: activeSource.productsTabName,
          ordersTabName: activeSource.ordersTabName ?? '',
        });
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load data sources.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        await loadClients();
        await loadData(clientId);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load data sources.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function switchClient(nextClientId: string) {
    setClientId(nextClientId);
    setLastSyncRun(null);
    await loadData(nextClientId);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveGoogleSheetDataSource(clientId, {
        name: `${selectedClient?.businessName ?? clientId} Sheet`,
        sheetUrl: form.sheetUrl.trim(),
        productsTabName: form.productsTabName.trim() || 'Products',
        ordersTabName: form.ordersTabName.trim() === '' ? undefined : form.ordersTabName.trim(),
      });
      setSources([saved]);
      setNotice('Google Sheet source saved.');
      await loadData(clientId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save Google Sheet source.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSync() {
    if (source === undefined) return;
    setIsSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await syncExternalDataSource(clientId, source.id);
      setLastSyncRun(result.syncRun);
      setNotice(`Sync complete: ${result.syncRun.productsImported} products and ${result.syncRun.ordersImported} orders imported.`);
      await loadData(clientId);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync Google Sheet.');
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <InternalShell
      activeView="data-sources"
      eyebrow="Operational data"
      title="Google Sheet Data Sources"
      action={
        <div className="page-actions">
          <UiSelect className="page-select" value={clientId} onChange={(event) => void switchClient(event.target.value)}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.businessName}</option>
            ))}
          </UiSelect>
          <button className="icon-button" disabled={isLoading} type="button" onClick={() => void loadData()}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      }
    >
      {error !== null && <div className="inline-alert">{error}</div>}
      {notice !== null && <div className="inline-success">{notice}</div>}

      <section className="client-data-grid">
        <section className="client-panel data-source-panel">
          <div className="panel-header">
            <div className="panel-title">
              <DatabaseZap size={16} />
              Sheet source
            </div>
            <span className="badge" data-tone={source?.lastSyncStatus === 'failed' ? 'coral' : source?.lastSyncStatus === 'succeeded' ? 'green' : 'blue'}>
              {source?.lastSyncStatus ?? 'not synced'}
            </span>
          </div>
          <form className="stack-form data-source-form" onSubmit={(event) => void handleSave(event)}>
            <label>
              Google Sheet URL
              <input value={form.sheetUrl} onChange={(event) => setForm((current) => ({ ...current, sheetUrl: event.target.value }))} />
            </label>
            <div className="data-form-row">
              <label>
                Products tab
                <input value={form.productsTabName} onChange={(event) => setForm((current) => ({ ...current, productsTabName: event.target.value }))} />
              </label>
              <label>
                Orders tab
                <input value={form.ordersTabName} onChange={(event) => setForm((current) => ({ ...current, ordersTabName: event.target.value }))} />
              </label>
            </div>
            <div className="form-actions">
              <button className="icon-button" disabled={isSaving} type="submit">
                <Save size={16} />
                Save
              </button>
              <button className="icon-button" disabled={source === undefined || isSyncing} type="button" onClick={() => void handleSync()}>
                <RefreshCw size={16} />
                Sync now
              </button>
            </div>
          </form>
        </section>

        <section className="client-panel data-source-panel">
          <div className="panel-header">
            <div className="panel-title">Sync result</div>
            <span className="count">{formatTime(source?.lastSyncAt)}</span>
          </div>
          <div className="data-source-status">
            <div>
              <span>Products</span>
              <strong>{lastSyncRun?.productsImported ?? products.length}</strong>
            </div>
            <div>
              <span>Orders</span>
              <strong>{lastSyncRun?.ordersImported ?? orders.length}</strong>
            </div>
            <div>
              <span>Warnings</span>
              <strong>{lastSyncRun?.validationWarnings.length ?? 0}</strong>
            </div>
          </div>
        </section>
      </section>

      <section className="client-data-grid">
        <section className="client-panel data-source-panel">
          <div className="panel-header">
            <div className="panel-title">Products</div>
            <span className="count">{products.length}</span>
          </div>
          <div className="data-record-list">
            {products.slice(0, 10).map((product) => (
              <article className="data-record-row" key={product.id}>
                <div>
                  <strong>{product.productName}</strong>
                  <small>{[product.sku, product.variant].filter(Boolean).join(' / ') || 'No SKU'}</small>
                </div>
                <span className="badge">{product.availabilityStatus.replace(/_/g, ' ')}</span>
              </article>
            ))}
            {products.length === 0 && <div className="empty">No products synced</div>}
          </div>
        </section>

        <section className="client-panel data-source-panel">
          <div className="panel-header">
            <div className="panel-title">Orders</div>
            <span className="count">{orders.length}</span>
          </div>
          <div className="data-record-list">
            {orders.slice(0, 10).map((order) => (
              <article className="data-record-row" key={order.id}>
                <div>
                  <strong>{order.orderId}</strong>
                  <small>{order.paymentStatus ?? 'payment not set'}</small>
                </div>
                <span className="badge">{order.orderStatus.replace(/_/g, ' ')}</span>
              </article>
            ))}
            {orders.length === 0 && <div className="empty">No orders synced</div>}
          </div>
        </section>
      </section>
    </InternalShell>
  );
}
