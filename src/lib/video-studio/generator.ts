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
import { VIDEO_MODELS, MULTISHOT_FALLBACK_CHAIN, type VideoModelKey } from "@/lib/video-studio/models";
import type { MusicVideoProps, SceneClip } from "../../../remotion/src/MusicVideoComposition";
import { db }                        from "@/lib/db";
import { optimizeVideoPrompt }       from "@/lib/wavespeed";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PlannedSceneInput {
  index:              number;
  model:              string;
  prompt:             string;
  startTime:          number;   // seconds into track
  endTime:            number;
  duration:           number;   // clip length in seconds
  aspectRatio:        string;
  spec:               SceneSpec;
  referenceImageUrl?: string;   // per-scene override (Director Mode); falls back to global ref
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

// ─── V2 Multi-shot generation (Kling 3.0 text-to-video) ─────────────────────────

/**
 * Input for a single shot within a multi-shot segment.
 */
interface MultiShotInput {
  prompt:   string;
  duration: number; // seconds, 3-15 per Kling limit
}

/**
 * Split an array of shots into batches of at most maxPerSegment.
 * Kling 3.0 supports max 6 shots per API call.
 */
function chunkShots(
  shots:           MultiShotInput[],
  maxPerSegment:   number,
  maxTotalSeconds: number = Infinity,
): MultiShotInput[][] {
  const chunks: MultiShotInput[][] = [];
  let current: MultiShotInput[]   = [];
  let currentDuration              = 0;

  for (const shot of shots) {
    const wouldExceedCount    = current.length >= maxPerSegment;
    const wouldExceedDuration = current.length > 0 && (currentDuration + shot.duration) > maxTotalSeconds;

    if (wouldExceedCount || wouldExceedDuration) {
      chunks.push(current);
      current         = [];
      currentDuration = 0;
    }

    current.push(shot);
    currentDuration += shot.duration;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Ensures every prompt references the artist as @Element1.
 * Kling's element referencing requires @Element1 in the prompt text
 * for the uploaded reference image to be applied to that character.
 */
function ensureElementReference(prompt: string): string {
  if (prompt.includes("@Element1")) return prompt;
  // Prepend @Element1 to the prompt so Kling binds the artist reference
  return `@Element1 ${prompt}`;
}

/**
 * V2 core generation function — submits all scenes as multi-shot Kling 3.0 calls.
 *
 * Flow:
 *   1. Optimize each scene prompt through WaveSpeed
 *   2. Inject @Element1 reference into every prompt
 *   3. Chunk into segments of ≤6 shots (Kling's per-call limit)
 *   4. Submit each segment as one fal.queue.submit / fal.subscribe call
 *   5. Create a FalSceneJob record per segment (webhook routes results back)
 *
 * In production: fire-and-forget — webhook handles completion and stitching.
 * In dev:        polling — blocks until each segment completes.
 *
 * @param jobId          MusicVideo record ID
 * @param scenes         Planned scenes (from shot list or auto-generated)
 * @param artistImageUrl User's uploaded reference photo (used as elements[0])
 * @param audioUrl       Artist's audio track URL
 * @param aspectRatio    "16:9" | "9:16" | "1:1"
 * @param hasVocals      When true, prompts include singing/performing context for lip-sync
 * @param webhookUrl     Production webhook URL; undefined → dev polling mode
 * @param modelKey       Model to use; defaults to DEFAULT_QUICK_MODEL (kling-3-pro)
 */
export async function generateMultiShotVideo(
  jobId:          string,
  scenes:         PlannedSceneInput[],
  artistImageUrl: string,
  audioUrl:       string,
  aspectRatio:    string,
  hasVocals:      boolean = false,
  webhookUrl?:    string,
  modelKey:       VideoModelKey = "kling-3-pro",
): Promise<void> {

  // ── 1. Resolve model — fall back through chain if key is invalid ─────────────
  let activeModelKey = modelKey;
  if (!VIDEO_MODELS[activeModelKey]) {
    activeModelKey = "kling-3-pro";
  }
  const modelId = VIDEO_MODELS[activeModelKey].id;

  // ── 2. Optimize prompts + inject @Element1 ───────────────────────────────────
  const optimizedShots: MultiShotInput[] = [];

  for (const scene of scenes) {
    let prompt = scene.prompt;

    // Inject element reference if missing
    prompt = ensureElementReference(prompt);

    // WaveSpeed prompt optimization (no-op if WAVESPEED_API_KEY not set)
    prompt = await optimizeVideoPrompt(prompt, "kling");

    optimizedShots.push({
      prompt,
      duration: Math.min(scene.duration || 5, 15),
    });
  }

  // ── 3. Chunk into segments respecting maxShots AND maxDuration ──────────────
  const segments = chunkShots(
    optimizedShots,
    VIDEO_MODELS[activeModelKey].maxShots,
    VIDEO_MODELS[activeModelKey].maxDuration,
  );

  console.log(
    `[generateMultiShotVideo] ${scenes.length} shots → ${segments.length} segment(s) via ${modelId}`,
  );

  // ── 3b. Write segment placeholders to DB (production webhook mode only) ─────
  // The webhook reads video.scenes to get timing / prompt metadata per segment.
  // One placeholder per segment; indices match FalSceneJob.sceneIndex.
  // The webhook replaces these with final results (video URLs) on completion.
  if (webhookUrl) {
    const maxShots         = VIDEO_MODELS[activeModelKey].maxShots;
    const segPlaceholders: GeneratedSceneOutput[] = segments.map((seg, segIdx) => {
      const offset    = segIdx * maxShots;
      const segScenes = scenes.slice(offset, offset + seg.length);
      const startTime = segScenes[0]?.startTime ?? 0;
      const endTime   = segScenes[segScenes.length - 1]?.endTime ?? 0;
      const energy    = segScenes.reduce((s, sc) => s + (sc.spec?.energyLevel ?? 0.5), 0)
                        / Math.max(segScenes.length, 1);

      return {
        sceneIndex:      segIdx,
        videoUrl:        "",
        thumbnailUrl:    null,
        model:           modelId,
        prompt:          seg.map(s => s.prompt).join(" · "),
        startTime,
        endTime,
        energyLevel:     Math.round(energy * 100) / 100,
        qaApproved:      null,
        qaReason:        "Pending — awaiting segment webhook",
        qaRetried:       false,
        originalPrompt:  seg.map(s => s.prompt).join(" · "),
        refinedPrompt:   null,
        primaryModel:    modelId,
        actualModel:     modelId,
        fallbackUsed:    false,
        fallbackAttempts: 0,
      };
    });

    await db.musicVideo.update({
      where: { id: jobId },
      data:  {
        scenes:      segPlaceholders as object[],
        progress:    25,
        currentStep: `Generating ${segments.length} segment${segments.length !== 1 ? "s" : ""}…`,
      },
    });
  }

  // ── 4. Submit each segment ──────────────────────────────────────────────────
  const validRatio = (aspectRatio === "9:16" || aspectRatio === "1:1") ? aspectRatio : "16:9";

  const maxShotsPerSeg = VIDEO_MODELS[activeModelKey].maxShots;

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const segment = segments[segIdx];

    // Identify original scenes for this segment to get timing + lip-sync flags
    const segOffset  = segIdx * maxShotsPerSeg;
    const segScenes  = scenes.slice(segOffset, segOffset + segment.length);

    // Per-segment lip-sync: only enable if any shot in this segment needs it
    const segHasLipSync = hasVocals && segScenes.some(s => s.spec?.hasLipSync);
    const segStartTime  = segScenes[0]?.startTime ?? 0;
    const segEndTime    = segScenes[segScenes.length - 1]?.endTime ?? segStartTime;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input: Record<string, any> = {
      multi_prompt: segment.map(s => ({
        prompt:   s.prompt,
        duration: String(s.duration), // fal.ai expects string
      })),
      multi_prompt_type: "customize",
      elements: [{
        frontal_image_url: artistImageUrl,
      }],
      aspect_ratio:   validRatio,
      generate_audio: false, // artist's audio is overlaid separately by Remotion
    };

    // Lip-sync: pass audio + per-segment time range so Kling syncs the correct
    // portion of the track to @Element1's mouth movement in this segment.
    if (segHasLipSync && audioUrl) {
      input.sound_url        = audioUrl;
      input.sound_start_time = segStartTime;
      input.sound_end_time   = segEndTime;
      console.log(
        `[generateMultiShotVideo] Segment ${segIdx}: lip-sync ON ` +
        `(${segStartTime.toFixed(1)}s → ${segEndTime.toFixed(1)}s)`,
      );
    }

    if (webhookUrl) {
      // ── PRODUCTION: fire-and-forget via webhook ────────────────────────────
      let requestId: string;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const submitted = await (fal.queue as any).submit(modelId, { input, webhookUrl });
        requestId = submitted.request_id;
      } catch (primaryErr) {
        console.error(`[generateMultiShotVideo] Primary model ${modelId} failed for segment ${segIdx}:`, primaryErr);

        // Try fallback chain
        let submitted: { request_id: string } | null = null;
        for (const fallbackKey of MULTISHOT_FALLBACK_CHAIN) {
          const fallbackId = VIDEO_MODELS[fallbackKey].id;
          if (fallbackId === modelId) continue; // skip same model
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            submitted = await (fal.queue as any).submit(fallbackId, { input, webhookUrl });
            console.log(`[generateMultiShotVideo] Segment ${segIdx} fell back to ${fallbackId}`);
            break;
          } catch (fbErr) {
            console.error(`[generateMultiShotVideo] Fallback ${fallbackId} also failed:`, fbErr);
          }
        }

        if (!submitted) {
          // All models failed — mark this segment failed in DB
          await db.falSceneJob.create({
            data: {
              requestId:    `failed-${jobId}-seg${segIdx}-${Date.now()}`,
              musicVideoId: jobId,
              sceneIndex:   segIdx,
              sceneTotal:   segments.length,
              status:       "FAILED",
              model:        modelId,
            },
          });
          console.error(`[generateMultiShotVideo] Segment ${segIdx} failed all fallbacks — marked FAILED`);
          continue;
        }

        requestId = submitted.request_id;
      }

      console.log(`[fal.queue.submit] segment ${segIdx}/${segments.length - 1} request_id: ${requestId}`);

      await db.falSceneJob.create({
        data: {
          requestId:    requestId,
          musicVideoId: jobId,
          sceneIndex:   segIdx,
          sceneTotal:   segments.length,
          status:       "PENDING",
          model:        modelId,
        },
      });

    } else {
      // ── DEV: blocking polling ───────────────────────────────────────────────
      console.log(`[generateMultiShotVideo] Dev polling — segment ${segIdx}/${segments.length - 1}`);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (fal as any).subscribe(modelId, {
          input,
          pollInterval: 5000,
          logs:         false,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const output   = (result as any).data ?? result;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const videoUrl = (output as any)?.video?.url ?? (output as any)?.url ?? "";

        await db.falSceneJob.create({
          data: {
            requestId:    `dev-${jobId}-seg${segIdx}-${Date.now()}`,
            musicVideoId: jobId,
            sceneIndex:   segIdx,
            sceneTotal:   segments.length,
            status:       videoUrl ? "COMPLETE" : "FAILED",
            videoUrl:     videoUrl || null,
            model:        modelId,
          },
        });

        console.log(`[generateMultiShotVideo] Segment ${segIdx} complete — ${videoUrl ? "✓" : "FAILED"}`);
      } catch (err) {
        console.error(`[generateMultiShotVideo] Dev polling failed for segment ${segIdx}:`, err);
        await db.falSceneJob.create({
          data: {
            requestId:    `dev-failed-${jobId}-seg${segIdx}-${Date.now()}`,
            musicVideoId: jobId,
            sceneIndex:   segIdx,
            sceneTotal:   segments.length,
            status:       "FAILED",
            model:        modelId,
          },
        });
      }
    }
  }
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
        model:        scene.model,
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
        // Per-scene override takes priority over the global reference image
        const sceneRef = scene.referenceImageUrl ?? referenceImageUrl;

        // For Seedance 1.5 Pro transitions, pass next scene's reference if available
        const nextScene    = scenes[scene.index + 1];
        const nextSceneRef = nextScene?.referenceImageUrl ?? referenceImageUrl;
        const nextRef      = nextScene && scene.model === "fal-ai/bytedance/seedance/v1.5/pro/image-to-video"
          ? nextSceneRef
          : undefined;

        // generateSceneWithFallback handles model fallback + Claude QA (polling)
        // or fal.queue.submit (webhook mode — returns placeholder immediately)
        return generateSceneWithFallback(
          scene, sceneRef, audioUrl, nextRef,
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
 * Render one video per requested aspect ratio in sequence, plus an optional
 * Spotify Canvas short-form clip (9:16, max 30 seconds).
 *
 * Returns a Record<string, string> mapping ratio → final video URL.
 * The Spotify Canvas URL (if generated) is stored under the key "spotify-canvas".
 *
 * @param includeSpotifyCanvas  When true, also renders a 9:16 clip capped at 30s
 *                               for use as a Spotify Canvas or Instagram Reel preview.
 */
export async function generateMultiFormatVideos(
  videoId:              string,
  scenes:               GeneratedSceneOutput[],
  audioUrl:             string,
  aspectRatios:         string[],
  durationMs:           number,
  includeSpotifyCanvas: boolean = false,
): Promise<Record<string, string>> {
  // Deduplicate ratios
  const ratios = Array.from(new Set(aspectRatios));
  const output: Record<string, string> = {};

  for (const ratio of ratios) {
    const url = await stitchWithRemotion(videoId, scenes, audioUrl, ratio, durationMs);
    if (url) output[ratio] = url;
  }

  // Spotify Canvas: 9:16 portrait, max 30 seconds
  // Reuses the 9:16 render if it was already generated within the time limit;
  // otherwise renders a dedicated short clip.
  if (includeSpotifyCanvas) {
    const CANVAS_MAX_MS = 30_000;

    if (output["9:16"] && durationMs <= CANVAS_MAX_MS) {
      // Full 9:16 video is short enough — reuse it directly
      output["spotify-canvas"] = output["9:16"];
    } else {
      // Render a dedicated 9:16 Spotify Canvas (capped at 30s)
      const canvasDuration = Math.min(durationMs, CANVAS_MAX_MS);
      const canvasUrl      = await stitchWithRemotion(
        `${videoId}-canvas`,
        scenes,
        audioUrl,
        "9:16",
        canvasDuration,
      );
      if (canvasUrl) output["spotify-canvas"] = canvasUrl;
    }
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
