-- Add Essentia ML analysis fields to Track model
-- Populated by Replicate mtg/music-classifiers after track upload

ALTER TABLE "Track"
  ADD COLUMN IF NOT EXISTS "essentiaGenres"       JSONB,
  ADD COLUMN IF NOT EXISTS "essentiaMoods"        JSONB,
  ADD COLUMN IF NOT EXISTS "essentiaInstruments"  JSONB,
  ADD COLUMN IF NOT EXISTS "essentiaDanceability" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "essentiaVoice"        TEXT,
  ADD COLUMN IF NOT EXISTS "essentiaVoiceGender"  TEXT,
  ADD COLUMN IF NOT EXISTS "essentiaTimbre"       TEXT,
  ADD COLUMN IF NOT EXISTS "essentiaAutoTags"     JSONB,
  ADD COLUMN IF NOT EXISTS "essentiaAnalyzedAt"   TIMESTAMP(3);
