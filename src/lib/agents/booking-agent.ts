/**
 * booking-agent.ts — AI Booking Agent (Step 7)
 *
 * PURPOSE
 * On-demand PPU report ($14.99). Finds performance and exposure opportunities
 * for an artist or DJ: venues, open mics, festivals, competitions, showcases,
 * radio stations, music blogs, and podcasts.
 *
 * TRIGGER
 * PPU checkout at POST /api/dashboard/ai/booking-report/checkout.
 * Webhook fires generateBookingReport(userId, mode) on payment success.
 * mode: "ARTIST" | "DJ"
 *
 * DESIGN RULES
 * - Claude Haiku only — cost-efficient structured report generation
 * - Log every action to AgentLog (details field)
 * - No AI/agent mention in user-facing copy
 * - Reign plan: free (checked at checkout, not here)
 */

import { db }                         from "@/lib/db";
import { claude }                     from "@/lib/claude";
import { logAgentAction, AT }         from "@/lib/agents";
import { createNotification }         from "@/lib/notifications";
import { sendAgentEmail, agentEmailBase } from "@/lib/agents";

const HAIKU   = "claude-3-5-haiku-20241022";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookingMode = "ARTIST" | "DJ";

export interface BookingOpportunity {
  name:        string;
  type:        string;        // "open mic" | "festival" | "competition" | "showcase" | "radio" | "blog" | "podcast" | "club night" etc.
  location:    string;        // city / online / platform
  deadline:    string | null; // ISO date string or null
  link:        string | null; // submission URL or contact
  fit:         string;        // why this is a good fit (1–2 sentences)
}

export interface BookingReport {
  generatedAt:   string;
  mode:          BookingMode;
  genre:         string | null;
  city:          string | null;
  opportunities: BookingOpportunity[];
  summary:       string;
}

export interface BookingAgentResult {
  success: boolean;
}

// ─── Core: generate report ────────────────────────────────────────────────────

export async function generateBookingReport(
  userId: string,
  mode:   BookingMode = "ARTIST",
): Promise<BookingReport | null> {
  const user = await db.user.findUnique({
    where:  { id: userId },
    select: {
      id:         true,
      name:       true,
      email:      true,
      artistName: true,
      city:       true,
      genres:     true,
      tracks: {
        where:  { status: "PUBLISHED" },
        select: {
          genre:        true,
          plays:        true,
          audioFeatures: { select: { genre: true, mood: true, energy: true } },
        },
        take: 10,
      },
    },
  });
  if (!user) return null;

  await logAgentAction("BOOKING_AGENT", "REPORT_GENERATION_START", "USER", userId, { mode });

  // Determine primary genre
  const allGenres = [
    ...user.genres,
    ...user.tracks.map((t) => t.audioFeatures?.genre ?? t.genre).filter(Boolean),
  ] as string[];
  const genreCount: Record<string, number> = {};
  for (const g of allGenres) genreCount[g] = (genreCount[g] ?? 0) + 1;
  const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const totalPlays = user.tracks.reduce((sum, t) => sum + (t.plays ?? 0), 0);
  const city       = user.city ?? "unknown location";
  const artistLabel = user.artistName ?? user.name;

  // Build prompt
  const prompt = mode === "ARTIST"
    ? buildArtistPrompt(artistLabel, topGenre, city, totalPlays)
    : buildDJPrompt(artistLabel, topGenre, city, totalPlays);

  let opportunities: BookingOpportunity[] = [];
  let summary = "Here are 10 curated opportunities to grow your presence and get heard.";

  try {
    const resp = await claude.messages.create({
      model:      HAIKU,
      max_tokens: 1800,
      messages: [{
        role:    "user",
        content: prompt,
      }],
    });

    const text      = resp.content.find((b) => b.type === "text")?.text?.trim() ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.opportunities)) {
        opportunities = parsed.opportunities.map((o: Partial<BookingOpportunity>) => ({
          name:     o.name     ?? "Opportunity",
          type:     o.type     ?? "performance",
          location: o.location ?? city,
          deadline: o.deadline ?? null,
          link:     o.link     ?? null,
          fit:      o.fit      ?? "Strong genre alignment.",
        }));
      }
      if (typeof parsed.summary === "string" && parsed.summary.length > 0) {
        summary = parsed.summary;
      }
    }
  } catch (err) {
    console.error("[booking-agent] Haiku error:", err);
    // Return empty report rather than failing silently
  }

  const report: BookingReport = {
    generatedAt:   new Date().toISOString(),
    mode,
    genre:         topGenre,
    city,
    opportunities,
    summary,
  };

  // Store in AgentLog
  await logAgentAction(
    "BOOKING_AGENT",
    "REPORT_GENERATED",
    "USER",
    userId,
    report as unknown as Record<string, unknown>,
  );

  // In-app notification
  await createNotification({
    userId,
    type:    "AI_JOB_COMPLETE",
    title:   "Your booking opportunities report is ready",
    message: summary,
    link:    mode === "DJ"
      ? "/dashboard/dj/booking-report"
      : "/dashboard/ai/booking-report",
  });

  // Email highlights
  if (user.email && opportunities.length > 0) {
    const topThree = opportunities.slice(0, 3);
    const oppRows  = topThree
      .map(
        (o) => `
        <div style="border-left:3px solid #D4A843;padding:10px 14px;margin:10px 0;">
          <p style="margin:0 0 4px;color:#D4A843;font-weight:700;font-size:14px;">${o.name} <span style="color:#888;font-weight:400;font-size:12px;">(${o.type})</span></p>
          <p style="margin:0 0 4px;font-size:13px;color:#ccc;">${o.fit}</p>
          <p style="margin:0;font-size:12px;color:#888;">${o.location}${o.deadline ? ` · Deadline: ${o.deadline}` : ""}${o.link ? ` · <a href="${o.link}" style="color:#D4A843;">${o.link}</a>` : ""}</p>
        </div>`,
      )
      .join("");

    const html = agentEmailBase(
      `<p>Hi ${artistLabel},</p>
       <p>Your booking opportunities report is ready. Here are your top picks:</p>
       ${oppRows}
       <p style="font-size:14px;color:#ccc;">View all ${opportunities.length} opportunities in your dashboard.</p>`,
      "View Full Report",
      `${APP_URL}${mode === "DJ" ? "/dashboard/dj/booking-report" : "/dashboard/ai/booking-report"}`,
    );

    void sendAgentEmail(
      { email: user.email, name: artistLabel },
      "Your IndieThis Booking Opportunities Report",
      html,
      ["booking_report"],
    ).catch(() => {});
  }

  return report;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildArtistPrompt(
  artistName: string,
  genre:      string | null,
  city:       string,
  plays:      number,
): string {
  const listenerLabel =
    plays > 10000 ? "a growing fanbase with over 10,000 plays"
    : plays > 1000 ? "approximately 1,000–10,000 total plays"
    : "an emerging artist building their audience";

  return `You are a music industry booking agent helping independent artists find opportunities.

Find 10 current performance and exposure opportunities for "${artistName}", an independent ${genre ?? "indie"} artist based in ${city} with ${listenerLabel}.

Search for a mix of: open mic nights, festivals accepting applications with upcoming deadlines, battle of the bands competitions, local showcases, radio stations accepting indie submissions, music blogs accepting features, and podcasts looking for musician guests.

For each opportunity include:
- name: full name of the opportunity
- type: one of "open mic", "festival", "competition", "showcase", "radio", "blog", "podcast", or "other"
- location: city or "online" or platform name
- deadline: ISO date (YYYY-MM-DD) if known, otherwise null
- link: direct submission URL or contact email, or null if not available
- fit: 1–2 sentences explaining why this is a great fit for this specific artist

Also write a one-sentence summary introducing the report.

Respond in JSON only — no markdown fences:
{
  "opportunities": [{ "name": "", "type": "", "location": "", "deadline": null, "link": null, "fit": "" }],
  "summary": ""
}`;
}

function buildDJPrompt(
  djName:  string,
  genre:   string | null,
  city:    string,
  plays:   number,
): string {
  const experienceLabel =
    plays > 5000 ? "an established DJ with a proven track record"
    : "an up-and-coming DJ building their bookings";

  return `You are a music industry booking agent helping independent DJs find opportunities.

Find 10 current DJ booking and exposure opportunities for "${djName}", an independent ${genre ?? "electronic/dance"} DJ based in ${city} — ${experienceLabel}.

Search for a mix of: club nights accepting DJ applications, festivals with DJ slots, DJ competitions and battles, radio stations with guest mix slots, podcasts and mix show series, promotional opportunities through music blogs and playlist curators, and events needing warm-up DJs.

For each opportunity include:
- name: full name of the opportunity or venue/event
- type: one of "club night", "festival", "competition", "radio", "mix show", "blog", "podcast", or "other"
- location: city or "online" or platform name
- deadline: ISO date (YYYY-MM-DD) if known, otherwise null
- link: direct booking / submission URL or contact, or null
- fit: 1–2 sentences on why this specific DJ would be a great fit

Also write a one-sentence summary introducing the report.

Respond in JSON only — no markdown fences:
{
  "opportunities": [{ "name": "", "type": "", "location": "", "deadline": null, "link": null, "fit": "" }],
  "summary": ""
}`;
}
