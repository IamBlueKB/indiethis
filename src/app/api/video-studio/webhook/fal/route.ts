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
import { renderMediaOnLambda }             from "@remotion/lambda/client";
import { UTApi }                           from "uploadthing/server";
import { fal }                             from "@fal-ai/client";

const utapi  = new UTApi();
// Use APP_WEBHOOK_URL for Remotion callbacks — must be publicly reachable.
// Set APP_WEBHOOK_URL=https://indiethis.com in production (or ngrok URL in dev).
// Never use NEXT_PUBLIC_APP_URL here — it resolves to localhost in dev.
const APP_URL = process.env.APP_WEBHOOK_URL ?? "https://indiethis.com";

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
      // ── Scene failed — retry up to 2× before giving up ───────────────────
      await db.falSceneJob.update({
        where: { id: job.id },
        data:  { status: "FAILED" },
      });
      console.error(`[fal webhook] Scene ${sceneIndex} of ${musicVideoId} failed — fal status: ${status}`);

      // Count how many times this specific scene has already failed
      const priorFailures = await db.falSceneJob.count({
        where: { musicVideoId, sceneIndex, status: "FAILED" },
      });

      if (priorFailures < 2) {
        // Attempt a retry: re-submit to Kling from the saved keyframeUrl
        try {
          const videoForRetry = await db.musicVideo.findUnique({
            where:  { id: musicVideoId },
            select: { shotList: true, aspectRatio: true, scenes: true },
          });
          const shotList    = (videoForRetry?.shotList as Record<string, unknown>[]) ?? [];
          const placeholders = (videoForRetry?.scenes as Record<string, unknown>[]) ?? [];
          const shot        = shotList[sceneIndex];
          const ph          = placeholders.find(s => s.sceneIndex === sceneIndex);
          const keyframeUrl = shot?.keyframeUrl as string | undefined;
          const prompt      = ph?.prompt as string | undefined;
          const aspectRatio = videoForRetry?.aspectRatio === "9:16" ? "9:16" : "16:9";
          const duration    = String(Math.min(Math.round((shot?.duration as number) ?? 8), 15));

          if (keyframeUrl && prompt) {
            fal.config({ credentials: process.env.FAL_KEY! });
            const retryResult = await (fal.queue as unknown as {
              submit: (model: string, opts: unknown) => Promise<{ request_id: string }>;
            }).submit("fal-ai/kling-video/v3/pro/image-to-video", {
              input: {
                start_image_url: keyframeUrl,
                prompt:          `Full body shot, complete figure visible from head to toe. ${prompt}`,
                negative_prompt: "cropped body, cut off legs, torso only, disembodied, floating head, backwards legs, twisted limbs, distorted anatomy, deformed body, anatomical errors",
                duration,
                generate_audio:  false,
                aspect_ratio:    aspectRatio,
              },
              webhookUrl: `${APP_URL}/api/video-studio/webhook/fal`,
            });

            // Create a new FalSceneJob for the retry so it flows through the webhook
            await db.falSceneJob.create({
              data: {
                requestId:    retryResult.request_id,
                musicVideoId,
                sceneIndex,
                sceneTotal,
                model:        "fal-ai/kling-video/v3/pro/image-to-video",
              },
            });

            console.log(`[fal webhook] Scene ${sceneIndex} retry #${priorFailures} submitted — request_id: ${retryResult.request_id}`);
            // Return early — don't proceed to stitch counting until retry resolves
            return NextResponse.json({ received: true });
          }
        } catch (retryErr) {
          console.error(`[fal webhook] Scene ${sceneIndex} retry submission failed:`, retryErr);
          // Fall through to counting — treat as permanent failure
        }
      } else {
        console.error(`[fal webhook] Scene ${sceneIndex} of ${musicVideoId} — all retries exhausted, proceeding without this clip`);
      }
    }

    // ── 3. Count completed / failed jobs (by unique sceneIndex, latest job per scene) ─
    // Using latest-per-sceneIndex logic so retries don't double-count.
    const allJobsForCount = await db.falSceneJob.findMany({
      where:   { musicVideoId },
      orderBy: { createdAt: "asc" },
    });

    // Find the latest job for each sceneIndex
    const latestByScene = new Map<number, typeof allJobsForCount[0]>();
    for (const j of allJobsForCount) {
      const existing = latestByScene.get(j.sceneIndex);
      if (!existing || j.createdAt > existing.createdAt) {
        latestByScene.set(j.sceneIndex, j);
      }
    }

    // Only count scenes where the latest attempt is terminal (COMPLETE or FAILED)
    const terminalScenes = [...latestByScene.values()].filter(j =>
      j.status === "COMPLETE" || j.status === "FAILED"
    );
    const doneCount  = terminalScenes.length;
    const unitLabel  = isMultiShot ? "segments" : "scenes";

    // Build doneJobs for downstream use (assembly step uses this)
    const doneJobs = [...latestByScene.values()].sort((a, b) => a.sceneIndex - b.sceneIndex);

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
    // doneJobs is already built above (latest terminal job per sceneIndex, sorted by sceneIndex)

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

    const sceneResults: GeneratedSceneOutput[] = doneJobs.map(j => {
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

    // ── 5. Submit Remotion render with webhook callback (no polling) ─────────
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data: {
        scenes:      sceneResults as object[],
        status:      "STITCHING",
        progress:    75,
        currentStep: "Stitching your video…",
      },
    });

    console.log(`[fal webhook] All ${sceneTotal} scenes done for ${musicVideoId} — submitting Remotion render`);

    const serveUrl     = process.env.REMOTION_SERVE_URL ?? "";
    const functionName = process.env.REMOTION_FUNCTION_NAME ?? "";
    const awsRegion    = (process.env.REMOTION_REGION ?? process.env.AWS_REGION ?? "us-east-1") as "us-east-1";
    const webhookUrl   = `${APP_URL}/api/video-studio/webhook/remotion`;
    const durationMs   = Math.round(video.trackDuration * 1000);
    const validRatio   = (video.aspectRatio === "9:16" || video.aspectRatio === "1:1") ? video.aspectRatio : "16:9";

    type SceneClip = { videoUrl: string; startTime: number; endTime: number; duration: number };
    const sceneClips: SceneClip[] = sceneResults
      .filter(s => s.videoUrl)
      .map(s => ({
        videoUrl:  s.videoUrl,
        startTime: s.startTime,
        endTime:   s.endTime,
        duration:  s.endTime - s.startTime,
      }));

    const renderParams = {
      region:          awsRegion,
      functionName,
      serveUrl,
      composition:     "MusicVideoComposition",
      inputProps: {
        scenes:      sceneClips,
        audioUrl:    video.audioUrl,
        aspectRatio: validRatio,
        durationMs,
        crossfadeMs: 800,
      } as unknown as Record<string, unknown>,
      codec:           "h264" as const,
      imageFormat:     "jpeg" as const,
      maxRetries:      1,
      privacy:         "public" as const,
      framesPerLambda: 300,  // ~5 chunks for a 45s video — within 240s Lambda timeout, low concurrency
      outName:         `music-video-${musicVideoId}-${validRatio.replace(":", "x")}.mp4`,
      webhook: {
        url:    webhookUrl,
        secret: process.env.REMOTION_WEBHOOK_SECRET ?? null,
        customData: { musicVideoId },
      },
    };

    // Retry with exponential backoff on AWS rate limit errors
    const MAX_RETRIES = 3;
    let submitted: Awaited<ReturnType<typeof renderMediaOnLambda>> | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        submitted = await renderMediaOnLambda(renderParams);
        break;
      } catch (renderErr) {
        const msg = renderErr instanceof Error ? renderErr.message : String(renderErr);
        const isRateLimit = msg.includes("Rate Exceeded") ||
                            msg.includes("TooManyRequests") ||
                            msg.includes("ConcurrentInvocationLimitExceeded");
        if (isRateLimit && attempt < MAX_RETRIES) {
          // AWS rate limits can persist 10-30s; use longer backoff: 8s, 20s, 45s
          const delays = [8000, 20000, 45000];
          const delay  = delays[attempt - 1] ?? 45000;
          console.warn(`[fal webhook] Remotion rate limit hit (attempt ${attempt}/${MAX_RETRIES}) — retrying in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw renderErr;
      }
    }
    if (!submitted) throw new Error("Remotion render failed after all retries");

    // Store renderId so the Remotion webhook can look up this video
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  { errorMessage: `remotion:${submitted.renderId}:${submitted.bucketName}` },
    });

    console.log(`[fal webhook] Remotion render submitted for ${musicVideoId} — renderId=${submitted.renderId}`);

    return NextResponse.json({ received: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fal webhook] Unhandled error:", msg);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
