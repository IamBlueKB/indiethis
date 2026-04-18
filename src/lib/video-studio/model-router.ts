/**
 * src/lib/video-studio/model-router.ts
 *
 * Music Video Studio — Model Router
 *
 * Selects the optimal fal.ai video generation model for each scene based on
 * its creative requirements. Director Mode uses the full routing logic.
 * Quick Mode always uses a single model (Kling 3.0 Pro) for cost predictability.
 *
 * Model registry (as of 2026):
 *   Veo 3.1         — fal-ai/veo3.1/image-to-video        — best lip sync
 *   Seedance 2.0    — fal-ai/bytedance/seedance/v2         — multi-scene narrative
 *   Kling 3.0 Pro   — fal-ai/kling-video/v3/pro/image-to-video — motion + aesthetic
 *   Kling 2.6 Pro   — fal-ai/kling-video/v2.6/pro/image-to-video — character refs (Elements)
 *   Seedance 1.5 Pro — fal-ai/bytedance/seedance/v1.5/pro/image-to-video — keyframe transitions
 *
 * NOTE: Model names are shown in Director Mode's shot list for transparency,
 * but users never choose models directly.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SceneType =
  | "performance"   // Artist singing / performing to camera
  | "narrative"     // Story-driven, characters in action
  | "abstract"      // Mood visuals, no characters
  | "transition"    // Scene-to-scene bridge clip
  | "establishing"; // Wide establishing shot, sets location

export interface SceneSpec {
  type:                  SceneType;
  hasLipSync:            boolean;  // scene includes singing with mouth movement
  hasFastMotion:         boolean;  // action, dance, high-energy movement
  hasMultipleCharacters: boolean;  // two or more people in frame
  characterRefs:         string[]; // reference image URLs for character consistency
  energyLevel:           number;   // 0–1, from SongSection.energy
  duration:              number;   // target clip length in seconds
}

export type FalModel =
  | "fal-ai/veo3.1/image-to-video"
  | "fal-ai/bytedance/seedance/v2"
  | "fal-ai/kling-video/v3/pro/image-to-video"
  | "fal-ai/kling-video/v2.6/pro/image-to-video"
  | "fal-ai/bytedance/seedance/v1.5/pro/image-to-video";

export interface ModelConfig {
  model:          FalModel;
  displayName:    string;   // human-readable name shown in Director Mode shot list
  reason:         string;   // why this model was chosen (shown in shot list)
  costPerSecond:  number;   // USD per second of output video
  maxClipSeconds: number;   // maximum clip length this model supports
  supportsAudio:  boolean;  // whether the model can embed audio in the output
  supportsRefs:   boolean;  // whether the model supports reference images
}

export interface RoutingDecision {
  config:        ModelConfig;
  estimatedCost: number;  // USD for this specific clip
}

// ─── Model catalogue ──────────────────────────────────────────────────────────

export const MODELS: Record<string, ModelConfig> = {
  VEO_3_1: {
    model:          "fal-ai/veo3.1/image-to-video",
    displayName:    "Veo 3.1",
    reason:         "",
    costPerSecond:  0.20,
    maxClipSeconds: 8,
    supportsAudio:  true,
    supportsRefs:   false,
  },
  SEEDANCE_2: {
    model:          "fal-ai/bytedance/seedance/v2",
    displayName:    "Seedance 2.0",
    reason:         "",
    costPerSecond:  0.052,   // $0.26 per 5-sec segment
    maxClipSeconds: 5,
    supportsAudio:  true,
    supportsRefs:   false,
  },
  KLING_3_PRO: {
    model:          "fal-ai/kling-video/v3/pro/image-to-video",
    displayName:    "Kling 3.0 Pro",
    reason:         "",
    costPerSecond:  0.10,
    maxClipSeconds: 10,
    supportsAudio:  false,
    supportsRefs:   false,
  },
  KLING_2_6_PRO: {
    model:          "fal-ai/kling-video/v2.6/pro/image-to-video",
    displayName:    "Kling 2.6 Pro (Elements)",
    reason:         "",
    costPerSecond:  0.084,
    maxClipSeconds: 10,
    supportsAudio:  false,
    supportsRefs:   true,   // Elements feature for character reference consistency
  },
  SEEDANCE_1_5_PRO: {
    model:          "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    displayName:    "Seedance 1.5 Pro",
    reason:         "",
    costPerSecond:  0.052,   // $0.26 per 5-sec segment
    maxClipSeconds: 5,
    supportsAudio:  false,
    supportsRefs:   false,   // supports start/end keyframe control
  },
};

// ─── Routing logic ────────────────────────────────────────────────────────────

/**
 * Select the optimal model for a scene. The priority order follows the spec:
 *
 *   1. Performance with lip sync       → Veo 3.1        (best lip sync accuracy)
 *   2. Narrative with multiple chars   → Seedance 2.0   (multi-scene consistency)
 *   3. High energy / fast motion       → Kling 3.0 Pro  (best motion fluidity)
 *   4. Character refs, no lip sync     → Kling 2.6 Pro  (Elements for ref consistency)
 *   5. Transition scenes               → Seedance 1.5 Pro (keyframe control)
 *   6. Abstract / mood visuals         → Kling 3.0 Pro  (art-house aesthetic)
 *   7. Default / everything else       → Kling 3.0 Pro  (best all-around)
 */
export function selectModel(scene: SceneSpec): ModelConfig {
  // Rule 1 — Performance with singing → Veo 3.1 (best lip sync)
  if (scene.hasLipSync && scene.type === "performance") {
    return {
      ...MODELS.VEO_3_1,
      reason: "Best lip sync accuracy for singing scenes",
    };
  }

  // Rule 2 — Narrative storytelling with multiple characters → Seedance 2.0
  if (scene.type === "narrative" && scene.hasMultipleCharacters) {
    return {
      ...MODELS.SEEDANCE_2,
      reason: "Multi-scene narrative with character consistency",
    };
  }

  // Rule 3 — High-energy action / dance / fast motion → Kling 3.0 Pro
  if (scene.hasFastMotion || scene.energyLevel > 0.8) {
    return {
      ...MODELS.KLING_3_PRO,
      reason: "Best motion fluidity for high-energy scenes",
    };
  }

  // Rule 4 — Character reference images but no lip sync → Kling 2.6 Pro (Elements)
  if (scene.characterRefs.length > 0 && !scene.hasLipSync) {
    return {
      ...MODELS.KLING_2_6_PRO,
      reason: "Elements feature for character reference consistency",
    };
  }

  // Rule 5 — Transition clips → Seedance 1.5 Pro (start/end keyframe control)
  if (scene.type === "transition") {
    return {
      ...MODELS.SEEDANCE_1_5_PRO,
      reason: "Start-and-end frame control for smooth transitions",
    };
  }

  // Rule 6 — Abstract mood visuals → Kling 3.0 Pro (art-house aesthetic)
  if (scene.type === "abstract") {
    return {
      ...MODELS.KLING_3_PRO,
      reason: "Art-house aesthetic for abstract scenes",
    };
  }

  // Rule 7 — Default / establishing / everything else → Kling 3.0 Pro
  return {
    ...MODELS.KLING_3_PRO,
    reason: "Best all-around quality and value",
  };
}

// ─── Quick Mode: single model for all scenes ──────────────────────────────────

/**
 * Quick Mode always uses Kling 3.0 Pro for every scene.
 * Consistent model = predictable cost and faster parallel generation.
 */
export function selectQuickModeModel(): ModelConfig {
  return {
    ...MODELS.KLING_3_PRO,
    reason: "Quick Mode standard — consistent quality across all scenes",
  };
}

// ─── Cost estimation ──────────────────────────────────────────────────────────

/**
 * Estimate the USD cost for a single clip.
 * Clips are rounded up to the model's minimum billing unit.
 */
export function estimateClipCost(
  config:   ModelConfig,
  duration: number, // seconds
): number {
  const billableSeconds = Math.min(
    Math.max(duration, 1), // minimum 1 second
    config.maxClipSeconds,
  );
  return Math.round(billableSeconds * config.costPerSecond * 10000) / 10000;
}

/**
 * Make a full routing decision for a scene, including cost estimate.
 */
export function routeScene(
  scene: SceneSpec,
  mode:  "QUICK" | "DIRECTOR",
): RoutingDecision {
  const config = mode === "QUICK" ? selectQuickModeModel() : selectModel(scene);
  return {
    config,
    estimatedCost: estimateClipCost(config, scene.duration),
  };
}

// ─── Batch cost estimation for a full video ───────────────────────────────────

export interface VideoEstimate {
  scenes:           SceneRoutingResult[];
  totalCost:        number;    // USD
  worstCaseCost:    number;    // USD — if every scene uses most expensive model
  averagePerScene:  number;    // USD
}

export interface SceneRoutingResult {
  sceneIndex:    number;
  model:         FalModel;
  displayName:   string;
  reason:        string;
  clipDuration:  number;
  estimatedCost: number;
}

export function estimateVideoProduction(
  scenes: Array<SceneSpec & { index: number }>,
  mode:   "QUICK" | "DIRECTOR",
): VideoEstimate {
  const results: SceneRoutingResult[] = scenes.map(scene => {
    const decision = routeScene(scene, mode);
    return {
      sceneIndex:    scene.index,
      model:         decision.config.model,
      displayName:   decision.config.displayName,
      reason:        decision.config.reason,
      clipDuration:  scene.duration,
      estimatedCost: decision.estimatedCost,
    };
  });

  const totalCost = results.reduce((sum, r) => sum + r.estimatedCost, 0);

  // Worst case: every scene uses Veo 3.1 (most expensive at $0.20/s)
  const worstCaseCost = results.reduce((sum, r) =>
    sum + Math.min(r.clipDuration, MODELS.VEO_3_1.maxClipSeconds) * MODELS.VEO_3_1.costPerSecond, 0
  );

  const averagePerScene = results.length > 0 ? totalCost / results.length : 0;

  return {
    scenes:          results,
    totalCost:       Math.round(totalCost     * 10000) / 10000,
    worstCaseCost:   Math.round(worstCaseCost * 10000) / 10000,
    averagePerScene: Math.round(averagePerScene * 10000) / 10000,
  };
}

// ─── Scene type inference from song section data ──────────────────────────────

/**
 * Infer a SceneType from a song section's characteristics.
 * Used by the Quick Mode scene planner to auto-populate SceneSpec.type.
 */
export function inferSceneType(
  sectionType: string,
  energy:      number,
  hasLyrics:   boolean,
): SceneType {
  // Drops and high-energy sections → abstract or performance
  if (sectionType === "drop" || (energy > 0.85 && !hasLyrics)) return "abstract";

  // Sections with lyrics and moderate-high energy → performance
  if (hasLyrics && energy > 0.4) return "performance";

  // Intros and outros → establishing or abstract
  if (sectionType === "intro" || sectionType === "outro") {
    return energy > 0.5 ? "establishing" : "abstract";
  }

  // Bridges and breakdowns → abstract or transition
  if (sectionType === "bridge" || sectionType === "breakdown") {
    return "abstract";
  }

  // Verses without strong lyric data → narrative or establishing
  if (sectionType === "verse") return hasLyrics ? "performance" : "narrative";

  // Chorus → performance by default
  if (sectionType === "chorus") return "performance";

  return "establishing";
}

// ─── Platform pricing constants ───────────────────────────────────────────────

/**
 * User-facing prices in cents. Always read from PlatformPricing in production.
 * These are fallbacks for development/preview only.
 *
 * See src/lib/video-studio/pricing.ts for the live PlatformPricing query.
 */
// ─── New pricing tiers (2026 update) ─────────────────────────────────────────
//
// Tiers: CANVAS | QUICK_60 | QUICK_120 | DIRECTOR_60 | DIRECTOR_120
// No subscriber discounts on Video Studio — additional videos at full price.
// Push/Reign subscribers get a free included video per month (see credit check).

export type VideoTier =
  | "CANVAS"       // $14.99 — 1 shot, 3–9s loop, Spotify Canvas
  | "QUICK_60"     // $39.99 — 8 shots, up to 60s
  | "QUICK_120"    // $59.99 — 12 shots, up to 120s
  | "DIRECTOR_60"  // $69.99 — 8 shots, up to 60s, Director chat + redos
  | "DIRECTOR_120" // $99.99 — 12 shots, up to 120s, Director chat + redos

export const VIDEO_TIER_PRICES: Record<VideoTier, number> = {
  CANVAS:       1499,  // $14.99
  QUICK_60:     3999,  // $39.99
  QUICK_120:    5999,  // $59.99
  DIRECTOR_60:  6999,  // $69.99
  DIRECTOR_120: 9999,  // $99.99
};

/** Shot count per tier */
export const VIDEO_TIER_SHOTS: Record<VideoTier, number> = {
  CANVAS:       1,
  QUICK_60:     8,
  QUICK_120:    12,
  DIRECTOR_60:  8,
  DIRECTOR_120: 12,
};

/** Max track duration (seconds) per tier */
export const VIDEO_TIER_MAX_DURATION: Record<VideoTier, number> = {
  CANVAS:        9,
  QUICK_60:     60,
  QUICK_120:    120,
  DIRECTOR_60:  60,
  DIRECTOR_120: 120,
};

/** Min scene duration (seconds) — spec: 5s */
export const MIN_SCENE_DURATION = 5;

/** Max scene duration (seconds) — spec: 10s */
export const MAX_SCENE_DURATION = 10;

/** Subscriber free included video per month */
export const SUBSCRIBER_INCLUDED_TIER: Partial<Record<string, VideoTier>> = {
  PUSH:  "DIRECTOR_60",
  REIGN: "DIRECTOR_120",
};

/** Scene regeneration (per redo) */
export const SCENE_REGEN_PRICE = 299; // $2.99

/** Legacy price table — kept for any existing references */
export const DEFAULT_VIDEO_PRICES = {
  GUEST_QUICK_SHORT:    3999,  // remapped to QUICK_60
  GUEST_QUICK_STANDARD: 3999,
  GUEST_QUICK_EXTENDED: 5999,
  GUEST_DIRECTOR_SHORT:    6999,
  GUEST_DIRECTOR_STANDARD: 6999,
  GUEST_DIRECTOR_EXTENDED: 9999,
  LAUNCH_QUICK_EXTRA_SHORT:    3999,
  LAUNCH_QUICK_EXTRA_STANDARD: 3999,
  LAUNCH_QUICK_EXTRA_EXTENDED: 5999,
  LAUNCH_DIRECTOR_SHORT:    6999,
  LAUNCH_DIRECTOR_STANDARD: 6999,
  LAUNCH_DIRECTOR_EXTENDED: 9999,
  PUSH_QUICK_EXTRA_SHORT:    3999,
  PUSH_QUICK_EXTRA_STANDARD: 3999,
  PUSH_QUICK_EXTRA_EXTENDED: 5999,
  PUSH_DIRECTOR_SHORT:    6999,
  PUSH_DIRECTOR_STANDARD: 6999,
  PUSH_DIRECTOR_EXTENDED: 9999,
  REIGN_QUICK_EXTRA_SHORT:    3999,
  REIGN_QUICK_EXTRA_STANDARD: 3999,
  REIGN_QUICK_EXTRA_EXTENDED: 5999,
  REIGN_DIRECTOR_SHORT:    6999,
  REIGN_DIRECTOR_STANDARD: 6999,
  REIGN_DIRECTOR_EXTENDED: 9999,
  LENGTH_UPGRADE_TO_STANDARD: 0,
  LENGTH_UPGRADE_TO_EXTENDED: 2000,
  SCENE_REGEN: 299,
} as const;

/** Map (tier, mode, length) → price in cents. @deprecated use VIDEO_TIER_PRICES */
export function getVideoPrice(
  _tier:   string,
  mode:   "QUICK" | "DIRECTOR",
  length: "SHORT" | "STANDARD" | "EXTENDED",
): number {
  if (mode === "QUICK")    return length === "EXTENDED" ? VIDEO_TIER_PRICES.QUICK_120    : VIDEO_TIER_PRICES.QUICK_60;
  if (mode === "DIRECTOR") return length === "EXTENDED" ? VIDEO_TIER_PRICES.DIRECTOR_120 : VIDEO_TIER_PRICES.DIRECTOR_60;
  return VIDEO_TIER_PRICES.QUICK_60;
}
