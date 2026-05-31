ALTER TABLE "PromptProfile"
ADD COLUMN "experimentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "experimentKey" TEXT,
ADD COLUMN "trafficWeight" INTEGER NOT NULL DEFAULT 100;

ALTER TABLE "PromptProfileVersion"
ADD COLUMN "experimentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "experimentKey" TEXT,
ADD COLUMN "trafficWeight" INTEGER NOT NULL DEFAULT 100;
