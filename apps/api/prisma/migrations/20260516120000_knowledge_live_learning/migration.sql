-- T39 live learning loop: link knowledge-base candidate entries back to the
-- ticket whose resolution produced them. Nullable so existing rows stay valid.

ALTER TABLE "KnowledgeEntry" ADD COLUMN "sourceTicketId" TEXT;

CREATE INDEX "KnowledgeEntry_sourceTicketId_idx" ON "KnowledgeEntry"("sourceTicketId");
