CREATE TABLE "KnowledgeChangeRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "targetEntryId" TEXT,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "proposedTitle" TEXT NOT NULL,
    "proposedAnswer" TEXT NOT NULL,
    "proposedKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "proposedCategory" TEXT NOT NULL DEFAULT 'general',
    "requesterNote" TEXT,
    "reviewerNote" TEXT,
    "clientVisibleMessage" TEXT,
    "internalNote" TEXT,
    "submittedBy" TEXT NOT NULL DEFAULT 'client',
    "reviewedBy" TEXT,
    "publishedEntryId" TEXT,
    "currentEntrySnapshot" JSONB,
    "decisionSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "KnowledgeChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeChangeRequest_clientId_idx" ON "KnowledgeChangeRequest"("clientId");
CREATE INDEX "KnowledgeChangeRequest_clientId_status_idx" ON "KnowledgeChangeRequest"("clientId", "status");
CREATE INDEX "KnowledgeChangeRequest_targetEntryId_idx" ON "KnowledgeChangeRequest"("targetEntryId");
CREATE INDEX "KnowledgeChangeRequest_status_urgency_idx" ON "KnowledgeChangeRequest"("status", "urgency");
CREATE INDEX "KnowledgeChangeRequest_createdAt_idx" ON "KnowledgeChangeRequest"("createdAt");

ALTER TABLE "KnowledgeChangeRequest"
  ADD CONSTRAINT "KnowledgeChangeRequest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeChangeRequest"
  ADD CONSTRAINT "KnowledgeChangeRequest_targetEntryId_fkey"
  FOREIGN KEY ("targetEntryId") REFERENCES "KnowledgeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
