/**
 * collaboration-matchmaker.ts — Collaboration Matchmaker Agent (Step 8)
 *
 * PURPOSE
 * Monthly (1st of month) cron agent. Matches artists on IndieThis for features,
 * collaborations, and joint releases. Opt-in only — only users with
 * openToCollaborations = true are matched and appear in results.
 *
 * MATCHING LOGIC
 * - Rule-based first: AudioFeatures comparison (energy, speechiness, genre)
 * - Complementary pairing preferred over identical sounds:
 *   · Singer (low speechiness) ↔ Rapper (high speechiness) with similar energy
 *   · Acoustic (low energy) ↔ Electronic producer (high energy)
 *   · Same city bonus (easier to actually work together)
 *   · Same genre with different energy levels
 * - Haiku writes a natural-sounding match reason
 * - Max 1 notification per artist per month (6-day dedup guard for safety)
 * - BOTH artists must have openToCollaborations = true
 *
 * COST
 * Free for all tiers — drives platform activity (split sheets, studio bookings,
 * beat purchases, new uploads). Zero marginal cost beyond one Haiku call.
 *
 * DESIGN RULES
 * - No AI/agent mention in user-facing copy
 * - Log every action to AgentLog
 */

import { db }                  from "@/lib/db";
import { claude }              from "@/lib/claude";
import { logAgentAction, AT }  from "@/lib/agents";
import { createNotification }  from "@/lib/notifications";

const HAIKU = "claude-3-5-haiku-20241022";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollabMatch {
  artistId:    string;
  artistName:  string;
  artistSlug:  string | null;
  topTrack:    string | null;
  sharedGenre: string | null;
  reason:      string;
}

export interface CollabMatchmakerResult {
  checked:      number;
  matchesSent:  number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/** Numeric "compatibility score" between two AudioFeatures profiles. Higher = better collab candidate. */
function compatibilityScore(
  a: { energy: number; speechiness: number; valence: number; genre: string | null },
  b: { energy: number; speechiness: number; valence: number; genre: string | null },
  sameCity: boolean,
): number {
  let score = 0;

  // Complementary energy: moderate difference is good (0.2–0.5 gap scores highest)
  const energyDiff = Math.abs(a.energy - b.energy);
  if (energyDiff >= 0.2 && energyDiff <= 0.5) score += 3;
  else if (energyDiff < 0.2) score += 1; // similar — ok but less interesting

  // Complementary speechiness: singer + rapper pairing
  const speechDiff = Math.abs(a.speechiness - b.speechiness);
  if (speechDiff >= 0.3) score += 4; // strong complementary vocal style
  else if (speechDiff >= 0.15) score += 2;

  // Similar valence (emotional tone) — helps the collab feel cohesive
  const valenceDiff = Math.abs(a.valence - b.valence);
  if (valenceDiff < 0.2) score += 2;

  // Shared genre bonus
  if (a.genre && b.genre && a.genre.toLowerCase() === b.genre.toLowerCase()) score += 3;

  // Same city bonus
  if (sameCity) score += 2;

  return score;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runCollaborationMatchmakerAgent(): Promise<CollabMatchmakerResult> {
  await logAgentAction("COLLABORATION_MATCHMAKER", "AGENT_RUN_START");

  const result: CollabMatchmakerResult = { checked: 0, matchesSent: 0 };

  // All opted-in artists with active subscriptions and at least 1 published track
  const artists = await db.user.findMany({
    where: {
      openToCollaborations: true,
      role:                 "ARTIST",
      subscription:         { status: "ACTIVE" },
      tracks:               { some: { status: "PUBLISHED" } },
    },
    select: {
      id:         true,
      name:       true,
      artistName: true,
      artistSlug: true,
      city:       true,
      tracks: {
        where:   { status: "PUBLISHED" },
        select:  {
          title:         true,
          audioFeatures: {
            select: { energy: true, speechiness: true, valence: true, genre: true },
          },
        },
        take: 5,
        orderBy: { plays: "desc" },
      },
    },
    take: 500,
  });

  result.checked = artists.length;

  // Build a quick lookup: artistId → averaged AudioFeatures
  type AvgFeatures = { energy: number; speechiness: number; valence: number; genre: string | null };

  function avgFeatures(tracks: typeof artists[0]["tracks"]): AvgFeatures | null {
    const withAF = tracks.filter((t) => t.audioFeatures);
    if (!withAF.length) return null;
    const n = withAF.length;
    return {
      energy:      withAF.reduce((s, t) => s + (t.audioFeatures!.energy      ?? 0.5), 0) / n,
      speechiness: withAF.reduce((s, t) => s + (t.audioFeatures!.speechiness ?? 0.1), 0) / n,
      valence:     withAF.reduce((s, t) => s + (t.audioFeatures!.valence      ?? 0.5), 0) / n,
      genre:       withAF[0]?.audioFeatures?.genre ?? null,
    };
  }

  const featureMap = new Map<string, AvgFeatures>();
  for (const a of artists) {
    const af = avgFeatures(a.tracks);
    if (af) featureMap.set(a.id, af);
  }

  // Match each artist to their best candidate (avoid re-notifying within 6 days)
  const notifiedPairs = new Set<string>(); // "id1:id2" ordered

  for (const artist of artists) {
    const artistAF = featureMap.get(artist.id);
    if (!artistAF) continue;

    // Already notified this month?
    const recentLog = await db.agentLog.findFirst({
      where: {
        agentType: AT("COLLABORATION_MATCHMAKER"),
        action:    "MATCH_SENT",
        targetId:  artist.id,
        createdAt: { gte: daysAgo(6) },
      },
    });
    if (recentLog) continue;

    // Score all other artists
    const candidates = artists
      .filter((b) => b.id !== artist.id && featureMap.has(b.id))
      .map((b) => ({
        artist:  b,
        af:      featureMap.get(b.id)!,
        score:   compatibilityScore(
          artistAF,
          featureMap.get(b.id)!,
          !!(artist.city && b.city && artist.city.toLowerCase() === b.city.toLowerCase()),
        ),
      }))
      .sort((a, b) => b.score - a.score);

    if (!candidates.length) continue;

    const best = candidates[0];
    const pairKey = [artist.id, best.artist.id].sort().join(":");
    if (notifiedPairs.has(pairKey)) continue;
    notifiedPairs.add(pairKey);

    // Haiku: write a natural match reason for BOTH directions
    const artistLabel = artist.artistName ?? artist.name;
    const matchLabel  = best.artist.artistName ?? best.artist.name;
    const topTrackA   = artist.tracks[0]?.title ?? null;
    const topTrackB   = best.artist.tracks[0]?.title ?? null;

    let reasonForA = `Your sounds could complement each other perfectly — ${matchLabel} brings a style that contrasts well with yours.`;
    let reasonForB = `Your sounds could complement each other perfectly — ${artistLabel} brings a style that contrasts well with yours.`;

    try {
      const prompt = `You are a music industry connector on IndieThis writing personalized collaboration suggestions.

Artist A: "${artistLabel}" — genre: ${artistAF.genre ?? "varied"}, energy: ${artistAF.energy.toFixed(2)}, vocal style score: ${artistAF.speechiness.toFixed(2)}${topTrackA ? `, top track: "${topTrackA}"` : ""}
Artist B: "${matchLabel}" — genre: ${best.af.genre ?? "varied"}, energy: ${best.af.energy.toFixed(2)}, vocal style score: ${best.af.speechiness.toFixed(2)}${topTrackB ? `, top track: "${topTrackB}"` : ""}

Write two short, natural-sounding sentences (max 25 words each):
1. Why this collab is a great idea — from A's perspective (tell A why B is a good match)
2. Why this collab is a great idea — from B's perspective (tell B why A is a good match)

Do not mention scores or numbers. Sound like a music-scene friend making an introduction.

Respond in JSON only:
{"forA": "...", "forB": "..."}`;

      const resp = await claude.messages.create({
        model:      HAIKU,
        max_tokens: 150,
        messages:   [{ role: "user", content: prompt }],
      });
      const text  = resp.content.find((b) => b.type === "text")?.text?.trim() ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (typeof parsed.forA === "string" && parsed.forA.length > 0) reasonForA = parsed.forA;
        if (typeof parsed.forB === "string" && parsed.forB.length > 0) reasonForB = parsed.forB;
      }
    } catch { /* use defaults */ }

    // Notify artist A about artist B
    await createNotification({
      userId:  artist.id,
      type:    "AI_JOB_COMPLETE",
      title:   `We think you and ${matchLabel} would make something great`,
      message: reasonForA,
      link:    best.artist.artistSlug ? `/${best.artist.artistSlug}` : "/dashboard/music",
    });

    await logAgentAction(
      "COLLABORATION_MATCHMAKER",
      "MATCH_SENT",
      "USER",
      artist.id,
      { matchedArtistId: best.artist.id, matchedArtistName: matchLabel, score: best.score },
    );

    // Notify artist B about artist A
    const recentLogB = await db.agentLog.findFirst({
      where: {
        agentType: AT("COLLABORATION_MATCHMAKER"),
        action:    "MATCH_SENT",
        targetId:  best.artist.id,
        createdAt: { gte: daysAgo(6) },
      },
    });

    if (!recentLogB) {
      await createNotification({
        userId:  best.artist.id,
        type:    "AI_JOB_COMPLETE",
        title:   `We think you and ${artistLabel} would make something great`,
        message: reasonForB,
        link:    artist.artistSlug ? `/${artist.artistSlug}` : "/dashboard/music",
      });

      await logAgentAction(
        "COLLABORATION_MATCHMAKER",
        "MATCH_SENT",
        "USER",
        best.artist.id,
        { matchedArtistId: artist.id, matchedArtistName: artistLabel, score: best.score },
      );

      result.matchesSent++;
    }

    result.matchesSent++;
  }

  await logAgentAction(
    "COLLABORATION_MATCHMAKER",
    "AGENT_RUN_COMPLETE",
    undefined,
    undefined,
    result as unknown as Record<string, unknown>,
  );

  return result;
}
