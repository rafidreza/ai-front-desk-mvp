-- Defensive defaults so manual INSERTs (psql, scripts) do not fail with NULL
-- constraint errors. App code continues to pass explicit timestamps; these are
-- only used when the caller omits the columns.

ALTER TABLE "Message" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Ticket"  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Ticket"  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
