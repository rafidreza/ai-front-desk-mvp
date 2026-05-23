'use client';

import { Link2, RefreshCw, Save, TableProperties } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ClientPortalNav } from '../_components/ClientPortalNav';
import {
  getExternalDataSources,
  getExternalOrders,
  getExternalProducts,
  saveGoogleSheetDataSource,
  syncExternalDataSource,
} from '@/lib/api';
import { ExternalDataSource, ExternalDataSyncRun, OrderRecord, ProductRecord } from '@/types/domain';

type SheetForm = {
  name: string;
  sheetUrl: string;
  productsTabName: string;
  ordersTabName: string;
  syncIntervalMinutes: string;
  productFreshnessMinutes: string;
  orderFreshnessMinutes: string;
};

const emptyForm: SheetForm = {
  name: 'Google Sheet',
  sheetUrl: '',
  productsTabName: 'Products',
  ordersTabName: 'Orders',
  syncIntervalMinutes: '15',
  productFreshnessMinutes: '15',
  orderFreshnessMinutes: '5',
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

function formFromSource(source?: ExternalDataSource): SheetForm {
  if (source === undefined) return emptyForm;
  return {
    name: source.name,
    sheetUrl: source.sheetUrl,
    productsTabName: source.productsTabName,
    ordersTabName: source.ordersTabName ?? '',
    syncIntervalMinutes: String(source.syncIntervalMinutes),
    productFreshnessMinutes: String(source.productFreshnessMinutes),
    orderFreshnessMinutes: String(source.orderFreshnessMinutes),
  };
}

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function ClientDataSourcesPage() {
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

  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-client';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-client';
  }, []);

  const source = sources[0];

  async function loadData(nextSource = source) {
    setIsLoading(true);
    setError(null);
    try {
      const loadedSources = await getExternalDataSources(clientId);
      const activeSource = nextSource ?? loadedSources[0];
      setSources(loadedSources);
      if (activeSource !== undefined) {
        const [loadedProducts, loadedOrders] = await Promise.all([
          getExternalProducts(clientId, activeSource.id),
          getExternalOrders(clientId, activeSource.id),
        ]);
        setProducts(loadedProducts);
        setOrders(loadedOrders);
        setForm(formFromSource(activeSource));
      } else {
        setProducts([]);
        setOrders([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load data sources.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function logout() {
    await fetch('/api/client-auth/logout', { method: 'POST' });
    window.location.href = '/client/login';
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveGoogleSheetDataSource(clientId, {
        name: form.name.trim() || 'Google Sheet',
        sheetUrl: form.sheetUrl.trim(),
        productsTabName: form.productsTabName.trim() || 'Products',
        ordersTabName: form.ordersTabName.trim() === '' ? undefined : form.ordersTabName.trim(),
        syncIntervalMinutes: toNumber(form.syncIntervalMinutes, 15),
        productFreshnessMinutes: toNumber(form.productFreshnessMinutes, 15),
        orderFreshnessMinutes: toNumber(form.orderFreshnessMinutes, 5),
      });
      setSources([saved]);
      setNotice('Google Sheet source saved.');
      await loadData(saved);
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
      await loadData(result.source);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync Google Sheet.');
      await loadData(source);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div className="client-title-lockup">
          <span className="client-mark">DS</span>
          <div>
            <p className="eyebrow">Live business data</p>
            <h1>Data Sources</h1>
          </div>
        </div>
        <ClientPortalNav active="data-sources" clientId={clientId} />
        <div className="panel-actions">
          <button className="icon-button" disabled={isLoading} type="button" onClick={() => void loadData()}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="icon-button" type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>

      {error !== null && <div className="inline-alert">{error}</div>}
      {notice !== null && <div className="inline-success">{notice}</div>}

      <section className="client-data-command">
        <div>
          <p className="eyebrow">Google Sheet</p>
          <h2>{source?.lastSyncStatus === 'succeeded' ? 'Product and order data is connected' : 'Connect product and order data'}</h2>
          <p>Last sync: {formatTime(source?.lastSuccessfulSyncAt)}. Products stay fresh for {source?.productFreshnessMinutes ?? 15} minutes; orders stay fresh for {source?.orderFreshnessMinutes ?? 5} minutes.</p>
        </div>
        <div className="knowledge-command-stats">
          <div>
            <span>Products</span>
            <strong>{products.length}</strong>
          </div>
          <div>
            <span>Orders</span>
            <strong>{orders.length}</strong>
          </div>
        </div>
      </section>

      <section className="client-data-grid">
        <section className="client-panel data-source-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Link2 size={16} />
              Google Sheet link
            </div>
            <span className="badge" data-tone={source?.lastSyncStatus === 'failed' ? 'coral' : source?.lastSyncStatus === 'succeeded' ? 'green' : 'blue'}>
              {source?.lastSyncStatus ?? 'not synced'}
            </span>
          </div>

          <form className="stack-form data-source-form" onSubmit={(event) => void handleSave(event)}>
            <label>
              Source name
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Google Sheet URL
              <input value={form.sheetUrl} placeholder="https://docs.google.com/spreadsheets/d/..." onChange={(event) => setForm((current) => ({ ...current, sheetUrl: event.target.value }))} />
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
            <div className="data-form-row">
              <label>
                Sync minutes
                <input type="number" min="5" value={form.syncIntervalMinutes} onChange={(event) => setForm((current) => ({ ...current, syncIntervalMinutes: event.target.value }))} />
              </label>
              <label>
                Product freshness
                <input type="number" min="1" value={form.productFreshnessMinutes} onChange={(event) => setForm((current) => ({ ...current, productFreshnessMinutes: event.target.value }))} />
              </label>
              <label>
                Order freshness
                <input type="number" min="1" value={form.orderFreshnessMinutes} onChange={(event) => setForm((current) => ({ ...current, orderFreshnessMinutes: event.target.value }))} />
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
            <div className="panel-title">
              <TableProperties size={16} />
              Sync status
            </div>
            {source !== undefined && <span className="count">{formatTime(source.lastSyncAt)}</span>}
          </div>
          <div className="data-source-status">
            <div>
              <span>Last result</span>
              <strong>{source?.lastSyncStatus ?? 'Not synced'}</strong>
            </div>
            <div>
              <span>Products imported</span>
              <strong>{lastSyncRun?.productsImported ?? products.length}</strong>
            </div>
            <div>
              <span>Orders imported</span>
              <strong>{lastSyncRun?.ordersImported ?? orders.length}</strong>
            </div>
          </div>
          {source?.lastSyncError !== undefined && <div className="inline-alert">{source.lastSyncError}</div>}
          {(lastSyncRun?.validationWarnings ?? []).length > 0 && (
            <div className="data-warning-list">
              {lastSyncRun?.validationWarnings.slice(0, 8).map((warning, index) => (
                <p key={index}>{String(warning.message ?? 'Validation warning')}</p>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="client-data-grid">
        <section className="client-panel data-source-panel">
          <div className="panel-header">
            <div className="panel-title">Products</div>
            <span className="count">{products.length}</span>
          </div>
          <div className="data-record-list">
            {products.slice(0, 8).map((product) => (
              <article className="data-record-row" key={product.id}>
                <div>
                  <strong>{product.productName}</strong>
                  <small>{[product.sku, product.variant].filter(Boolean).join(' / ') || 'No SKU'}</small>
                </div>
                <span className="badge" data-tone={product.availabilityStatus === 'in_stock' ? 'green' : product.availabilityStatus === 'out_of_stock' ? 'coral' : 'amber'}>
                  {product.availabilityStatus.replace(/_/g, ' ')}
                </span>
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
            {orders.slice(0, 8).map((order) => (
              <article className="data-record-row" key={order.id}>
                <div>
                  <strong>{order.orderId}</strong>
                  <small>{order.paymentStatus ?? 'payment not set'}</small>
                </div>
                <span className="badge" data-tone={order.orderStatus === 'delivered' ? 'green' : order.orderStatus === 'cancelled' ? 'coral' : 'blue'}>
                  {order.orderStatus.replace(/_/g, ' ')}
                </span>
              </article>
            ))}
            {orders.length === 0 && <div className="empty">No orders synced</div>}
          </div>
        </section>
      </section>
    </main>
  );
}
