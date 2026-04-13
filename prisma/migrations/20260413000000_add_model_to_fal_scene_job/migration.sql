-- Add model field to FalSceneJob
ALTER TABLE "FalSceneJob" ADD COLUMN IF NOT EXISTS "model" TEXT;
