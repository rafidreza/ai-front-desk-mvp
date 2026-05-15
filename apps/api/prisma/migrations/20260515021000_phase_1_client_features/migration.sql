ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "ownerName" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "businessCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingStatus" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "whatsappPoc" TEXT,
  ADD COLUMN IF NOT EXISTS "digestEmail" TEXT;

ALTER TABLE "KnowledgeEntry"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "csatScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "csatComment" TEXT,
  ADD COLUMN IF NOT EXISTS "csatAt" TIMESTAMP(3);

ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "salesRecoveredEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "KnowledgeEntry_clientId_status_idx" ON "KnowledgeEntry"("clientId", "status");
CREATE INDEX IF NOT EXISTS "Conversation_clientId_csatScore_idx" ON "Conversation"("clientId", "csatScore");
