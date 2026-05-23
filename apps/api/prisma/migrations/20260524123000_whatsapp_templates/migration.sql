CREATE TABLE "WhatsAppTemplate" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "languageCode" TEXT NOT NULL DEFAULT 'en_US',
  "category" TEXT NOT NULL DEFAULT 'utility',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "body" TEXT NOT NULL,
  "rejectionReason" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppTemplate_clientId_name_languageCode_key" ON "WhatsAppTemplate"("clientId", "name", "languageCode");
CREATE INDEX "WhatsAppTemplate_clientId_idx" ON "WhatsAppTemplate"("clientId");
CREATE INDEX "WhatsAppTemplate_status_idx" ON "WhatsAppTemplate"("status");

ALTER TABLE "WhatsAppTemplate"
  ADD CONSTRAINT "WhatsAppTemplate_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
