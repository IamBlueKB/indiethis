-- Add quality gate fields to MusicVideo
ALTER TABLE "MusicVideo"
    ADD COLUMN IF NOT EXISTS "qaApproved" BOOLEAN,
    ADD COLUMN IF NOT EXISTS "qaReport"   TEXT;
