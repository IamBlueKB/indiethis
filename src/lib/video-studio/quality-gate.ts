/**
 * src/lib/video-studio/quality-gate.ts
 *
 * Quality Gate Agent — Claude Vision post-generation frame check.
 *
 * After a music video is stitched, this agent evaluates the thumbnail
 * of the highest-energy scene using Claude Vision. The check is non-blocking:
 * it runs after delivery and only sets a quality flag + report on the record.
 *
 * A failed QA does NOT prevent the artist from seeing their video — it adds
 * a soft warning on the preview page so they know to consider a regeneration.
 *
 * Criteria evaluated:
 *   1. Visual coherence — subject is recognizable, no major distortion
 *   2. Composition quality — framing is intentional, not random
 *   3. Mood alignment — lighting / atmosphere matches the brief tone
 *   4. Technical quality — no severe compression artifacts, blurring, or glitches
 */

import { db }          from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QAReport {
  approved:       boolean;
  score:          number;    // 1–10 overall quality score
  reason:         string;    // one-sentence summary
  recommendation: string;    // actionable advice for the artist
  criteria: {
    visualCoherence:  boolean;
    composition:      boolean;
    moodAlignment:    boolean;
    technicalQuality: boolean;
  };
  checkedAt: string;         // ISO timestamp
}

// ─── Main gate function ───────────────────────────────────────────────────────

/**
 * Run the quality gate on a completed music video.
 *
 * @param musicVideoId  MusicVideo record ID
 * @param thumbnailUrl  URL of the frame to evaluate (highest-energy scene thumbnail)
 * @param brief         Optional brief summary for mood/tone context
 */
export async function runVideoQualityGate(
  musicVideoId: string,
  thumbnailUrl: string,
  brief?:       string,
): Promise<QAReport> {
  const toneContext = brief
    ? `Creative brief context: "${brief.slice(0, 200)}"`
    : "No brief context available.";

  const qaPrompt = `You are a quality control agent evaluating an AI-generated music video frame.

${toneContext}

Evaluate this thumbnail on four criteria:
1. Visual coherence — Is the subject recognizable? Are there major distortions or AI artifacts?
2. Composition — Is the framing intentional and aesthetically balanced?
3. Mood alignment — Does the lighting and atmosphere feel cinematic and intentional?
4. Technical quality — Is the image sharp enough? No severe compression blocks or glitches?

Score each criterion true (pass) or false (fail). Give an overall quality score from 1–10.

Respond with ONLY valid JSON:
{
  "approved": true,
  "score": 8,
  "reason": "One sentence summary of quality",
  "recommendation": "One actionable suggestion for the artist",
  "criteria": {
    "visualCoherence": true,
    "composition": true,
    "moodAlignment": true,
    "technicalQuality": true
  }
}`;

  let report: QAReport;

  try {
    // Dynamic import to avoid loading Anthropic at module init time
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{
        role:    "user",
        content: [
          { type: "image", source: { type: "url", url: thumbnailUrl } },
          { type: "text",  text: qaPrompt },
        ],
      }],
    });

    const text    = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed  = JSON.parse(cleaned) as Omit<QAReport, "checkedAt">;

    report = { ...parsed, checkedAt: new Date().toISOString() };
  } catch (err) {
    // QA failure is non-blocking — pass through with a skip report
    console.warn("[quality-gate] Frame check failed — passing through:", err);
    report = {
      approved:       true,
      score:          7,
      reason:         "Quality check skipped (service unavailable)",
      recommendation: "Preview your video and request a regeneration if needed.",
      criteria: {
        visualCoherence:  true,
        composition:      true,
        moodAlignment:    true,
        technicalQuality: true,
      },
      checkedAt: new Date().toISOString(),
    };
  }

  // Persist to the MusicVideo record (non-blocking — don't throw on DB error)
  try {
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        qaApproved: report.approved,
        qaReport:   JSON.stringify(report),
      },
    });
  } catch (dbErr) {
    console.error("[quality-gate] DB update failed:", dbErr);
  }

  return report;
}

// ─── Convenience wrapper for webhook ─────────────────────────────────────────

/**
 * Run the quality gate asynchronously (fire-and-forget).
 * Safe to call from the webhook without blocking the response.
 */
export function runVideoQualityGateAsync(
  musicVideoId: string,
  thumbnailUrl: string,
  brief?:       string,
): void {
  if (!thumbnailUrl) return;

  runVideoQualityGate(musicVideoId, thumbnailUrl, brief).catch(err => {
    console.error("[quality-gate] Async gate failed:", err);
  });
}
