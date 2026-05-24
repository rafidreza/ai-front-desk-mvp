ALTER TABLE "Message"
  ADD COLUMN "attachmentType" TEXT,
  ADD COLUMN "attachmentUrl" TEXT,
  ADD COLUMN "transcript" TEXT;

CREATE INDEX "Message_attachmentType_idx" ON "Message"("attachmentType");
