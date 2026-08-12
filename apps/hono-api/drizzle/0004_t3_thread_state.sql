-- T3 — Thread + structured thread state
-- Per-customer thread, its structured field state, and per-tenant field schema.
-- Also links Call -> Thread. Hand-authored to match src/db/schema.ts.

ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "threadId" text;
CREATE INDEX IF NOT EXISTS "Call_threadId_idx" ON "Call" ("threadId");

CREATE TABLE IF NOT EXISTS "Thread" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "identity" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "lastSeenAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "Thread_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "Thread_clientId_identity_key"
  ON "Thread" ("clientId", "identity");
CREATE INDEX IF NOT EXISTS "Thread_clientId_idx" ON "Thread" ("clientId");

CREATE TABLE IF NOT EXISTS "ThreadState" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "threadId" text NOT NULL,
  "fields" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "ThreadState_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade,
  CONSTRAINT "ThreadState_threadId_Thread_id_fk"
    FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "ThreadState_threadId_key" ON "ThreadState" ("threadId");
CREATE INDEX IF NOT EXISTS "ThreadState_clientId_idx" ON "ThreadState" ("clientId");

CREATE TABLE IF NOT EXISTS "ThreadStateFieldSchema" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "schema" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "ThreadStateFieldSchema_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "ThreadStateFieldSchema_clientId_key"
  ON "ThreadStateFieldSchema" ("clientId");
