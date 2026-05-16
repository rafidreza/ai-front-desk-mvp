ALTER TABLE "Conversation"
  ADD COLUMN "autoQaScore" DOUBLE PRECISION,
  ADD COLUMN "autoQaGrade" TEXT,
  ADD COLUMN "autoQaDefects" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "autoQaReason" TEXT,
  ADD COLUMN "autoQaAt" TIMESTAMP(3),
  ADD COLUMN "autoQaVersion" TEXT;

CREATE INDEX "Conversation_clientId_autoQaGrade_idx" ON "Conversation"("clientId", "autoQaGrade");
