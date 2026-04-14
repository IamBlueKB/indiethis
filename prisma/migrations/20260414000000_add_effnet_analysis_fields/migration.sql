-- AlterTable: add EffNet background analysis fields to Track
ALTER TABLE "Track"
  ADD COLUMN IF NOT EXISTS "analysisStatus"       TEXT,
  ADD COLUMN IF NOT EXISTS "analysisError"        TEXT,
  ADD COLUMN IF NOT EXISTS "analyzedAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "effnetGenre"          JSONB,
  ADD COLUMN IF NOT EXISTS "effnetMood"           JSONB,
  ADD COLUMN IF NOT EXISTS "effnetInstruments"    JSONB,
  ADD COLUMN IF NOT EXISTS "effnetDanceability"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "effnetVoice"          JSONB,
  ADD COLUMN IF NOT EXISTS "effnetMoodAggressive" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "effnetMoodHappy"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "effnetMoodSad"        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "effnetMoodRelaxed"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "effnetTonal"          BOOLEAN;

-- Set default for analysisStatus on existing rows
UPDATE "Track" SET "analysisStatus" = 'pending' WHERE "analysisStatus" IS NULL;
