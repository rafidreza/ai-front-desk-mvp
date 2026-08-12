-- T7 — Lead qualification + ICP
-- Per-tenant ICP rules and the qualification verdicts they produce.
-- Hand-authored to match src/db/schema.ts.

CREATE TABLE IF NOT EXISTS "IcpRules" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "IcpRules_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "IcpRules_clientId_key" ON "IcpRules" ("clientId");

CREATE TABLE IF NOT EXISTS "LeadQualification" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "threadId" text NOT NULL,
  "callId" text,
  "qualified" boolean NOT NULL,
  "reason" text,
  "confidence" double precision NOT NULL DEFAULT 0,
  "scoredAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "LeadQualification_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade,
  CONSTRAINT "LeadQualification_threadId_Thread_id_fk"
    FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "LeadQualification_clientId_idx" ON "LeadQualification" ("clientId");
CREATE INDEX IF NOT EXISTS "LeadQualification_threadId_idx" ON "LeadQualification" ("threadId");
