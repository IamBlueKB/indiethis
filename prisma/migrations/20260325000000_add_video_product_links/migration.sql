-- Add product linking and sync flag to ArtistVideo
ALTER TABLE "ArtistVideo" ADD COLUMN "isYoutubeSynced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ArtistVideo" ADD COLUMN "linkedTrackId"   TEXT;
ALTER TABLE "ArtistVideo" ADD COLUMN "linkedBeatId"    TEXT;
ALTER TABLE "ArtistVideo" ADD COLUMN "linkedMerchId"   TEXT;

-- Foreign key constraints (SET NULL so deleting the linked product unlinks cleanly)
ALTER TABLE "ArtistVideo" ADD CONSTRAINT "ArtistVideo_linkedTrackId_fkey"
  FOREIGN KEY ("linkedTrackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ArtistVideo" ADD CONSTRAINT "ArtistVideo_linkedBeatId_fkey"
  FOREIGN KEY ("linkedBeatId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ArtistVideo" ADD CONSTRAINT "ArtistVideo_linkedMerchId_fkey"
  FOREIGN KEY ("linkedMerchId") REFERENCES "MerchProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
