CREATE TABLE "BlockedSender" (
    "id"               TEXT NOT NULL,
    "clientId"         TEXT NOT NULL,
    "channel"          TEXT NOT NULL,
    "externalSenderId" TEXT NOT NULL,
    "reason"           TEXT,
    "blockedBy"        TEXT NOT NULL,
    "blockedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedSender_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlockedSender_clientId_channel_externalSenderId_key"
    ON "BlockedSender"("clientId", "channel", "externalSenderId");

CREATE INDEX "BlockedSender_clientId_idx" ON "BlockedSender"("clientId");

ALTER TABLE "BlockedSender"
    ADD CONSTRAINT "BlockedSender_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
