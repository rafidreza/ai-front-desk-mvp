-- Combined voice-schema migrations (T26,T1,T4,T3,T24,T9,T14,T7,T8,T13,T27,T12). Idempotent.
-- Run once against the staging Neon DB (Neon console SQL Editor, or psql).

-- ===== 0001_t26_multitenancy_foundation.sql =====
-- T26 — Multitenancy foundation
-- Adds operator→client access mapping and per-tenant encrypted secret storage.
-- Hand-authored to match src/db/schema.ts. If you regenerate with `npm run db:generate`,
-- reconcile against this file. Idempotent-friendly (IF NOT EXISTS) for safe re-runs.

CREATE TABLE IF NOT EXISTS "OperatorClientAccess" (
  "id" text PRIMARY KEY NOT NULL,
  "operatorId" text NOT NULL,
  "clientId" text NOT NULL,
  "role" text NOT NULL DEFAULT 'operator',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "OperatorClientAccess_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "OperatorClientAccess_operatorId_clientId_key"
  ON "OperatorClientAccess" ("operatorId", "clientId");
CREATE INDEX IF NOT EXISTS "OperatorClientAccess_operatorId_idx"
  ON "OperatorClientAccess" ("operatorId");
CREATE INDEX IF NOT EXISTS "OperatorClientAccess_clientId_idx"
  ON "OperatorClientAccess" ("clientId");

CREATE TABLE IF NOT EXISTS "TenantSecret" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "key" text NOT NULL,
  "encryptedValue" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "TenantSecret_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantSecret_clientId_key_key"
  ON "TenantSecret" ("clientId", "key");
CREATE INDEX IF NOT EXISTS "TenantSecret_clientId_idx"
  ON "TenantSecret" ("clientId");

-- ===== 0002_t1_telephony_ingress.sql =====
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

-- ===== 0003_t4_call_persistence.sql =====
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

-- ===== 0004_t3_thread_state.sql =====
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

-- ===== 0005_t24_connector_framework.sql =====
-- T24 — Connector framework
-- Per-tenant external-system connectors + a durable write queue for graceful degradation.
-- Credentials are NOT stored here; config references a TenantSecret key (T26).
-- Hand-authored to match src/db/schema.ts.

CREATE TABLE IF NOT EXISTS "Connector" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "type" text NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'active',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "Connector_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "Connector_clientId_type_key" ON "Connector" ("clientId", "type");
CREATE INDEX IF NOT EXISTS "Connector_clientId_idx" ON "Connector" ("clientId");

CREATE TABLE IF NOT EXISTS "ConnectorWriteQueue" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL,
  "connectorId" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "lastError" text,
  "nextAttemptAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "ConnectorWriteQueue_clientId_Client_id_fk"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE cascade,
  CONSTRAINT "ConnectorWriteQueue_connectorId_Connector_id_fk"
    FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConnectorWriteQueue_connectorId_idempotencyKey_key"
  ON "ConnectorWriteQueue" ("connectorId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "ConnectorWriteQueue_clientId_status_idx"
  ON "ConnectorWriteQueue" ("clientId", "status");

-- ===== 0006_t9_action_governance.sql =====
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

-- ===== 0007_t14_groundedness.sql =====
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

-- ===== 0008_t7_lead_qualification.sql =====
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

-- ===== 0009_t8_escalation.sql =====
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

-- ===== 0010_t13_interaction_scoring.sql =====
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

-- ===== 0011_t12_client_voice_config.sql =====
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

-- ===== 0012_t27_audit_log.sql =====
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

-- ===== 0013_client_management_fields.sql =====
-- Client management fields used by the Cloudflare Hono API.
-- Older Prisma migrations already added these in shared environments; keep
-- this idempotent so a fresh Hono-managed database can catch up safely.

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "lifecycleStage" TEXT NOT NULL DEFAULT 'lead';
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "conversionChecklist" JSONB;

CREATE INDEX IF NOT EXISTS "Client_status_idx" ON "Client" ("status");
CREATE INDEX IF NOT EXISTS "Client_lifecycleStage_idx" ON "Client" ("lifecycleStage");
