CREATE TABLE "ClientAuthChallenge" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientAuthChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientAuthChallenge_clientId_idx" ON "ClientAuthChallenge"("clientId");
CREATE INDEX "ClientAuthChallenge_destination_idx" ON "ClientAuthChallenge"("destination");
CREATE INDEX "ClientAuthChallenge_expiresAt_idx" ON "ClientAuthChallenge"("expiresAt");

ALTER TABLE "ClientAuthChallenge" ADD CONSTRAINT "ClientAuthChallenge_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
