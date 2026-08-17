-- Client management fields used by the Cloudflare Hono API.
-- Older Prisma migrations already added these in shared environments; keep
-- this idempotent so a fresh Hono-managed database can catch up safely.

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "lifecycleStage" TEXT NOT NULL DEFAULT 'lead';
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "conversionChecklist" JSONB;

CREATE INDEX IF NOT EXISTS "Client_status_idx" ON "Client" ("status");
CREATE INDEX IF NOT EXISTS "Client_lifecycleStage_idx" ON "Client" ("lifecycleStage");
