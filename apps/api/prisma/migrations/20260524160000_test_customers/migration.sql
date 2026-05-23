CREATE TABLE "TestCustomer" (
    "id"               TEXT NOT NULL,
    "clientId"         TEXT NOT NULL,
    "channel"          TEXT NOT NULL,
    "externalSenderId" TEXT NOT NULL,
    "note"             TEXT,
    "markedBy"         TEXT NOT NULL,
    "markedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCustomer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TestCustomer_clientId_channel_externalSenderId_key"
    ON "TestCustomer"("clientId", "channel", "externalSenderId");

CREATE INDEX "TestCustomer_clientId_idx" ON "TestCustomer"("clientId");

ALTER TABLE "TestCustomer"
    ADD CONSTRAINT "TestCustomer_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
