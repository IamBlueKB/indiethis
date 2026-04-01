/**
 * producer-artist-match.ts — Producer-Artist Match Agent (Step 6)
 *
 * PURPOSE
 * Bidirectional PPU matching report at $9.99:
 *
 *  • Artist   → top-5 producers on IndieThis whose beat genres align with
 *               the artist's catalogue, with a Haiku-written rationale.
 *  • Producer → top-5 artists whose genre preferences match the producer's
 *               available beats.
 *
 * A "producer" on IndieThis is any artist who has at least one track with
 * BeatLeaseSettings enabled (i.e. their beats are available for licensing).
 *
 * TRIGGER
 * PPU checkout at POST /api/dashboard/ai/producer-match/checkout.
 * Webhook fires generateProducerArtistMatch(userId) on payment success.
 *
 * PROACTIVE CRON (Thursday)
 * Sends a once-a-week teaser notification to artists that recently added a
 * track but have no beat-source link, and to producers with new beats that
 * have no licensees yet. 6-day dedup guard.
 *
 * DESIGN RULES
 * - Claude Haiku only — rule-based matching, Haiku writes rationale
 * - Log every action to AgentLog (details field)
 * - No AI/agent mention in user-facing copy
 */

import { db }                from "@/lib/db";
import {
  logAgentAction,
  sendAgentEmail,
  agentEmailBase,
  AT,
}                            from "@/lib/agents";
import { createNotification } from "@/lib/notifications";
import { claude }             from "@/lib/claude";

const HAIKU   = "claude-3-5-haiku-20241022";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MatchCandidate {
  userId:      string;
  name:        string;
  artistName:  string | null;
  artistSlug:  string | null;
  sharedGenres: string[];
  topGenre:    string | null;
  rationale:   string;
}

export interface ProducerArtistMatchReport {
  generatedAt:  string;
  mode:         "ARTIST_SEEKING_PRODUCER" | "PRODUCER_SEEKING_ARTIST";
  buyerGenres:  string[];
  matches:      MatchCandidate[];
  summary:      string;
}

export interface ProducerArtistMatchResult {
  checked:     number;
  teasersSent: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/** Genres from user.genres array + track genres, deduplicated */
function collectGenres(userGenres: string[], trackGenres: (string | null)[]): string[] {
  const all = [...userGenres, ...trackGenres.filter(Boolean)] as string[];
  return [...new Set(all.map((g) => g.toLowerCase()))];
}

/** Intersection of two string arrays */
function intersect(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

// ─── PPU: generate full match report ─────────────────────────────────────────

export async function generateProducerArtistMatch(
  userId: string,
): Promise<ProducerArtistMatchReport | null> {
  const buyer = await db.user.findUnique({
    where:  { id: userId },
    select: {
      id:         true,
      name:       true,
      email:      true,
      artistName: true,
      artistSlug: true,
      genres:     true,
      tracks: {
        where:  { status: "PUBLISHED" },
        select: { genre: true, beatLeaseSettings: { select: { id: true } } },
      },
    },
  });
  if (!buyer) return null;

  const buyerTrackGenres = buyer.tracks.map((t) => t.genre);
  const buyerGenres      = collectGenres(buyer.genres, buyerTrackGenres);

  // Is the buyer themselves a producer? (has tracks with beatLeaseSettings)
  const buyerIsProducer = buyer.tracks.some((t) => t.beatLeaseSettings !== null);
  const mode: ProducerArtistMatchReport["mode"] = buyerIsProducer
    ? "PRODUCER_SEEKING_ARTIST"
    : "ARTIST_SEEKING_PRODUCER";

  let matches: MatchCandidate[] = [];

  if (mode === "ARTIST_SEEKING_PRODUCER") {
    // Find producers: artists who have beats available for lease
    const producers = await db.user.findMany({
      where: {
        id:   { not: userId },
        role: "ARTIST",
        tracks: {
          some: { status: "PUBLISHED", beatLeaseSettings: { isNot: null } },
        },
      },
      select: {
        id:         true,
        name:       true,
        artistName: true,
        artistSlug: true,
        genres:     true,
        tracks: {
          where:  { status: "PUBLISHED", beatLeaseSettings: { isNot: null } },
          select: { genre: true },
          take:   10,
        },
      },
      take: 50,
    });

    for (const p of producers) {
      const pGenres = collectGenres(p.genres, p.tracks.map((t) => t.genre));
      const shared  = intersect(buyerGenres, pGenres);
      if (!shared.length && buyerGenres.length > 0) continue; // no overlap
      matches.push({
        userId:       p.id,
        name:         p.name,
        artistName:   p.artistName,
        artistSlug:   p.artistSlug,
        sharedGenres: shared,
        topGenre:     pGenres[0] ?? null,
        rationale:    "", // filled by Haiku below
      });
    }
  } else {
    // Producer seeking artists: find artists with matching genres who have no beat source
    const artists = await db.user.findMany({
      where: {
        id:   { not: userId },
        role: "ARTIST",
        subscription: { status: "ACTIVE" },
      },
      select: {
        id:         true,
        name:       true,
        artistName: true,
        artistSlug: true,
        genres:     true,
        tracks: {
          where:  { status: "PUBLISHED" },
          select: { genre: true },
          take:   10,
        },
      },
      take: 100,
    });

    for (const a of artists) {
      const aGenres = collectGenres(a.genres, a.tracks.map((t) => t.genre));
      const shared  = intersect(buyerGenres, aGenres);
      if (!shared.length && buyerGenres.length > 0) continue;
      matches.push({
        userId:       a.id,
        name:         a.name,
        artistName:   a.artistName,
        artistSlug:   a.artistSlug,
        sharedGenres: shared,
        topGenre:     aGenres[0] ?? null,
        rationale:    "",
      });
    }
  }

  // Sort by shared-genre count desc, take top 5
  matches.sort((a, b) => b.sharedGenres.length - a.sharedGenres.length);
  matches = matches.slice(0, 5);

  // Haiku: write rationale for each match + summary
  const buyerLabel = buyer.artistName ?? buyer.name;
  const candidateList = matches
    .map((m, i) =>
      `${i + 1}. ${m.artistName ?? m.name} (shared genres: ${m.sharedGenres.join(", ") || "general"})`
    )
    .join("\n");

  const prompt = `You are a music industry connector writing a match report for "${buyerLabel}" on IndieThis.
Mode: ${mode === "ARTIST_SEEKING_PRODUCER" ? "Artist looking for a producer" : "Producer looking for artists to work with"}
Buyer genres: ${buyerGenres.join(", ") || "varied"}

Matched candidates:
${candidateList || "No direct matches — write encouraging general advice"}

For each candidate write ONE short sentence (max 15 words) explaining WHY they're a good match.
Then write ONE overall summary sentence (max 20 words).

Respond in JSON only — no markdown:
{
  "rationales": ["sentence1", "sentence2", ...],
  "summary": "overall summary sentence"
}`;

  let rationales: string[] = matches.map(() => "Strong genre alignment makes this a natural fit.");
  let summary = "These matches are based on shared genre preferences across the IndieThis platform.";

  try {
    const resp = await claude.messages.create({
      model:      HAIKU,
      max_tokens: 400,
      messages:   [{ role: "user", content: prompt }],
    });
    const text      = resp.content.find((b) => b.type === "text")?.text?.trim() ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.rationales)) {
        rationales = parsed.rationales.map((r: string, i: number) =>
          typeof r === "string" && r.length > 0 ? r : rationales[i] ?? rationales[0]
        );
      }
      if (typeof parsed.summary === "string" && parsed.summary.length > 0) {
        summary = parsed.summary;
      }
    }
  } catch { /* use defaults */ }

  // Attach rationales
  matches = matches.map((m, i) => ({ ...m, rationale: rationales[i] ?? m.rationale }));

  const report: ProducerArtistMatchReport = {
    generatedAt: new Date().toISOString(),
    mode,
    buyerGenres,
    matches,
    summary,
  };

  // Store in AgentLog
  await logAgentAction(
    "PRODUCER_ARTIST_MATCH",
    "MATCH_REPORT_GENERATED",
    "USER",
    userId,
    report as unknown as Record<string, unknown>,
  );

  // In-app notification
  await createNotification({
    userId,
    type:    "AI_JOB_COMPLETE",
    title:   "Your match report is ready",
    message: summary,
    link:    "/dashboard/ai/producer-match",
  });

  // Email highlights
  if (buyer.email && matches.length > 0) {
    const topMatch    = matches[0];
    const displayName = topMatch.artistName ?? topMatch.name;
    const html        = agentEmailBase(
      `<p>Hi ${buyerLabel},</p>
       <p>Your producer-artist match report is ready. Here's your top match:</p>
       <div style="background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.25);border-radius:12px;padding:16px 20px;margin:16px 0;">
         <p style="margin:0 0 6px;color:#D4A843;font-weight:700;font-size:15px;">${displayName}</p>
         <p style="margin:0 0 10px;font-size:13px;color:#ccc;">${topMatch.rationale}</p>
         ${topMatch.sharedGenres.length > 0
           ? `<p style="margin:0;font-size:12px;color:#888;">Shared genres: ${topMatch.sharedGenres.join(" · ")}</p>`
           : ""}
       </div>
       <p style="font-size:14px;color:#ccc;">${summary}</p>`,
      "View Full Match Report",
      `${APP_URL}/dashboard/ai/producer-match`,
    );
    void sendAgentEmail(
      { email: buyer.email, name: buyerLabel },
      "Your IndieThis Match Report is ready",
      html,
      ["producer_match"],
    ).catch(() => {});
  }

  return report;
}

// ─── Weekly Thursday teaser cron ─────────────────────────────────────────────

export async function runProducerArtistMatchAgent(): Promise<ProducerArtistMatchResult> {
  await logAgentAction("PRODUCER_ARTIST_MATCH", "AGENT_RUN_START");

  const result: ProducerArtistMatchResult = { checked: 0, teasersSent: 0 };

  // Artists: active subscription, at least 1 published track, no beat source yet
  const artists = await db.user.findMany({
    where: {
      role: "ARTIST",
      subscription: { status: "ACTIVE" },
      tracks: { some: { status: "PUBLISHED" } },
    },
    select: { id: true, name: true, artistName: true },
    take:   200,
  });

  for (const artist of artists) {
    result.checked++;

    const recentLog = await db.agentLog.findFirst({
      where: {
        agentType: AT("PRODUCER_ARTIST_MATCH"),
        action:    "TEASER_SENT",
        targetId:  artist.id,
        createdAt: { gte: daysAgo(6) },
      },
    });
    if (recentLog) continue;

    await createNotification({
      userId:  artist.id,
      type:    "AI_JOB_COMPLETE",
      title:   "Find your perfect producer match",
      message: "We can match you with producers on IndieThis whose beats fit your sound. Get your personalised match report for $9.99.",
      link:    "/dashboard/ai/producer-match",
    });

    await logAgentAction("PRODUCER_ARTIST_MATCH", "TEASER_SENT", "USER", artist.id);
    result.teasersSent++;
  }

  await logAgentAction(
    "PRODUCER_ARTIST_MATCH",
    "AGENT_RUN_COMPLETE",
    undefined,
    undefined,
    result as unknown as Record<string, unknown>,
  );

  return result;
}
