-- T24 — Connector framework
-- Per-tenant external-system connectors + a durable write queue for graceful degradation.
-- Credentials are NOT stored here; config references a TenantSecret key (T26).
-- Hand-authored to match src/db/schema.ts.

CREATE TABLE IF NOT EXISTS "Connector" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "type" text NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'active',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "Connector_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "Connector_clientId_type_key" ON "Connector" ("clientId", "type");
CREATE INDEX IF NOT EXISTS "Connector_clientId_idx" ON "Connector" ("clientId");

CREATE TABLE IF NOT EXISTS "ConnectorWriteQueue" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "connectorId" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "lastError" text,
  "nextAttemptAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "ConnectorWriteQueue_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade,
  CONSTRAINT "ConnectorWriteQueue_connectorId_Connector_id_fk"
    FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConnectorWriteQueue_connectorId_idempotencyKey_key"
  ON "ConnectorWriteQueue" ("connectorId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "ConnectorWriteQueue_clientId_status_idx"
  ON "ConnectorWriteQueue" ("clientId", "status");
