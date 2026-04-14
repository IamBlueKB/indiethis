/**
 * POST /api/internal/trigger/video
 *
 * Fires startGeneration() or startAnalysisOnly() from video-studio/generate.ts
 * in isolation so that Vercel's nft tracer only bundles this function's deps
 * (onnxruntime-web, ONNX models, node-web-audio-api, essentia, Remotion) —
 * NOT ffmpeg or sharp.
 *
 * Body:
 *   { musicVideoId: string, analysisOnly?: boolean }
 *
 * Protected by CRON_SECRET. Caller fires and forgets.
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // 5 minutes — analysis polling can take up to 4 min

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { musicVideoId, analysisOnly } = (await req.json()) as {
    musicVideoId: string;
    analysisOnly?: boolean;
  };

  if (analysisOnly) {
    const { startAnalysisOnly } = await import("@/lib/video-studio/generate");
    await startAnalysisOnly(musicVideoId).catch((err) =>
      console.error("[internal/trigger/video] startAnalysisOnly failed:", err),
    );
  } else {
    const { startGeneration } = await import("@/lib/video-studio/generate");
    void startGeneration(musicVideoId).catch((err) =>
      console.error("[internal/trigger/video] startGeneration failed:", err),
    );
  }

  return NextResponse.json({ ok: true });
}
