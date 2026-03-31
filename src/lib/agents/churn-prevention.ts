/**
 * src/lib/agents/churn-prevention.ts
 * Churn Prevention Agent — runs daily via the master cron.
 *
 * Calculates a churn risk score for every active subscriber and takes action:
 *   0–30   Healthy        — no action
 *   31–60  At risk        — re-engagement email with feature highlights
 *   61–80  High risk      — personal email targeting the specific gap
 *   81–100 Critical       — in-app notification + email (offer support / free call)
 *
 * Users are not re-triggered within 7 days.
 * churnRiskScore is persisted on the User model.
 */

import { db }              from "@/lib/db";
import {
  logAgentAction,
  agentActedRecently,
  sendAgentEmail,
  sendAgentNotification,
  agentEmailBase,
} from "@/lib/agents";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ─── Score calculation ────────────────────────────────────────────────────────

interface ChurnFactors {
  daysSinceLogin:       number;
  daysSinceTrack:       number;
  daysSinceAI:          number;
  daysSinceEmail:       number;
  subscriptionAgeDays:  number;
  hasFailedPayment:     boolean;
}

function calcChurnScore(f: ChurnFactors): number {
  let score = 0;

  // Login recency (max 35 pts)
  if      (f.daysSinceLogin > 60) score += 35;
  else if (f.daysSinceLogin > 30) score += 25;
  else if (f.daysSinceLogin > 14) score += 15;
  else if (f.daysSinceLogin > 7)  score += 5;

  // Track upload recency (max 20 pts)
  if      (f.daysSinceTrack > 60) score += 20;
  else if (f.daysSinceTrack > 30) score += 12;
  else if (f.daysSinceTrack > 14) score += 5;

  // AI tool use recency (max 20 pts)
  if      (f.daysSinceAI > 60) score += 20;
  else if (f.daysSinceAI > 30) score += 12;
  else if (f.daysSinceAI > 21) score += 7;

  // Email blast recency (max 10 pts)
  if      (f.daysSinceEmail > 60) score += 10;
  else if (f.daysSinceEmail > 30) score += 5;

  // New subscriber — higher natural churn risk (max 10 pts)
  if (f.subscriptionAgeDays < 30)  score += 8;
  else if (f.subscriptionAgeDays < 60) score += 4;

  // Failed payment is a strong churn signal (5 pts)
  if (f.hasFailedPayment) score += 5;

  return Math.min(score, 100);
}

// ─── Email content builders ───────────────────────────────────────────────────

function buildAtRiskEmail(name: string): string {
  return agentEmailBase(
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#C8C8C8;">Hey ${name}, we've been building new things on IndieThis and wanted to make sure you haven't missed them.</p>
     <p style="margin:0 0 8px;font-size:14px;color:#C8C8C8;line-height:1.7;">Here's what artists on your plan are using right now:</p>
     <ul style="margin:0 0 12px;padding-left:18px;font-size:14px;color:#C8C8C8;line-height:2;">
       <li>AI Mastering — upload your track, choose your sound, done in minutes</li>
       <li>Canvas Videos — animated looping covers for your tracks</li>
       <li>Fan Capture — collect emails from every page visitor automatically</li>
       <li>Beat Marketplace — license beats directly from producers</li>
     </ul>
     <p style="margin:0;font-size:14px;color:#666;">Log back in and see what's waiting for you.</p>`,
    "Go to Dashboard →",
    `${APP_URL()}/dashboard`,
  );
}

function buildHighRiskEmail(name: string, unusedFeature: string, unusedUrl: string): string {
  const featureMessages: Record<string, string> = {
    mastering:    "Your tracks deserve a professional master. Upload a track, choose your target sound, and compare before/after — it takes 3 minutes.",
    canvas:       "Canvas videos are short looping clips that play behind your track on your artist page. Fans notice. Upload a photo, generate in 30 seconds.",
    cover_art:    "Cover art is the first thing people see. Generate 4 options in 12 seconds — describe what you want and pick the one that fits.",
    page:         "Your artist page is your hub — music, merch, booking, shows, tip jar. Every social profile should link here. Publish it today.",
    broadcasts:   "Your fans signed up to hear from you. An email or SMS blast takes 2 minutes and keeps them engaged between releases.",
  };

  const message = featureMessages[unusedFeature] ??
    "There are tools on your dashboard you haven't tried yet — and some of them are already included in your plan.";

  return agentEmailBase(
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">Hey ${name} — we noticed something.</p>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">${message}</p>
     <p style="margin:0;font-size:14px;color:#666;">It's already part of your plan. No extra charge.</p>`,
    "Try it now →",
    unusedUrl,
  );
}

function buildCriticalEmail(name: string): string {
  return agentEmailBase(
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">Hey ${name} — it's been a while.</p>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C8C8C8;">We want to make sure IndieThis is actually working for you. If there's anything that hasn't clicked or you're not sure how to use a feature, we're here to help you get it set up.</p>
     <p style="margin:0;font-size:14px;color:#666;">Reply to this email and someone from the team will get back to you directly.</p>`,
    "Come back to IndieThis →",
    `${APP_URL()}/dashboard`,
  );
}

// ─── Main agent ───────────────────────────────────────────────────────────────

export async function runChurnPreventionAgent(): Promise<{ acted: number; scored: number }> {
  const now = Date.now();

  // Load all active subscribers with the data we need for scoring
  const users = await db.user.findMany({
    where: {
      isSuspended: false,
      subscription: { status: "ACTIVE" },
    },
    select: {
      id:          true,
      email:       true,
      name:        true,
      lastLoginAt: true,
      createdAt:   true,
      artistSite:  { select: { isPublished: true } },
      subscription: {
        select: { createdAt: true, tier: true },
      },
      tracks: {
        orderBy: { createdAt: "desc" },
        take:    1,
        select:  { createdAt: true },
      },
      aiGenerations: {
        orderBy: { createdAt: "desc" },
        take:    1,
        select:  { createdAt: true, type: true },
      },
      broadcastLogs: {
        orderBy: { createdAt: "desc" },
        take:    1,
        select:  { createdAt: true },
      },
    },
  });

  // Check recent payment failures from Stripe webhook logs via notifications
  const recentFailures = await db.notification.findMany({
    where: {
      type:      "SUBSCRIPTION_FAILED",
      createdAt: { gte: new Date(now - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { userId: true },
  });
  const failedPaymentUserIds = new Set(recentFailures.map((n) => n.userId));

  let acted  = 0;
  const scores: { id: string; score: number }[] = [];

  for (const user of users) {
    const subAge   = user.subscription?.createdAt
      ? (now - user.subscription.createdAt.getTime()) / 86400000
      : 999;
    const lastLogin = user.lastLoginAt
      ? (now - user.lastLoginAt.getTime()) / 86400000
      : 999;
    const lastTrack = user.tracks[0]?.createdAt
      ? (now - user.tracks[0].createdAt.getTime()) / 86400000
      : 999;
    const lastAI = user.aiGenerations[0]?.createdAt
      ? (now - user.aiGenerations[0].createdAt.getTime()) / 86400000
      : 999;
    const lastEmail = user.broadcastLogs[0]?.createdAt
      ? (now - user.broadcastLogs[0].createdAt.getTime()) / 86400000
      : 999;

    const score = calcChurnScore({
      daysSinceLogin:      lastLogin,
      daysSinceTrack:      lastTrack,
      daysSinceAI:         lastAI,
      daysSinceEmail:      lastEmail,
      subscriptionAgeDays: subAge,
      hasFailedPayment:    failedPaymentUserIds.has(user.id),
    });

    scores.push({ id: user.id, score });

    // Skip if acted recently (7 days)
    if (await agentActedRecently("CHURN_PREVENTION", user.id, 7 * 24)) continue;

    const name = user.name ?? "there";

    if (score >= 81) {
      // Critical — notification + email
      await sendAgentNotification(
        user.id,
        "We miss you — anything we can help with?",
        "It's been a while. If you need help getting started with any feature, reply to our email — we're here.",
        `${APP_URL()}/dashboard`,
      );
      await sendAgentEmail(
        { email: user.email, name },
        "We want to make sure IndieThis is working for you",
        buildCriticalEmail(name),
        ["agent", "churn", "critical"],
      );
      await logAgentAction("CHURN_PREVENTION", "CRITICAL_OUTREACH", "USER", user.id, { score });
      acted++;

    } else if (score >= 61) {
      // High risk — targeted email based on biggest gap
      let feature = "dashboard";
      let url     = `${APP_URL()}/dashboard`;

      if (lastTrack > 30 && user.tracks.length === 0) {
        // Never uploaded
        feature = "canvas"; url = `${APP_URL()}/dashboard/music`;
      } else if (!user.artistSite?.isPublished) {
        feature = "page"; url = `${APP_URL()}/dashboard/site`;
      } else if (lastAI > 21) {
        feature = "mastering"; url = `${APP_URL()}/dashboard/ai/mastering`;
      } else if (lastEmail > 30) {
        feature = "broadcasts"; url = `${APP_URL()}/dashboard/broadcasts`;
      }

      await sendAgentEmail(
        { email: user.email, name },
        "One thing you haven't tried yet",
        buildHighRiskEmail(name, feature, url),
        ["agent", "churn", "high-risk"],
      );
      await logAgentAction("CHURN_PREVENTION", "HIGH_RISK_EMAIL", "USER", user.id, { score, feature });
      acted++;

    } else if (score >= 31) {
      // At risk — general re-engagement
      await sendAgentEmail(
        { email: user.email, name },
        "Here's what you might have missed",
        buildAtRiskEmail(name),
        ["agent", "churn", "at-risk"],
      );
      await logAgentAction("CHURN_PREVENTION", "AT_RISK_EMAIL", "USER", user.id, { score });
      acted++;
    }
  }

  // Batch-update churn risk scores
  if (scores.length > 0) {
    await Promise.all(
      scores.map(({ id, score }) =>
        db.user.update({ where: { id }, data: { churnRiskScore: score } })
      )
    );
  }

  await logAgentAction("CHURN_PREVENTION", "AGENT_RUN_COMPLETE", undefined, undefined, {
    usersScored: scores.length,
    usersActed:  acted,
  });

  return { acted, scored: scores.length };
}
