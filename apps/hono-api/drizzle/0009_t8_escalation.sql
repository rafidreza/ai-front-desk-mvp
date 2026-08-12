-- T8 — Escalation to human anchor
-- One escalation per call/thread handed to a human, with reason + context payload.
-- Hand-authored to match src/db/schema.ts.

CREATE TABLE IF NOT EXISTS "Escalation" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "threadId" text,
  "callId" text,
  "reason" text NOT NULL,
  "mode" text NOT NULL DEFAULT 'async',
  "status" text NOT NULL DEFAULT 'open',
  "assignedTo" text,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "resolvedAt" timestamp,
  CONSTRAINT "Escalation_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "Escalation_clientId_status_idx" ON "Escalation" ("clientId", "status");
CREATE INDEX IF NOT EXISTS "Escalation_clientId_idx" ON "Escalation" ("clientId");
