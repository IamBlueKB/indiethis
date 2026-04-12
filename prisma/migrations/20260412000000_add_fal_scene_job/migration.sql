-- Migration: add_fal_scene_job
-- Adds FalSceneJob table: maps fal.ai request_id to a MusicVideo scene
-- so the webhook route can route completion callbacks without polling.

CREATE TABLE IF NOT EXISTS "FalSceneJob" (
  "id"           TEXT NOT NULL,
  "requestId"    TEXT NOT NULL,
  "musicVideoId" TEXT NOT NULL,
  "sceneIndex"   INTEGER NOT NULL,
  "sceneTotal"   INTEGER NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "videoUrl"     TEXT,
  "thumbnailUrl" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FalSceneJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FalSceneJob_requestId_key" ON "FalSceneJob"("requestId");
CREATE INDEX IF NOT EXISTS "FalSceneJob_musicVideoId_idx" ON "FalSceneJob"("musicVideoId");
CREATE INDEX IF NOT EXISTS "FalSceneJob_status_idx" ON "FalSceneJob"("status");
