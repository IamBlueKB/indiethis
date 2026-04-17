/**
 * POST /api/video-studio/webhook/fal
 *
 * Receives Kling i2v scene completion callbacks from fal.ai.
 * Called once per scene clip when its video is ready.
 *
 * Flow per callback:
 *   1. Look up FalSceneJob by request_id
 *   2. Re-upload clip to UploadThing (fal.ai URLs expire)
 *   3. Update MusicVideo progress
 *   4. When all scenes done → run Remotion Lambda stitch inline → mark COMPLETE
 *
 * maxDuration: 300 — the final callback triggers Remotion Lambda stitching
 * which polls AWS Lambda for up to ~5 minutes on long tracks.
 */

import { NextRequest, NextResponse }       from "next/server";
import { db }                              from "@/lib/db";
import { type GeneratedSceneOutput }       from "@/lib/video-studio/generator";
import { VIDEO_MODELS }                    from "@/lib/video-studio/models";
import { generateMultiFormatVideos, pickThumbnailScene } from "@/lib/video-studio/generator";
import { sendMusicVideoCompleteEmail }     from "@/lib/brevo/email";
import { sendVideoConversionEmail1 }       from "@/lib/agents/video-conversion";
import { UTApi }                           from "uploadthing/server";

const utapi  = new UTApi();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

/**
 * Re-uploads a fal.ai video clip URL to permanent UploadThing storage.
 * fal.ai URLs expire within hours; Remotion Lambda renders in distributed
 * chunks and needs stable URLs for the full render duration.
 */
async function reuploadVideoUrl(falUrl: string, filename: string): Promise<string> {
  try {
    const res          = await fetch(falUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buffer       = await res.arrayBuffer();
    const file         = new File([new Uint8Array(buffer)], filename, { type: "video/mp4" });
    const upload       = await utapi.uploadFiles(file);
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
      console.warn(`[fal webhook] No FalSceneJob for request_id: ${request_id}`);
      return NextResponse.json({ received: true });
    }

    const { musicVideoId, sceneIndex, sceneTotal } = job;

    // Detect whether this is a V2 multi-shot (text-to-video) segment job
    // or a V3 single-scene (image-to-video) job.
    const isMultiShot = job.model != null &&
      Object.values(VIDEO_MODELS).some(m => m.id === job.model && m.type === "text-to-video");

    console.log(
      `[fal webhook] ${isMultiShot ? "multi-shot segment" : "single-scene i2v"} ` +
      `— scene/seg ${sceneIndex}/${sceneTotal - 1} — model: ${job.model ?? "unknown"}`,
    );

    // Guard: skip if video is already complete or failed
    const videoCheck = await db.musicVideo.findUnique({
      where:  { id: musicVideoId },
      select: { status: true },
    });
    if (!videoCheck || videoCheck.status === "COMPLETE" || videoCheck.status === "FAILED") {
      return NextResponse.json({ received: true });
    }

    // ── 2. Record result ─────────────────────────────────────────────────────
    const videoUrl:     string      = payload?.video?.url ?? "";
    const thumbnailUrl: string|null = payload?.video?.thumbnail_url ?? null;

    if (status === "OK" && videoUrl) {
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

    // ── 3. Count completed / failed jobs ────────────────────────────────────
    const doneJobs = await db.falSceneJob.findMany({
      where:   { musicVideoId, status: { in: ["COMPLETE", "FAILED"] } },
      orderBy: { sceneIndex: "asc" },
    });

    const doneCount  = doneJobs.length;
    const unitLabel  = isMultiShot ? "segments" : "scenes";

    const genProgress = 25 + Math.round((doneCount / sceneTotal) * 50);
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        progress:    genProgress,
        currentStep: `Generated ${doneCount}/${sceneTotal} ${unitLabel}…`,
      },
    });

    if (doneCount < sceneTotal) {
      return NextResponse.json({ received: true });
    }

    // ── 4. All scenes done — assemble scene results ──────────────────────────
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
        scenes:        true,
      },
    });

    if (!video) {
      console.error(`[fal webhook] MusicVideo ${musicVideoId} not found during final assembly`);
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const placeholders = (video.scenes as GeneratedSceneOutput[] | null) ?? [];

    const sceneResults: GeneratedSceneOutput[] = allJobs.map(j => {
      const ph = placeholders.find(s => s.sceneIndex === j.sceneIndex);
      return {
        sceneIndex:       j.sceneIndex,
        videoUrl:         j.videoUrl        ?? "",
        thumbnailUrl:     j.thumbnailUrl    ?? null,
        model:            ph?.model          ?? "fal-ai/kling-video/v3/pro/image-to-video",
        prompt:           ph?.prompt         ?? "",
        startTime:        ph?.startTime      ?? 0,
        endTime:          ph?.endTime        ?? 0,
        energyLevel:      ph?.energyLevel    ?? 0.5,
        qaApproved:       null,
        qaReason:         j.status === "FAILED" ? "Generation failed" : null,
        qaRetried:        false,
        originalPrompt:   ph?.originalPrompt  ?? "",
        refinedPrompt:    null,
        primaryModel:     ph?.primaryModel    ?? "fal-ai/kling-video/v3/pro/image-to-video",
        actualModel:      ph?.actualModel     ?? "fal-ai/kling-video/v3/pro/image-to-video",
        fallbackUsed:     ph?.fallbackUsed    ?? false,
        fallbackAttempts: ph?.fallbackAttempts ?? 0,
      };
    });

    const completedScenes = sceneResults.filter(s => s.videoUrl);

    if (completedScenes.length === 0) {
      await db.musicVideo.update({
        where: { id: musicVideoId },
        data: {
          status:       "FAILED",
          progress:     0,
          currentStep:  "Generation failed",
          errorMessage: "All scenes failed to generate",
        },
      });
      console.error(`[fal webhook] All scenes failed for ${musicVideoId}`);
      return NextResponse.json({ received: true });
    }

    // ── 5. Stitch with Remotion Lambda (inline — no Inngest needed) ──────────
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data: {
        scenes:      sceneResults as object[],
        status:      "STITCHING",
        progress:    75,
        currentStep: "Stitching your video…",
      },
    });

    console.log(`[fal webhook] All ${sceneTotal} scenes done for ${musicVideoId} — starting Remotion stitch`);

    const durationMs     = Math.round(video.trackDuration * 1000);
    const finalVideoUrls = await generateMultiFormatVideos(
      musicVideoId,
      sceneResults,
      video.audioUrl,
      [video.aspectRatio],
      durationMs,
      false,
    );

    const finalVideoUrl     = finalVideoUrls[video.aspectRatio] ?? Object.values(finalVideoUrls)[0] ?? null;
    const thumbScene        = pickThumbnailScene(sceneResults);
    const finalThumbnailUrl = thumbScene?.videoUrl ?? video.thumbnailUrl ?? null;

    await db.musicVideo.update({
      where: { id: musicVideoId },
      data: {
        status:         "COMPLETE",
        progress:       100,
        currentStep:    "Complete!",
        scenes:         sceneResults as object[],
        finalVideoUrl:  finalVideoUrl  ?? undefined,
        finalVideoUrls: Object.keys(finalVideoUrls).length > 0
          ? (finalVideoUrls as object)
          : undefined,
        thumbnailUrl:   finalThumbnailUrl ?? undefined,
      },
    });

    console.log(`[fal webhook] ${musicVideoId} complete — ${completedScenes.length}/${allJobs.length} scenes stitched`);

    // ── 6. Notification email ────────────────────────────────────────────────
    const previewUrl = `${APP_URL}/video-studio/${musicVideoId}/preview`;

    try {
      if (video.userId) {
        const user = await db.user.findUnique({
          where:  { id: video.userId },
          select: { email: true, name: true, artistSlug: true },
        });
        if (user?.email) {
          await sendMusicVideoCompleteEmail({
            toEmail:    user.email,
            toName:     user.name ?? "Artist",
            trackTitle: video.trackTitle,
            previewUrl,
            mode:       video.mode as "QUICK" | "DIRECTOR",
            artistSlug: user.artistSlug ?? undefined,
          });
        }
      } else if (video.guestEmail) {
        await sendVideoConversionEmail1({
          id:             musicVideoId,
          trackTitle:     video.trackTitle,
          guestEmail:     video.guestEmail,
          amount:         video.amount,
          mode:           video.mode,
          finalVideoUrl:  finalVideoUrl ?? null,
          finalVideoUrls: null,
        });
        await db.musicVideo.update({
          where: { id: musicVideoId },
          data: {
            conversionStep:   1,
            conversionNextAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
      }
    } catch (emailErr) {
      console.warn("[fal webhook] Notification email failed:", emailErr);
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fal webhook] Unhandled error:", msg);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
