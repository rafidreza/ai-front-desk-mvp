CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "KnowledgeEntry"
  ADD COLUMN "embedding" vector(64),
  ADD COLUMN "embeddingText" TEXT,
  ADD COLUMN "embeddedAt" TIMESTAMP(3);

CREATE INDEX "KnowledgeEntry_clientId_status_embeddedAt_idx" ON "KnowledgeEntry"("clientId", "status", "embeddedAt");
CREATE INDEX "KnowledgeEntry_embedding_ivfflat_idx" ON "KnowledgeEntry" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 32);
