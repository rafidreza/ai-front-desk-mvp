ALTER TABLE "Client" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

CREATE INDEX "Client_status_idx" ON "Client"("status");
