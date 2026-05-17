ALTER TABLE "KnowledgeEntry" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "KnowledgeEntryVersion" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general';

UPDATE "KnowledgeEntry"
SET "category" = CASE
  WHEN lower("title") LIKE '%delivery%' OR EXISTS (SELECT 1 FROM unnest("keywords") keyword WHERE lower(keyword) IN ('delivery', 'shipping', 'courier', 'dhaka')) THEN 'delivery'
  WHEN lower("title") LIKE '%payment%' OR EXISTS (SELECT 1 FROM unnest("keywords") keyword WHERE lower(keyword) IN ('payment', 'cod', 'bkash', 'nagad', 'cash on delivery')) THEN 'payment'
  WHEN lower("title") LIKE '%return%' OR lower("title") LIKE '%exchange%' OR EXISTS (SELECT 1 FROM unnest("keywords") keyword WHERE lower(keyword) IN ('return', 'exchange', 'refund', 'damaged', 'wrong')) THEN 'returns'
  WHEN lower("title") LIKE '%stock%' OR lower("title") LIKE '%size%' OR EXISTS (SELECT 1 FROM unnest("keywords") keyword WHERE lower(keyword) IN ('stock', 'size', 'color', 'variant')) THEN 'product'
  ELSE 'general'
END;

UPDATE "KnowledgeEntryVersion"
SET "category" = CASE
  WHEN lower("title") LIKE '%delivery%' OR EXISTS (SELECT 1 FROM unnest("keywords") keyword WHERE lower(keyword) IN ('delivery', 'shipping', 'courier', 'dhaka')) THEN 'delivery'
  WHEN lower("title") LIKE '%payment%' OR EXISTS (SELECT 1 FROM unnest("keywords") keyword WHERE lower(keyword) IN ('payment', 'cod', 'bkash', 'nagad', 'cash on delivery')) THEN 'payment'
  WHEN lower("title") LIKE '%return%' OR lower("title") LIKE '%exchange%' OR EXISTS (SELECT 1 FROM unnest("keywords") keyword WHERE lower(keyword) IN ('return', 'exchange', 'refund', 'damaged', 'wrong')) THEN 'returns'
  WHEN lower("title") LIKE '%stock%' OR lower("title") LIKE '%size%' OR EXISTS (SELECT 1 FROM unnest("keywords") keyword WHERE lower(keyword) IN ('stock', 'size', 'color', 'variant')) THEN 'product'
  ELSE 'general'
END;

CREATE INDEX "KnowledgeEntry_clientId_category_idx" ON "KnowledgeEntry"("clientId", "category");
