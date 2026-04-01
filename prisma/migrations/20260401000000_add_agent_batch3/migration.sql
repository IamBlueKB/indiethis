-- Migration: add_agent_batch3
-- Adds openToCollaborations to User and new AgentType enum values for Batch 3 agents.

-- Add openToCollaborations field to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "openToCollaborations" BOOLEAN NOT NULL DEFAULT false;

-- Add BOOKING_AGENT AgentType enum value
DO $$ BEGIN
  ALTER TYPE "AgentType" ADD VALUE IF NOT EXISTS 'BOOKING_AGENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add COLLABORATION_MATCHMAKER AgentType enum value
DO $$ BEGIN
  ALTER TYPE "AgentType" ADD VALUE IF NOT EXISTS 'COLLABORATION_MATCHMAKER';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
