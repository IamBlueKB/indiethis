-- CreateTable: VideoFeedback
CREATE TABLE IF NOT EXISTS "VideoFeedback" (
    "id"           TEXT NOT NULL,
    "musicVideoId" TEXT NOT NULL,
    "sceneIndex"   INTEGER NOT NULL DEFAULT -1,
    "rating"       INTEGER,
    "liked"        BOOLEAN,
    "notes"        TEXT,
    "promptUsed"   TEXT,
    "modelUsed"    TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SystemConfig
CREATE TABLE IF NOT EXISTS "SystemConfig" (
    "key"       TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VideoFeedback_musicVideoId_idx" ON "VideoFeedback"("musicVideoId");
CREATE INDEX IF NOT EXISTS "VideoFeedback_createdAt_idx"    ON "VideoFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "VideoFeedback"
    ADD CONSTRAINT "VideoFeedback_musicVideoId_fkey"
    FOREIGN KEY ("musicVideoId")
    REFERENCES "MusicVideo"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
