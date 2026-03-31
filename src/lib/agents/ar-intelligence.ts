/**
 * src/lib/agents/ar-intelligence.ts
 * A&R Intelligence Agent — Step 7
 *
 * Runs weekly (Friday). Push + Reign tier artists only.
 * Gathers play trends, crate adds, fan signups, digital sales, and audio features,
 * then calls Claude for 3 actionable micro-insights sent as notification + email.
 */

import Anthropic                from "@anthropic-ai/sdk";
import { db }                   from "@/lib/db";
import {
  logAgentAction,
  agentActedRecently,
  sendAgentEmail,
  sendAgentNotification,
  agentEmailBase,
} from "@/lib/agents";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const QUALIFYING_TIERS = ["PUSH", "REIGN"] as const;

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runArIntelligenceAgent(): Promise<{ acted: number }> {
  const now    = new Date();
  const week1Start = new Date(now.getTime() - 7  * 86400_000);
  const week2Start = new Date(now.getTime() - 14 * 86400_000);

  // Qualifying artists: Push or Reign, active, not suspended
  const artists = await db.user.findMany({
    where: {
      isSuspended: false,
      subscription: {
        tier:   { in: [...QUALIFYING_TIERS] },
        status: "ACTIVE",
      },
    },
    select: {
      id:    true,
      email: true,
      name:  true,
      tracks: {
        where: { status: "PUBLISHED" },
        select: {
          id:          true,
          title:       true,
          totalPlays:  true,
          audioFeatures: {
            select: {
              energy:          true,
              danceability:    true,
              valence:         true,
              genre:           true,
              mood:            true,
            },
          },
        },
      },
    },
  });

  let acted = 0;

  for (const artist of artists) {
    try {
      // 7-day cooldown — skip if we already sent this week
      const recentlySent = await agentActedRecently("AR_INTELLIGENCE", artist.id, 6 * 24);
      if (recentlySent) continue;

      if (artist.tracks.length === 0) continue;

      const trackIds = artist.tracks.map((t) => t.id);

      // ── Play counts: this week vs previous week ──────────────────────────
      const [thisWeekPlays, lastWeekPlays] = await Promise.all([
        db.trackPlay.groupBy({
          by:     ["trackId"],
          where:  { trackId: { in: trackIds }, playedAt: { gte: week1Start } },
          _count: { _all: true },
        }),
        db.trackPlay.groupBy({
          by:     ["trackId"],
          where:  { trackId: { in: trackIds }, playedAt: { gte: week2Start, lt: week1Start } },
          _count: { _all: true },
        }),
      ]);

      const thisWeekMap  = new Map(thisWeekPlays.map((r)  => [r.trackId, r._count._all]));
      const lastWeekMap  = new Map(lastWeekPlays.map((r)  => [r.trackId, r._count._all]));

      // ── New DJ crate adds this week ──────────────────────────────────────
      const crateAdds = await db.crateItem.count({
        where: {
          addedAt: { gte: week1Start },
          track:   { artistId: artist.id },
        },
      });

      // ── New fan contacts this week ───────────────────────────────────────
      const newFans = await db.fanContact.count({
        where: {
          artistId:  artist.id,
          createdAt: { gte: week1Start },
        },
      });

      // ── Digital sales this week ──────────────────────────────────────────
      const salesThisWeek = await db.digitalPurchase.count({
        where: {
          createdAt:     { gte: week1Start },
          digitalProduct: { userId: artist.id },
        },
      });

      // ── Total platform plays this week (for trend context) ────────────────
      const platformTotalThisWeek = await db.trackPlay.count({
        where: { playedAt: { gte: week1Start } },
      });

      // ── Build per-track trend data ────────────────────────────────────────
      type TrackTrend = {
        title:     string;
        thisWeek:  number;
        lastWeek:  number;
        change:    number;
        direction: "up" | "down" | "flat";
        features?: {
          energy:       number;
          danceability: number;
          valence:      number;
          genre:        string | null;
          mood:         string | null;
        };
      };

      const trackTrends: TrackTrend[] = artist.tracks.map((track) => {
        const tw  = thisWeekMap.get(track.id)  ?? 0;
        const lw  = lastWeekMap.get(track.id)  ?? 0;
        const pct = lw > 0 ? ((tw - lw) / lw) * 100 : (tw > 0 ? 100 : 0);
        return {
          title:     track.title,
          thisWeek:  tw,
          lastWeek:  lw,
          change:    Math.round(pct),
          direction: pct >  20 ? "up" : pct < -20 ? "down" : "flat",
          features:  track.audioFeatures
            ? {
                energy:       track.audioFeatures.energy,
                danceability: track.audioFeatures.danceability,
                valence:      track.audioFeatures.valence,
                genre:        track.audioFeatures.genre,
                mood:         track.audioFeatures.mood,
              }
            : undefined,
        };
      });

      const risingTracks  = trackTrends.filter((t) => t.direction === "up");
      const decliningTracks = trackTrends.filter((t) => t.direction === "down");
      const totalThisWeek = trackTrends.reduce((s, t) => s + t.thisWeek, 0);
      const totalLastWeek = trackTrends.reduce((s, t) => s + t.lastWeek, 0);
      const overallTrend  =
        totalLastWeek > 0
          ? Math.round(((totalThisWeek - totalLastWeek) / totalLastWeek) * 100)
          : totalThisWeek > 0 ? 100 : 0;

      // ── Call Claude for 3 insights ────────────────────────────────────────
      const dataPayload = {
        artist:            artist.name ?? "Artist",
        overallPlaysTrend: `${overallTrend > 0 ? "+" : ""}${overallTrend}% vs last week (${totalThisWeek} total plays)`,
        risingTracks:      risingTracks.map((t) => `"${t.title}" +${t.change}% (${t.thisWeek} plays)`),
        decliningTracks:   decliningTracks.map((t) => `"${t.title}" ${t.change}% (${t.thisWeek} plays)`),
        djCrateAddsThisWeek: crateAdds,
        newFanSignupsThisWeek: newFans,
        digitalSalesThisWeek: salesThisWeek,
        platformTotalPlaysThisWeek: platformTotalThisWeek,
        audioFeaturesSample: trackTrends.slice(0, 3).map((t) => ({
          track:    t.title,
          features: t.features,
        })),
      };

      const completion = await anthropic.messages.create({
        model:      "claude-3-5-haiku-20241022",
        max_tokens: 400,
        messages: [
          {
            role:    "user",
            content: `You are an A&R intelligence analyst. Based on this artist's data, provide exactly 3 brief, actionable insights. Be specific, reference actual track names and numbers. Keep each insight to 1-2 sentences. Focus on what the artist should DO next. Return only a JSON array of 3 strings, no other text.

Artist data:
${JSON.stringify(dataPayload, null, 2)}`,
          },
        ],
      });

      let insights: string[] = [];
      try {
        const raw = completion.content[0].type === "text" ? completion.content[0].text.trim() : "[]";
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
        insights = JSON.parse(cleaned);
        if (!Array.isArray(insights)) insights = [];
        insights = insights.slice(0, 3).map(String);
      } catch {
        // Claude returned non-JSON — fall back to generic message
        insights = [
          totalThisWeek > 0
            ? `Your tracks got ${totalThisWeek} plays this week${overallTrend !== 0 ? ` (${overallTrend > 0 ? "+" : ""}${overallTrend}% vs last week)` : ""}.`
            : "No plays recorded this week — consider promoting your tracks.",
          crateAdds > 0
            ? `${crateAdds} DJ${crateAdds === 1 ? "" : "s"} added your music to their crate this week.`
            : "No new DJ crate adds this week — submit your tracks to DJ pools.",
          newFans > 0
            ? `${newFans} new fan${newFans === 1 ? "" : "s"} joined your list this week.`
            : "No new fans this week — share your fan sign-up link.",
        ];
      }

      if (insights.length === 0) continue;

      // ── Send in-app notification ──────────────────────────────────────────
      const notifMessage = insights.map((ins, i) => `${i + 1}. ${ins}`).join("\n\n");
      await sendAgentNotification(
        artist.id,
        "Weekly A&R Brief",
        notifMessage,
        "/dashboard/music",
      );

      // ── Send email ────────────────────────────────────────────────────────
      const insightRows = insights
        .map(
          (ins, i) => `
          <div style="margin-bottom:16px;padding:14px 16px;background:rgba(255,255,255,0.04);border-radius:10px;border-left:3px solid #D4A843;">
            <span style="font-size:10px;font-weight:700;color:#D4A843;letter-spacing:0.5px;text-transform:uppercase;">Insight ${i + 1}</span>
            <p style="margin:6px 0 0;font-size:14px;color:#E0E0E0;line-height:1.5;">${ins}</p>
          </div>`,
        )
        .join("");

      const statsRow = [
        totalThisWeek > 0 && `<span style="color:#D4A843;font-weight:700;">${totalThisWeek}</span> plays`,
        crateAdds > 0     && `<span style="color:#D4A843;font-weight:700;">${crateAdds}</span> crate add${crateAdds === 1 ? "" : "s"}`,
        newFans > 0       && `<span style="color:#D4A843;font-weight:700;">${newFans}</span> new fan${newFans === 1 ? "" : "s"}`,
        salesThisWeek > 0 && `<span style="color:#D4A843;font-weight:700;">${salesThisWeek}</span> sale${salesThisWeek === 1 ? "" : "s"}`,
      ]
        .filter(Boolean)
        .join(" &nbsp;·&nbsp; ");

      const bodyHtml = `
        <p style="margin:0 0 6px;font-size:13px;color:#888;letter-spacing:0.5px;text-transform:uppercase;font-weight:600;">Weekly A&R Brief</p>
        <p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#F0F0F0;line-height:1.2;">Your music, this week.</p>
        ${statsRow ? `<p style="margin:0 0 20px;font-size:13px;color:#888;">${statsRow}</p>` : ""}
        ${insightRows}
        <p style="margin:20px 0 0;font-size:13px;color:#666;">These insights update every Friday. Keep creating.</p>
      `;

      const html = agentEmailBase(bodyHtml, "View Your Dashboard", `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/music`);

      await sendAgentEmail(
        { email: artist.email!, name: artist.name ?? "Artist" },
        "Your Weekly A&R Brief",
        html,
        ["ar-intelligence"],
      );

      await logAgentAction("AR_INTELLIGENCE", "AR_BRIEF_SENT", "USER", artist.id, {
        insights:     insights.length,
        plays:        totalThisWeek,
        playTrend:    overallTrend,
        crateAdds,
        newFans,
        sales:        salesThisWeek,
      });

      acted++;
    } catch (err) {
      await logAgentAction("AR_INTELLIGENCE", "AR_BRIEF_ERROR", "USER", artist.id, {
        error: String(err),
      });
    }
  }

  return { acted };
}
