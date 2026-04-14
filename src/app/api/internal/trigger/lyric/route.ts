/**
 * POST /api/internal/trigger/lyric
 *
 * Fires startLyricVideoGeneration() in isolation so Vercel's nft tracer
 * only bundles this function's deps (onnxruntime-web via song-analyzer,
 * ONNX models, node-web-audio-api, essentia, sharp, Remotion).
 *
 * Protected by CRON_SECRET. Caller fires and forgets.
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = (await req.json()) as { jobId: string };

  const { startLyricVideoGeneration } = await import("@/lib/lyric-video/pipeline");
  void startLyricVideoGeneration(jobId).catch((err) =>
    console.error("[internal/trigger/lyric] startLyricVideoGeneration failed:", err),
  );

  return NextResponse.json({ ok: true });
}
