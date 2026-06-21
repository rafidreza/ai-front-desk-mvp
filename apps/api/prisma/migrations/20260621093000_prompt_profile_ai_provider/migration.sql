ALTER TABLE "PromptProfile"
  ADD COLUMN "aiProvider" TEXT,
  ADD COLUMN "aiModel" TEXT;

ALTER TABLE "PromptProfileVersion"
  ADD COLUMN "aiProvider" TEXT,
  ADD COLUMN "aiModel" TEXT;
