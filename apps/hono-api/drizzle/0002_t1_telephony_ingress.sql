-- T1 — Telephony ingress (control/data plane)
-- Number -> client mapping (tenant resolution) and the Call lifecycle record.
-- Hand-authored to match src/db/schema.ts. Idempotent-friendly for safe re-runs.

CREATE TABLE IF NOT EXISTS "TenantPhoneNumber" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "e164Number" text NOT NULL,
  "label" text,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "TenantPhoneNumber_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantPhoneNumber_e164Number_key"
  ON "TenantPhoneNumber" ("e164Number");
CREATE INDEX IF NOT EXISTS "TenantPhoneNumber_clientId_idx"
  ON "TenantPhoneNumber" ("clientId");
CREATE INDEX IF NOT EXISTS "TenantPhoneNumber_active_idx"
  ON "TenantPhoneNumber" ("active");

CREATE TABLE IF NOT EXISTS "Call" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "phoneNumberId" text,
  "dialledNumber" text NOT NULL,
  "callerIdMasked" text,
  "direction" text NOT NULL DEFAULT 'inbound',
  "status" text NOT NULL DEFAULT 'ringing',
  "languagePosture" text,
  "recordingUrl" text,
  "endReason" text,
  "durationS" integer,
  "outcome" text,
  "startedAt" timestamp NOT NULL DEFAULT now(),
  "endedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "Call_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade,
  CONSTRAINT "Call_phoneNumberId_TenantPhoneNumber_id_fk"
    FOREIGN KEY ("phoneNumberId") REFERENCES "TenantPhoneNumber"("id") ON DELETE set null
);

CREATE INDEX IF NOT EXISTS "Call_clientId_idx" ON "Call" ("clientId");
CREATE INDEX IF NOT EXISTS "Call_clientId_status_idx" ON "Call" ("clientId", "status");
CREATE INDEX IF NOT EXISTS "Call_phoneNumberId_idx" ON "Call" ("phoneNumberId");
CREATE INDEX IF NOT EXISTS "Call_startedAt_idx" ON "Call" ("startedAt");
