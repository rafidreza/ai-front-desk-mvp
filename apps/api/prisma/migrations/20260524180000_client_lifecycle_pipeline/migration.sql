-- T118 pipeline + T121 checklist:
-- Adds a separate `lifecycleStage` field (used by the operations
-- pipeline kanban) and a `conversionChecklist` JSON blob (used by the
-- pilot -> paid review). Old `onboardingStatus` is left untouched so
-- the existing client + onboarding flows keep working.
ALTER TABLE "Client" ADD COLUMN "lifecycleStage" TEXT NOT NULL DEFAULT 'lead';
ALTER TABLE "Client" ADD COLUMN "conversionChecklist" JSONB;

CREATE INDEX "Client_lifecycleStage_idx" ON "Client"("lifecycleStage");

-- Seed lifecycleStage from the existing onboardingStatus so every
-- current row lands in a plausible column on first render.
UPDATE "Client"
SET "lifecycleStage" = CASE
    WHEN "onboardingStatus" IN ('live', 'active') THEN 'live'
    WHEN "onboardingStatus" = 'onboarding_complete' THEN 'kb_building'
    WHEN "onboardingStatus" IN ('channels_complete', 'profile_complete', 'signup_started') THEN 'onboarding'
    ELSE 'lead'
END
WHERE "lifecycleStage" = 'lead';
