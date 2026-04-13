/**
 * src/lib/video-studio/models.ts
 *
 * Unified model registry for the Video Studio V2 pipeline.
 *
 * V2 primary path: Kling 3.0 Pro text-to-video with multi-shot + element referencing.
 * Legacy path:     All existing image-to-video models kept for fallback and Director
 *                  Mode per-scene overrides.
 *
 * Model type guide:
 *   text-to-video  — supports multi_prompt (multiple shots per call) and elements
 *                    (artist photo reference for character consistency across shots).
 *                    One API call can produce a full multi-shot segment.
 *   image-to-video — single scene per call; requires image_url as reference frame.
 *                    Used when a scene has a per-model override in Director Mode, or
 *                    as a fallback when text-to-video models are unavailable.
 */

// ─── Model descriptor ─────────────────────────────────────────────────────────

export interface VideoModelDescriptor {
  /** fal.ai model ID — exact string passed to fal.queue.submit / fal.subscribe */
  id:                string;
  /** Human-readable display name shown in UI */
  name:              string;
  /** "text-to-video" supports multi_prompt + elements; "image-to-video" is single-scene */
  type:              "text-to-video" | "image-to-video";
  /** Maximum shots per API call (text-to-video only; image-to-video is always 1) */
  maxShots:          number;
  /** Maximum total duration in seconds across all shots */
  maxDuration:       number;
  /** Whether this model supports multi_prompt for multi-shot generation */
  supportsMultiShot: boolean;
  /** Whether this model supports the elements[] parameter for character reference */
  supportsElements:  boolean;
  /** Whether this model supports native lip-sync to audio */
  supportsLipSync:   boolean;
  /** Estimated cost per second of output video (USD) */
  costPerSecond:     number;
}

// ─── Full model registry ──────────────────────────────────────────────────────

export const VIDEO_MODELS = {

  // ── Multi-shot capable (preferred for full music videos) ──────────────────
  // One API call = multiple shots = full video segment.
  // Artist's photo passed as elements[0].frontal_image_url for face consistency.

  "kling-3-pro": {
    id:                "fal-ai/kling-video/v3/pro/text-to-video",
    name:              "Kling 3.0 Pro",
    type:              "text-to-video",
    maxShots:          6,
    maxDuration:       15,
    supportsMultiShot: true,
    supportsElements:  true,
    supportsLipSync:   true,
    costPerSecond:     0.10,
  },

  "kling-3-standard": {
    id:                "fal-ai/kling-video/v3/standard/text-to-video",
    name:              "Kling 3.0 Standard",
    type:              "text-to-video",
    maxShots:          6,
    maxDuration:       15,
    supportsMultiShot: true,
    supportsElements:  true,
    supportsLipSync:   true,
    costPerSecond:     0.07,
  },

  "kling-o3-pro": {
    id:                "fal-ai/kling-video/o3/pro/text-to-video",
    name:              "Kling O3 Pro",
    type:              "text-to-video",
    maxShots:          6,
    maxDuration:       15,
    supportsMultiShot: true,
    supportsElements:  true,
    supportsLipSync:   true,
    costPerSecond:     0.10,
  },

  // ── Single-scene image-to-video models ────────────────────────────────────
  // Used for per-scene Director Mode overrides, or as fallbacks.
  // Each requires image_url (artist's reference photo).

  "kling-3-pro-i2v": {
    id:                "fal-ai/kling-video/v3/pro/image-to-video",
    name:              "Kling 3.0 Pro (Image)",
    type:              "image-to-video",
    maxShots:          1,
    maxDuration:       10,
    supportsMultiShot: false,
    supportsElements:  true,
    supportsLipSync:   true,
    costPerSecond:     0.10,
  },

  "kling-2.6-pro-i2v": {
    id:                "fal-ai/kling-video/v2.6/pro/image-to-video",
    name:              "Kling 2.6 Pro (Elements)",
    type:              "image-to-video",
    maxShots:          1,
    maxDuration:       10,
    supportsMultiShot: false,
    supportsElements:  true,
    supportsLipSync:   false,
    costPerSecond:     0.084,
  },

  "seedance-2": {
    id:                "fal-ai/bytedance/seedance/v2",
    name:              "Seedance 2.0",
    type:              "image-to-video",
    maxShots:          1,
    maxDuration:       5,
    supportsMultiShot: false,
    supportsElements:  false,
    supportsLipSync:   false,
    costPerSecond:     0.052,
  },

  "seedance-1.5-pro": {
    id:                "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    name:              "Seedance 1.5 Pro",
    type:              "image-to-video",
    maxShots:          1,
    maxDuration:       5,
    supportsMultiShot: false,
    supportsElements:  false,
    supportsLipSync:   false,
    costPerSecond:     0.052,
  },

  "veo-3.1": {
    id:                "fal-ai/veo3.1/image-to-video",
    name:              "Veo 3.1",
    type:              "image-to-video",
    maxShots:          1,
    maxDuration:       8,
    supportsMultiShot: false,
    supportsElements:  false,
    supportsLipSync:   true,
    costPerSecond:     0.20,
  },

  "nano-banana-2": {
    id:                "fal-ai/nano-banana-2",
    name:              "Nano Banana 2",
    type:              "image-to-video",
    maxShots:          1,
    maxDuration:       8,
    supportsMultiShot: false,
    supportsElements:  false,
    supportsLipSync:   false,
    costPerSecond:     0.05,
  },

} as const satisfies Record<string, VideoModelDescriptor>;

// ─── Type helpers ─────────────────────────────────────────────────────────────

export type VideoModelKey = keyof typeof VIDEO_MODELS;
export type VideoModelId  = typeof VIDEO_MODELS[VideoModelKey]["id"];

// ─── Defaults ─────────────────────────────────────────────────────────────────

/** Primary model for Quick Mode — multi-shot, elements, lip-sync */
export const DEFAULT_QUICK_MODEL:    VideoModelKey = "kling-3-pro";

/** Primary model for Director Mode — same; per-scene overrides can change this */
export const DEFAULT_DIRECTOR_MODEL: VideoModelKey = "kling-3-pro";

/**
 * Fallback chain for text-to-video (multi-shot) path.
 * Tried in order when the primary model fails.
 */
export const MULTISHOT_FALLBACK_CHAIN: VideoModelKey[] = [
  "kling-3-standard",
  "kling-o3-pro",
  "kling-3-pro-i2v",   // last resort: drop to single-scene i2v
];

/**
 * Fallback chain for image-to-video (single-scene) path.
 * Used when a Director Mode per-scene override fails.
 */
export const I2V_FALLBACK_CHAIN: VideoModelKey[] = [
  "kling-3-pro-i2v",
  "seedance-2",
  "seedance-1.5-pro",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Look up a model descriptor by its fal.ai model ID string */
export function getModelByFalId(falId: string): VideoModelDescriptor | undefined {
  return Object.values(VIDEO_MODELS).find(m => m.id === falId);
}

/** Look up a model descriptor by its registry key */
export function getModel(key: VideoModelKey): VideoModelDescriptor {
  return VIDEO_MODELS[key];
}

/**
 * Whether a given model key supports multi-shot generation.
 * Only text-to-video models with supportsMultiShot: true qualify.
 */
export function isMultiShotCapable(key: VideoModelKey): boolean {
  return VIDEO_MODELS[key].supportsMultiShot;
}
