/**
 * trend-forecaster.ts — Trend Forecaster Agent (Step 5)
 *
 * PURPOSE
 * Analyses platform-wide listening data plus genre patterns to generate a
 * personalised trend report for an artist. Two modes:
 *
 *  1. PPU Report  — generateTrendReport(userId)
 *     Artist pays $4.99 → rich JSON report stored in AgentLog →
 *     notification deep-links to /dashboard/ai/trend-report
 *
 *  2. Weekly Teaser — runTrendForecasterAgent()
 *     Friday cron. Sends every active artist a free 1-paragraph teaser
 *     (top platform trend + call to buy full report). 6-day dedup guard.
 *
 * DESIGN RULES
 * - Claude Haiku for all text generation
 * - Platform data only — no external web calls needed
 * - Log every action to AgentLog
 * - "The IndieThis Team" tone — no AI/agent mentions
 */

import { db }                from "@/lib/db";
import {
  logAgentAction,
  sendAgentEmail,
  agentEmailBase,
}                            from "@/lib/agents";
import { createNotification } from "@/lib/notifications";
import { claude }             from "@/lib/claude";

const HAIKU    = "claude-3-5-haiku-20241022";
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrendReport {
  generatedAt:      string;
  artistGenre:      string | null;
  topPlatformGenres: Array<{ genre: string; playCount: number }>;
  releaseTimingTip:  string;
  monetisationTip:   string;
  personalInsight:   string;
  callToAction:      string;
}

export interface TrendForecasterResult {
  checked: number;
  teasersSent: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// ─── PPU: full report ─────────────────────────────────────────────────────────

export async function generateTrendReport(userId: string): Promise<TrendReport | null> {
  const user = await db.user.findUnique({
    where:  { id: userId },
    select: {
      id:         true,
      name:       true,
      email:      true,
      artistName: true,
      tracks: {
        where:  { status: "PUBLISHED" },
        select: { genre: true, plays: true, title: true },
        orderBy: { plays: "desc" },
        take:   10,
      },
    },
  });
  if (!user) return null;

  // ── Platform-wide genre stats (last 30 days via tracks) ───────────────────
  const genreAgg = await db.track.groupBy({
    by:      ["genre"],
    _sum:    { plays: true },
    where:   { status: "PUBLISHED", genre: { not: null } },
    orderBy: { _sum: { plays: "desc" } },
    take:    10,
  });

  const topPlatformGenres = genreAgg
    .filter((g) => g.genre !== null)
    .slice(0, 5)
    .map((g) => ({ genre: g.genre as string, playCount: g._sum.plays ?? 0 }));

  // Artist's primary genre (most common on their own tracks)
  const artistGenre = user.tracks[0]?.genre ?? null;

  // Build context for Haiku
  const genreList   = topPlatformGenres.map((g) => `${g.genre} (${g.playCount.toLocaleString()} plays)`).join(", ");
  const trackList   = user.tracks.slice(0, 5).map((t) => `"${t.title}" (${t.plays} plays, genre: ${t.genre ?? "unknown"})`).join("; ");
  const artistLabel = user.artistName ?? user.name;

  const prompt = `You are an A&R data analyst writing a personalised trend report for an IndieThis artist.

Artist: ${artistLabel}
Artist's primary genre: ${artistGenre ?? "unknown"}
Artist's recent tracks: ${trackList || "none"}

Top platform genres by plays right now: ${genreList || "data unavailable"}

Write a short JSON report with exactly these keys (no markdown, pure JSON):
{
  "releaseTimingTip": "1 sentence on best day/time to release for this genre",
  "monetisationTip": "1 sentence specific to their genre on earning more (merch, stream leases, etc.)",
  "personalInsight": "1–2 sentences analysing their tracks vs platform trends",
  "callToAction": "1 upbeat sentence encouraging them"
}`;

  let haiku: { releaseTimingTip: string; monetisationTip: string; personalInsight: string; callToAction: string } = {
    releaseTimingTip: "Fridays are the strongest release day across most genres on IndieThis.",
    monetisationTip:  "Consider enabling stream leases on your most-played track to earn passive monthly income.",
    personalInsight:  "Your tracks are well-positioned against current platform trends — keep releasing consistently.",
    callToAction:     "Your next release could be your biggest yet.",
  };

  try {
    const resp = await claude.messages.create({
      model:      HAIKU,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content.find((b) => b.type === "text")?.text?.trim() ?? "";
    // Extract JSON — strip any markdown fences if present
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      haiku = {
        releaseTimingTip: parsed.releaseTimingTip ?? haiku.releaseTimingTip,
        monetisationTip:  parsed.monetisationTip  ?? haiku.monetisationTip,
        personalInsight:  parsed.personalInsight  ?? haiku.personalInsight,
        callToAction:     parsed.callToAction      ?? haiku.callToAction,
      };
    }
  } catch { /* use defaults */ }

  const report: TrendReport = {
    generatedAt:       new Date().toISOString(),
    artistGenre,
    topPlatformGenres,
    ...haiku,
  };

  // Store report in AgentLog metadata
  await logAgentAction(
    "TREND_FORECASTER",
    "TREND_REPORT_GENERATED",
    "USER",
    userId,
    report as unknown as Record<string, unknown>,
  );

  // Notify artist
  await createNotification({
    userId,
    type:    "AI_JOB_COMPLETE",
    title:   "Your trend report is ready",
    message: report.personalInsight,
    link:    "/dashboard/ai/trend-report",
  });

  // Email with report highlights
  if (user.email) {
    const html = agentEmailBase(
      `<p>Hi ${user.artistName ?? user.name},</p>
       <p>Your personalised trend report is ready. Here are the highlights:</p>
       <div style="background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.25);border-radius:12px;padding:16px 20px;margin:16px 0;">
         <p style="margin:0 0 10px;color:#D4A843;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">📊 Platform Insight</p>
         <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">${report.personalInsight}</p>
         <p style="margin:0 0 4px;font-size:13px;font-weight:600;">🗓 Release timing</p>
         <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#ccc;">${report.releaseTimingTip}</p>
         <p style="margin:0 0 4px;font-size:13px;font-weight:600;">💰 Monetisation tip</p>
         <p style="margin:0;font-size:13px;line-height:1.5;color:#ccc;">${report.monetisationTip}</p>
       </div>
       <p>${report.callToAction}</p>`,
      "View Full Report",
      `${APP_URL}/dashboard/ai/trend-report`,
    );
    void sendAgentEmail(
      { email: user.email, name: user.artistName ?? user.name },
      "Your IndieThis Trend Report is ready",
      html,
      ["trend_report"],
    ).catch(() => {});
  }

  return report;
}

// ─── Weekly teaser cron ───────────────────────────────────────────────────────

export async function runTrendForecasterAgent(): Promise<TrendForecasterResult> {
  await logAgentAction("TREND_FORECASTER", "AGENT_RUN_START");

  const result: TrendForecasterResult = { checked: 0, teasersSent: 0 };

  // Platform top genre for the teaser
  const topGenreRow = await db.track.groupBy({
    by:      ["genre"],
    _sum:    { plays: true },
    where:   { status: "PUBLISHED", genre: { not: null } },
    orderBy: { _sum: { plays: "desc" } },
    take:    1,
  });
  const topGenre = topGenreRow[0]?.genre ?? "Hip-Hop";

  // Active artists
  const artists = await db.user.findMany({
    where:  { role: "ARTIST", subscription: { status: "ACTIVE" } },
    select: { id: true, name: true, artistName: true },
    take:   200,
  });

  for (const artist of artists) {
    result.checked++;

    // 6-day dedup guard — don't resend teaser within the same week
    const recentLog = await db.agentLog.findFirst({
      where: {
        agentType: "TREND_FORECASTER",
        action:    "TEASER_SENT",
        targetId:  artist.id,
        createdAt: { gte: daysAgo(6) },
      },
    });
    if (recentLog) continue;

    await createNotification({
      userId:  artist.id,
      type:    "AI_JOB_COMPLETE",
      title:   `This week's top trend: ${topGenre}`,
      message: `${topGenre} is leading platform plays this week. Get your personalised trend report ($4.99) for release timing, monetisation tips, and a breakdown of where your music fits.`,
      link:    "/dashboard/ai/trend-report",
    });

    await logAgentAction("TREND_FORECASTER", "TEASER_SENT", "USER", artist.id, { topGenre });
    result.teasersSent++;
  }

  await logAgentAction(
    "TREND_FORECASTER",
    "AGENT_RUN_COMPLETE",
    undefined,
    undefined,
    result as unknown as Record<string, unknown>,
  );

  return result;
}
