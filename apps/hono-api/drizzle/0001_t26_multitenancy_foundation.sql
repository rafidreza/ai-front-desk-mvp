-- T26 — Multitenancy foundation
-- Adds operator→client access mapping and per-tenant encrypted secret storage.
-- Hand-authored to match src/db/schema.ts. If you regenerate with `npm run db:generate`,
-- reconcile against this file. Idempotent-friendly (IF NOT EXISTS) for safe re-runs.

CREATE TABLE IF NOT EXISTS "OperatorClientAccess" (
  "id" text PRIMARY KEY NOT NULL,
  "operatorId" text NOT NULL,
  "clientId" text NOT NULL,
  "role" text NOT NULL DEFAULT 'operator',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "OperatorClientAccess_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "OperatorClientAccess_operatorId_clientId_key"
  ON "OperatorClientAccess" ("operatorId", "clientId");
CREATE INDEX IF NOT EXISTS "OperatorClientAccess_operatorId_idx"
  ON "OperatorClientAccess" ("operatorId");
CREATE INDEX IF NOT EXISTS "OperatorClientAccess_clientId_idx"
  ON "OperatorClientAccess" ("clientId");

CREATE TABLE IF NOT EXISTS "TenantSecret" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "key" text NOT NULL,
  "encryptedValue" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "TenantSecret_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantSecret_clientId_key_key"
  ON "TenantSecret" ("clientId", "key");
CREATE INDEX IF NOT EXISTS "TenantSecret_clientId_idx"
  ON "TenantSecret" ("clientId");
