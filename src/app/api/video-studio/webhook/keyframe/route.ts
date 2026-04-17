/**
 * POST /api/video-studio/webhook/keyframe
 *
 * Receives FLUX Kontext Pro keyframe completion callbacks from fal.ai.
 * Called once per scene when its keyframe image is ready.
 *
 * Flow per callback:
 *   1. Look up FalKeyframeJob by request_id
 *   2. Re-upload image to UploadThing (fal.ai URLs expire)
 *   3. Save keyframeUrl on shotList[sceneIndex]
 *   4. When all keyframes for this video are done:
 *        - Director Mode → set status STORYBOARD
 *        - Quick/Canvas  → call startSceneGeneration() (submit Kling jobs)
 *
 * maxDuration: 60 — re-upload + DB writes only; no long-running work.
 */

import { NextRequest, NextResponse }          from "next/server";
import { db }                                 from "@/lib/db";
import { UTApi }                              from "uploadthing/server";
import { startSceneGeneration }               from "@/lib/video-studio/pipeline";

const utapi = new UTApi();

/** Re-uploads a fal.ai image URL to permanent UploadThing storage. */
async function reuploadImageUrl(falUrl: string, filename: string): Promise<string> {
  try {
    const res    = await fetch(falUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buffer = await res.arrayBuffer();
    const file   = new File([new Uint8Array(buffer)], filename, { type: "image/png" });
    const upload = await utapi.uploadFiles(file);
    const url    = upload.data?.ufsUrl ?? upload.data?.url;
    if (!url) throw new Error("No URL returned from UploadThing");
    console.log(`[keyframe webhook] Uploaded ${filename} → ${url.slice(0, 60)}…`);
    return url;
  } catch (err) {
    console.warn(`[keyframe webhook] Re-upload failed for ${filename} — keeping fal.ai URL:`, err);
    return falUrl;
  }
}

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body                       = await req.json() as Record<string, any>;
    const { request_id, status, payload } = body;

    if (!request_id) {
      return NextResponse.json({ error: "Missing request_id" }, { status: 400 });
    }

    // ── 1. Look up the keyframe job ──────────────────────────────────────────
    const job = await db.falKeyframeJob.findUnique({ where: { requestId: request_id } });
    if (!job) {
      console.warn(`[keyframe webhook] No FalKeyframeJob for request_id: ${request_id}`);
      return NextResponse.json({ received: true });
    }

    const { musicVideoId, sceneIndex, totalScenes } = job;

    // Guard: skip if video is already complete or failed
    const videoCheck = await db.musicVideo.findUnique({
      where:  { id: musicVideoId },
      select: { status: true },
    });
    if (!videoCheck || videoCheck.status === "COMPLETE" || videoCheck.status === "FAILED") {
      return NextResponse.json({ received: true });
    }

    // ── 2. Handle result ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const falImageUrl: string = payload?.images?.[0]?.url ?? (payload as any)?.image?.url ?? "";

    if (status === "OK" && falImageUrl) {
      const filename     = `keyframe-${musicVideoId}-scene${sceneIndex}-${Date.now()}.png`;
      const permanentUrl = await reuploadImageUrl(falImageUrl, filename);

      await db.falKeyframeJob.update({
        where: { id: job.id },
        data:  { status: "COMPLETE", imageUrl: permanentUrl },
      });

      // Persist keyframeUrl on shotList entry
      const video = await db.musicVideo.findUnique({
        where:  { id: musicVideoId },
        select: { shotList: true, progress: true },
      });
      if (video) {
        const shotList: Record<string, unknown>[] =
          (video.shotList as Record<string, unknown>[]) ?? [];
        while (shotList.length <= sceneIndex) shotList.push({});
        shotList[sceneIndex] = { ...shotList[sceneIndex], keyframeUrl: permanentUrl };

        const progress = 10 + Math.round(((sceneIndex + 1) / totalScenes) * 30);
        await db.musicVideo.update({
          where: { id: musicVideoId },
          data:  {
            shotList: shotList as object[],
            progress,
            currentStep: `Keyframe ${sceneIndex + 1}/${totalScenes} ready…`,
          },
        });
        console.log(`[keyframe webhook] Scene ${sceneIndex + 1}/${totalScenes} keyframe saved for ${musicVideoId}`);
      }
    } else {
      await db.falKeyframeJob.update({
        where: { id: job.id },
        data:  { status: "FAILED" },
      });
      console.error(`[keyframe webhook] Scene ${sceneIndex} keyframe failed for ${musicVideoId} — fal status: ${status}`);
    }

    // ── 3. Check if all keyframes for this video are done ────────────────────
    const allJobs = await db.falKeyframeJob.findMany({
      where:   { musicVideoId },
      orderBy: { sceneIndex: "asc" },
    });

    const doneCount = allJobs.filter(j => j.status === "COMPLETE" || j.status === "FAILED").length;
    if (doneCount < totalScenes) {
      return NextResponse.json({ received: true });
    }

    const successCount = allJobs.filter(j => j.status === "COMPLETE").length;
    if (successCount === 0) {
      await db.musicVideo.update({
        where: { id: musicVideoId },
        data: {
          status:       "FAILED",
          progress:     0,
          currentStep:  "Keyframe generation failed",
          errorMessage: "All keyframes failed to generate",
        },
      });
      console.error(`[keyframe webhook] All keyframes failed for ${musicVideoId}`);
      return NextResponse.json({ received: true });
    }

    // ── 4. All keyframes done — route based on mode ──────────────────────────
    const video = await db.musicVideo.findUnique({
      where:  { id: musicVideoId },
      select: { mode: true },
    });
    if (!video) return NextResponse.json({ received: true });

    if (video.mode === "DIRECTOR") {
      // Director Mode: show storyboard for user review before starting Kling
      await db.musicVideo.update({
        where: { id: musicVideoId },
        data: {
          status:      "STORYBOARD",
          progress:    40,
          currentStep: "Review your storyboard — approve or regenerate scenes…",
        },
      });
      console.log(`[keyframe webhook] Director Mode — storyboard ready for ${musicVideoId}`);
    } else {
      // Quick/Canvas Mode: automatically start Kling scene generation
      console.log(`[keyframe webhook] Quick/Canvas Mode — starting scene generation for ${musicVideoId}`);
      await startSceneGeneration(musicVideoId);
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[keyframe webhook] Unhandled error:", msg);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
