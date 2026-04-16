/**
 * src/inngest/functions/video-pipeline.ts
 *
 * All Inngest step functions for the Music Video generation pipeline.
 *
 * Pipeline flow:
 *   video/generate.requested
 *     → video/keyframe.generate  (one per scene, max 3 concurrent)
 *       → video/keyframes.complete
 *         → video/scenes.approved  (Director: after user approves; Quick/Canvas: immediate)
 *           → video/scene.generate  (one per scene, max 3 concurrent — Kling i2v)
 *             → webhook fires video/stitch.requested when all Kling clips done
 *               → COMPLETE
 *
 * Each step runs in its own Vercel function invocation — no single call ever
 * hits the 300s timeout ceiling.
 *
 * Inngest v4 API: createFunction(options, handler) — trigger lives in options.triggers
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { inngest }                          from "@/inngest/client";
import { db }                               from "@/lib/db";
import { fal }                              from "@fal-ai/client";
import { UTApi }                            from "uploadthing/server";
import {
  generateMultiFormatVideos,
  pickThumbnailScene,
  type GeneratedSceneOutput,
}                                           from "@/lib/video-studio/generator";
import { sendMusicVideoCompleteEmail }      from "@/lib/brevo/email";
import { sendVideoConversionEmail1 }        from "@/lib/agents/video-conversion";

const utapi   = new UTApi();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ─── Shared helpers ─────────────────────────────────────────────────────────────

/** Re-upload a fal.ai image URL to UploadThing for permanent storage. */
async function reuploadImageUrl(falUrl: string, filename: string): Promise<string> {
  try {
    const res    = await fetch(falUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buffer = await res.arrayBuffer();
    const file   = new File([new Uint8Array(buffer)], filename, { type: "image/png" });
    const upload = await utapi.uploadFiles(file);
    const url    = upload.data?.ufsUrl ?? upload.data?.url;
    if (!url) throw new Error("No URL returned from UploadThing");
    console.log(`[pipeline] Uploaded ${filename} → ${url.slice(0, 60)}…`);
    return url;
  } catch (err) {
    console.warn(`[pipeline] Re-upload failed for ${filename} — keeping fal.ai URL:`, err);
    return falUrl;
  }
}

// ─── 1. Orchestrator ────────────────────────────────────────────────────────────

/**
 * Triggered when the user approves generation (after payment clears).
 * Sets status → GENERATING, fans out one video/keyframe.generate event per scene.
 * Returns in <1s — keyframe generation is fully async.
 *
 * Input: { videoId, scenes: ShotListItem[], artistImageUrl }
 */
export const videoOrchestrator = inngest.createFunction(
  {
    id:       "video-orchestrator",
    triggers: [{ event: "video/generate.requested" }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { videoId, scenes, artistImageUrl } = event.data as {
      videoId:        string;
      scenes:         any[];
      artistImageUrl: string;
    };

    await step.run("set-status", async () => {
      await db.musicVideo.update({
        where: { id: videoId },
        data:  {
          status:      "GENERATING",
          progress:    10,
          currentStep: `Generating ${scenes.length} keyframe${scenes.length !== 1 ? "s" : ""}…`,
        },
      });
    });

    // Fan out — one keyframe event per scene
    await step.sendEvent(
      "fan-out-keyframes",
      scenes.map((scene: any, index: number) => ({
        name: "video/keyframe.generate",
        data: {
          videoId,
          sceneIndex:      index,
          totalScenes:     scenes.length,
          artistImageUrl,
          description:     scene.description     ?? "",
          cameraDirection: scene.cameraDirection ?? "",
          filmLook:        scene.filmLook        ?? "",
          duration:        scene.duration        ?? 8,
          startTime:       scene.startTime       ?? (index * 8),
          endTime:         scene.endTime         ?? ((index + 1) * 8),
          prompt:          scene.prompt          ?? scene.description ?? "",
        },
      })),
    );
  },
);

// ─── 2. Keyframe generation (one per scene) ─────────────────────────────────────

/**
 * Generates one FLUX Kontext Pro keyframe for a single scene.
 * Uses fal.subscribe with timeout — runs in its own step invocation,
 * so no zombie timer risk (Inngest manages the lifecycle).
 *
 * Saves permanent UploadThing URL to shotList[sceneIndex].keyframeUrl.
 * When all scenes for this video have keyframes, fires video/keyframes.complete.
 */
export const generateKeyframe = inngest.createFunction(
  {
    id:          "generate-keyframe",
    triggers:    [{ event: "video/keyframe.generate" }],
    concurrency: { limit: 3 },
    retries:     2,
  },
  async ({ event, step }: { event: any; step: any }) => {
    const {
      videoId, sceneIndex, totalScenes, artistImageUrl,
      description, cameraDirection, filmLook,
    } = event.data as {
      videoId:         string;
      sceneIndex:      number;
      totalScenes:     number;
      artistImageUrl:  string;
      description:     string;
      cameraDirection: string;
      filmLook:        string;
    };

    // Step A — Generate keyframe via FLUX Kontext Pro
    // Spec: use fal.subscribe with timeout (not fal.queue.submit for FLUX)
    const falUrl: string = await step.run("flux-generate", async () => {
      fal.config({ credentials: process.env.FAL_KEY! });

      const prompt =
        `Place this person in the following scene: ${description}. ` +
        (cameraDirection ? `${cameraDirection}. ` : "") +
        (filmLook        ? `${filmLook}. `        : "") +
        `Maintain the person's exact facial features, clothing, and appearance from the reference photo.`;

      const result = await fal.subscribe("fal-ai/flux-pro/kontext" as any, {
        input: {
          prompt,
          image_url: artistImageUrl,
        },
        timeout: 120_000,
      } as any);

      const imageUrl = (result as any).data?.images?.[0]?.url ?? "";
      if (!imageUrl) throw new Error("FLUX Kontext Pro returned no keyframe image");
      console.log(`[pipeline] FLUX keyframe scene ${sceneIndex} done — ${imageUrl.slice(0, 60)}…`);
      return imageUrl;
    });

    // Step B — Upload to permanent UploadThing storage (fal.ai URLs expire)
    const permanentUrl: string = await step.run("upload-keyframe", async () => {
      return await reuploadImageUrl(
        falUrl,
        `keyframe-${videoId}-scene${sceneIndex}-${Date.now()}.png`,
      );
    });

    // Step C — Persist keyframeUrl on shotList[sceneIndex]
    await step.run("save-keyframe", async () => {
      const video = await db.musicVideo.findUnique({
        where:  { id: videoId },
        select: { shotList: true },
      });
      if (!video) throw new Error(`Video ${videoId} not found`);

      const shotList: any[] = (video.shotList as any[]) ?? [];
      while (shotList.length <= sceneIndex) shotList.push({});
      shotList[sceneIndex] = { ...shotList[sceneIndex], keyframeUrl: permanentUrl };

      const progress = 10 + Math.round(((sceneIndex + 1) / totalScenes) * 30);
      await db.musicVideo.update({
        where: { id: videoId },
        data:  { shotList: shotList as object[], progress },
      });
      console.log(`[pipeline] Keyframe ${sceneIndex + 1}/${totalScenes} saved for ${videoId}`);
    });

    // Step D — Check if all keyframes complete; fire video/keyframes.complete if so
    await step.run("check-complete", async () => {
      const video = await db.musicVideo.findUnique({
        where:  { id: videoId },
        select: { shotList: true },
      });
      if (!video) return;

      const shotList: any[] = (video.shotList as any[]) ?? [];
      const allDone = shotList.length >= totalScenes &&
        shotList.slice(0, totalScenes).every((s: any) => s?.keyframeUrl);

      if (allDone) {
        console.log(`[pipeline] All ${totalScenes} keyframes done for ${videoId} — firing keyframes.complete`);
        await inngest.send({ name: "video/keyframes.complete", data: { videoId } });
      }
    });
  },
);

// ─── 3. Keyframes complete — route to approval or video gen ─────────────────────

/**
 * Called when all keyframes for a video are ready.
 * Director Mode → set status STORYBOARD (user approves before Kling runs).
 * Quick Mode / Canvas → immediately fire video/scenes.approved (no approval step).
 */
export const keyframesComplete = inngest.createFunction(
  {
    id:       "keyframes-complete",
    triggers: [{ event: "video/keyframes.complete" }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { videoId } = event.data as { videoId: string };

    const video: any = await step.run("get-video", async () => {
      return await db.musicVideo.findUnique({
        where:  { id: videoId },
        select: { mode: true },
      });
    });

    if (!video) return;

    if (video.mode === "DIRECTOR") {
      await step.run("set-storyboard", async () => {
        await db.musicVideo.update({
          where: { id: videoId },
          data:  {
            status:      "STORYBOARD",
            progress:    40,
            currentStep: "Review your storyboard — approve or regenerate scenes…",
          },
        });
      });
      console.log(`[pipeline] Director Mode — storyboard ready for ${videoId}`);
    } else {
      await step.sendEvent("start-video-gen", {
        name: "video/scenes.approved",
        data: { videoId },
      });
      console.log(`[pipeline] Quick/Canvas Mode — auto-approving scenes for ${videoId}`);
    }
  },
);

// ─── 4. Scenes approved — fan out Kling i2v calls ───────────────────────────────

/**
 * Triggered by:
 *   - Director Mode: artist clicks "Accept All" → API route fires this event
 *   - Quick/Canvas: auto-fired by keyframes-complete
 *
 * Clears stale FalSceneJobs, then fans out one video/scene.generate per scene.
 */
export const scenesApproved = inngest.createFunction(
  {
    id:       "scenes-approved",
    triggers: [{ event: "video/scenes.approved" }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { videoId } = event.data as { videoId: string };

    const video: any = await step.run("get-video", async () => {
      return await db.musicVideo.findUnique({
        where:  { id: videoId },
        select: { shotList: true, aspectRatio: true },
      });
    });

    if (!video) throw new Error(`Video ${videoId} not found`);

    const shotList: any[] = (video.shotList as any[]) ?? [];
    if (shotList.length === 0) throw new Error("No shots in shotList");

    await step.run("cleanup-stale-jobs", async () => {
      await db.falSceneJob.deleteMany({ where: { musicVideoId: videoId } });
    });

    await step.run("set-generating", async () => {
      await db.musicVideo.update({
        where: { id: videoId },
        data:  {
          status:      "GENERATING",
          progress:    45,
          currentStep: `Generating ${shotList.length} scenes…`,
        },
      });
    });

    // Fan out — one Kling i2v event per scene
    await step.sendEvent(
      "fan-out-scenes",
      shotList.map((scene: any, index: number) => ({
        name: "video/scene.generate",
        data: {
          videoId,
          sceneIndex:      index,
          totalScenes:     shotList.length,
          keyframeUrl:     scene.keyframeUrl     ?? "",
          description:     scene.description     ?? "",
          cameraDirection: scene.cameraDirection ?? "",
          filmLook:        scene.filmLook        ?? "",
          duration:        String(Math.min(Math.round(scene.duration ?? 8), 15)),
          startTime:       scene.startTime       ?? (index * 8),
          endTime:         scene.endTime         ?? ((index + 1) * 8),
          aspectRatio:     video.aspectRatio,
        },
      })),
    );

    console.log(`[pipeline] Fanned out ${shotList.length} Kling i2v jobs for ${videoId}`);
  },
);

// ─── 5. Scene video generation (one per scene — Kling i2v) ─────────────────────

/**
 * Submits one Kling i2v job for a single scene via fal.queue.submit + webhook.
 * The webhook at /api/video-studio/webhook/fal receives the result and fires
 * video/stitch.requested when all scenes are done.
 *
 * IMPORTANT: start_image_url = keyframeUrl (FLUX keyframe), NOT original artist photo.
 * generate_audio = false — Remotion overlays the full audio track during stitching.
 */
export const generateScene = inngest.createFunction(
  {
    id:          "generate-scene",
    triggers:    [{ event: "video/scene.generate" }],
    concurrency: { limit: 3 },
    retries:     1,
  },
  async ({ event, step }: { event: any; step: any }) => {
    const {
      videoId, sceneIndex, totalScenes, keyframeUrl,
      description, cameraDirection, filmLook, duration,
      startTime, endTime,
    } = event.data as {
      videoId:         string;
      sceneIndex:      number;
      totalScenes:     number;
      keyframeUrl:     string;
      description:     string;
      cameraDirection: string;
      filmLook:        string;
      duration:        string;
      startTime:       number;
      endTime:         number;
      aspectRatio:     string;
    };

    await step.run("submit-kling", async () => {
      fal.config({ credentials: process.env.FAL_KEY! });

      const prompt     = [description, cameraDirection, filmLook].filter(Boolean).join(". ");
      const webhookUrl = `${APP_URL}/api/video-studio/webhook/fal`;

      const { request_id } = await (fal.queue as any).submit(
        "fal-ai/kling-video/v3/pro/image-to-video",
        {
          input: {
            prompt,
            start_image_url: keyframeUrl, // FLUX keyframe — NOT the original artist photo
            duration,                     // string enum: "3", "5", "8", "10", "15"
            generate_audio:  false,       // Remotion overlays full audio; no clip audio needed
          },
          webhookUrl,
        },
      );

      console.log(`[pipeline] Kling i2v scene ${sceneIndex} submitted — request_id: ${request_id}`);

      // Store lookup record so webhook can route the result back to this scene
      await db.falSceneJob.create({
        data: {
          requestId:    request_id,
          musicVideoId: videoId,
          sceneIndex,
          sceneTotal:   totalScenes,
          model:        "fal-ai/kling-video/v3/pro/image-to-video",
        },
      });

      // Write placeholder scene entry so webhook can merge results with metadata
      const video = await db.musicVideo.findUnique({
        where:  { id: videoId },
        select: { scenes: true },
      });
      const existing: any[] = (video?.scenes as any[] | null) ?? [];
      const idx = existing.findIndex((s: any) => s.sceneIndex === sceneIndex);
      const placeholder = {
        sceneIndex,
        videoUrl:         "",
        thumbnailUrl:     null,
        model:            "fal-ai/kling-video/v3/pro/image-to-video",
        prompt,
        startTime,
        endTime,
        energyLevel:      0.5,
        qaApproved:       null,
        qaReason:         "Pending — awaiting webhook",
        qaRetried:        false,
        originalPrompt:   prompt,
        refinedPrompt:    null,
        primaryModel:     "fal-ai/kling-video/v3/pro/image-to-video",
        actualModel:      "fal-ai/kling-video/v3/pro/image-to-video",
        fallbackUsed:     false,
        fallbackAttempts: 0,
      };
      if (idx >= 0) existing[idx] = placeholder;
      else existing.push(placeholder);

      await db.musicVideo.update({
        where: { id: videoId },
        data:  { scenes: existing as object[] },
      });
    });
  },
);

// ─── 6. Stitch — Remotion Lambda assembly ───────────────────────────────────────

/**
 * Fired by the fal webhook when all Kling clips are done.
 * Reads FalSceneJob records + MusicVideo.scenes placeholders,
 * assembles GeneratedSceneOutput[], calls generateMultiFormatVideos (Remotion Lambda),
 * marks video COMPLETE, sends notification email.
 */
export const stitchVideo = inngest.createFunction(
  {
    id:       "stitch-video",
    triggers: [{ event: "video/stitch.requested" }],
    retries:  1,
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { videoId } = event.data as { videoId: string };

    await step.run("remotion-render", async () => {
      const video = await db.musicVideo.findUnique({
        where:  { id: videoId },
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
      if (!video) throw new Error(`Video ${videoId} not found`);

      const jobs = await db.falSceneJob.findMany({
        where:   { musicVideoId: videoId },
        orderBy: { sceneIndex: "asc" },
      });

      const placeholders = (video.scenes as GeneratedSceneOutput[] | null) ?? [];

      const sceneResults: GeneratedSceneOutput[] = jobs.map(j => {
        const ph = placeholders.find(s => s.sceneIndex === j.sceneIndex);
        return {
          sceneIndex:       j.sceneIndex,
          videoUrl:         j.videoUrl         ?? "",
          thumbnailUrl:     j.thumbnailUrl      ?? null,
          model:            ph?.model           ?? "fal-ai/kling-video/v3/pro/image-to-video",
          prompt:           ph?.prompt          ?? "",
          startTime:        ph?.startTime       ?? 0,
          endTime:          ph?.endTime         ?? 0,
          energyLevel:      ph?.energyLevel     ?? 0.5,
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
        throw new Error("No scenes completed — all Kling jobs failed");
      }

      await db.musicVideo.update({
        where: { id: videoId },
        data:  {
          scenes:      sceneResults as object[],
          status:      "STITCHING",
          progress:    75,
          currentStep: "Stitching your video…",
        },
      });

      const durationMs     = Math.round(video.trackDuration * 1000);
      const finalVideoUrls = await generateMultiFormatVideos(
        videoId,
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
        where: { id: videoId },
        data:  {
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

      console.log(`[pipeline] ${videoId} complete — ${completedScenes.length}/${jobs.length} scenes stitched`);

      // Notification email
      const appUrl     = APP_URL;
      const previewUrl = `${appUrl}/video-studio/${videoId}/preview`;

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
            id:             videoId,
            trackTitle:     video.trackTitle,
            guestEmail:     video.guestEmail,
            amount:         video.amount,
            mode:           video.mode,
            finalVideoUrl:  finalVideoUrl ?? null,
            finalVideoUrls: null,
          });
          await db.musicVideo.update({
            where: { id: videoId },
            data:  {
              conversionStep:   1,
              conversionNextAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            },
          });
        }
      } catch (emailErr) {
        console.warn("[pipeline] Notification email failed:", emailErr);
      }
    });
  },
);
