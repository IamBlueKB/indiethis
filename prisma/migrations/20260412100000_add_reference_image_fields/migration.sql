-- Migration: add_reference_image_fields
-- Adds referenceImageUrl and imageSource to MusicVideo
-- so the image source wizard step can persist the user's chosen image.

ALTER TABLE "MusicVideo" ADD COLUMN IF NOT EXISTS "referenceImageUrl" TEXT;
ALTER TABLE "MusicVideo" ADD COLUMN IF NOT EXISTS "imageSource"       TEXT;
