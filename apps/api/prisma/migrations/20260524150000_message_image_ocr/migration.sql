ALTER TABLE "Message"
  ADD COLUMN "extractedText" TEXT,
  ADD COLUMN "matchedProducts" JSONB NOT NULL DEFAULT '[]';
