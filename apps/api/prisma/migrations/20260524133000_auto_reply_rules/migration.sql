CREATE TABLE "ClientAutoReplyRule" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "ruleType" TEXT NOT NULL DEFAULT 'holiday',
  "label" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  "startDate" TEXT,
  "endDate" TEXT,
  "dayOfWeek" INTEGER,
  "startMinute" INTEGER NOT NULL DEFAULT 0,
  "endMinute" INTEGER NOT NULL DEFAULT 1440,
  "replyText" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientAutoReplyRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientAutoReplyRule_clientId_idx" ON "ClientAutoReplyRule"("clientId");
CREATE INDEX "ClientAutoReplyRule_clientId_enabled_idx" ON "ClientAutoReplyRule"("clientId", "enabled");
CREATE INDEX "ClientAutoReplyRule_ruleType_idx" ON "ClientAutoReplyRule"("ruleType");

ALTER TABLE "ClientAutoReplyRule"
  ADD CONSTRAINT "ClientAutoReplyRule_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
