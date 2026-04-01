/**
 * payment-recovery.ts — Payment Recovery Agent
 *
 * PURPOSE
 * Proactive email escalation when subscription payment fails.
 * One-time 20% win-back offer after cancellation (if winBackUsed is false).
 *
 * SEQUENCE
 * Day 0  — payment fails  → webhook calls startPaymentRecoverySequence()
 *           Friendly email: "Your payment didn't go through."
 * Day 2  — cron sweep     → warning email, more urgent tone
 * Day 5  — cron sweep     → final notice; mention fan credits if balance > 0
 * Day 10 — cron sweep     → subscription cancelled; win-back or re-engagement email
 *
 * DEDUP GUARD
 * Each step is logged to AgentLog (action: PAYMENT_FAILED_DAY0/2/5, WIN_BACK_SENT,
 * RE_ENGAGEMENT_SENT). Before each send, the log is checked — skip if already sent.
 *
 * DESIGN RULES
 * - All emails from "The IndieThis Team" — no mention of AI or agents
 * - Claude Haiku NOT used here (pure rule-based; no intelligence needed)
 * - Log every action to AgentLog
 */

import { db } from "@/lib/db";
import { logAgentAction, sendAgentEmail, agentEmailBase, AT } from "@/lib/agents";
import { createNotification } from "@/lib/notifications";
import { stripe } from "@/lib/stripe";

const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;

// ─── Portal URL helper ────────────────────────────────────────────────────────

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";
const PORTAL_URL = `${APP_URL}/api/stripe/portal`;

// ─── Email builders ───────────────────────────────────────────────────────────

function day0Email(name: string): string {
  return agentEmailBase(
    `<p>Hi ${name},</p>
     <p>Your recent payment didn't go through. To keep your artist page live and your AI tools active, please update your payment method.</p>
     <p>It only takes a moment — your page and all your content are safe.</p>`,
    "Update Payment Method",
    `${APP_URL}/dashboard/settings?tab=billing`,
  );
}

function day2Email(name: string): string {
  return agentEmailBase(
    `<p>Hi ${name},</p>
     <p>Your subscription is still showing a failed payment. Your access to AI tools, analytics, and your public page may be interrupted soon.</p>
     <p>Update your payment method now to avoid any disruption.</p>`,
    "Fix My Payment",
    `${APP_URL}/dashboard/settings?tab=billing`,
  );
}

function day5Email(name: string, fanBalance: number): string {
  const creditsNote = fanBalance >= 1
    ? `<p style="background:rgba(212,168,67,0.1);border:1px solid rgba(212,168,67,0.3);border-radius:10px;padding:12px 16px;margin:16px 0;color:#D4A843;">
         💳 You have <strong>$${fanBalance.toFixed(2)}</strong> in earnings from your fans. Want to apply those to cover your subscription? Contact us and we'll sort it out.
       </p>`
    : "";

  return agentEmailBase(
    `<p>Hi ${name},</p>
     <p><strong>This is a final notice.</strong> Without a successful payment, your account will be downgraded and your public artist page will go offline.</p>
     ${creditsNote}
     <p>Update your payment method now to keep everything running.</p>`,
    "Update Now — Keep My Page Live",
    `${APP_URL}/dashboard/settings?tab=billing`,
  );
}

function winBackEmail(name: string, promoCode: string): string {
  return agentEmailBase(
    `<p>Hi ${name},</p>
     <p>We kept your page and all your data safe. Your tracks, fan contacts, and everything you built are still here — waiting for you.</p>
     <p>Come back with <strong>20% off your first month</strong>. No strings attached.</p>
     <p style="background:rgba(212,168,67,0.1);border:1px solid rgba(212,168,67,0.3);border-radius:10px;padding:14px 20px;margin:16px 0;text-align:center;">
       <span style="font-size:22px;font-weight:700;letter-spacing:2px;color:#D4A843;">${promoCode}</span><br>
       <span style="font-size:12px;color:#999;margin-top:4px;display:block;">Valid for 14 days · Single use</span>
     </p>`,
    "Resubscribe — 20% Off",
    `${APP_URL}/upgrade?promo=${promoCode}`,
  );
}

function reEngagementEmail(name: string): string {
  return agentEmailBase(
    `<p>Hi ${name},</p>
     <p>Your IndieThis page is still here. Everything you built — your tracks, fan contacts, and artist profile — is safe and waiting for you.</p>
     <p>Resubscribe anytime to pick up exactly where you left off.</p>`,
    "Come Back to IndieThis",
    `${APP_URL}/upgrade`,
  );
}

// ─── Win-back promo code creation ─────────────────────────────────────────────

async function createWinBackPromoCode(userId: string): Promise<string | null> {
  if (!stripe) return null;

  // Ensure the 20% coupon exists
  const COUPON_ID = "winback-20pct-1mo";
  try {
    await stripe.coupons.retrieve(COUPON_ID);
  } catch {
    await stripe.coupons.create({
      id:                 COUPON_ID,
      name:               "IndieThis Win-Back — 20% Off",
      percent_off:        20,
      duration:           "once",
    });
  }

  // Create single-use promotion code, expires in 14 days
  const expiresAt = Math.floor((Date.now() + 14 * DAY) / 1000);
  const code = `COMEBACK${userId.slice(-6).toUpperCase()}`;

  try {
    await stripe.promotionCodes.create({
      promotion:       { type: "coupon", coupon: COUPON_ID },
      code,
      max_redemptions:  1,
      expires_at:       expiresAt,
      metadata:         { userId, type: "win_back" },
    });
    return code;
  } catch {
    // Code might already exist — generate a timestamp variant
    const altCode = `BACK${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await stripe.promotionCodes.create({
      promotion:       { type: "coupon", coupon: COUPON_ID },
      code:            altCode,
      max_redemptions: 1,
      expires_at:      expiresAt,
      metadata:        { userId, type: "win_back" },
    });
    return altCode;
  }
}

// ─── Day 0: called from webhook on invoice.payment_failed ────────────────────

export async function startPaymentRecoverySequence(userId: string): Promise<void> {
  // Guard: already started?
  const existing = await db.agentLog.findFirst({
    where: {
      agentType: AT("PAYMENT_RECOVERY"),
      action:    "PAYMENT_FAILED_DAY0",
      targetId:  userId,
      createdAt: { gte: new Date(Date.now() - 7 * DAY) }, // within last 7 days
    },
  });
  if (existing) return; // sequence already running

  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user?.email) return;

  // Day 0 notification (email sent by existing webhook handler — just log here)
  await logAgentAction("PAYMENT_RECOVERY", "PAYMENT_FAILED_DAY0", "USER", userId);

  await createNotification({
    userId,
    type:    "SUBSCRIPTION_FAILED",
    title:   "Payment failed — action required",
    message: "Your payment didn't go through. Update your card to keep your page and AI tools active.",
    link:    "/dashboard/settings?tab=billing",
  });
}

// ─── Daily cron sweep ─────────────────────────────────────────────────────────

export interface PaymentRecoveryResult {
  day2Sent: number;
  day5Sent: number;
  winBackSent: number;
  reEngageSent: number;
}

export async function runPaymentRecoveryAgent(): Promise<PaymentRecoveryResult> {
  await logAgentAction("PAYMENT_RECOVERY", "AGENT_RUN_START");

  const now = Date.now();
  const result: PaymentRecoveryResult = { day2Sent: 0, day5Sent: 0, winBackSent: 0, reEngageSent: 0 };

  // ── Day 2: find Day0 logs from 44–56 h ago ──────────────────────────────────
  const day0Logs = await db.agentLog.findMany({
    where: {
      agentType: AT("PAYMENT_RECOVERY"),
      action:    "PAYMENT_FAILED_DAY0",
      createdAt: { gte: new Date(now - 56 * HOUR), lte: new Date(now - 44 * HOUR) },
    },
    select: { targetId: true },
  });

  for (const log of day0Logs) {
    const userId = log.targetId;
    if (!userId) continue;

    const alreadySent = await db.agentLog.findFirst({
      where: { agentType: AT("PAYMENT_RECOVERY"), action: "PAYMENT_FAILED_DAY2", targetId: userId },
    });
    if (alreadySent) continue;

    const user = await db.user.findUnique({
      where:  { id: userId },
      select: { id: true, name: true, email: true, subscription: { select: { status: true } } },
    });
    if (!user?.email || user.subscription?.status === "ACTIVE") continue;

    await sendAgentEmail(
      { email: user.email, name: user.name },
      "Your IndieThis subscription needs attention",
      day2Email(user.name),
      ["payment_recovery", "day2"],
    );
    await logAgentAction("PAYMENT_RECOVERY", "PAYMENT_FAILED_DAY2", "USER", userId);
    result.day2Sent++;
  }

  // ── Day 5: find Day0 logs from 5–6 days ago ─────────────────────────────────
  const day0Logs5 = await db.agentLog.findMany({
    where: {
      agentType: AT("PAYMENT_RECOVERY"),
      action:    "PAYMENT_FAILED_DAY0",
      createdAt: { gte: new Date(now - 6 * DAY), lte: new Date(now - 5 * DAY) },
    },
    select: { targetId: true },
  });

  for (const log of day0Logs5) {
    const userId = log.targetId;
    if (!userId) continue;

    const alreadySent = await db.agentLog.findFirst({
      where: { agentType: AT("PAYMENT_RECOVERY"), action: "PAYMENT_FAILED_DAY5", targetId: userId },
    });
    if (alreadySent) continue;

    const user = await db.user.findUnique({
      where:  { id: userId },
      select: { id: true, name: true, email: true, artistBalance: true, subscription: { select: { status: true } } },
    });
    if (!user?.email || user.subscription?.status === "ACTIVE") continue;

    await sendAgentEmail(
      { email: user.email, name: user.name },
      "Final notice: Your IndieThis page is at risk",
      day5Email(user.name, user.artistBalance ?? 0),
      ["payment_recovery", "day5"],
    );
    await logAgentAction("PAYMENT_RECOVERY", "PAYMENT_FAILED_DAY5", "USER", userId);
    result.day5Sent++;
  }

  // ── Day 10: cancelled subscriptions — win-back or re-engagement ─────────────
  const recentlyCancelled = await db.subscription.findMany({
    where: {
      status:    "CANCELLED",
      canceledAt: { gte: new Date(now - 11 * DAY), lte: new Date(now - 9 * DAY) },
    },
    select: { userId: true },
  });

  for (const sub of recentlyCancelled) {
    const userId = sub.userId;

    // Only process users who had a payment failure sequence (not voluntary cancels)
    const hadFailure = await db.agentLog.findFirst({
      where: { agentType: AT("PAYMENT_RECOVERY"), action: "PAYMENT_FAILED_DAY0", targetId: userId },
    });
    if (!hadFailure) continue;

    const alreadySent = await db.agentLog.findFirst({
      where: {
        agentType: AT("PAYMENT_RECOVERY"),
        action:    { in: ["WIN_BACK_SENT", "RE_ENGAGEMENT_SENT"] },
        targetId:  userId,
      },
    });
    if (alreadySent) continue;

    const user = await db.user.findUnique({
      where:  { id: userId },
      select: { id: true, name: true, email: true, winBackUsed: true },
    });
    if (!user?.email) continue;

    if (!user.winBackUsed) {
      // First time — send win-back with promo code
      const promoCode = await createWinBackPromoCode(userId);
      if (promoCode) {
        await sendAgentEmail(
          { email: user.email, name: user.name },
          "We kept your page safe — come back with 20% off",
          winBackEmail(user.name, promoCode),
          ["win_back"],
        );
        await db.user.update({ where: { id: userId }, data: { winBackUsed: true } });
        await logAgentAction("PAYMENT_RECOVERY", "WIN_BACK_SENT", "USER", userId, { promoCode });
        result.winBackSent++;
      }
    } else {
      // Already used win-back — plain re-engagement
      await sendAgentEmail(
        { email: user.email, name: user.name },
        "Your IndieThis page is still here",
        reEngagementEmail(user.name),
        ["re_engagement"],
      );
      await logAgentAction("PAYMENT_RECOVERY", "RE_ENGAGEMENT_SENT", "USER", userId);
      result.reEngageSent++;
    }
  }

  await logAgentAction(
    "PAYMENT_RECOVERY",
    "AGENT_RUN_COMPLETE",
    undefined, undefined,
    result as unknown as Record<string, unknown>,
  );

  return result;
}
