-- T13 — Interaction scoring
-- Per-call rubric score + per-tenant rubric config.
-- Hand-authored to match src/db/schema.ts.

CREATE TABLE IF NOT EXISTS "CallScore" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "callId" text NOT NULL,
  "score" double precision NOT NULL,
  "breakdown" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "flagged" boolean NOT NULL DEFAULT false,
  "scoredAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "CallScore_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade,
  CONSTRAINT "CallScore_callId_Call_id_fk"
    FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "CallScore_clientId_idx" ON "CallScore" ("clientId");
CREATE INDEX IF NOT EXISTS "CallScore_callId_idx" ON "CallScore" ("callId");
CREATE INDEX IF NOT EXISTS "CallScore_clientId_flagged_idx" ON "CallScore" ("clientId", "flagged");

CREATE TABLE IF NOT EXISTS "ScoringRubric" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "ScoringRubric_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScoringRubric_clientId_key" ON "ScoringRubric" ("clientId");
