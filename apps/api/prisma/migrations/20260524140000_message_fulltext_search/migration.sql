-- Full-text search over Message.text using a Postgres generated tsvector
-- column. 'simple' is used (not 'english') so Bangla, Banglish, and mixed
-- content all get indexed without stemming swallowing meaningful tokens.
ALTER TABLE "Message"
    ADD COLUMN "tsv" tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', coalesce("text", ''))) STORED;

CREATE INDEX "Message_tsv_idx" ON "Message" USING GIN ("tsv");
