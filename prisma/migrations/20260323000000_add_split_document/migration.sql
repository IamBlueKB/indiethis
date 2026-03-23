-- Add documentUrl to SplitSheet: stores the generated PDF URL once all parties agree
ALTER TABLE "SplitSheet" ADD COLUMN "documentUrl" TEXT;

-- Add ipHash to Split: stores a hashed IP address captured at agreement time (digital signature record)
ALTER TABLE "Split" ADD COLUMN "ipHash" TEXT;
