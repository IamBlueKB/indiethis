/**
 * POST /api/internal/trigger/ai-job
 *
 * Fires processAIJob() in isolation so Vercel's nft tracer only bundles
 * this function's deps (sharp, ffmpeg, Remotion, fal.ai, Prisma) — no
 * onnxruntime-web, ONNX models, or node-web-audio-api.
 *
 * Protected by CRON_SECRET. Caller fires and forgets.
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = (await req.json()) as { jobId: string };

  const { processAIJob } = await import("@/lib/ai-job-processor");
  void processAIJob(jobId).catch((err) =>
    console.error("[internal/trigger/ai-job] processAIJob failed:", err),
  );

  return NextResponse.json({ ok: true });
}
