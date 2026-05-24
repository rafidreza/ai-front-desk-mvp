-- Allows the live-learning loop to mark a KB suggestion as
-- originating from a specific escalated ticket. The unique partial
-- index keeps the loop idempotent — a second escalation of the same
-- ticket cannot generate a duplicate suggestion.
ALTER TABLE "KnowledgeChangeRequest" ADD COLUMN "sourceTicketId" TEXT;

CREATE INDEX "KnowledgeChangeRequest_sourceTicketId_idx"
    ON "KnowledgeChangeRequest"("sourceTicketId");

CREATE UNIQUE INDEX "KnowledgeChangeRequest_clientId_sourceTicketId_key"
    ON "KnowledgeChangeRequest"("clientId", "sourceTicketId")
    WHERE "sourceTicketId" IS NOT NULL;
