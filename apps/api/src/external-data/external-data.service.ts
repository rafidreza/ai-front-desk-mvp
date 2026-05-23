import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import {
  ExternalDataSource,
  ExternalDataSyncRun,
  ExternalDataSyncStatus,
  OrderRecord,
  OrderStatus,
  PaymentStatus,
  ProductAvailabilityStatus,
  ProductRecord,
} from '../types/domain';

type JsonRecord = Record<string, unknown>;

type Warning = {
  tab: 'Products' | 'Orders';
  row: number;
  field?: string;
  message: string;
};

type CsvRow = Record<string, string>;

type ExternalDataSourceRow = {
  id: string;
  clientId: string;
  sourceType: string;
  status: string;
  name: string;
  sheetUrl: string;
  spreadsheetId: string | null;
  productsTabName: string;
  ordersTabName: string | null;
  syncIntervalMinutes: number;
  productFreshnessMinutes: number;
  orderFreshnessMinutes: number;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  lastSyncAt: Date | null;
  lastSuccessfulSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExternalDataSyncRunRow = {
  id: string;
  dataSourceId: string;
  clientId: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  productsSeen: number;
  productsImported: number;
  ordersSeen: number;
  ordersImported: number;
  validationWarnings: unknown;
  errorMessage: string | null;
};

type ProductRecordRow = {
  id: string;
  dataSourceId: string;
  clientId: string;
  rowKey: string;
  sku: string | null;
  productName: string;
  variant: string | null;
  availabilityStatus: string;
  stockQuantity: number | null;
  price: number | null;
  currency: string | null;
  productUrl: string | null;
  availabilityNote: string | null;
  sourceUpdatedAt: Date | null;
  lastSyncedAt: Date;
  rawRow: unknown;
};

type OrderRecordRow = {
  id: string;
  dataSourceId: string;
  clientId: string;
  rowKey: string;
  orderId: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerName: string | null;
  orderStatus: string;
  paymentStatus: string | null;
  trackingUrl: string | null;
  orderNote: string | null;
  sourceUpdatedAt: Date | null;
  lastSyncedAt: Date;
  rawRow: unknown;
};

type SaveGoogleSheetInput = {
  name?: string;
  sheetUrl: string;
  productsTabName?: string;
  ordersTabName?: string;
  syncIntervalMinutes?: number;
  productFreshnessMinutes?: number;
  orderFreshnessMinutes?: number;
};

type ParsedProduct = Omit<ProductRecord, 'id' | 'dataSourceId' | 'clientId' | 'lastSyncedAt'>;
type ParsedOrder = Omit<OrderRecord, 'id' | 'dataSourceId' | 'clientId' | 'lastSyncedAt'>;

const allowedAvailabilityStatuses = new Set<ProductAvailabilityStatus>([
  'in_stock',
  'low_stock',
  'out_of_stock',
  'preorder',
  'discontinued',
  'unknown',
]);

const allowedOrderStatuses = new Set<OrderStatus>([
  'received',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'unknown',
]);

const allowedPaymentStatuses = new Set<PaymentStatus>(['unpaid', 'partial', 'paid', 'refunded', 'unknown']);

function dateToString(value: Date | null): string | undefined {
  return value?.toISOString();
}

function optionalString(value: string | null): string | undefined {
  return value ?? undefined;
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function normalizeStatus(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizePhone(value: string) {
  return value.replace(/\D+/g, '');
}

function toOptionalString(value: string | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

function toNumber(value: string | undefined) {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toDate(value: string | undefined) {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return undefined;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function coerceWarnings(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => item !== null && typeof item === 'object' && !Array.isArray(item)) : [];
}

function mapSource(row: ExternalDataSourceRow): ExternalDataSource {
  return {
    id: row.id,
    clientId: row.clientId,
    sourceType: 'google_sheet',
    status: row.status as ExternalDataSource['status'],
    name: row.name,
    sheetUrl: row.sheetUrl,
    spreadsheetId: optionalString(row.spreadsheetId),
    productsTabName: row.productsTabName,
    ordersTabName: optionalString(row.ordersTabName),
    syncIntervalMinutes: row.syncIntervalMinutes,
    productFreshnessMinutes: row.productFreshnessMinutes,
    orderFreshnessMinutes: row.orderFreshnessMinutes,
    lastSyncStatus: row.lastSyncStatus as ExternalDataSyncStatus | undefined,
    lastSyncError: optionalString(row.lastSyncError),
    lastSyncAt: dateToString(row.lastSyncAt),
    lastSuccessfulSyncAt: dateToString(row.lastSuccessfulSyncAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapSyncRun(row: ExternalDataSyncRunRow): ExternalDataSyncRun {
  return {
    id: row.id,
    dataSourceId: row.dataSourceId,
    clientId: row.clientId,
    status: row.status as ExternalDataSyncStatus,
    startedAt: row.startedAt.toISOString(),
    finishedAt: dateToString(row.finishedAt),
    productsSeen: row.productsSeen,
    productsImported: row.productsImported,
    ordersSeen: row.ordersSeen,
    ordersImported: row.ordersImported,
    validationWarnings: coerceWarnings(row.validationWarnings),
    errorMessage: optionalString(row.errorMessage),
  };
}

function mapProduct(row: ProductRecordRow): ProductRecord {
  return {
    id: row.id,
    dataSourceId: row.dataSourceId,
    clientId: row.clientId,
    rowKey: row.rowKey,
    sku: optionalString(row.sku),
    productName: row.productName,
    variant: optionalString(row.variant),
    availabilityStatus: row.availabilityStatus as ProductAvailabilityStatus,
    stockQuantity: row.stockQuantity ?? undefined,
    price: row.price ?? undefined,
    currency: optionalString(row.currency),
    productUrl: optionalString(row.productUrl),
    availabilityNote: optionalString(row.availabilityNote),
    sourceUpdatedAt: dateToString(row.sourceUpdatedAt),
    lastSyncedAt: row.lastSyncedAt.toISOString(),
    rawRow: row.rawRow !== null && typeof row.rawRow === 'object' && !Array.isArray(row.rawRow) ? row.rawRow as JsonRecord : {},
  };
}

function mapOrder(row: OrderRecordRow): OrderRecord {
  return {
    id: row.id,
    dataSourceId: row.dataSourceId,
    clientId: row.clientId,
    rowKey: row.rowKey,
    orderId: row.orderId,
    customerPhone: optionalString(row.customerPhone),
    customerEmail: optionalString(row.customerEmail),
    customerName: optionalString(row.customerName),
    orderStatus: row.orderStatus as OrderStatus,
    paymentStatus: row.paymentStatus as PaymentStatus | undefined,
    trackingUrl: optionalString(row.trackingUrl),
    orderNote: optionalString(row.orderNote),
    sourceUpdatedAt: dateToString(row.sourceUpdatedAt),
    lastSyncedAt: row.lastSyncedAt.toISOString(),
    rawRow: row.rawRow !== null && typeof row.rawRow === 'object' && !Array.isArray(row.rawRow) ? row.rawRow as JsonRecord : {},
  };
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);

  const headers = rows[0]?.map(normalizeHeader) ?? [];
  return rows.slice(1).map((cells) => {
    const item: CsvRow = {};
    headers.forEach((header, index) => {
      if (header !== '') item[header] = cells[index]?.trim() ?? '';
    });
    return item;
  });
}

function extractSpreadsheetId(sheetUrl: string) {
  return sheetUrl.match(/\/spreadsheets\/d\/([^/?#]+)/)?.[1];
}

function assertAllowedSheetUrl(sheetUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(sheetUrl);
  } catch {
    throw new BadRequestException('Enter a valid Google Sheet or CSV export URL.');
  }

  const isGoogleSheet = parsed.hostname === 'docs.google.com' && parsed.pathname.includes('/spreadsheets/');
  const isCsvExport = parsed.searchParams.get('output') === 'csv' || parsed.pathname.toLowerCase().endsWith('.csv');
  if (!isGoogleSheet && !isCsvExport) {
    throw new BadRequestException('Only Google Sheets links or CSV export URLs are supported.');
  }
}

function buildCsvUrl(source: ExternalDataSource, tabName: string) {
  const url = new URL(source.sheetUrl);
  if (url.searchParams.get('output') === 'csv' || url.pathname.toLowerCase().endsWith('.csv')) {
    return source.sheetUrl;
  }

  if (source.spreadsheetId === undefined) {
    throw new BadRequestException('Google Sheet URL must include a spreadsheet id.');
  }

  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(source.spreadsheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
}

@Injectable()
export class ExternalDataService {
  constructor(private readonly prisma: PrismaService) {}

  async listSources(clientId: string): Promise<ExternalDataSource[]> {
    const rows = await this.prisma.$queryRaw<ExternalDataSourceRow[]>`
      SELECT * FROM "ExternalDataSource"
      WHERE "clientId" = ${clientId}
      ORDER BY "createdAt" DESC
    `;
    return rows.map(mapSource);
  }

  async getSource(clientId: string, sourceId: string): Promise<ExternalDataSource> {
    const rows = await this.prisma.$queryRaw<ExternalDataSourceRow[]>`
      SELECT * FROM "ExternalDataSource"
      WHERE "clientId" = ${clientId} AND "id" = ${sourceId}
      LIMIT 1
    `;
    const source = rows[0];
    if (source === undefined) throw new NotFoundException('External data source not found.');
    return mapSource(source);
  }

  async saveGoogleSheetSource(clientId: string, input: SaveGoogleSheetInput): Promise<ExternalDataSource> {
    const sheetUrl = input.sheetUrl.trim();
    assertAllowedSheetUrl(sheetUrl);
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    const existing = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "ExternalDataSource"
      WHERE "clientId" = ${clientId} AND "sourceType" = 'google_sheet' AND "status" <> 'paused'
      ORDER BY "createdAt" ASC
      LIMIT 1
    `;

    const id = existing[0]?.id ?? randomUUID();
    const name = input.name?.trim() || 'Google Sheet';
    const productsTabName = input.productsTabName?.trim() || 'Products';
    const ordersTabName = input.ordersTabName?.trim() || null;
    const syncIntervalMinutes = input.syncIntervalMinutes ?? 15;
    const productFreshnessMinutes = input.productFreshnessMinutes ?? 15;
    const orderFreshnessMinutes = input.orderFreshnessMinutes ?? 5;

    if (existing[0] === undefined) {
      await this.prisma.$executeRaw`
        INSERT INTO "ExternalDataSource" (
          "id", "clientId", "sourceType", "status", "name", "sheetUrl", "spreadsheetId",
          "productsTabName", "ordersTabName", "syncIntervalMinutes", "productFreshnessMinutes", "orderFreshnessMinutes", "updatedAt"
        )
        VALUES (
          ${id}, ${clientId}, 'google_sheet', 'active', ${name}, ${sheetUrl}, ${spreadsheetId ?? null},
          ${productsTabName}, ${ordersTabName}, ${syncIntervalMinutes}, ${productFreshnessMinutes}, ${orderFreshnessMinutes}, CURRENT_TIMESTAMP
        )
      `;
    } else {
      await this.prisma.$executeRaw`
        UPDATE "ExternalDataSource"
        SET "status" = 'active',
            "name" = ${name},
            "sheetUrl" = ${sheetUrl},
            "spreadsheetId" = ${spreadsheetId ?? null},
            "productsTabName" = ${productsTabName},
            "ordersTabName" = ${ordersTabName},
            "syncIntervalMinutes" = ${syncIntervalMinutes},
            "productFreshnessMinutes" = ${productFreshnessMinutes},
            "orderFreshnessMinutes" = ${orderFreshnessMinutes},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id} AND "clientId" = ${clientId}
      `;
    }

    return this.getSource(clientId, id);
  }

  async syncSource(clientId: string, sourceId: string): Promise<{ source: ExternalDataSource; syncRun: ExternalDataSyncRun }> {
    const source = await this.getSource(clientId, sourceId);
    const syncRunId = randomUUID();

    await this.prisma.$executeRaw`
      INSERT INTO "ExternalDataSyncRun" ("id", "dataSourceId", "clientId", "status")
      VALUES (${syncRunId}, ${source.id}, ${clientId}, 'running')
    `;

    try {
      const products = await this.fetchProducts(source);
      const orders = source.ordersTabName === undefined ? { rows: [], imported: [], warnings: [] } : await this.fetchOrders(source);
      const warnings = [...products.warnings, ...orders.warnings];

      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM "ProductRecord" WHERE "dataSourceId" = ${source.id}`;
        await tx.$executeRaw`DELETE FROM "OrderRecord" WHERE "dataSourceId" = ${source.id}`;

        for (const product of products.imported) {
          await tx.$executeRaw`
            INSERT INTO "ProductRecord" (
              "id", "dataSourceId", "clientId", "rowKey", "sku", "productName", "variant", "availabilityStatus",
              "stockQuantity", "price", "currency", "productUrl", "availabilityNote", "sourceUpdatedAt", "rawRow"
            )
            VALUES (
              ${randomUUID()}, ${source.id}, ${clientId}, ${product.rowKey}, ${product.sku ?? null}, ${product.productName},
              ${product.variant ?? null}, ${product.availabilityStatus}, ${product.stockQuantity ?? null}, ${product.price ?? null},
              ${product.currency ?? null}, ${product.productUrl ?? null}, ${product.availabilityNote ?? null},
              ${product.sourceUpdatedAt === undefined ? null : new Date(product.sourceUpdatedAt)}, ${JSON.stringify(product.rawRow)}::jsonb
            )
          `;
        }

        for (const order of orders.imported) {
          await tx.$executeRaw`
            INSERT INTO "OrderRecord" (
              "id", "dataSourceId", "clientId", "rowKey", "orderId", "customerPhone", "customerEmail", "customerName",
              "orderStatus", "paymentStatus", "trackingUrl", "orderNote", "sourceUpdatedAt", "rawRow"
            )
            VALUES (
              ${randomUUID()}, ${source.id}, ${clientId}, ${order.rowKey}, ${order.orderId}, ${order.customerPhone ?? null},
              ${order.customerEmail ?? null}, ${order.customerName ?? null}, ${order.orderStatus}, ${order.paymentStatus ?? null},
              ${order.trackingUrl ?? null}, ${order.orderNote ?? null},
              ${order.sourceUpdatedAt === undefined ? null : new Date(order.sourceUpdatedAt)}, ${JSON.stringify(order.rawRow)}::jsonb
            )
          `;
        }

        await tx.$executeRaw`
          UPDATE "ExternalDataSyncRun"
          SET "status" = 'succeeded',
              "finishedAt" = CURRENT_TIMESTAMP,
              "productsSeen" = ${products.rows.length},
              "productsImported" = ${products.imported.length},
              "ordersSeen" = ${orders.rows.length},
              "ordersImported" = ${orders.imported.length},
              "validationWarnings" = ${JSON.stringify(warnings)}::jsonb
          WHERE "id" = ${syncRunId}
        `;
        await tx.$executeRaw`
          UPDATE "ExternalDataSource"
          SET "lastSyncStatus" = 'succeeded',
              "lastSyncError" = NULL,
              "lastSyncAt" = CURRENT_TIMESTAMP,
              "lastSuccessfulSyncAt" = CURRENT_TIMESTAMP,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${source.id}
        `;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync Google Sheet.';
      await this.prisma.$executeRaw`
        UPDATE "ExternalDataSyncRun"
        SET "status" = 'failed',
            "finishedAt" = CURRENT_TIMESTAMP,
            "errorMessage" = ${message}
        WHERE "id" = ${syncRunId}
      `;
      await this.prisma.$executeRaw`
        UPDATE "ExternalDataSource"
        SET "lastSyncStatus" = 'failed',
            "lastSyncError" = ${message},
            "lastSyncAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${source.id}
      `;
      throw new BadRequestException(message);
    }

    const [updatedSource, syncRun] = await Promise.all([
      this.getSource(clientId, source.id),
      this.getSyncRun(clientId, syncRunId),
    ]);
    return { source: updatedSource, syncRun };
  }

  async listProducts(clientId: string, sourceId?: string): Promise<ProductRecord[]> {
    const sourceFilter = sourceId === undefined ? Prisma.empty : Prisma.sql`AND "dataSourceId" = ${sourceId}`;
    const rows = await this.prisma.$queryRaw<ProductRecordRow[]>`
      SELECT * FROM "ProductRecord"
      WHERE "clientId" = ${clientId} ${sourceFilter}
      ORDER BY "productName" ASC, "variant" ASC
      LIMIT 500
    `;
    return rows.map(mapProduct);
  }

  async listOrders(clientId: string, sourceId?: string): Promise<OrderRecord[]> {
    const sourceFilter = sourceId === undefined ? Prisma.empty : Prisma.sql`AND "dataSourceId" = ${sourceId}`;
    const rows = await this.prisma.$queryRaw<OrderRecordRow[]>`
      SELECT * FROM "OrderRecord"
      WHERE "clientId" = ${clientId} ${sourceFilter}
      ORDER BY "lastSyncedAt" DESC
      LIMIT 500
    `;
    return rows.map(mapOrder);
  }

  private async getSyncRun(clientId: string, syncRunId: string): Promise<ExternalDataSyncRun> {
    const rows = await this.prisma.$queryRaw<ExternalDataSyncRunRow[]>`
      SELECT * FROM "ExternalDataSyncRun"
      WHERE "clientId" = ${clientId} AND "id" = ${syncRunId}
      LIMIT 1
    `;
    const run = rows[0];
    if (run === undefined) throw new NotFoundException('External data sync run not found.');
    return mapSyncRun(run);
  }

  private async fetchProducts(source: ExternalDataSource) {
    const rows = parseCsv(await this.fetchCsv(buildCsvUrl(source, source.productsTabName)));
    const warnings: Warning[] = [];
    const imported: ParsedProduct[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const sku = toOptionalString(row.sku);
      const productName = toOptionalString(row.productname);
      if (sku === undefined && productName === undefined) {
        warnings.push({ tab: 'Products', row: rowNumber, field: 'sku/product_name', message: 'Product row needs an SKU or product name.' });
        return;
      }

      const rawStatus = normalizeStatus(row.availabilitystatus ?? '');
      const availabilityStatus: ProductAvailabilityStatus = allowedAvailabilityStatuses.has(rawStatus as ProductAvailabilityStatus)
        ? rawStatus as ProductAvailabilityStatus
        : 'unknown';
      if (availabilityStatus === 'unknown' && rawStatus !== 'unknown') {
        warnings.push({ tab: 'Products', row: rowNumber, field: 'availability_status', message: 'Unknown availability status; imported as unknown.' });
      }

      imported.push({
        rowKey: sku ?? `${productName ?? 'product'}:${toOptionalString(row.variant) ?? ''}`.toLowerCase(),
        sku,
        productName: productName ?? sku ?? 'Unnamed product',
        variant: toOptionalString(row.variant),
        availabilityStatus,
        stockQuantity: toNumber(row.stockquantity),
        price: toNumber(row.price),
        currency: toOptionalString(row.currency),
        productUrl: toOptionalString(row.producturl),
        availabilityNote: toOptionalString(row.availabilitynote),
        sourceUpdatedAt: toDate(row.lastupdatedat)?.toISOString(),
        rawRow: row,
      });
    });

    return { rows, imported, warnings };
  }

  private async fetchOrders(source: ExternalDataSource) {
    const rows = parseCsv(await this.fetchCsv(buildCsvUrl(source, source.ordersTabName ?? 'Orders')));
    const warnings: Warning[] = [];
    const imported: ParsedOrder[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const orderId = toOptionalString(row.orderid);
      if (orderId === undefined) {
        warnings.push({ tab: 'Orders', row: rowNumber, field: 'order_id', message: 'Order row needs an order ID.' });
        return;
      }

      const rawOrderStatus = normalizeStatus(row.orderstatus ?? '');
      const orderStatus: OrderStatus = allowedOrderStatuses.has(rawOrderStatus as OrderStatus) ? rawOrderStatus as OrderStatus : 'unknown';
      if (orderStatus === 'unknown' && rawOrderStatus !== 'unknown') {
        warnings.push({ tab: 'Orders', row: rowNumber, field: 'order_status', message: 'Unknown order status; imported as unknown.' });
      }

      const rawPaymentStatus = normalizeStatus(row.paymentstatus ?? '');
      const paymentStatus = rawPaymentStatus === ''
        ? undefined
        : allowedPaymentStatuses.has(rawPaymentStatus as PaymentStatus)
          ? rawPaymentStatus as PaymentStatus
          : 'unknown';
      if (paymentStatus === 'unknown' && rawPaymentStatus !== 'unknown') {
        warnings.push({ tab: 'Orders', row: rowNumber, field: 'payment_status', message: 'Unknown payment status; imported as unknown.' });
      }

      imported.push({
        rowKey: orderId,
        orderId,
        customerPhone: row.customerphone === undefined ? undefined : normalizePhone(row.customerphone),
        customerEmail: toOptionalString(row.customeremail),
        customerName: toOptionalString(row.customername),
        orderStatus,
        paymentStatus,
        trackingUrl: toOptionalString(row.trackingurl),
        orderNote: toOptionalString(row.ordernote),
        sourceUpdatedAt: toDate(row.lastupdatedat)?.toISOString(),
        rawRow: row,
      });
    });

    return { rows, imported, warnings };
  }

  private async fetchCsv(url: string) {
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) {
      throw new Error(`Sheet fetch failed with status ${response.status}.`);
    }
    return response.text();
  }
}
