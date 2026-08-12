-- T12 — Client voice config
-- Per-tenant voice-agent configuration set during self-serve onboarding.
-- Hand-authored to match src/db/schema.ts.

CREATE TABLE IF NOT EXISTS "ClientVoiceConfig" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "ClientVoiceConfig_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientVoiceConfig_clientId_key" ON "ClientVoiceConfig" ("clientId");
