/**
 * src/lib/video-studio/generator.ts
 *
 * Music Video Studio — Production Engine
 *
 * Handles the heavy-lifting for video generation:
 *   6a. Character portrait generation via FLUX Kontext Pro
 *   6b. Per-scene video generation with model-specific fal.ai params (max 3 concurrent)
 *      — Model fallback chain: automatically retries with next-best model on failure
 *      — Claude QA loop: reviews each generated frame before delivery; auto-regenerates on rejection
 *   6c. Multi-format Remotion Lambda stitching with beat-aligned crossfades
 *   6d. Thumbnail extraction from the highest-energy scene
 *
 * Called exclusively from generate.ts — not exposed to API routes directly.
 */

import Anthropic                     from "@anthropic-ai/sdk";
import { fal }                      from "@fal-ai/client";
import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import type { SceneSpec }            from "@/lib/video-studio/model-router";
import type { MusicVideoProps, SceneClip } from "../../../remotion/src/MusicVideoComposition";
import { db }                        from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PlannedSceneInput {
  index:       number;
  model:       string;
  prompt:      string;
  startTime:   number;   // seconds into track
  endTime:     number;
  duration:    number;   // clip length in seconds
  aspectRatio: string;
  spec:        SceneSpec;
}

export interface GeneratedSceneOutput {
  sceneIndex:      number;
  videoUrl:        string;
  thumbnailUrl:    string | null;
  model:           string;
  prompt:          string;
  startTime:       number;
  endTime:         number;
  energyLevel:     number;
  // QA tracking
  qaApproved:      boolean | null;   // null = no thumbnail available, QA skipped
  qaReason:        string | null;
  qaRetried:       boolean;
  originalPrompt:  string;
  refinedPrompt:   string | null;
  // Fallback tracking
  primaryModel:    string;
  actualModel:     string;
  fallbackUsed:    boolean;
  fallbackAttempts: number;
  // Manual rejection tracking (Reject & Redirect)
  manualRejected?:     boolean;
  manualRedirectNote?: string;
}

// ─── 6a: Character portrait via FLUX Kontext Pro ────────────────────────────────

/**
 * Generates a consistent character reference image from one or more
 * reference photos. The resulting portrait URL is fed into every scene
 * that has characterRefs, providing visual character lock across clips.
 *
 * Uses fal-ai/flux-kontext/pro (image-to-image editing model).
 */
export async function generateCharacterPortrait(
  referenceImageUrl: string,
  styleBase:         string,
): Promise<string> {
  const prompt = `${styleBase}, professional music video lighting, clean background, consistent character portrait, facing camera, sharp focus, cinematic quality`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await fal.subscribe("fal-ai/flux-kontext/pro" as any, {
    input: {
      prompt,
      image_url:       referenceImageUrl,
      guidance_scale:  3.5,
      num_inference_steps: 28,
      output_format:   "jpeg",
    },
    pollInterval: 3000,
    logs:         false,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output = (result as any).data ?? result;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageUrl = (output as any)?.images?.[0]?.url ?? (output as any)?.image?.url ?? "";

  if (!imageUrl) throw new Error("FLUX Kontext Pro returned no image");
  return imageUrl;
}

// ─── 6b: Per-scene generation with model-specific params ─────────────────────────

/**
 * Generates a single scene clip using the appropriate fal.ai model.
 *
 * Each model has different API surface:
 *   Kling 3.0 Pro / 2.6 Pro — image_url (optional), prompt, duration, aspect_ratio
 *   Veo 3.1                 — image_url (optional), prompt, duration, aspect_ratio
 *   Seedance 2.0            — image_url (optional), prompt, audio_url (optional)
 *   Seedance 1.5 Pro        — start_image_url + end_image_url for keyframe transitions
 */
export async function generateSceneClip(
  scene:               PlannedSceneInput,
  referenceImageUrl?:  string,
  audioUrl?:           string,
  nextSceneImageUrl?:  string,   // used by Seedance 1.5 Pro for keyframe transitions
  // Webhook mode (production): submit job and return immediately; webhook delivers result
  webhookUrl?:         string,   // if set → use fal.queue.submit instead of fal.subscribe
  musicVideoId?:       string,   // required when webhookUrl is set; stored in FalSceneJob
  sceneTotal?:         number,   // total scenes for this video; stored in FalSceneJob
): Promise<GeneratedSceneOutput> {

  const aspectRatioParam =
    scene.aspectRatio === "9:16" ? "9:16" :
    scene.aspectRatio === "1:1"  ? "1:1"  :
    "16:9";

  const clipDuration = Math.min(Math.round(scene.duration), 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let input: Record<string, any> = {
    prompt:       scene.prompt,
    duration:     clipDuration,
    aspect_ratio: aspectRatioParam,
  };

  // Add reference image for models that support it
  if (referenceImageUrl) {
    input.image_url = referenceImageUrl;
  }

  // Model-specific overrides
  if (scene.model === "fal-ai/bytedance/seedance/v2") {
    // Seedance 2.0 — supports audio embedding
    if (audioUrl) input.audio_url = audioUrl;
    // Seedance 2.0 uses 5s clips max
    input.duration = Math.min(clipDuration, 5);
  }

  if (scene.model === "fal-ai/bytedance/seedance/v1.5/pro/image-to-video") {
    // Seedance 1.5 Pro — keyframe transitions
    input.duration = Math.min(clipDuration, 5);
    if (nextSceneImageUrl) {
      input.end_image_url = nextSceneImageUrl;
    }
    // Rename image_url → start_image_url
    if (input.image_url) {
      input.start_image_url = input.image_url;
      delete input.image_url;
    }
  }

  if (scene.model === "fal-ai/kling-video/v2.6/pro/image-to-video") {
    // Kling 2.6 Pro (Elements) — character ref consistency
    // image_url is already set above if referenceImageUrl exists
  }

  // ── PRODUCTION (webhook mode): submit job, store lookup record, return placeholder ──
  if (webhookUrl && musicVideoId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { request_id } = await fal.queue.submit(scene.model as any, {
      input,
      webhookUrl,
    });

    console.log(`[fal.queue.submit] scene ${scene.index} request_id: ${request_id}`);

    // Store lookup so the webhook can route the result back to this scene
    await db.falSceneJob.create({
      data: {
        requestId:    request_id,
        musicVideoId,
        sceneIndex:   scene.index,
        sceneTotal:   sceneTotal ?? 1,
      },
    });

    console.log(
      `[generator] Scene ${scene.index} submitted to fal.ai — request_id: ${request_id}`,
    );

    // Return placeholder — the webhook fills in videoUrl/thumbnailUrl when complete
    return {
      sceneIndex:       scene.index,
      videoUrl:         "",
      thumbnailUrl:     null,
      model:            scene.model,
      prompt:           scene.prompt,
      startTime:        scene.startTime,
      endTime:          scene.endTime,
      energyLevel:      scene.spec.energyLevel,
      qaApproved:       null,
      qaReason:         "Pending — awaiting webhook",
      qaRetried:        false,
      originalPrompt:   scene.prompt,
      refinedPrompt:    null,
      primaryModel:     scene.model,
      actualModel:      scene.model,
      fallbackUsed:     false,
      fallbackAttempts: 0,
    };
  }

  // ── DEV (polling mode): block until fal.ai completes ─────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await fal.subscribe(scene.model as any, {
    input,
    pollInterval: 5000,
    logs:         false,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output   = (result as any).data ?? result;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoUrl = (output as any)?.video?.url ?? (output as any)?.url ?? "";
  // Some fal.ai models (Kling) include a thumbnail_url on the video object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const thumbnailUrl: string | null = (output as any)?.video?.thumbnail_url ?? null;

  return {
    sceneIndex:       scene.index,
    videoUrl,
    thumbnailUrl,
    model:            scene.model,
    prompt:           scene.prompt,
    startTime:        scene.startTime,
    endTime:          scene.endTime,
    energyLevel:      scene.spec.energyLevel,
    // QA + fallback defaults — overwritten by generateSceneWithFallback
    qaApproved:       null,
    qaReason:         null,
    qaRetried:        false,
    originalPrompt:   scene.prompt,
    refinedPrompt:    null,
    primaryModel:     scene.model,
    actualModel:      scene.model,
    fallbackUsed:     false,
    fallbackAttempts: 0,
  };
}

// ─── Claude QA loop ───────────────────────────────────────────────────────────────

interface QAResult {
  approved:      boolean;
  reason:        string;
  refinedPrompt: string | null;
}

/**
 * Sends a generated scene thumbnail to Claude for quality review.
 * Claude evaluates whether the frame matches the scene description, has
 * acceptable visual quality, and matches the requested mood/energy level.
 *
 * Returns approved=true to pass, approved=false to trigger a one-time retry
 * with the refinedPrompt. If the thumbnail URL is unavailable, returns
 * approved=true so generation continues without blocking.
 */
async function qaReviewScene(
  clipThumbnailUrl: string,
  sceneDescription: string,
  cameraDirection:  string,
  energyLevel:      number,
): Promise<QAResult> {
  const energyLabel = energyLevel > 0.7 ? "high" : energyLevel > 0.4 ? "medium" : "low";

  const qaPrompt = `You are a quality control reviewer for AI-generated music video scenes.

Compare this generated frame against the original scene description.

Scene description: "${sceneDescription}"
Camera direction: "${cameraDirection}"
Mood/energy: "${energyLabel}"

Evaluate on three criteria:
1. Does the scene match the described setting and content?
2. Is the visual quality acceptable (not blurry, not distorted, no artifacts)?
3. Does the mood/lighting match the requested energy level?

Respond with ONLY a JSON object:
{
  "approved": true/false,
  "reason": "one sentence explanation",
  "refinedPrompt": "improved prompt if rejected, null if approved"
}`;

  try {
    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages:   [{
        role:    "user",
        content: [
          { type: "image", source: { type: "url", url: clipThumbnailUrl } },
          { type: "text",  text: qaPrompt },
        ],
      }],
    });

    const text    = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as QAResult;
  } catch (err) {
    // If Claude is unavailable or response is unparseable, pass the scene through
    console.warn("[generator] QA review failed — passing scene through:", err);
    return { approved: true, reason: "QA skipped (parse error)", refinedPrompt: null };
  }
}

// ─── Model fallback chain ─────────────────────────────────────────────────────────

/**
 * Ordered fallback list for each primary model.
 * On infrastructure failure (timeout / 500 / rate limit), the pipeline
 * automatically tries the next model in the chain.
 *
 * Uses the actual fal.ai model identifiers from model-router.ts.
 */
const MODEL_FALLBACKS: Record<string, string[]> = {
  "fal-ai/veo3.1/image-to-video": [
    "fal-ai/kling-video/v3/pro/image-to-video",
    "fal-ai/bytedance/seedance/v2",
  ],
  "fal-ai/bytedance/seedance/v2": [
    "fal-ai/kling-video/v3/pro/image-to-video",
    "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
  ],
  "fal-ai/kling-video/v3/pro/image-to-video": [
    "fal-ai/bytedance/seedance/v2",
    "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
  ],
  "fal-ai/kling-video/v2.6/pro/image-to-video": [
    "fal-ai/kling-video/v3/pro/image-to-video",
    "fal-ai/bytedance/seedance/v2",
  ],
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video": [
    "fal-ai/kling-video/v3/pro/image-to-video",
    "fal-ai/bytedance/seedance/v2",
  ],
};

/**
 * Wraps generateSceneClip with a fallback chain + Claude QA review.
 *
 * Pipeline per scene:
 *   1. Try primary model → on failure, try fallback 1 → fallback 2
 *   2. Once any model succeeds, run Claude QA (if thumbnail available)
 *   3. If QA rejects → regenerate once with refined prompt (using same model)
 *   4. Return result regardless of second attempt quality
 *
 * Max calls per scene: 3 model attempts + 1 QA call + 1 QA retry = 5
 * Typical scene:       1 model call + 1 QA call = 2
 */
async function generateSceneWithFallback(
  scene:              PlannedSceneInput,
  referenceImageUrl?: string,
  audioUrl?:          string,
  nextSceneImageUrl?: string,
  webhookUrl?:        string,
  musicVideoId?:      string,
  sceneTotal?:        number,
): Promise<GeneratedSceneOutput> {
  const primaryModel   = scene.model;
  const fallbacks      = MODEL_FALLBACKS[primaryModel] ?? [];
  const modelsToTry    = [primaryModel, ...fallbacks];
  let fallbackAttempts = 0;

  let clip: GeneratedSceneOutput | null = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      clip = await generateSceneClip(
        { ...scene, model },
        referenceImageUrl,
        audioUrl,
        nextSceneImageUrl,
        webhookUrl,
        musicVideoId,
        sceneTotal,
      );

      if (i > 0) {
        fallbackAttempts = i;
        console.log(
          `[generator] scene ${scene.index}: primary ${primaryModel} failed, succeeded with fallback ${model}`,
        );
      }
      break; // success — exit model loop
    } catch (err) {
      console.error(
        `[generator] scene ${scene.index}: model ${model} failed (attempt ${i + 1}/${modelsToTry.length})`,
        err,
      );
      if (i === modelsToTry.length - 1) {
        // All models exhausted — throw so generateAllScenes can write a placeholder
        throw new Error(
          `Scene ${scene.index} failed after ${modelsToTry.length} models: ${modelsToTry.join(" → ")}`,
        );
      }
    }
  }

  if (!clip) throw new Error(`Scene ${scene.index}: no clip generated`);

  // Annotate fallback metadata
  clip.primaryModel     = primaryModel;
  clip.actualModel      = clip.model;
  clip.fallbackUsed     = fallbackAttempts > 0;
  clip.fallbackAttempts = fallbackAttempts;
  clip.originalPrompt   = scene.prompt;

  // ── Claude QA review ──────────────────────────────────────────────────────
  if (clip.thumbnailUrl) {
    const cameraDirection = scene.spec.type; // use scene type as proxy for camera direction
    const qaResult = await qaReviewScene(
      clip.thumbnailUrl,
      scene.prompt,
      cameraDirection,
      scene.spec.energyLevel,
    );

    clip.qaApproved = qaResult.approved;
    clip.qaReason   = qaResult.reason;

    if (!qaResult.approved) {
      console.log(`[generator] scene ${scene.index} QA rejected: ${qaResult.reason}`);

      // Retry once with the refined prompt — always use polling for QA retry
      // (webhook mode doesn't support synchronous QA retries)
      const retryPrompt = qaResult.refinedPrompt ?? scene.prompt;
      try {
        const retryClip = await generateSceneClip(
          { ...scene, model: clip.actualModel, prompt: retryPrompt },
          referenceImageUrl,
          audioUrl,
          nextSceneImageUrl,
          // No webhookUrl/musicVideoId — force polling mode for QA retry
        );
        // Preserve QA metadata, adopt retry's video/thumbnail
        clip.videoUrl      = retryClip.videoUrl;
        clip.thumbnailUrl  = retryClip.thumbnailUrl;
        clip.qaRetried     = true;
        clip.refinedPrompt = retryPrompt;
      } catch (retryErr) {
        // Retry failed — show original clip to artist anyway
        console.warn(`[generator] scene ${scene.index} QA retry failed:`, retryErr);
        clip.qaRetried     = true;
        clip.refinedPrompt = retryPrompt;
      }
    }
  } else {
    // No thumbnail — QA skipped gracefully
    clip.qaApproved = null;
    clip.qaReason   = "No thumbnail available";
  }

  return clip;
}

// ─── Parallel scene generation (max 3 concurrent) ────────────────────────────────

/**
 * Generates all planned scenes in parallel batches of 3.
 * Failed scenes receive empty videoUrl placeholders so downstream stitching
 * skips them without crashing.
 */
export async function generateAllScenes(
  scenes:              PlannedSceneInput[],
  referenceImageUrl?:  string,
  audioUrl?:           string,
  onProgress?:         (completed: number, total: number) => void,
  // Webhook mode params — when set, submission is fire-and-forget
  webhookUrl?:         string,
  musicVideoId?:       string,
): Promise<GeneratedSceneOutput[]> {
  const results:    GeneratedSceneOutput[] = [];
  const concurrency = 3;
  const sceneTotal  = scenes.length;

  // Chunk into batches of 3
  const chunks: PlannedSceneInput[][] = [];
  for (let i = 0; i < scenes.length; i += concurrency) {
    chunks.push(scenes.slice(i, i + concurrency));
  }

  let completedCount = 0;

  for (const chunk of chunks) {
    const settled = await Promise.allSettled(
      chunk.map((scene) => {
        // For Seedance 1.5 Pro transitions, pass next scene's reference if available
        const nextScene = scenes[scene.index + 1];
        const nextRef   = nextScene && scene.model === "fal-ai/bytedance/seedance/v1.5/pro/image-to-video"
          ? referenceImageUrl
          : undefined;

        // generateSceneWithFallback handles model fallback + Claude QA (polling)
        // or fal.queue.submit (webhook mode — returns placeholder immediately)
        return generateSceneWithFallback(
          scene, referenceImageUrl, audioUrl, nextRef,
          webhookUrl, musicVideoId, sceneTotal,
        );
      })
    );

    for (let i = 0; i < settled.length; i++) {
      const r     = settled[i];
      const scene = chunk[i];

      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        console.error(`[generator] scene ${scene.index} failed all fallbacks:`, r.reason);
        // Placeholder so timeline isn't broken
        results.push({
          sceneIndex:       scene.index,
          videoUrl:         "",
          thumbnailUrl:     null,
          model:            scene.model,
          prompt:           scene.prompt,
          startTime:        scene.startTime,
          endTime:          scene.endTime,
          energyLevel:      scene.spec.energyLevel,
          qaApproved:       null,
          qaReason:         "Generation failed",
          qaRetried:        false,
          originalPrompt:   scene.prompt,
          refinedPrompt:    null,
          primaryModel:     scene.model,
          actualModel:      scene.model,
          fallbackUsed:     false,
          fallbackAttempts: 0,
        });
      }
    }

    completedCount += chunk.length;
    onProgress?.(completedCount, scenes.length);
  }

  // Sort by sceneIndex so timeline is ordered
  return results.sort((a, b) => a.sceneIndex - b.sceneIndex);
}

// ─── 6c: Remotion Lambda stitching ───────────────────────────────────────────────

const POLL_INTERVAL_MS = 8_000;
const MAX_RENDER_MS    = 20 * 60 * 1000; // 20 minutes

/**
 * Stitches generated scene clips into a final video using Remotion Lambda.
 * Beat-aligned crossfades are achieved via the MusicVideoComposition Remotion
 * component which interpolates opacity at scene boundaries.
 *
 * Returns the public S3 URL of the final rendered video.
 */
export async function stitchWithRemotion(
  videoId:     string,
  scenes:      GeneratedSceneOutput[],
  audioUrl:    string,
  aspectRatio: string,
  durationMs:  number,
): Promise<string> {
  const serveUrl     = process.env.REMOTION_SERVE_URL;
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const awsRegion    = (process.env.REMOTION_REGION ?? process.env.AWS_REGION ?? "us-east-1") as Parameters<typeof renderMediaOnLambda>[0]["region"];

  if (!serveUrl || !functionName) {
    console.warn("[generator] Remotion not configured — returning first scene URL as fallback");
    return scenes.find(s => s.videoUrl)?.videoUrl ?? "";
  }

  const validRatio = (aspectRatio === "9:16" || aspectRatio === "1:1") ? aspectRatio : "16:9";

  const sceneClips: SceneClip[] = scenes
    .filter(s => s.videoUrl)
    .map(s => ({
      videoUrl:  s.videoUrl,
      startTime: s.startTime,
      endTime:   s.endTime,
      duration:  s.endTime - s.startTime,
    }));

  const inputProps: MusicVideoProps = {
    scenes:      sceneClips,
    audioUrl,
    aspectRatio: validRatio as "16:9" | "9:16" | "1:1",
    durationMs,
    crossfadeMs: 500,
  };

  const { renderId, bucketName } = await renderMediaOnLambda({
    region:       awsRegion,
    functionName,
    serveUrl,
    composition:  "MusicVideoComposition",
    inputProps:   inputProps as unknown as Record<string, unknown>,
    codec:        "h264",
    imageFormat:  "jpeg",
    maxRetries:   2,
    privacy:      "public",
    outName:      `music-video-${videoId}-${validRatio.replace(":", "x")}.mp4`,
  });

  // Poll until done
  const renderStart = Date.now();
  while (Date.now() - renderStart < MAX_RENDER_MS) {
    await new Promise<void>(r => setTimeout(r, POLL_INTERVAL_MS));

    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region: awsRegion,
    });

    if (progress.fatalErrorEncountered) {
      const errMsg = progress.errors?.[0]?.message ?? "Unknown Remotion error";
      console.error(`[generator] Remotion render failed for ${videoId}:`, errMsg);
      // Fall back to first valid scene URL rather than crashing the whole pipeline
      return scenes.find(s => s.videoUrl)?.videoUrl ?? "";
    }

    if (progress.done) {
      return progress.outputFile ?? "";
    }
  }

  console.error(`[generator] Remotion render timed out for ${videoId}`);
  return scenes.find(s => s.videoUrl)?.videoUrl ?? "";
}

/**
 * Render one video per requested aspect ratio in sequence.
 * Returns a Record<string, string> mapping ratio → final video URL.
 */
export async function generateMultiFormatVideos(
  videoId:      string,
  scenes:       GeneratedSceneOutput[],
  audioUrl:     string,
  aspectRatios: string[],
  durationMs:   number,
): Promise<Record<string, string>> {
  const output: Record<string, string> = {};

  for (const ratio of aspectRatios) {
    const url = await stitchWithRemotion(videoId, scenes, audioUrl, ratio, durationMs);
    if (url) output[ratio] = url;
  }

  return output;
}

// ─── 6d: Thumbnail from highest-energy scene ──────────────────────────────────────

/**
 * Returns the videoUrl of the scene with the highest energy level.
 * The preview thumbnail is derived from this clip at the 1-second mark
 * by the client — we just identify which clip to use.
 */
export function pickThumbnailScene(scenes: GeneratedSceneOutput[]): GeneratedSceneOutput | null {
  const valid = scenes.filter(s => s.videoUrl);
  if (valid.length === 0) return null;

  return valid.reduce((best, s) =>
    s.energyLevel > best.energyLevel ? s : best
  , valid[0]);
}
