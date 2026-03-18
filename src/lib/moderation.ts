/**
 * Content moderation via Claude.
 * Call triggerModerationScan(studioId) fire-and-forget after a studio publishes.
 */

import { db } from "@/lib/db";
import { claude, SONNET } from "@/lib/claude";
import { logInsight, getModerationAccuracyContext } from "@/lib/ai-log";

export async function runModerationScan(studioId: string): Promise<void> {
  // Fetch studio content
  const studio = await db.studio.findUnique({
    where: { id: studioId },
    select: {
      id: true,
      name: true,
      bio: true,
      description: true,
      tagline: true,
      services: true,
      servicesJson: true,
      testimonials: true,
    },
  });
  if (!studio) return;

  // Build content block for Claude
  const parts: string[] = [];
  if (studio.name) parts.push(`Studio name: ${studio.name}`);
  if (studio.tagline) parts.push(`Tagline: ${studio.tagline}`);
  if (studio.description) parts.push(`Description: ${studio.description}`);
  if (studio.bio) parts.push(`Bio: ${studio.bio}`);
  if (studio.services?.length) parts.push(`Services: ${studio.services.join(", ")}`);
  if (studio.servicesJson) {
    try {
      const sj = typeof studio.servicesJson === "string"
        ? JSON.parse(studio.servicesJson)
        : studio.servicesJson;
      if (Array.isArray(sj)) {
        const names = sj.map((s: { name?: string; title?: string }) => s.name ?? s.title).filter(Boolean);
        if (names.length) parts.push(`Service descriptions: ${names.join(", ")}`);
      }
    } catch { /* ignore */ }
  }
  if (studio.testimonials) {
    try {
      const testimonials = JSON.parse(studio.testimonials);
      if (Array.isArray(testimonials)) {
        const texts = testimonials
          .map((t: { text?: string; body?: string }) => t.text ?? t.body)
          .filter(Boolean)
          .slice(0, 3);
        if (texts.length) parts.push(`Testimonials: ${texts.join(" | ")}`);
      }
    } catch { /* ignore */ }
  }

  if (parts.length === 0) {
    await db.studio.update({
      where: { id: studioId },
      data: { moderationStatus: "CLEAN", moderationScannedAt: new Date() },
    });
    return;
  }

  const content = parts.join("\n");

  // Include accuracy calibration from past admin decisions
  const accuracyContext = await getModerationAccuracyContext();

  const prompt = `You are a content moderation assistant for a music studio booking platform called IndieThis.

Review the following studio profile content and determine if it violates platform policies.

Flag content if it contains:
- Offensive, hateful, or discriminatory language
- Spam, repetitive nonsense, or SEO keyword stuffing
- False or exaggerated claims (e.g. "Grammy-winning" with no context, "worked with Jay-Z" etc. that seem fabricated)
- Adult/NSFW content
- Contact info or external links embedded in description fields to bypass the platform
- Plagiarized or clearly copy-pasted boilerplate text with no customization${accuracyContext}

Content to review:
${content}

Respond in this exact JSON format only, no markdown:
{"flagged": false}
OR
{"flagged": true, "reason": "One-sentence reason explaining the specific issue found"}`;

  try {
    const message = await claude.messages.create({
      model: SONNET,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const result = JSON.parse(text) as { flagged: boolean; reason?: string };

    // Log to AIInsightsLog
    void logInsight({
      insightType: "MODERATION_SCAN",
      referenceId: studioId,
      input: content,
      output: text,
    }).catch(() => {});

    await db.studio.update({
      where: { id: studioId },
      data: {
        moderationStatus: result.flagged ? "FLAGGED" : "CLEAN",
        moderationReason: result.flagged ? (result.reason ?? "Flagged by AI moderator") : null,
        moderationScannedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[moderation] scan failed for studio", studioId, err);
    await db.studio.update({
      where: { id: studioId },
      data: { moderationStatus: "REVIEWING", moderationScannedAt: new Date() },
    });
  }
}

/** Fire-and-forget wrapper — safe to call without await */
export function triggerModerationScan(studioId: string): void {
  void runModerationScan(studioId).catch((err) =>
    console.error("[moderation] unhandled error", err)
  );
}
