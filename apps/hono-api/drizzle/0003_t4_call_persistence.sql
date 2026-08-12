-- T4 — Call persistence: transcript + actions
-- Diarized transcript segments (idempotent per turn) and per-call action records.
-- Also adds Call.scoreId (set later by T13). Hand-authored to match src/db/schema.ts.

ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "scoreId" text;

CREATE TABLE IF NOT EXISTS "TranscriptSegment" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "callId" text NOT NULL,
  "turnIndex" integer NOT NULL,
  "speaker" text NOT NULL,
  "text" text NOT NULL,
  "language" text,
  "latencyMs" integer,
  "startedAt" timestamp,
  "endedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "TranscriptSegment_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade,
  CONSTRAINT "TranscriptSegment_callId_Call_id_fk"
    FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "TranscriptSegment_callId_turnIndex_key"
  ON "TranscriptSegment" ("callId", "turnIndex");
CREATE INDEX IF NOT EXISTS "TranscriptSegment_clientId_idx" ON "TranscriptSegment" ("clientId");
CREATE INDEX IF NOT EXISTS "TranscriptSegment_callId_idx" ON "TranscriptSegment" ("callId");

CREATE TABLE IF NOT EXISTS "CallAction" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "callId" text NOT NULL,
  "turnIndex" integer,
  "type" text NOT NULL,
  "actionClass" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "result" jsonb,
  "approvedBy" text,
  "at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "CallAction_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade,
  CONSTRAINT "CallAction_callId_Call_id_fk"
    FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "CallAction_clientId_idx" ON "CallAction" ("clientId");
CREATE INDEX IF NOT EXISTS "CallAction_callId_idx" ON "CallAction" ("callId");
CREATE INDEX IF NOT EXISTS "CallAction_actionClass_idx" ON "CallAction" ("actionClass");
