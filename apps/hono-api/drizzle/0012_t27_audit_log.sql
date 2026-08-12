-- T27 — Governance / audit log
-- Append-only, tenant-scoped "who did what, when, why" trail.
-- Hand-authored to match src/db/schema.ts.

CREATE TABLE IF NOT EXISTS "AuditEvent" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "actorType" text NOT NULL,
  "actorId" text,
  "eventType" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "AuditEvent_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "AuditEvent_clientId_idx" ON "AuditEvent" ("clientId");
CREATE INDEX IF NOT EXISTS "AuditEvent_clientId_createdAt_idx" ON "AuditEvent" ("clientId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_eventType_idx" ON "AuditEvent" ("eventType");
