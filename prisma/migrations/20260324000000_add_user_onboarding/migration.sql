-- Add onboarding funnel fields to User
ALTER TABLE "User" ADD COLUMN "city"             TEXT;
ALTER TABLE "User" ADD COLUMN "genres"           TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN "soundcloudUrl"    TEXT;
ALTER TABLE "User" ADD COLUMN "signupPath"       TEXT;
ALTER TABLE "User" ADD COLUMN "onboardingStep"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "planSelectedAt"   TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "setupCompletedAt" TIMESTAMP(3);
