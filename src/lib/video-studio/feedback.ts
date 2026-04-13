/**
 * src/lib/video-studio/feedback.ts
 *
 * Video Studio feedback system — learning agent.
 *
 * Artists can rate scenes/videos after generation. The feedback is stored
 * in VideoFeedback and periodically analyzed by Claude to identify prompt
 * patterns that produce good vs poor results.
 *
 * Analysis results are persisted in SystemConfig under the key
 * "video_prompt_patterns" and can be injected into future prompt generation
 * to improve output quality over time.
 */

import { db }          from "@/lib/db";
import { claude, SONNET } from "@/lib/claude";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FeedbackPayload {
  sceneIndex?: number;   // omit or -1 for overall video rating
  rating?:     number;   // 1–5 stars
  liked?:      boolean;  // quick thumbs up/down
  notes?:      string;   // optional artist note (max 500 chars)
}

export interface PromptPatternInsights {
  likedPatterns:    string[];
  dislikedPatterns: string[];
  recommendations:  string[];
  analyzedAt:       string;
  sampleCount:      number;
}

// ─── Submit feedback ─────────────────────────────────────────────────────────

/**
 * Record artist feedback for a music video (or a specific scene within it).
 * Also attaches the generation prompt and model for pattern analysis later.
 *
 * @param musicVideoId  The MusicVideo record ID
 * @param payload       Feedback data from the artist
 */
export async function submitFeedback(
  musicVideoId: string,
  payload:      FeedbackPayload,
): Promise<void> {
  const { sceneIndex = -1, rating, liked, notes } = payload;

  // Validate rating range
  const validRating = rating != null ? Math.min(5, Math.max(1, Math.round(rating))) : null;

  // Look up scene-specific metadata (prompt + model) for richer analysis
  let promptUsed: string | null = null;
  let modelUsed:  string | null = null;

  if (sceneIndex >= 0) {
    const video = await db.musicVideo.findUnique({
      where:  { id: musicVideoId },
      select: { scenes: true },
    });

    if (video?.scenes) {
      const scenes = video.scenes as Array<{ sceneIndex: number; prompt?: string; model?: string }>;
      const scene  = scenes.find(s => s.sceneIndex === sceneIndex);
      promptUsed   = scene?.prompt ?? null;
      modelUsed    = scene?.model  ?? null;
    }
  }

  await db.videoFeedback.create({
    data: {
      musicVideoId,
      sceneIndex,
      rating:    validRating,
      liked:     liked ?? null,
      notes:     notes?.slice(0, 500) ?? null,
      promptUsed,
      modelUsed,
    },
  });
}

// ─── Pattern analysis ─────────────────────────────────────────────────────────

/**
 * Analyze recent feedback to identify prompt patterns that correlate with
 * positive vs negative ratings. Results are stored in SystemConfig and can
 * be used to guide future prompt generation.
 *
 * Runs asynchronously after feedback is submitted. Short-circuits if there
 * is insufficient data (< 10 rated records).
 */
export async function analyzePromptPatterns(): Promise<void> {
  // Only look at last 90 days of feedback
  const since     = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const feedbacks = await db.videoFeedback.findMany({
    where: {
      createdAt:  { gte: since },
      promptUsed: { not: null },
      OR: [
        { rating: { not: null } },
        { liked:  { not: null } },
      ],
    },
    select: { rating: true, liked: true, promptUsed: true, modelUsed: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (feedbacks.length < 10) {
    console.log("[feedback] Not enough data for pattern analysis — skipping");
    return;
  }

  const isLiked    = (f: typeof feedbacks[number]) =>
    f.liked === true || (f.rating != null && f.rating >= 4);
  const isDisliked = (f: typeof feedbacks[number]) =>
    f.liked === false || (f.rating != null && f.rating <= 2);

  const liked    = feedbacks.filter(isLiked).map(f => f.promptUsed!);
  const disliked = feedbacks.filter(isDisliked).map(f => f.promptUsed!);

  if (liked.length === 0 && disliked.length === 0) return;

  const likedSample    = liked.slice(0, 40).join("\n---\n");
  const dislikedSample = disliked.slice(0, 40).join("\n---\n");

  const res = await claude.messages.create({
    model:      SONNET,
    max_tokens: 600,
    messages: [{
      role:    "user",
      content: `You are analyzing music video generation prompts to identify what makes them produce well-received vs poorly-received results.

HIGHLY RATED PROMPTS (${liked.length} total):
${likedSample || "(none yet)"}

POORLY RATED PROMPTS (${disliked.length} total):
${dislikedSample || "(none yet)"}

Identify 3–5 concrete patterns. Focus on: prompt specificity, descriptive language, camera direction clarity, lighting terms, energy level descriptions, use of @Element1.

Return JSON only:
{
  "likedPatterns": ["pattern"],
  "dislikedPatterns": ["pattern"],
  "recommendations": ["actionable improvement"],
  "analyzedAt": "${new Date().toISOString()}",
  "sampleCount": ${feedbacks.length}
}`,
    }],
  });

  const text    = res.content[0].type === "text" ? res.content[0].text : "{}";
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  try {
    // Validate JSON before storing
    JSON.parse(cleaned);
    await db.systemConfig.upsert({
      where:  { key: "video_prompt_patterns" },
      update: { value: cleaned },
      create: { key: "video_prompt_patterns", value: cleaned },
    });
    console.log(`[feedback] Prompt patterns updated — ${feedbacks.length} samples analyzed`);
  } catch {
    console.error("[feedback] Invalid JSON from analysis — not storing");
  }
}

// ─── Read insights ────────────────────────────────────────────────────────────

/**
 * Retrieve the current prompt pattern insights from SystemConfig.
 * Returns null if no analysis has been run yet.
 */
export async function getPromptInsights(): Promise<PromptPatternInsights | null> {
  const config = await db.systemConfig.findUnique({
    where: { key: "video_prompt_patterns" },
  });

  if (!config?.value) return null;

  try {
    return JSON.parse(config.value) as PromptPatternInsights;
  } catch {
    return null;
  }
}
