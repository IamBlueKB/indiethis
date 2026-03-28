-- Add tags array to Contact
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Add STEM_SEPARATION notification types to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STEM_SEPARATION_COMPLETE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STEM_SEPARATION_FAILED';

-- Create StemSeparation table
CREATE TABLE IF NOT EXISTS "StemSeparation" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "originalFileUrl"  TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "vocalsUrl"        TEXT,
    "drumsUrl"         TEXT,
    "bassUrl"          TEXT,
    "otherUrl"         TEXT,
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "replicateId"      TEXT,
    "stripePaymentId"  TEXT,
    "errorMessage"     TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StemSeparation_pkey" PRIMARY KEY ("id")
);

-- Add index on userId
CREATE INDEX IF NOT EXISTS "StemSeparation_userId_idx" ON "StemSeparation"("userId");

-- Add foreign key
ALTER TABLE "StemSeparation" ADD CONSTRAINT "StemSeparation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
