CREATE TABLE "PromptProfile" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "systemInstructions" TEXT NOT NULL,
  "toneRules" TEXT NOT NULL,
  "escalationRules" TEXT NOT NULL,
  "forbiddenClaims" TEXT NOT NULL,
  "fallbackBehavior" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "version" INTEGER NOT NULL DEFAULT 1,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromptProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromptProfileVersion" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "systemInstructions" TEXT NOT NULL,
  "toneRules" TEXT NOT NULL,
  "escalationRules" TEXT NOT NULL,
  "forbiddenClaims" TEXT NOT NULL,
  "fallbackBehavior" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromptProfileVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromptProfile_clientId_idx" ON "PromptProfile"("clientId");
CREATE INDEX "PromptProfile_clientId_status_idx" ON "PromptProfile"("clientId", "status");
CREATE INDEX "PromptProfileVersion_profileId_idx" ON "PromptProfileVersion"("profileId");
CREATE INDEX "PromptProfileVersion_clientId_idx" ON "PromptProfileVersion"("clientId");
CREATE INDEX "PromptProfileVersion_action_idx" ON "PromptProfileVersion"("action");

ALTER TABLE "PromptProfile" ADD CONSTRAINT "PromptProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptProfileVersion" ADD CONSTRAINT "PromptProfileVersion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PromptProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PromptProfile" (
  "id", "clientId", "name", "systemInstructions", "toneRules", "escalationRules", "forbiddenClaims", "fallbackBehavior", "status", "version", "createdAt", "updatedAt"
)
SELECT
  "id" || ':prompt:default',
  "id",
  'Default support prompt',
  'You are the AI front desk agent for ' || "businessName" || '. Only answer from approved knowledge. Keep replies short enough for Messenger commerce.',
  "tone",
  'Escalate when the customer asks for a human, refund, cancellation, complaint handling, or when knowledge confidence is low. Escalation keywords: ' || array_to_string("escalationKeywords", ', '),
  'Do not invent prices, delivery commitments, stock availability, discounts, refunds, or policy details that are not in the approved knowledge base.',
  'If the answer is missing, politely say a team member will check and get back shortly.',
  'active',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Client";

INSERT INTO "PromptProfileVersion" (
  "id", "profileId", "clientId", "version", "name", "systemInstructions", "toneRules", "escalationRules", "forbiddenClaims", "fallbackBehavior", "status", "action", "actorId", "createdAt"
)
SELECT
  "id" || ':v:1', "id", "clientId", "version", "name", "systemInstructions", "toneRules", "escalationRules", "forbiddenClaims", "fallbackBehavior", "status", 'baseline', 'migration', "updatedAt"
FROM "PromptProfile";
