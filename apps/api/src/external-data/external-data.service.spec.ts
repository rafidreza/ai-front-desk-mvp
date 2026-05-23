import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { ExternalDataService, parseExternalDataCsv } from './external-data.service';

const now = new Date();

function sourceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'source-1',
    clientId: 'pilot-client',
    sourceType: 'google_sheet',
    status: 'active',
    name: 'Google Sheet',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
    spreadsheetId: 'sheet-1',
    productsTabName: 'Products',
    ordersTabName: 'Orders',
    syncIntervalMinutes: 15,
    productFreshnessMinutes: 15,
    orderFreshnessMinutes: 5,
    lastSyncStatus: 'succeeded',
    lastSyncError: null,
    lastSyncAt: now,
    lastSuccessfulSyncAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product-1',
    dataSourceId: 'source-1',
    clientId: 'pilot-client',
    rowKey: 'KURTI-BLK-M',
    sku: 'KURTI-BLK-M',
    productName: 'Black Cotton Kurti',
    variant: 'M',
    availabilityStatus: 'in_stock',
    stockQuantity: 8,
    price: 1490,
    currency: 'BDT',
    productUrl: null,
    availabilityNote: 'Ships today',
    sourceUpdatedAt: now,
    lastSyncedAt: now,
    rawRow: {},
    ...overrides,
  };
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    dataSourceId: 'source-1',
    clientId: 'pilot-client',
    rowKey: 'ORD-1042',
    orderId: 'ORD-1042',
    customerPhone: '01711112222',
    customerEmail: 'buyer@example.com',
    customerName: 'Nadia',
    orderStatus: 'shipped',
    paymentStatus: 'paid',
    trackingUrl: 'https://tracking.example/ORD-1042',
    orderNote: 'Courier pickup completed',
    sourceUpdatedAt: now,
    lastSyncedAt: now,
    rawRow: {},
    ...overrides,
  };
}

function queryText(strings: TemplateStringsArray) {
  return Array.from(strings).join(' ');
}

function createService(input: {
  sources?: unknown[];
  products?: unknown[];
  orders?: unknown[];
} = {}) {
  const executeRaw = vi.fn(async () => 1);
  const transaction = vi.fn(async (callback: (tx: { $executeRaw: typeof executeRaw }) => Promise<void>) => callback({ $executeRaw: executeRaw }));
  const queryRaw = vi.fn(async (strings: TemplateStringsArray) => {
    const sql = queryText(strings);
    if (sql.includes('"ExternalDataSource"')) return input.sources ?? [sourceRow()];
    if (sql.includes('"ProductRecord"')) return input.products ?? [];
    if (sql.includes('"OrderRecord"')) return input.orders ?? [];
    if (sql.includes('"ExternalDataSyncRun"')) {
      return [{
        id: 'sync-1',
        dataSourceId: 'source-1',
        clientId: 'pilot-client',
        status: 'failed',
        startedAt: now,
        finishedAt: now,
        productsSeen: 0,
        productsImported: 0,
        ordersSeen: 0,
        ordersImported: 0,
        validationWarnings: [],
        errorMessage: 'failed',
      }];
    }
    return [];
  });

  const prisma = {
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    $transaction: transaction,
  } as unknown as PrismaService;

  return { executeRaw, queryRaw, service: new ExternalDataService(prisma), transaction };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ExternalDataService', () => {
  it('parses quoted Google Sheet CSV rows', () => {
    const rows = parseExternalDataCsv('sku,product_name,availability_status,availability_note\nK-1,"Black, Cotton Kurti",in_stock,"Ships ""today"""');

    expect(rows).toEqual([
      {
        sku: 'K-1',
        productname: 'Black, Cotton Kurti',
        availabilitystatus: 'in_stock',
        availabilitynote: 'Ships "today"',
      },
    ]);
  });

  it('keeps the previous cache when a sync fetch fails', async () => {
    const { service, transaction } = createService({ sources: [sourceRow()] });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));

    await expect(service.syncSource('pilot-client', 'source-1')).rejects.toThrow('Sheet fetch failed with status 404');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('answers product availability from fresh synced product rows', async () => {
    const { service } = createService({
      sources: [sourceRow()],
      products: [productRow()],
    });

    const reply = await service.findOperationalReply('pilot-client', 'Is black cotton kurti available?');

    expect(reply?.text).toContain('Black Cotton Kurti');
    expect(reply?.text).toContain('available');
    expect(reply?.text).toContain('BDT 1490');
    expect(reply?.shouldEscalate).toBe(false);
  });

  it('does not expose order status until the customer identifier matches', async () => {
    const { service } = createService({
      sources: [sourceRow()],
      orders: [orderRow()],
    });

    const unverified = await service.findOperationalReply('pilot-client', 'What is order ORD-1042 status?');
    expect(unverified?.text).toContain('Please share the phone number or email');
    expect(unverified?.text).not.toContain('shipped');

    const verified = await service.findOperationalReply('pilot-client', 'What is order ORD-1042 status? buyer@example.com');
    expect(verified?.text).toContain('Order ORD-1042 is shipped');
    expect(verified?.text).not.toContain('buyer@example.com');
    expect(verified?.text).not.toContain('01711112222');
    expect(verified?.text).not.toContain('Nadia');
  });
});
