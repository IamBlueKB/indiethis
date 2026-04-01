-- Migration: add_agent_batch2
-- Adds winBackUsed to User and new AgentType enum values for Batch 2 agents.
-- Applied via prisma db push; baselined here for migrate deploy compatibility.

-- Add winBackUsed field to User (if not already present)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "winBackUsed" BOOLEAN NOT NULL DEFAULT false;

-- Add new AgentType enum values (PostgreSQL requires individual ALTER TYPE statements)
DO $$ BEGIN
  ALTER TYPE "AgentType" ADD VALUE IF NOT EXISTS 'CREATIVE_PROMPT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AgentType" ADD VALUE IF NOT EXISTS 'INACTIVE_CONTENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AgentType" ADD VALUE IF NOT EXISTS 'PAYMENT_RECOVERY';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AgentType" ADD VALUE IF NOT EXISTS 'TREND_FORECASTER';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AgentType" ADD VALUE IF NOT EXISTS 'PRODUCER_ARTIST_MATCH';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
