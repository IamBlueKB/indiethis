/**
 * POST /api/internal/trigger/video
 *
 * Fires startGeneration() from video-studio/generate.ts in isolation so
 * that Vercel's nft tracer only bundles this function's deps (onnxruntime-web,
 * ONNX models, node-web-audio-api, essentia, Remotion) — NOT ffmpeg or sharp.
 *
 * Protected by CRON_SECRET. Caller fires and forgets.
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { musicVideoId } = (await req.json()) as { musicVideoId: string };

  const { startGeneration } = await import("@/lib/video-studio/generate");
  void startGeneration(musicVideoId).catch((err) =>
    console.error("[internal/trigger/video] startGeneration failed:", err),
  );

  return NextResponse.json({ ok: true });
}
