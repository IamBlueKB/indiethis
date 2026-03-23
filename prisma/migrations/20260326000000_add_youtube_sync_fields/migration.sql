-- Add YouTube sync fields to User
ALTER TABLE "User" ADD COLUMN "youtubeChannelId"   TEXT;
ALTER TABLE "User" ADD COLUMN "youtubeSyncEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "youtubeSyncLastAt"  TIMESTAMP(3);

-- Add YouTube video ID to ArtistVideo for deduplication
ALTER TABLE "ArtistVideo" ADD COLUMN "youtubeVideoId" TEXT;
