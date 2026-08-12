-- T9 — Action-class governance
-- Adds status/decision to CallAction and a per-tenant ActionPolicy (approval thresholds).
-- Hand-authored to match src/db/schema.ts.

ALTER TABLE "CallAction" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'auto_executed';
ALTER TABLE "CallAction" ADD COLUMN IF NOT EXISTS "decidedAt" timestamp;
CREATE INDEX IF NOT EXISTS "CallAction_clientId_status_idx" ON "CallAction" ("clientId", "status");

CREATE TABLE IF NOT EXISTS "ActionPolicy" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "ActionPolicy_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "ActionPolicy_clientId_key" ON "ActionPolicy" ("clientId");
