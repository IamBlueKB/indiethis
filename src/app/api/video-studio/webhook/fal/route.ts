/**
 * POST /api/video-studio/webhook/fal
 *
 * Receives completion callbacks from fal.ai when scene generation finishes.
 * fal.ai POSTs here (via the `fal_webhook` query param) with the result of
 * each fal.queue.submit() call.
 *
 * Flow:
 *   1. Look up FalSceneJob by request_id to identify which video/scene completed
 *   2. Mark job COMPLETE or FAILED, storing videoUrl
 *   3. Update MusicVideo progress
 *   4. When all scenes are done → stitch with Remotion → mark COMPLETE
 *
 * maxDuration: 300 — the last scene callback triggers Remotion Lambda stitching
 * which polls an external AWS Lambda. 5 minutes covers most video lengths.
 */

import { NextRequest, NextResponse }    from "next/server";
import { db }                           from "@/lib/db";
import { type GeneratedSceneOutput }    from "@/lib/video-studio/generator";
import { VIDEO_MODELS }                    from "@/lib/video-studio/models";
import { inngest }                         from "@/inngest/client";
import { UTApi }                           from "uploadthing/server";

const utapi = new UTApi();

/**
 * Re-uploads a fal.ai video clip URL to permanent UploadThing storage.
 * fal.ai URLs expire within hours; Remotion Lambda renders in distributed
 * chunks and needs stable URLs for the full render duration.
 *
 * Falls back to the original fal.ai URL if upload fails.
 */
async function reuploadVideoUrl(falUrl: string, filename: string): Promise<string> {
  try {
    const res = await fetch(falUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buffer = await res.arrayBuffer();
    const file   = new File([new Uint8Array(buffer)], filename, { type: "video/mp4" });
    const upload = await utapi.uploadFiles(file);
    const permanentUrl = upload.data?.ufsUrl ?? upload.data?.url;
    if (!permanentUrl) throw new Error("No URL returned from UploadThing");
    console.log(`[fal webhook] Uploaded ${filename} to UploadThing: ${permanentUrl}`);
    return permanentUrl;
  } catch (err) {
    console.warn(`[fal webhook] Re-upload failed for ${filename} — keeping fal.ai URL:`, err);
    return falUrl;
  }
}

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await req.json() as Record<string, any>;
    const { request_id, status, payload } = body;

    if (!request_id) {
      return NextResponse.json({ error: "Missing request_id" }, { status: 400 });
    }

    // ── 1. Look up the scene job ─────────────────────────────────────────────
    const job = await db.falSceneJob.findUnique({ where: { requestId: request_id } });
    if (!job) {
      // fal.ai may send retries — return 200 so it doesn't keep retrying
      console.warn(`[fal webhook] No FalSceneJob for request_id: ${request_id}`);
      return NextResponse.json({ received: true });
    }

    const { musicVideoId, sceneIndex, sceneTotal } = job;

    // Detect whether this is a V2 multi-shot (text-to-video) segment job
    // or a legacy V1 single-scene (image-to-video) job.
    // Multi-shot: sceneIndex = segment index; video.scenes holds one placeholder per segment.
    // Legacy i2v: sceneIndex = scene index; video.scenes holds one placeholder per scene.
    const isMultiShot = job.model != null &&
      Object.values(VIDEO_MODELS).some(m => m.id === job.model && m.type === "text-to-video");

    console.log(
      `[fal webhook] ${isMultiShot ? "multi-shot segment" : "single-scene i2v"} ` +
      `— scene/seg ${sceneIndex}/${sceneTotal - 1} — model: ${job.model ?? "unknown"}`,
    );

    // Guard: if video already failed or completed (e.g. a late retry), skip
    const videoCheck = await db.musicVideo.findUnique({
      where:  { id: musicVideoId },
      select: { status: true },
    });
    if (!videoCheck || videoCheck.status === "COMPLETE" || videoCheck.status === "FAILED") {
      return NextResponse.json({ received: true });
    }

    // ── 2. Record result ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoUrl:     string      = payload?.video?.url ?? "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const thumbnailUrl: string|null = payload?.video?.thumbnail_url ?? null;

    if (status === "OK" && videoUrl) {
      // Re-upload to permanent storage BEFORE marking COMPLETE.
      // fal.ai URLs are temporary and may expire during distributed Lambda chunk rendering.
      // By the time the last scene's webhook triggers Remotion stitching, all URLs
      // must be stable — this guarantees that invariant.
      const filename     = `mv-${musicVideoId}-scene${sceneIndex}-${Date.now()}.mp4`;
      const permanentUrl = await reuploadVideoUrl(videoUrl, filename);

      await db.falSceneJob.update({
        where: { id: job.id },
        data:  { status: "COMPLETE", videoUrl: permanentUrl, thumbnailUrl },
      });
      console.log(`[fal webhook] Scene ${sceneIndex}/${sceneTotal - 1} of ${musicVideoId} ✓`);
    } else {
      await db.falSceneJob.update({
        where: { id: job.id },
        data:  { status: "FAILED" },
      });
      console.error(`[fal webhook] Scene ${sceneIndex} of ${musicVideoId} failed — fal status: ${status}`);
    }

    // ── 3. Count completed / failed jobs for this video ──────────────────────
    const doneJobs = await db.falSceneJob.findMany({
      where:   { musicVideoId, status: { in: ["COMPLETE", "FAILED"] } },
      orderBy: { sceneIndex: "asc" },
    });

    const doneCount = doneJobs.length;

    // Update progress (scene/segment gen = 25–75% of overall progress)
    const genProgress = 25 + Math.round((doneCount / sceneTotal) * 50);
    const unitLabel   = isMultiShot ? "segments" : "scenes";
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        progress:    genProgress,
        currentStep: `Generated ${doneCount}/${sceneTotal} ${unitLabel}…`,
      },
    });

    if (doneCount < sceneTotal) {
      // More scenes still pending — nothing more to do yet
      return NextResponse.json({ received: true });
    }

    // ── 4. All scenes done — build GeneratedSceneOutput[] ────────────────────
    const allJobs = await db.falSceneJob.findMany({
      where:   { musicVideoId },
      orderBy: { sceneIndex: "asc" },
    });

    const video = await db.musicVideo.findUnique({
      where:  { id: musicVideoId },
      select: {
        audioUrl:      true,
        aspectRatio:   true,
        trackDuration: true,
        thumbnailUrl:  true,
        userId:        true,
        guestEmail:    true,
        trackTitle:    true,
        amount:        true,
        mode:          true,
        scenes:        true,   // placeholder scenes written during submission
        creativeBrief: true,   // for quality gate context
      },
    });

    if (!video) {
      console.error(`[fal webhook] MusicVideo ${musicVideoId} not found during final assembly`);
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Merge job results with the placeholder scene metadata (model, prompt, timing)
    const placeholders = (video.scenes as GeneratedSceneOutput[] | null) ?? [];

    const sceneResults: GeneratedSceneOutput[] = allJobs.map(j => {
      const ph = placeholders.find(s => s.sceneIndex === j.sceneIndex);
      return {
        sceneIndex:       j.sceneIndex,
        videoUrl:         j.videoUrl  ?? "",
        thumbnailUrl:     j.thumbnailUrl ?? null,
        model:            ph?.model            ?? "",
        prompt:           ph?.prompt           ?? "",
        startTime:        ph?.startTime        ?? 0,
        endTime:          ph?.endTime          ?? 0,
        energyLevel:      ph?.energyLevel      ?? 0.5,
        qaApproved:       null,
        qaReason:         j.status === "FAILED" ? "Generation failed" : null,
        qaRetried:        false,
        originalPrompt:   ph?.originalPrompt   ?? "",
        refinedPrompt:    null,
        primaryModel:     ph?.primaryModel     ?? "",
        actualModel:      ph?.actualModel      ?? "",
        fallbackUsed:     ph?.fallbackUsed     ?? false,
        fallbackAttempts: ph?.fallbackAttempts ?? 0,
      };
    });

    const completedScenes = sceneResults.filter(s => s.videoUrl);

    if (completedScenes.length === 0) {
      await db.musicVideo.update({
        where: { id: musicVideoId },
        data:  {
          status:       "FAILED",
          progress:     0,
          currentStep:  "Generation failed",
          errorMessage: "All scenes failed to generate",
        },
      });
      console.error(`[fal webhook] All scenes failed for ${musicVideoId}`);
      return NextResponse.json({ received: true });
    }

    // ── 5. Store assembled scene results + hand off to Inngest stitch step ───────
    // Persist scene results with merged metadata so the stitch-video Inngest function
    // can read them. Then fire video/stitch.requested — Remotion Lambda runs in its
    // own Inngest step invocation (no 300s webhook timeout risk).
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        scenes:      sceneResults as object[],
        status:      "STITCHING",
        progress:    75,
        currentStep: "Stitching your video…",
      },
    });

    await inngest.send({
      name: "video/stitch.requested",
      data: { videoId: musicVideoId },
    });

    console.log(`[fal webhook] All ${sceneTotal} scenes done for ${musicVideoId} — stitch handed to Inngest`);

    return NextResponse.json({ received: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fal webhook] Unhandled error:", msg);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
