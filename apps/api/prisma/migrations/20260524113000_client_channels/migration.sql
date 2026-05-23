CREATE TABLE "ClientChannel" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientChannel_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ClientChannel" (
  "id",
  "clientId",
  "channel",
  "externalId",
  "label",
  "status",
  "isPrimary",
  "metadata",
  "connectedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT("id", ':messenger:', "pageId"),
  "id",
  'messenger',
  "pageId",
  'Primary Facebook Page',
  'connected',
  true,
  '{}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Client"
WHERE "pageId" IS NOT NULL
  AND "pageId" <> ''
  AND "pageId" NOT LIKE '%-page-pending'
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "ClientChannel_channel_externalId_key" ON "ClientChannel"("channel", "externalId");
CREATE INDEX "ClientChannel_clientId_idx" ON "ClientChannel"("clientId");
CREATE INDEX "ClientChannel_clientId_channel_idx" ON "ClientChannel"("clientId", "channel");
CREATE INDEX "ClientChannel_channel_externalId_idx" ON "ClientChannel"("channel", "externalId");

ALTER TABLE "ClientChannel"
  ADD CONSTRAINT "ClientChannel_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
