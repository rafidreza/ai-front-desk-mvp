-- T14 — Groundedness verdicts
-- Per-turn judgement of whether an answer is supported by its KB evidence.
-- Hand-authored to match src/db/schema.ts.

CREATE TABLE IF NOT EXISTS "GroundednessVerdict" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "callId" text NOT NULL,
  "turnIndex" integer,
  "score" double precision NOT NULL,
  "verdict" text NOT NULL,
  "reason" text,
  "at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "GroundednessVerdict_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade,
  CONSTRAINT "GroundednessVerdict_callId_Call_id_fk"
    FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "GroundednessVerdict_clientId_idx" ON "GroundednessVerdict" ("clientId");
CREATE INDEX IF NOT EXISTS "GroundednessVerdict_callId_idx" ON "GroundednessVerdict" ("callId");
CREATE INDEX IF NOT EXISTS "GroundednessVerdict_verdict_idx" ON "GroundednessVerdict" ("verdict");
