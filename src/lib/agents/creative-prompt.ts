/**
 * creative-prompt.ts — Creative Prompt Agent
 *
 * PURPOSE
 * Suggests one optimized prompt for cover art or video generation based on a
 * track's sonic data (AudioFeatures) and Whisper transcription (lyrics).
 * Uses Claude Haiku for cost-efficiency.
 *
 * TRIGGERS
 * 1. On-demand: Artist opens cover art / video page and requests a suggestion.
 *    → GET /api/dashboard/ai/creative-prompt?trackId=xxx&type=cover_art|video|lyric_video
 * 2. Proactive: Cron fires 48 h after track upload if no cover art exists.
 *    → runCreativePromptAgent() called from master cron
 *
 * DESIGN RULES
 * - All notifications from "the IndieThis team" — no AI/agent mentions
 * - Claude Haiku only; prompts kept concise to minimise cost
 * - Log every action to AgentLog
 * - Weekly max (proactive): only one notification per track, guarded by AgentLog
 */

import { db } from "@/lib/db";
import { claude } from "@/lib/claude";
import { logAgentAction, AT } from "@/lib/agents";
import { createNotification } from "@/lib/notifications";

const HAIKU = "claude-3-5-haiku-20241022";

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildCoverArtSystemPrompt(
  genre:    string | null,
  mood:     string | null,
  energy:   number,
  valence:  number,
  lyrics:   string | null,
): string {
  const energyLabel  = energy  > 0.7 ? "high-energy" : energy  < 0.4 ? "calm/gentle" : "moderate-energy";
  const valenceLabel = valence > 0.6 ? "uplifting/positive" : valence < 0.4 ? "melancholic/dark" : "complex/emotional";

  const parts = [
    `Genre: ${genre ?? "unknown"}`,
    `Mood: ${mood ?? "atmospheric"}`,
    `Energy level: ${energyLabel}`,
    `Emotional tone: ${valenceLabel}`,
  ];

  if (lyrics) {
    const excerpt = lyrics.slice(0, 300).trim();
    parts.push(`Lyric excerpt: "${excerpt}"`);
  }

  return `You are a professional music visual director.
Based on the track data below, write ONE vivid, detailed image generation prompt that would create compelling album cover art.
Be specific about colors, mood, lighting, composition, and visual style.
The prompt should capture the essence of the music — not describe it literally.
Return ONE prompt only. No preamble, no alternatives, no explanation.

Track data:
${parts.join("\n")}`;
}

function buildVideoSystemPrompt(
  genre:    string | null,
  mood:     string | null,
  energy:   number,
  valence:  number,
  type:     "video" | "lyric_video",
): string {
  const energyLabel  = energy  > 0.7 ? "intense and kinetic" : energy  < 0.4 ? "slow and dreamy" : "steady and immersive";
  const valenceLabel = valence > 0.6 ? "bright and hopeful" : valence < 0.4 ? "dark and introspective" : "complex and layered";

  const format = type === "lyric_video"
    ? "a lyric video (text-forward, visually atmospheric, vertical 9:16 format)"
    : "a short music video / canvas video (looping, immersive, visually striking)";

  return `You are a professional music video director.
Based on the track data below, write ONE vivid, detailed prompt for ${format}.
Describe the visual style, color palette, motion direction, atmosphere, and any key visual motifs.
Keep it actionable for an AI video generator.
Return ONE prompt only. No preamble, no alternatives, no explanation.

Track data:
Genre: ${genre ?? "unknown"}
Mood: ${mood ?? "atmospheric"}
Energy: ${energyLabel}
Emotional tone: ${valenceLabel}`;
}

// ─── Core: generate suggestion for a single track ─────────────────────────────

export async function generateCreativePrompt(
  trackId: string,
  type:    "cover_art" | "video" | "lyric_video",
): Promise<string | null> {
  const track = await db.track.findUnique({
    where: { id: trackId },
    include: { audioFeatures: true },
  });
  if (!track) return null;

  const af = track.audioFeatures;

  // Pull Whisper transcription from most recent COMPLETE LYRIC_VIDEO AIJob if available
  let lyrics: string | null = null;
  if (type === "cover_art") {
    const lyricJob = await db.aIJob.findFirst({
      where: {
        triggeredById: track.artistId,
        type: "LYRIC_VIDEO",
        status: "COMPLETE",
        inputData: { path: ["trackId"], equals: trackId },
      },
      orderBy: { completedAt: "desc" },
      select: { outputData: true },
    });
    if (lyricJob?.outputData) {
      const out = lyricJob.outputData as Record<string, unknown>;
      lyrics = (out.text as string) ?? null;
    }
  }

  // Build system prompt by type
  const systemPrompt =
    type === "cover_art"
      ? buildCoverArtSystemPrompt(
          af?.genre    ?? null,
          af?.mood     ?? null,
          af?.energy   ?? 0.5,
          af?.valence  ?? 0.5,
          lyrics,
        )
      : buildVideoSystemPrompt(
          af?.genre    ?? null,
          af?.mood     ?? null,
          af?.energy   ?? 0.5,
          af?.valence  ?? 0.5,
          type,
        );

  const response = await claude.messages.create({
    model:      HAIKU,
    max_tokens: 200,
    messages: [{ role: "user", content: "Generate the prompt now." }],
    system: systemPrompt,
  });

  const text = response.content.find(b => b.type === "text")?.text?.trim() ?? null;
  return text;
}

// ─── Proactive: 48 h cron check ───────────────────────────────────────────────

export interface CreativePromptAgentResult {
  checked:  number;
  notified: number;
}

export async function runCreativePromptAgent(): Promise<CreativePromptAgentResult> {
  await logAgentAction("CREATIVE_PROMPT", "AGENT_RUN_START");

  // Find tracks uploaded 48–120 h ago with no cover art
  const now        = new Date();
  const cutoffMin  = new Date(now.getTime() - 48  * 60 * 60 * 1000);
  const cutoffMax  = new Date(now.getTime() - 120 * 60 * 60 * 1000);

  const tracks = await db.track.findMany({
    where: {
      coverArtUrl: null,
      createdAt: { gte: cutoffMax, lte: cutoffMin },
    },
    select: {
      id: true,
      title: true,
      artistId: true,
      audioFeatures: {
        select: { genre: true, mood: true, energy: true, valence: true },
      },
    },
    take: 30, // safety cap
  });

  let notified = 0;

  for (const track of tracks) {
    // Skip if already notified for this track
    const alreadyLogged = await db.agentLog.findFirst({
      where: {
        agentType: AT("CREATIVE_PROMPT"),
        action:    "PROACTIVE_NOTIFIED",
        targetId:  track.id,
      },
    });
    if (alreadyLogged) continue;

    // Generate suggestion via Haiku
    let suggestion: string | null = null;
    try {
      suggestion = await generateCreativePrompt(track.id, "cover_art");
    } catch (e) {
      console.error(`[creative-prompt] haiku error for track ${track.id}:`, e);
      continue;
    }
    if (!suggestion) continue;

    // Store suggestion in AgentLog details so it loads instantly on the page
    await logAgentAction(
      "CREATIVE_PROMPT",
      "PROACTIVE_NOTIFIED",
      "TRACK",
      track.id,
      { suggestion, type: "cover_art", trackId: track.id },
    );

    // Send in-app notification — sounds like the IndieThis team, not a bot
    await createNotification({
      userId:  track.artistId,
      type:    "AI_JOB_COMPLETE",
      title:   `We have a visual direction ready for "${track.title}"`,
      message: "Our team analyzed your track and has a cover art prompt ready. Open the Cover Art Generator to see it.",
      link:    `/dashboard/ai/cover-art?trackId=${track.id}&preloaded=1`,
    });

    notified++;
  }

  await logAgentAction(
    "CREATIVE_PROMPT",
    "AGENT_RUN_COMPLETE",
    undefined,
    undefined,
    { checked: tracks.length, notified },
  );

  return { checked: tracks.length, notified };
}
