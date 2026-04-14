/**
 * POST /api/internal/trigger
 *
 * Internal-only endpoint for firing heavy async tasks from lightweight routes
 * (e.g. the Stripe webhook) without those routes having to import the heavy
 * modules at all. Vercel's file tracer won't pull ai-job-processor, ffmpeg,
 * sharp, onnxruntime-web, etc. into the webhook bundle.
 *
 * Protected by the same CRON_SECRET used by all cron routes.
 * Caller fires and forgets — does NOT wait for a response.
 */
import { NextRequest, NextResponse } from "next/server";

type TriggerBody =
  | { type: "start-video-generation"; musicVideoId: string }
  | { type: "start-lyric-video";      jobId: string }
  | { type: "generate-cover-art";     jobId: string }
  | { type: "process-ai-job";         jobId: string };

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as TriggerBody;

  try {
    switch (body.type) {
      case "start-video-generation": {
        const { startGeneration } = await import("@/lib/video-studio/generate");
        void startGeneration(body.musicVideoId).catch((err) =>
          console.error("[internal/trigger] start-video-generation failed:", err)
        );
        break;
      }
      case "start-lyric-video": {
        const { startLyricVideoGeneration } = await import("@/lib/lyric-video/pipeline");
        void startLyricVideoGeneration(body.jobId).catch((err) =>
          console.error("[internal/trigger] start-lyric-video failed:", err)
        );
        break;
      }
      case "generate-cover-art": {
        const { generateCoverArtJobById } = await import("@/lib/cover-art/generator");
        void generateCoverArtJobById(body.jobId).catch((err) =>
          console.error("[internal/trigger] generate-cover-art failed:", err)
        );
        break;
      }
      case "process-ai-job": {
        const { processAIJob } = await import("@/lib/ai-job-processor");
        void processAIJob(body.jobId).catch((err) =>
          console.error("[internal/trigger] process-ai-job failed:", err)
        );
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown trigger type" }, { status: 400 });
    }
  } catch (err) {
    console.error("[internal/trigger] dispatch error:", err);
    return NextResponse.json({ error: "Trigger failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
