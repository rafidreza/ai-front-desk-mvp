CREATE TABLE "KnowledgeEntryVersion" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "keywords" TEXT[],
  "confidenceBoost" DOUBLE PRECISION,
  "status" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeEntryVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeEntryVersion_entryId_idx" ON "KnowledgeEntryVersion"("entryId");
CREATE INDEX "KnowledgeEntryVersion_clientId_idx" ON "KnowledgeEntryVersion"("clientId");
CREATE INDEX "KnowledgeEntryVersion_action_idx" ON "KnowledgeEntryVersion"("action");

ALTER TABLE "KnowledgeEntryVersion" ADD CONSTRAINT "KnowledgeEntryVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "KnowledgeEntryVersion" (
  "id", "entryId", "clientId", "version", "title", "answer", "keywords", "confidenceBoost", "status", "action", "actorId", "createdAt"
)
SELECT
  "id" || ':v:' || "version", "id", "clientId", "version", "title", "answer", "keywords", "confidenceBoost", "status", 'baseline', 'migration', "updatedAt"
FROM "KnowledgeEntry";
