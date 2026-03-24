/**
 * GET  /api/dashboard/broadcasts
 *   Returns broadcast history + this month's usage + tier limit.
 *
 * POST /api/dashboard/broadcasts
 *   Send a broadcast.
 *   Body: { message: string, segment: string }
 *     segment examples: "ALL", "RELEASE_NOTIFY", "SHOW_NOTIFY",
 *                        "TOP_SPENDERS", "MERCH_BUYERS", "ZIP:90210"
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  SMS_LIMITS,
  SMS_COST_PER_SEGMENT,
  resolveBroadcastRecipients,
  sendBroadcast,
} from "@/lib/brevo/broadcast-sms";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const artistId = session.user.id;

    const [logs, sub] = await Promise.all([
      db.broadcastLog.findMany({
        where:   { artistId },
        orderBy: { sentAt: "desc" },
        take:    50,
        select: {
          id:             true,
          message:        true,
          segment:        true,
          recipientCount: true,
          successCount:   true,
          sentAt:         true,
        },
      }),
      db.subscription.findUnique({
        where:  { userId: artistId },
        select: { tier: true, status: true, smsBroadcastsUsed: true },
      }),
    ]);

    const tier          = sub?.tier ?? "LAUNCH";
    const limit         = SMS_LIMITS[tier] ?? SMS_LIMITS.LAUNCH;
    const usedThisMonth = sub?.smsBroadcastsUsed ?? 0;

    return NextResponse.json({ logs, usedThisMonth, limit, tier });
  } catch (err) {
    console.error("[broadcasts GET]", err);
    return NextResponse.json({ error: "Failed to load broadcasts" }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const artistId = session.user.id;

    const body    = await req.json().catch(() => null);
    const message = (body?.message ?? "").trim();
    const segment = (body?.segment ?? "ALL").trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }
    if (message.length > 918) {
      // Max ~6 SMS segments (918 chars)
      return NextResponse.json({ error: "Message too long (max 918 chars)." }, { status: 400 });
    }

    // Check tier limit
    const sub = await db.subscription.findUnique({
      where:  { userId: artistId },
      select: { tier: true, smsBroadcastsUsed: true },
    });
    const tier          = sub?.tier ?? "LAUNCH";
    const limit         = SMS_LIMITS[tier] ?? SMS_LIMITS.LAUNCH;
    const usedThisMonth = sub?.smsBroadcastsUsed ?? 0;
    const remaining     = limit - usedThisMonth;

    if (remaining <= 0) {
      return NextResponse.json({
        error: `Monthly SMS limit reached (${limit} for ${tier} tier). Upgrade or wait until next month.`,
      }, { status: 429 });
    }

    // Resolve recipients
    const phones = await resolveBroadcastRecipients(artistId, segment);
    if (phones.length === 0) {
      return NextResponse.json({ error: "No recipients found for this segment with a phone number." }, { status: 400 });
    }

    // Cap to remaining allowance
    const allowed = phones.slice(0, remaining);

    // Calculate SMS segments per message
    const smsSegments     = Math.ceil(message.length / 160);
    const estimatedCost   = smsSegments * allowed.length * SMS_COST_PER_SEGMENT;

    // Send
    const result = await sendBroadcast(artistId, message, segment, allowed);

    // Increment usage counter (fire-and-forget; failure shouldn't block response)
    void db.subscription.updateMany({
      where: { userId: artistId },
      data:  { smsBroadcastsUsed: { increment: result.successCount } },
    }).catch((err: unknown) => console.error("[broadcasts POST] counter increment failed:", err));

    return NextResponse.json({
      ok:             true,
      recipientCount: result.recipientCount,
      successCount:   result.successCount,
      logId:          result.logId,
      estimatedCost,
    });
  } catch (err) {
    console.error("[broadcasts POST]", err);
    return NextResponse.json({ error: "Failed to send broadcast." }, { status: 500 });
  }
}
