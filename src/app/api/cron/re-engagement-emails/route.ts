import { NextResponse } from "next/server";
import { db }           from "@/lib/db";
import { PRICING_DEFAULTS } from "@/lib/pricing";
import {
  sendReEngagement7DayEmail,
  sendReEngagement14DayEmail,
  sendReEngagement30DayEmail,
  sendReEngagement45DayEmail,
} from "@/lib/brevo/email";

type ReEngagementType = "7DAY" | "14DAY" | "30DAY" | "45DAY";

const FEATURE_CATALOGUE = [
  { key: "VIDEO",     name: "AI Music Video",    description: "Upload a photo + track — AI generates a cinematic video in minutes.",   url: "/dashboard/ai/video"     },
  { key: "COVER_ART", name: "AI Cover Art",       description: "Describe your vision and get 4 stunning options in 12 seconds.",        url: "/dashboard/ai/cover-art" },
  { key: "MASTERING", name: "AI Mastering",       description: "Upload your track, set your style, A/B compare — then download.",       url: "/dashboard/ai/mastering" },
  { key: "MERCH",     name: "Merch Storefront",   description: "Zero inventory. Upload art, set your markup, start selling.",           url: "/dashboard/merch"        },
  { key: "PRESAVE",   name: "Pre-Save Campaign",  description: "Capture fans before your release — builds your email list automatically.", url: "/dashboard/releases"   },
] as const;

const TIER_PRICES: Record<string, number> = {
  LAUNCH: PRICING_DEFAULTS.PLAN_LAUNCH.value * 100,
  PUSH:   PRICING_DEFAULTS.PLAN_PUSH.value   * 100,
  REIGN:  PRICING_DEFAULTS.PLAN_REIGN.value  * 100,
};

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

// cycleKey = the start-of-inactive-window, rounded to the day
function cycleKey(lastLoginAt: Date | null): string {
  const d = lastLoginAt ?? new Date(0);
  return d.toISOString().split("T")[0]!;
}

function alreadySentThisCycle(
  logs: { emailType: string; cycleKey: string }[],
  type: ReEngagementType,
  key:  string,
): boolean {
  return logs.some((l) => l.emailType === type && l.cycleKey === key);
}

// Only send ONE email per user per cron run — whichever threshold they've crossed first
function currentThreshold(days: number): ReEngagementType | null {
  if (days >= 45) return "45DAY";
  if (days >= 30) return "30DAY";
  if (days >= 14) return "14DAY";
  if (days >= 7)  return "7DAY";
  return null;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

  // Load all active subscribers with lastLoginAt
  const subscriptions = await db.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "PAST_DUE"] },
      user:   { isSuspended: false },
    },
    select: {
      tier:              true,
      currentPeriodEnd:  true,
      user: {
        select: {
          id:           true,
          email:        true,
          name:         true,
          artistSlug:   true,
          lastLoginAt:  true,
          reEngagementEmails: { select: { emailType: true, cycleKey: true } },
          aiGenerations: { select: { type: true } },
          merchProducts: { select: { id: true }, take: 1 },
          preSaveCampaigns: { select: { id: true }, take: 1 },
        },
      },
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const sub of subscriptions) {
    const user = sub.user;
    if (!user.lastLoginAt) continue; // never logged in — skip

    const days      = daysSince(user.lastLoginAt);
    const threshold = currentThreshold(days);
    if (!threshold) continue; // active user, no action needed

    const key  = cycleKey(user.lastLoginAt);
    const logs = user.reEngagementEmails;

    // Skip if already sent this email in this cycle
    if (alreadySentThisCycle(logs, threshold, key)) { skipped++; continue; }

    const u = { id: user.id, email: user.email, name: user.name ?? "there", artistSlug: user.artistSlug };

    try {
      if (threshold === "7DAY") {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const pageViews = await db.pageView.count({
          where: { artistId: user.id, viewedAt: { gte: sevenDaysAgo } },
        });
        await sendReEngagement7DayEmail(u, pageViews);

      } else if (threshold === "14DAY") {
        const usedTypes = new Set(user.aiGenerations.map((j) => j.type));
        const unused = FEATURE_CATALOGUE.filter((f) => {
          if (f.key === "MERCH")   return user.merchProducts.length === 0;
          if (f.key === "PRESAVE") return user.preSaveCampaigns.length === 0;
          return !usedTypes.has(f.key as "VIDEO" | "COVER_ART" | "MASTERING");
        });
        const feature = unused[0] ?? FEATURE_CATALOGUE[0];
        await sendReEngagement14DayEmail(u, {
          name:        feature.name,
          description: feature.description,
          url:         `${appUrl}${feature.url}`,
        });

      } else if (threshold === "30DAY") {
        await sendReEngagement30DayEmail(u);

      } else if (threshold === "45DAY") {
        await sendReEngagement45DayEmail(u, {
          tier:         sub.tier,
          renewsAt:     sub.currentPeriodEnd,
          amountCents:  TIER_PRICES[sub.tier] ?? 1900,
        });
      }

      await db.reEngagementEmailLog.create({
        data: { userId: user.id, emailType: threshold, cycleKey: key },
      });
      sent++;

    } catch (err) {
      console.error(`[re-engagement-emails] user ${user.id}:`, err);
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, total: subscriptions.length });
}
