/**
 * src/lib/agents/revenue-optimization.ts
 * Revenue Optimization Agent — runs weekly every Monday via master cron.
 *
 * Identifies upsell and feature-discovery moments:
 *   — Launch users hitting credit/SMS limits → suggest Push
 *   — Launch power users (3+ AI tools) → suggest Push
 *   — Push users hitting multiple limits → suggest Reign
 *   — Any tier: unused features they'd benefit from (mastering, cover art, canvas, lyric video)
 *
 * One notification per user per week max. Picks highest-value suggestion.
 * Never re-triggers a user who downgraded in the last 60 days.
 * Never suggests a tool the user has already used.
 */

import { db }              from "@/lib/db";
import {
  logAgentAction,
  agentActedRecently,
  sendAgentNotification,
  sendAgentEmail,
  agentEmailBase,
} from "@/lib/agents";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ─── Suggestion types ─────────────────────────────────────────────────────────

type Suggestion = {
  priority:  number; // higher = more valuable
  title:     string;
  message:   string;
  link:      string;
  emailSubject: string;
  emailBody: string;
};

// ─── Email builder ────────────────────────────────────────────────────────────

function buildSuggestionEmail(name: string, body: string, ctaLabel: string, ctaUrl: string): string {
  return agentEmailBase(
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">Hey ${name} —</p>${body}`,
    ctaLabel,
    ctaUrl,
  );
}

// ─── Main agent ───────────────────────────────────────────────────────────────

export async function runRevenueOptimizationAgent(): Promise<{ acted: number }> {
  const now        = Date.now();
  const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
  const thisMonth    = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  // Load all active subscribers with everything we need
  const users = await db.user.findMany({
    where: {
      isSuspended: false,
      subscription: { status: "ACTIVE" },
    },
    select: {
      id:        true,
      email:     true,
      name:      true,
      subscription: {
        select: {
          tier:                  true,
          canceledAt:            true,
          aiVideoCreditsUsed:    true,
          aiVideoCreditsLimit:   true,
          aiArtCreditsUsed:      true,
          aiArtCreditsLimit:     true,
          aiMasterCreditsUsed:   true,
          aiMasterCreditsLimit:  true,
          lyricVideoCreditsUsed: true,
          lyricVideoCreditsLimit: true,
          smsBroadcastsUsed:     true,
        },
      },
      aiGenerations: {
        select: { type: true },
      },
      tracks: {
        select: { id: true, canvasVideoUrl: true },
        take:   1,
      },
      artistSite: {
        select: { isPublished: true },
      },
      broadcastLogs: {
        where:  { createdAt: { gte: thisMonth } },
        select: { id: true },
        take:   1,
      },
    },
  });

  // Find users who recently downgraded (canceledAt in last 60 days = they churned/downgraded)
  const recentCancels = await db.subscription.findMany({
    where:  { canceledAt: { gte: sixtyDaysAgo } },
    select: { userId: true },
  });
  const recentCancelIds = new Set(recentCancels.map((s) => s.userId));

  let acted = 0;

  for (const user of users) {
    const sub = user.subscription;
    if (!sub) continue;

    // Skip users who recently cancelled/downgraded
    if (recentCancelIds.has(user.id)) continue;

    // Skip if agent acted recently (7 days)
    if (await agentActedRecently("REVENUE_OPTIMIZATION", user.id, 7 * 24)) continue;

    const usedTypes   = new Set(user.aiGenerations.map((g) => g.type));
    const hasTrack    = user.tracks.length > 0;
    const hasCanvas   = user.tracks.some((t) => !!t.canvasVideoUrl);
    const pagePublished = user.artistSite?.isPublished ?? false;
    const name        = user.name ?? "there";
    const tier        = sub.tier;

    const suggestions: Suggestion[] = [];

    // ── Upgrade suggestions ───────────────────────────────────────────────────

    if (tier === "LAUNCH") {
      const hitsArt     = sub.aiArtCreditsUsed    >= sub.aiArtCreditsLimit;
      const hitsMaster  = sub.aiMasterCreditsUsed >= sub.aiMasterCreditsLimit;
      const hitsSms     = sub.smsBroadcastsUsed   >= 100; // Launch SMS limit
      const powerUser   = usedTypes.size >= 3;
      const hitsVideo   = sub.aiVideoCreditsUsed  >= sub.aiVideoCreditsLimit;

      const limitCount = [hitsArt, hitsMaster, hitsSms, hitsVideo].filter(Boolean).length;

      if (limitCount >= 1 || powerUser) {
        const reason = limitCount >= 2
          ? "You've hit credit limits on multiple tools this month."
          : hitsArt    ? "You've used all your AI Cover Art credits this month."
          : hitsMaster ? "You've used all your AI Mastering credits this month."
          : hitsSms    ? "You've hit your SMS broadcast limit."
          : powerUser  ? "You're getting serious use out of the platform."
          : "You're close to your limits.";

        suggestions.push({
          priority:     90,
          title:        "More credits, more tools",
          message:      `${reason} Push gives you 2x credits, AI Music Videos, Lyric Videos, and full artist site features.`,
          link:         `${APP_URL()}/dashboard/upgrade`,
          emailSubject: "You're outgrowing your current plan",
          emailBody:    `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">${reason}</p>
                         <p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">The Push plan gives you 2x AI credits, access to AI Music Videos, Lyric Videos, and a full artist website. It's the plan artists use when they're serious about growing.</p>
                         <p style="margin:0;font-size:14px;color:#666;">Upgrade for $49/month — cancel anytime.</p>`,
        });
      }
    }

    if (tier === "PUSH") {
      const hitsArt    = sub.aiArtCreditsUsed    >= sub.aiArtCreditsLimit;
      const hitsMaster = sub.aiMasterCreditsUsed >= sub.aiMasterCreditsLimit;
      const hitsVideo  = sub.aiVideoCreditsUsed  >= sub.aiVideoCreditsLimit;
      const hitsSms    = sub.smsBroadcastsUsed   >= 500; // Push SMS limit

      const limitCount = [hitsArt, hitsMaster, hitsVideo, hitsSms].filter(Boolean).length;

      if (limitCount >= 2) {
        suggestions.push({
          priority:     90,
          title:        "You're maxing out Push",
          message:      "You've hit limits on multiple tools this month. Reign gives you 3x the credits, custom domain, and unlimited usage.",
          link:         `${APP_URL()}/dashboard/upgrade`,
          emailSubject: "You're maxing out your plan",
          emailBody:    `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">You've hit credit limits on multiple tools this month — that means you're using IndieThis the right way.</p>
                         <p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">Reign gives you 3x the credits, a custom domain, beat marketplace access, and unlimited AI tool use. It's the plan for artists who are fully in.</p>
                         <p style="margin:0;font-size:14px;color:#666;">Upgrade for $99/month — cancel anytime.</p>`,
        });
      }
    }

    // ── Feature discovery suggestions ─────────────────────────────────────────

    // Has tracks but never mastered
    if (hasTrack && !usedTypes.has("MASTERING")) {
      suggestions.push({
        priority:     50,
        title:        "Get a professional master — free on your plan",
        message:      "Your plan includes AI Mastering. Upload a track, pick your target sound, compare before/after.",
        link:         `${APP_URL()}/dashboard/ai/mastering`,
        emailSubject: "Your plan includes AI Mastering — have you tried it?",
        emailBody:    `<p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">You've uploaded tracks but haven't used AI Mastering yet. Your plan includes mastering credits — upload your track, set the target sound (warm, bright, punchy, balanced), and compare before/after.</p>
                       <p style="margin:0;font-size:14px;color:#666;">It takes 3 minutes. Most artists say it makes their tracks sound like they were mixed by a pro.</p>`,
      });
    }

    // Has tracks but no cover art generated
    if (hasTrack && !usedTypes.has("COVER_ART")) {
      suggestions.push({
        priority:     45,
        title:        "Generate cover art for your tracks",
        message:      "Describe your vision — get 4 AI-generated cover options in 12 seconds.",
        link:         `${APP_URL()}/dashboard/ai/cover-art`,
        emailSubject: "Your tracks need cover art",
        emailBody:    `<p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">Cover art is the first thing fans see. You have tracks up but no generated cover art — describe your vision and we'll give you 4 options in 12 seconds.</p>
                       <p style="margin:0;font-size:14px;color:#666;">Included in your plan. No extra charge.</p>`,
      });
    }

    // Has tracks, page published, but no lyric video
    if (hasTrack && pagePublished && !usedTypes.has("LYRIC_VIDEO") && tier !== "LAUNCH") {
      suggestions.push({
        priority:     40,
        title:        "Create a lyric video for your latest track",
        message:      "Lyric videos drive engagement and streams. Auto-generated from your lyrics — takes 2 minutes.",
        link:         `${APP_URL()}/dashboard/ai/video`,
        emailSubject: "Turn your lyrics into a video",
        emailBody:    `<p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">Lyric videos drive more streams and shares than audio-only posts. Your plan includes lyric video generation — upload your track and lyrics and we'll handle the rest.</p>
                       <p style="margin:0;font-size:14px;color:#666;">Takes about 2 minutes to set up.</p>`,
      });
    }

    // Has tracks but no canvas video
    if (hasTrack && !hasCanvas) {
      suggestions.push({
        priority:     35,
        title:        "Add a canvas video to your tracks",
        message:      "Canvas videos play behind your music on your artist page. Takes 30 seconds to generate.",
        link:         `${APP_URL()}/dashboard/music`,
        emailSubject: "Your tracks can have animated canvas videos",
        emailBody:    `<p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">Canvas videos are short looping clips that play while your track plays — fans see an animated version of your cover art. Go to your track and tap &ldquo;Generate Canvas&rdquo;.</p>
                       <p style="margin:0;font-size:14px;color:#666;">30 seconds to generate. Looks great.</p>`,
      });
    }

    // Page published but no SMS/email broadcasts this month
    if (pagePublished && user.broadcastLogs.length === 0) {
      suggestions.push({
        priority:     30,
        title:        "Send your fans an update",
        message:      "You haven't sent a broadcast this month. Your fan list is waiting — send an update, tease a release, or share something personal.",
        link:         `${APP_URL()}/dashboard/broadcasts`,
        emailSubject: "Your fans haven't heard from you this month",
        emailBody:    `<p style="margin:0 0 16px;font-size:14px;color:#C8C8C8;line-height:1.7;">You haven't sent a broadcast this month. Consistent contact with your fan list is what separates artists who grow from artists who plateau. Send an update, tease a release, or share something real.</p>
                       <p style="margin:0;font-size:14px;color:#666;">Takes 2 minutes. Your fans opted in — they want to hear from you.</p>`,
      });
    }

    if (suggestions.length === 0) continue;

    // Pick the highest-priority suggestion
    suggestions.sort((a, b) => b.priority - a.priority);
    const pick = suggestions[0];

    // Send notification + email
    await sendAgentNotification(user.id, pick.title, pick.message, pick.link);
    await sendAgentEmail(
      { email: user.email, name },
      pick.emailSubject,
      buildSuggestionEmail(name, pick.emailBody, "See it on your dashboard →", pick.link),
      ["agent", "revenue-optimization"],
    );

    await logAgentAction("REVENUE_OPTIMIZATION", "SUGGESTION_SENT", "USER", user.id, {
      tier,
      priority:     pick.priority,
      suggestion:   pick.title,
    });

    acted++;
  }

  await logAgentAction("REVENUE_OPTIMIZATION", "AGENT_RUN_COMPLETE", undefined, undefined, {
    usersActed: acted,
    totalUsers: users.length,
  });

  return { acted };
}
