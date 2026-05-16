-- T38 industry templates: stamp the originating template key on knowledge
-- entries created by `IndustryTemplateService.applyTemplate`. Nullable so prior
-- rows stay valid; indexed so per-client per-template lookups are cheap.

ALTER TABLE "KnowledgeEntry" ADD COLUMN "templateKey" TEXT;

CREATE INDEX "KnowledgeEntry_templateKey_idx" ON "KnowledgeEntry"("templateKey");
