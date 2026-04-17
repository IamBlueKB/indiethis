-- CreateTable: FalKeyframeJob — lookup table for FLUX keyframe fal.ai jobs
CREATE TABLE "FalKeyframeJob" (
    "id"           TEXT NOT NULL,
    "requestId"    TEXT NOT NULL,
    "musicVideoId" TEXT NOT NULL,
    "sceneIndex"   INTEGER NOT NULL,
    "totalScenes"  INTEGER NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'PENDING',
    "imageUrl"     TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FalKeyframeJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FalKeyframeJob_requestId_key" ON "FalKeyframeJob"("requestId");
CREATE INDEX "FalKeyframeJob_musicVideoId_idx" ON "FalKeyframeJob"("musicVideoId");
CREATE INDEX "FalKeyframeJob_status_idx" ON "FalKeyframeJob"("status");
