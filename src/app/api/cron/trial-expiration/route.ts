/**
 * GET /api/cron/trial-expiration
 *
 * Daily cron job — processes free trial expirations and grace periods.
 *
 * Runs daily at 10:00 AM local time (configured in vercel.json).
 * Auth: Authorization: Bearer <CRON_SECRET>
 *
 * Steps:
 * 1. Send 3-day warning emails for trials expiring in ≤ 3 days (once per redemption)
 * 2. Start grace period for trials that expired today (graceUntil = now + 3 days)
 * 3. Lock accounts whose grace period ended (status = EXPIRED, clear isComped)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sendTrialExpiringEmail,
  sendTrialExpiredEmail,
  sendGracePeriodEmail,
  sendAccountLockedEmail,
} from "@/lib/brevo/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  let warningSent = 0;
  let gracesStarted = 0;
  let accountsLocked = 0;
  let day2Sent = 0;

  // ── Step 1: 3-day advance warning ────────────────────────────────────────
  // Find ACTIVE trials expiring within the next 3 days, no warning sent yet
  const warningCandidates = await db.promoRedemption.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { not: null, lte: in3Days, gt: now },
      warningSentAt: null,
      promoCode: { type: "FREE_TRIAL" },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      promoCode: { select: { tier: true } },
    },
  });

  for (const redemption of warningCandidates) {
    const daysLeft = Math.ceil(
      (redemption.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    try {
      await sendTrialExpiringEmail({
        email: redemption.user.email,
        name: redemption.user.name,
        daysLeft,
        tier: redemption.promoCode.tier ?? "Launch",
      });
      await db.promoRedemption.update({
        where: { id: redemption.id },
        data: { warningSentAt: now },
      });
      warningSent++;
    } catch (err) {
      console.error(`[trial-expiration] warning email failed for redemption ${redemption.id}:`, err);
    }
  }

  // ── Step 2: Start grace period for newly expired trials ──────────────────
  const expiredNow = await db.promoRedemption.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: now },
      graceUntil: null,
      promoCode: { type: "FREE_TRIAL" },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  for (const redemption of expiredNow) {
    const graceUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    try {
      await db.promoRedemption.update({
        where: { id: redemption.id },
        data: { graceUntil },
      });
      await sendTrialExpiredEmail({
        email: redemption.user.email,
        name: redemption.user.name,
      });
      gracesStarted++;
    } catch (err) {
      console.error(`[trial-expiration] grace start failed for redemption ${redemption.id}:`, err);
    }
  }

  // ── Step 3: Day 2 of grace — content count email ─────────────────────────
  const graceMidpoint = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // 1 day left in grace

  const day2Candidates = await db.promoRedemption.findMany({
    where: {
      status: "ACTIVE",
      graceUntil: { not: null, lte: graceMidpoint, gt: now },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  for (const redemption of day2Candidates) {
    try {
      // Fetch content counts for this user
      const [tracks, merch, contacts] = await Promise.all([
        db.track.count({ where: { userId: redemption.userId } }),
        db.merchProduct.count({ where: { userId: redemption.userId } }),
        db.fanContact.count({ where: { userId: redemption.userId } }),
      ]);

      await sendGracePeriodEmail({
        email: redemption.user.email,
        name: redemption.user.name,
        stats: { tracks, merch, contacts },
      });
      day2Sent++;
    } catch (err) {
      console.error(`[trial-expiration] day-2 grace email failed for redemption ${redemption.id}:`, err);
    }
  }

  // ── Step 4: End grace period — lock accounts ──────────────────────────────
  const graceExpired = await db.promoRedemption.findMany({
    where: {
      status: "ACTIVE",
      graceUntil: { lte: now },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  for (const redemption of graceExpired) {
    try {
      // Mark redemption as expired
      await db.promoRedemption.update({
        where: { id: redemption.id },
        data: { status: "EXPIRED" },
      });

      // Clear comped status on user
      await db.user.update({
        where: { id: redemption.userId },
        data: { isComped: false, compExpiresAt: null },
      });

      // Downgrade subscription to LAUNCH (don't delete — preserve content)
      await db.subscription.updateMany({
        where: { userId: redemption.userId },
        data: {
          tier: "LAUNCH",
          status: "CANCELLED",
        },
      });

      await sendAccountLockedEmail({
        email: redemption.user.email,
        name: redemption.user.name,
      });
      accountsLocked++;
    } catch (err) {
      console.error(`[trial-expiration] account lock failed for redemption ${redemption.id}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    warningSent,
    gracesStarted,
    day2Sent,
    accountsLocked,
  });
}
