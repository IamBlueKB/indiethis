import { NextResponse } from "next/server";
import { db }           from "@/lib/db";
import {
  sendOnboardingDay1Email,
  sendOnboardingDay3Email,
  sendOnboardingDay5Email,
  sendOnboardingDay7Email,
  sendOnboardingDay14Email,
  sendOnboardingDay30Email,
} from "@/lib/brevo/email";

type EmailType = "WELCOME" | "DAY1_TRACK" | "DAY3_AI" | "DAY5_PAGE" | "DAY7_FANS" | "DAY14_DISCOVER" | "DAY30_MILESTONE";

const FEATURE_CATALOGUE = [
  { key: "VIDEO",       name: "AI Music Video",   description: "Upload a photo + track — AI generates a cinematic video in minutes.",      url: "/dashboard/ai/video"     },
  { key: "COVER_ART",   name: "AI Cover Art",      description: "Describe your vision and get 4 options in 12 seconds.",                    url: "/dashboard/ai/cover-art" },
  { key: "MASTERING",   name: "AI Mastering",      description: "Upload your track, set your style, A/B compare — then download.",          url: "/dashboard/ai/mastering" },
  { key: "LYRIC_VIDEO", name: "Lyric Video",       description: "Auto-generated lyric videos you can share anywhere.",                      url: "/dashboard/ai/video"     },
  { key: "MERCH",       name: "Merch Store",       description: "Zero inventory. Upload art, set your markup, start selling.",              url: "/dashboard/merch"        },
  { key: "PRESAVE",     name: "Pre-Save Campaign", description: "Capture fans before your release — builds your email list automatically.", url: "/dashboard/releases"     },
  { key: "BEATS",       name: "Beat Marketplace",  description: "License production-ready beats directly from producers.",                  url: "/dashboard/marketplace"  },
] as const;

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

function alreadySent(sent: { emailType: string }[], type: EmailType): boolean {
  return sent.some((s) => s.emailType === type);
}

async function logSent(userId: string, emailType: EmailType): Promise<void> {
  await db.onboardingEmailLog.create({ data: { userId, emailType } });
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await db.user.findMany({
    where: { planSelectedAt: { not: null }, isSuspended: false },
    select: {
      id:            true,
      email:         true,
      name:          true,
      artistSlug:    true,
      planSelectedAt: true,
      onboardingEmails: { select: { emailType: true } },
      tracks:           { select: { id: true }, take: 1 },
      artistSite:       { select: { isPublished: true } },
      fanContacts:      { select: { id: true }, take: 6 },
      aiJobs:           { where: { triggeredBy: "ARTIST" },   select: { type: true } },
      merchProducts:    { select: { id: true }, take: 1 },
      preSaveCampaigns: { select: { id: true }, take: 1 },
      beatLicensesAsBuyer: { select: { id: true }, take: 1 },
    },
  });

  let sent = 0;
  let skipped = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

  for (const user of users) {
    if (!user.planSelectedAt) continue;
    const days   = daysSince(user.planSelectedAt);
    const logged = user.onboardingEmails;
    const u      = { id: user.id, email: user.email, name: user.name ?? "there", artistSlug: user.artistSlug };

    try {
      // Day 1 — no track uploaded yet
      if (days >= 1 && days < 4 && !alreadySent(logged, "DAY1_TRACK") && user.tracks.length === 0) {
        await sendOnboardingDay1Email(u);
        await logSent(user.id, "DAY1_TRACK");
        sent++; continue;
      }

      // Day 3 — no AI tool used yet
      if (days >= 3 && days < 6 && !alreadySent(logged, "DAY3_AI") && user.aiJobs.length === 0) {
        await sendOnboardingDay3Email(u);
        await logSent(user.id, "DAY3_AI");
        sent++; continue;
      }

      // Day 5 — page not published
      if (days >= 5 && days < 8 && !alreadySent(logged, "DAY5_PAGE") && !user.artistSite?.isPublished) {
        await sendOnboardingDay5Email(u);
        await logSent(user.id, "DAY5_PAGE");
        sent++; continue;
      }

      // Day 7 — page published but < 5 fans
      if (days >= 7 && days < 10 && !alreadySent(logged, "DAY7_FANS") && user.artistSite?.isPublished && user.fanContacts.length < 5) {
        await sendOnboardingDay7Email(u);
        await logSent(user.id, "DAY7_FANS");
        sent++; continue;
      }

      // Day 14 — feature discovery
      if (days >= 14 && days < 18 && !alreadySent(logged, "DAY14_DISCOVER")) {
        const usedTypes = new Set(user.aiJobs.map((j) => j.type));
        const unused = FEATURE_CATALOGUE
          .filter((f) => {
            if (f.key === "MERCH")   return user.merchProducts.length === 0;
            if (f.key === "PRESAVE") return user.preSaveCampaigns.length === 0;
            if (f.key === "BEATS")   return user.beatLicensesAsBuyer.length === 0;
            return !usedTypes.has(f.key as "VIDEO" | "COVER_ART" | "MASTERING" | "LYRIC_VIDEO");
          })
          .map((f) => ({ name: f.name, description: f.description, url: `${appUrl}${f.url}` }));

        if (unused.length >= 1) {
          await sendOnboardingDay14Email(u, unused);
          await logSent(user.id, "DAY14_DISCOVER");
          sent++; continue;
        }
      }

      // Day 30 — milestone check-in
      if (days >= 30 && days < 35 && !alreadySent(logged, "DAY30_MILESTONE")) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [pageViews, plays, fans, earningsAgg] = await Promise.all([
          db.pageView.count({ where: { artistId: user.id, viewedAt: { gte: thirtyDaysAgo } } }),
          db.trackPlay.count({ where: { artistId: user.id, playedAt: { gte: thirtyDaysAgo } } }),
          db.fanContact.count({ where: { artistId: user.id } }),
          db.track.aggregate({ where: { artistId: user.id }, _sum: { earnings: true } }),
        ]);
        await sendOnboardingDay30Email(u, {
          pageViews,
          plays,
          fans,
          earnings: earningsAgg._sum.earnings ?? 0,
        });
        await logSent(user.id, "DAY30_MILESTONE");
        sent++;
      }
    } catch (err) {
      console.error(`[onboarding-emails] user ${user.id}:`, err);
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, total: users.length });
}
