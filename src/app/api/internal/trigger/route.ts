/**
 * POST /api/internal/trigger
 *
 * Monolithic trigger has been split into per-module sub-routes so each
 * Vercel function only bundles its own heavy dependency tree:
 *
 *   /api/internal/trigger/video      — start-video-generation
 *   /api/internal/trigger/lyric      — start-lyric-video
 *   /api/internal/trigger/cover-art  — generate-cover-art
 *   /api/internal/trigger/ai-job     — process-ai-job
 *
 * This route is kept as a 410 Gone so any stale callers get a clear error.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has moved — use /api/internal/trigger/{video|lyric|cover-art|ai-job}" },
    { status: 410 },
  );
}
