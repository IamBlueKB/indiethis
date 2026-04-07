/**
 * src/lib/video-studio/generator.ts
 *
 * Music Video Studio — Production Engine
 *
 * Handles the heavy-lifting for video generation:
 *   6a. Character portrait generation via FLUX Kontext Pro
 *   6b. Per-scene video generation with model-specific fal.ai params (max 3 concurrent)
 *   6c. Multi-format Remotion Lambda stitching with beat-aligned crossfades
 *   6d. Thumbnail extraction from the highest-energy scene
 *
 * Called exclusively from generate.ts — not exposed to API routes directly.
 */

import { fal }                      from "@fal-ai/client";
import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import type { SceneSpec }            from "@/lib/video-studio/model-router";
import type { MusicVideoProps, SceneClip } from "../../../remotion/src/MusicVideoComposition";

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
  sceneIndex:   number;
  videoUrl:     string;
  model:        string;
  prompt:       string;
  startTime:    number;
  endTime:      number;
  energyLevel:  number;
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

  return {
    sceneIndex:  scene.index,
    videoUrl,
    model:       scene.model,
    prompt:      scene.prompt,
    startTime:   scene.startTime,
    endTime:     scene.endTime,
    energyLevel: scene.spec.energyLevel,
  };
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
): Promise<GeneratedSceneOutput[]> {
  const results:    GeneratedSceneOutput[] = [];
  const concurrency = 3;

  // Chunk into batches of 3
  const chunks: PlannedSceneInput[][] = [];
  for (let i = 0; i < scenes.length; i += concurrency) {
    chunks.push(scenes.slice(i, i + concurrency));
  }

  let completedCount = 0;

  for (const chunk of chunks) {
    const settled = await Promise.allSettled(
      chunk.map((scene, chunkIdx) => {
        // For Seedance 1.5 Pro transitions, pass next scene's reference if available
        const nextScene = scenes[scene.index + 1];
        const nextRef   = nextScene && scene.model === "fal-ai/bytedance/seedance/v1.5/pro/image-to-video"
          ? referenceImageUrl
          : undefined;

        return generateSceneClip(scene, referenceImageUrl, audioUrl, nextRef);
      })
    );

    for (let i = 0; i < settled.length; i++) {
      const r     = settled[i];
      const scene = chunk[i];

      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        console.error(`[generator] scene ${scene.index} failed:`, r.reason);
        // Placeholder so timeline isn't broken
        results.push({
          sceneIndex:  scene.index,
          videoUrl:    "",
          model:       scene.model,
          prompt:      scene.prompt,
          startTime:   scene.startTime,
          endTime:     scene.endTime,
          energyLevel: scene.spec.energyLevel,
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
