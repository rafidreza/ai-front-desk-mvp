CREATE TABLE "ExternalDataSource" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'google_sheet',
    "status" TEXT NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "sheetUrl" TEXT NOT NULL,
    "spreadsheetId" TEXT,
    "productsTabName" TEXT NOT NULL DEFAULT 'Products',
    "ordersTabName" TEXT,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "productFreshnessMinutes" INTEGER NOT NULL DEFAULT 15,
    "orderFreshnessMinutes" INTEGER NOT NULL DEFAULT 5,
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalDataSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalDataSyncRun" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "productsSeen" INTEGER NOT NULL DEFAULT 0,
    "productsImported" INTEGER NOT NULL DEFAULT 0,
    "ordersSeen" INTEGER NOT NULL DEFAULT 0,
    "ordersImported" INTEGER NOT NULL DEFAULT 0,
    "validationWarnings" JSONB NOT NULL DEFAULT '[]',
    "errorMessage" TEXT,

    CONSTRAINT "ExternalDataSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductRecord" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "sku" TEXT,
    "productName" TEXT NOT NULL,
    "variant" TEXT,
    "availabilityStatus" TEXT NOT NULL,
    "stockQuantity" INTEGER,
    "price" DOUBLE PRECISION,
    "currency" TEXT,
    "productUrl" TEXT,
    "availabilityNote" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawRow" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ProductRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderRecord" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "orderStatus" TEXT NOT NULL,
    "paymentStatus" TEXT,
    "trackingUrl" TEXT,
    "orderNote" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawRow" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "OrderRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExternalDataSource_clientId_idx" ON "ExternalDataSource"("clientId");
CREATE INDEX "ExternalDataSource_clientId_status_idx" ON "ExternalDataSource"("clientId", "status");
CREATE INDEX "ExternalDataSource_lastSyncAt_idx" ON "ExternalDataSource"("lastSyncAt");

CREATE INDEX "ExternalDataSyncRun_dataSourceId_idx" ON "ExternalDataSyncRun"("dataSourceId");
CREATE INDEX "ExternalDataSyncRun_clientId_idx" ON "ExternalDataSyncRun"("clientId");
CREATE INDEX "ExternalDataSyncRun_status_startedAt_idx" ON "ExternalDataSyncRun"("status", "startedAt");

CREATE UNIQUE INDEX "ProductRecord_dataSourceId_rowKey_key" ON "ProductRecord"("dataSourceId", "rowKey");
CREATE INDEX "ProductRecord_clientId_idx" ON "ProductRecord"("clientId");
CREATE INDEX "ProductRecord_clientId_sku_idx" ON "ProductRecord"("clientId", "sku");
CREATE INDEX "ProductRecord_clientId_productName_idx" ON "ProductRecord"("clientId", "productName");
CREATE INDEX "ProductRecord_clientId_availabilityStatus_idx" ON "ProductRecord"("clientId", "availabilityStatus");

CREATE UNIQUE INDEX "OrderRecord_dataSourceId_rowKey_key" ON "OrderRecord"("dataSourceId", "rowKey");
CREATE UNIQUE INDEX "OrderRecord_dataSourceId_orderId_key" ON "OrderRecord"("dataSourceId", "orderId");
CREATE INDEX "OrderRecord_clientId_idx" ON "OrderRecord"("clientId");
CREATE INDEX "OrderRecord_clientId_orderId_idx" ON "OrderRecord"("clientId", "orderId");
CREATE INDEX "OrderRecord_clientId_orderStatus_idx" ON "OrderRecord"("clientId", "orderStatus");

ALTER TABLE "ExternalDataSource"
  ADD CONSTRAINT "ExternalDataSource_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalDataSyncRun"
  ADD CONSTRAINT "ExternalDataSyncRun_dataSourceId_fkey"
  FOREIGN KEY ("dataSourceId") REFERENCES "ExternalDataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalDataSyncRun"
  ADD CONSTRAINT "ExternalDataSyncRun_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductRecord"
  ADD CONSTRAINT "ProductRecord_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductRecord"
  ADD CONSTRAINT "ProductRecord_dataSourceId_fkey"
  FOREIGN KEY ("dataSourceId") REFERENCES "ExternalDataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderRecord"
  ADD CONSTRAINT "OrderRecord_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderRecord"
  ADD CONSTRAINT "OrderRecord_dataSourceId_fkey"
  FOREIGN KEY ("dataSourceId") REFERENCES "ExternalDataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
