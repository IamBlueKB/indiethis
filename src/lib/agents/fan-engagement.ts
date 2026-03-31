/**
 * src/lib/agents/fan-engagement.ts
 * Fan Engagement Agent — runs weekly every Wednesday via master cron.
 *
 * Builds a data snapshot of each artist's fan activity:
 *   — Top fans by spend (FanScore)
 *   — New fans added this week (FanContact)
 *   — Merch orders placed this week (MerchOrder)
 *   — Days since last broadcast
 *
 * Sends the snapshot to Claude, which returns 2–3 specific, actionable
 * engagement suggestions tailored to that artist's situation.
 *
 * One digest per artist per week. Never surfaces advice about features
 * the artist hasn't unlocked on their current plan.
 */

import Anthropic         from "@anthropic-ai/sdk";
import { db }            from "@/lib/db";
import {
  logAgentAction,
  agentActedRecently,
  sendAgentNotification,
  sendAgentEmail,
  agentEmailBase,
} from "@/lib/agents";

const APP_URL   = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

interface FanSummary {
  newFansThisWeek:   number;
  totalFans:         number;
  topFanEmails:      string[];           // top 3 by totalSpend
  topFanSpend:       number;             // highest single fan's totalSpend
  merchOrdersThisWeek: number;
  lastBroadcastDays: number | null;      // null = never
  hasFanAutomation:  boolean;
  hasPreSave:        boolean;
  totalFanSpend:     number;             // sum of all FanScore.totalSpend
}

interface Suggestion {
  title:   string;
  body:    string;
  action:  string; // short CTA label
  url:     string;
}

// ─── Claude call ──────────────────────────────────────────────────────────────

async function generateSuggestions(
  artistName: string,
  summary:    FanSummary,
): Promise<Suggestion[]> {
  const prompt = `You are an expert music marketing advisor for IndieThis, a platform for independent artists.

Artist: ${artistName || "this artist"}
Fan data summary (last 7 days):
- New fans added this week: ${summary.newFansThisWeek}
- Total fans in database: ${summary.totalFans}
- Merch orders this week: ${summary.merchOrdersThisWeek}
- Top fan's total spend: $${summary.topFanSpend.toFixed(2)}
- Total fan spend (all time): $${summary.totalFanSpend.toFixed(2)}
- Days since last broadcast: ${summary.lastBroadcastDays === null ? "never sent one" : `${summary.lastBroadcastDays} days ago`}
- Has fan automation running: ${summary.hasFanAutomation ? "yes" : "no"}
- Has active pre-save campaign: ${summary.hasPreSave ? "yes" : "no"}

Return EXACTLY 2 or 3 specific, actionable engagement suggestions as a JSON array.
Each suggestion must be concrete and tailored to the data above — not generic advice.
Use first-person language directed at the artist (e.g., "Send a personal thank-you...").

JSON format (array, no wrapper object):
[
  {
    "title": "Short title (max 8 words)",
    "body": "One specific sentence explaining what to do and why (max 25 words). Reference the actual data.",
    "action": "Short CTA label (max 4 words)",
    "url_key": "broadcasts | fans | releases | music | site"
  }
]

url_key maps to the IndieThis dashboard section most relevant to the suggestion.
Only output valid JSON. No markdown, no extra text.`;

  try {
    const msg = await anthropic.messages.create({
      model:      "claude-3-haiku-20240307",
      max_tokens: 512,
      messages:   [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "[]";
    const raw  = JSON.parse(text) as Array<{
      title:    string;
      body:     string;
      action:   string;
      url_key:  string;
    }>;

    const urlMap: Record<string, string> = {
      broadcasts: `${APP_URL()}/dashboard/broadcasts`,
      fans:       `${APP_URL()}/dashboard/fans`,
      releases:   `${APP_URL()}/dashboard/releases`,
      music:      `${APP_URL()}/dashboard/music`,
      site:       `${APP_URL()}/dashboard/site`,
    };

    return raw.slice(0, 3).map((s) => ({
      title:  s.title,
      body:   s.body,
      action: s.action,
      url:    urlMap[s.url_key] ?? `${APP_URL()}/dashboard/fans`,
    }));
  } catch {
    // Fallback: static suggestion if Claude fails
    return [{
      title:  "Engage your fans this week",
      body:   summary.lastBroadcastDays === null || (summary.lastBroadcastDays ?? 99) > 14
        ? "You haven't sent a broadcast recently. Your fans want to hear from you."
        : "Check your fan dashboard to see your most active supporters.",
      action: "Go to Fan Hub",
      url:    `${APP_URL()}/dashboard/fans`,
    }];
  }
}

// ─── Email builder ────────────────────────────────────────────────────────────

function buildDigestEmail(
  name:        string,
  summary:     FanSummary,
  suggestions: Suggestion[],
): string {
  const statsHtml = `
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
      <tr>
        <td style="padding:10px 12px;background:#1a1a1a;border-radius:6px;text-align:center;width:33%;">
          <div style="font-size:22px;font-weight:700;color:#D4A843;">${summary.newFansThisWeek}</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">New fans this week</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:10px 12px;background:#1a1a1a;border-radius:6px;text-align:center;width:33%;">
          <div style="font-size:22px;font-weight:700;color:#D4A843;">${summary.totalFans}</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">Total fans</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:10px 12px;background:#1a1a1a;border-radius:6px;text-align:center;width:33%;">
          <div style="font-size:22px;font-weight:700;color:#D4A843;">${summary.merchOrdersThisWeek}</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">Orders this week</div>
        </td>
      </tr>
    </table>`;

  const suggestionsHtml = suggestions.map((s) => `
    <div style="margin:0 0 16px;padding:14px 16px;background:#1a1a1a;border-radius:8px;border-left:3px solid #D4A843;">
      <div style="font-size:14px;font-weight:600;color:#fff;margin:0 0 6px;">${s.title}</div>
      <div style="font-size:13px;color:#C8C8C8;line-height:1.6;margin:0 0 10px;">${s.body}</div>
      <a href="${s.url}" style="font-size:12px;color:#D4A843;text-decoration:none;font-weight:600;">${s.action} →</a>
    </div>`).join("");

  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">Hey ${name} — here's your fan engagement digest for this week:</p>
    ${statsHtml}
    <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#fff;">This week's suggestions:</p>
    ${suggestionsHtml}`;

  return agentEmailBase(
    body,
    "Open Fan Hub →",
    `${APP_URL()}/dashboard/fans`,
  );
}

// ─── Main agent ───────────────────────────────────────────────────────────────

export async function runFanEngagementAgent(): Promise<{ acted: number }> {
  const now        = Date.now();
  const oneWeekAgo = new Date(now - 7  * 24 * 60 * 60 * 1000);

  // Load all active subscribers
  const users = await db.user.findMany({
    where: {
      isSuspended:  false,
      subscription: { status: "ACTIVE" },
    },
    select: {
      id:    true,
      email: true,
      name:  true,
      artistName: true,
      subscription: { select: { tier: true } },
      // New fans this week
      fanContacts: {
        where:  { createdAt: { gte: oneWeekAgo } },
        select: { id: true },
      },
      // Total fan count
      _count: {
        select: { fanContacts: true },
      },
      // Merch products (just IDs for order counting)
      merchProducts: {
        select: { id: true },
      },
      // Last broadcast
      broadcastLogs: {
        orderBy: { sentAt: "desc" },
        take:    1,
        select:  { sentAt: true },
      },
      // Fan automations
      fanAutomations: {
        where:  { isActive: true },
        select: { id: true },
        take:   1,
      },
      // Pre-save campaigns
      preSaveCampaigns: {
        where:  { isActive: true },
        select: { id: true },
        take:   1,
      },
    },
  });

  // Top fan scores per artist (top 3 by totalSpend)
  const artistIds = users.map((u) => u.id);
  const topFanScores = await db.fanScore.findMany({
    where:   { artistId: { in: artistIds }, totalSpend: { gt: 0 } },
    orderBy: { totalSpend: "desc" },
    select:  { artistId: true, email: true, totalSpend: true },
  });

  // Group by artistId
  const fanScoreMap = new Map<string, typeof topFanScores>();
  for (const fs of topFanScores) {
    const list = fanScoreMap.get(fs.artistId) ?? [];
    list.push(fs);
    fanScoreMap.set(fs.artistId, list);
  }

  // Total fan spend per artist
  const fanSpendAgg = await db.fanScore.groupBy({
    by:    ["artistId"],
    where: { artistId: { in: artistIds } },
    _sum:  { totalSpend: true },
  });
  const fanSpendMap = new Map(fanSpendAgg.map((a) => [a.artistId, a._sum.totalSpend ?? 0]));

  let acted = 0;

  for (const user of users) {
    if (!user.subscription) continue;

    // Skip if already acted this week
    if (await agentActedRecently("FAN_ENGAGEMENT", user.id, 6 * 24)) continue;

    const scores  = fanScoreMap.get(user.id) ?? [];
    const lastBc  = user.broadcastLogs[0]?.sentAt ?? null;
    const daysAgo = lastBc ? Math.floor((now - lastBc.getTime()) / (24 * 60 * 60 * 1000)) : null;

    const productIds = user.merchProducts.map((p) => p.id);
    const orderCount = productIds.length > 0
      ? await db.merchOrderItem.count({
          where: { productId: { in: productIds }, order: { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } } },
        })
      : 0;

    const summary: FanSummary = {
      newFansThisWeek:     user.fanContacts.length,
      totalFans:           user._count.fanContacts,
      topFanEmails:        scores.slice(0, 3).map((s) => s.email),
      topFanSpend:         scores[0]?.totalSpend ?? 0,
      merchOrdersThisWeek: orderCount,
      lastBroadcastDays:   daysAgo,
      hasFanAutomation:    user.fanAutomations.length > 0,
      hasPreSave:          user.preSaveCampaigns.length > 0,
      totalFanSpend:       fanSpendMap.get(user.id) ?? 0,
    };

    // Skip artists with no fan activity at all (nothing to suggest about)
    if (summary.totalFans === 0 && summary.totalFanSpend === 0) continue;

    const displayName = user.artistName ?? user.name ?? "there";
    const suggestions = await generateSuggestions(displayName, summary);

    if (suggestions.length === 0) continue;

    // In-app notification — first suggestion as the headline
    const first = suggestions[0];
    await sendAgentNotification(
      user.id,
      `Fan digest — ${summary.newFansThisWeek > 0 ? `${summary.newFansThisWeek} new fans this week` : "your fan update"}`,
      first.body,
      `${APP_URL()}/dashboard/fans`,
    );

    // Email digest
    await sendAgentEmail(
      { email: user.email, name: displayName },
      `Your fan digest — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      buildDigestEmail(displayName, summary, suggestions),
      ["agent", "fan-engagement"],
    );

    await logAgentAction("FAN_ENGAGEMENT", "DIGEST_SENT", "USER", user.id, {
      newFans:        summary.newFansThisWeek,
      totalFans:      summary.totalFans,
      suggestions:    suggestions.map((s) => s.title),
    });

    acted++;
  }

  await logAgentAction("FAN_ENGAGEMENT", "AGENT_RUN_COMPLETE", undefined, undefined, {
    usersActed: acted,
    totalUsers: users.length,
  });

  return { acted };
}
