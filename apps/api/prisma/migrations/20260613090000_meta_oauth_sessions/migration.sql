CREATE TABLE "MetaOAuthSession" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'started',
  "returnTo" TEXT,
  "pages" JSONB,
  "selectedPageId" TEXT,
  "error" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MetaOAuthSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MetaOAuthSession"
  ADD CONSTRAINT "MetaOAuthSession_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "MetaOAuthSession_clientId_idx" ON "MetaOAuthSession"("clientId");
CREATE INDEX "MetaOAuthSession_status_idx" ON "MetaOAuthSession"("status");
CREATE INDEX "MetaOAuthSession_expiresAt_idx" ON "MetaOAuthSession"("expiresAt");
