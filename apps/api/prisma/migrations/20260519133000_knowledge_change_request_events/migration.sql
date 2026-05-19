CREATE TABLE "KnowledgeChangeRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChangeRequestEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeChangeRequestEvent_requestId_idx" ON "KnowledgeChangeRequestEvent"("requestId");
CREATE INDEX "KnowledgeChangeRequestEvent_eventType_idx" ON "KnowledgeChangeRequestEvent"("eventType");
CREATE INDEX "KnowledgeChangeRequestEvent_createdAt_idx" ON "KnowledgeChangeRequestEvent"("createdAt");

ALTER TABLE "KnowledgeChangeRequestEvent"
  ADD CONSTRAINT "KnowledgeChangeRequestEvent_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "KnowledgeChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "KnowledgeChangeRequestEvent" ("id", "requestId", "eventType", "actorId", "note", "payload", "createdAt")
SELECT
  "id" || ':submitted',
  "id",
  'submitted',
  "submittedBy",
  "requesterNote",
  jsonb_build_object('requestType', "requestType", 'status', "status", 'urgency', "urgency"),
  "createdAt"
FROM "KnowledgeChangeRequest";
