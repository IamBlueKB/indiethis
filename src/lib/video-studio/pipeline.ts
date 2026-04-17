/**
 * src/lib/video-studio/pipeline.ts
 *
 * Shared helpers for the fal-webhook-driven generation pipeline.
 * No Inngest — fal.ai callbacks drive every stage.
 *
 * Flow:
 *   startKeyframeGeneration()
 *     → fal FLUX Kontext Pro (one per scene, queue + webhook)
 *     → /api/video-studio/webhook/keyframe  (saves image, submits Kling job)
 *     → /api/video-studio/webhook/fal       (saves clip, stitches when all done)
 *
 *   startSceneGeneration()  ← called by keyframe webhook (Quick/Canvas)
 *                             or director approve (STORYBOARD approved)
 *     → fal Kling i2v (one per scene, queue + webhook)
 *     → /api/video-studio/webhook/fal
 */

import { fal }  from "@fal-ai/client";
import { db }   from "@/lib/db";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ─── Keyframe generation ────────────────────────────────────────────────────────

/**
 * Submits one FLUX Kontext Pro keyframe job per scene to fal.ai queue.
 * Sets video status to GENERATING and creates FalKeyframeJob records.
 * Returns immediately — results arrive via /webhook/keyframe.
 */
export async function startKeyframeGeneration(
  videoId:        string,
  scenes:         Record<string, unknown>[],
  artistImageUrl: string,
): Promise<void> {
  fal.config({ credentials: process.env.FAL_KEY! });

  await db.musicVideo.update({
    where: { id: videoId },
    data: {
      status:      "GENERATING",
      progress:    10,
      currentStep: `Generating ${scenes.length} keyframe${scenes.length !== 1 ? "s" : ""}…`,
    },
  });

  const webhookUrl = `${APP_URL}/api/video-studio/webhook/keyframe`;

  // Delete any stale keyframe jobs from previous failed attempts
  await db.falKeyframeJob.deleteMany({ where: { musicVideoId: videoId } });

  for (let i = 0; i < scenes.length; i++) {
    const scene          = scenes[i];
    const description    = (scene.description    as string) ?? "";
    const cameraDir      = (scene.cameraDirection as string) ?? "";
    const filmLook       = (scene.filmLook        as string) ?? "";

    const prompt =
      `Full body shot of this person placed in the following scene: ${description}. ` +
      `Show the complete figure from head to toe, natural pose, anatomically correct proportions, ` +
      `wide enough framing to show the entire body. ` +
      (cameraDir  ? `${cameraDir}. `  : "") +
      (filmLook   ? `${filmLook}. `   : "") +
      `Maintain the person's exact facial features, clothing, and appearance from the reference photo.`;

    const result = await (fal.queue as unknown as {
      submit: (model: string, opts: unknown) => Promise<{ request_id: string }>;
    }).submit("fal-ai/flux-pro/kontext", {
      input:      { prompt, image_url: artistImageUrl },
      webhookUrl,
    });

    await db.falKeyframeJob.create({
      data: {
        requestId:    result.request_id,
        musicVideoId: videoId,
        sceneIndex:   i,
        totalScenes:  scenes.length,
      },
    });

    console.log(`[pipeline] Keyframe job ${i + 1}/${scenes.length} submitted — request_id: ${result.request_id}`);
  }
}

// ─── Scene (video clip) generation ─────────────────────────────────────────────

/**
 * Submits one Kling i2v job per scene to fal.ai queue.
 * Reads keyframeUrl from each shotList entry — must be populated before calling.
 * Sets video status to GENERATING and creates FalSceneJob records.
 * Returns immediately — results arrive via /webhook/fal.
 */
export async function startSceneGeneration(videoId: string): Promise<void> {
  fal.config({ credentials: process.env.FAL_KEY! });

  const video = await db.musicVideo.findUnique({
    where:  { id: videoId },
    select: { shotList: true, aspectRatio: true },
  });
  if (!video) throw new Error(`Video ${videoId} not found`);

  const shotList = (video.shotList as Record<string, unknown>[]) ?? [];
  if (shotList.length === 0) throw new Error("No shots in shotList");

  // Clear stale jobs from previous failed attempts
  await db.falSceneJob.deleteMany({ where: { musicVideoId: videoId } });

  await db.musicVideo.update({
    where: { id: videoId },
    data: {
      status:      "GENERATING",
      progress:    45,
      currentStep: `Generating ${shotList.length} scene${shotList.length !== 1 ? "s" : ""}…`,
    },
  });

  const webhookUrl  = `${APP_URL}/api/video-studio/webhook/fal`;
  const aspectRatio = video.aspectRatio === "9:16" ? "9:16" : "16:9";

  // Build all placeholder scene entries first
  const placeholders = shotList.map((scene, i) => {
    const prompt = [scene.description, scene.cameraDirection, scene.filmLook]
      .filter(Boolean).join(". ") as string;
    return {
      sceneIndex:       i,
      videoUrl:         "",
      thumbnailUrl:     null,
      model:            "fal-ai/kling-video/v3/pro/image-to-video",
      prompt,
      startTime:        (scene.startTime  as number) ?? i * 8,
      endTime:          (scene.endTime    as number) ?? (i + 1) * 8,
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
  });

  await db.musicVideo.update({
    where: { id: videoId },
    data:  { scenes: placeholders as object[] },
  });

  for (let i = 0; i < shotList.length; i++) {
    const scene    = shotList[i];
    const promptParts = [
      "Full body shot, complete figure visible from head to toe",
      scene.description,
      scene.cameraDirection,
      scene.filmLook,
      "natural movement, consistent body orientation, anatomically correct",
    ].filter(Boolean);
    const prompt = promptParts.join(". ") as string;
    const duration = String(Math.min(Math.round((scene.duration as number) ?? 8), 15));

    const result = await (fal.queue as unknown as {
      submit: (model: string, opts: unknown) => Promise<{ request_id: string }>;
    }).submit("fal-ai/kling-video/v3/pro/image-to-video", {
      input: {
        start_image_url: (scene.keyframeUrl as string) ?? "",
        prompt,
        negative_prompt: "cropped body, cut off legs, torso only, disembodied, floating head, backwards legs, twisted limbs, distorted anatomy, deformed body, wrong body direction, anatomical errors, warped figure, disconnected body parts",
        duration,
        generate_audio: false,
        aspect_ratio:   aspectRatio,
      },
      webhookUrl,
    });

    await db.falSceneJob.create({
      data: {
        requestId:    result.request_id,
        musicVideoId: videoId,
        sceneIndex:   i,
        sceneTotal:   shotList.length,
        model:        "fal-ai/kling-video/v3/pro/image-to-video",
      },
    });

    console.log(`[pipeline] Kling job ${i + 1}/${shotList.length} submitted — request_id: ${result.request_id}`);
  }
}
