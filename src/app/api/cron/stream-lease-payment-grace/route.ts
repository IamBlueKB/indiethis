import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/cron/stream-lease-payment-grace
// Runs daily. Finds artists whose 3-day payment grace period has expired while
// their subscription is still PAST_DUE. Deactivates all active stream leases.
// Producer does NOT get paid for that month (no PAID record is created).
// Artist must use the reactivation flow (/api/dashboard/stream-leases/[id] PATCH)
// to restore individual leases — they are NOT auto-reactivated on next payment.
// Protected by CRON_SECRET bearer token.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find subscriptions where the grace period has expired and payment is still overdue
  const expiredGrace = await db.subscription.findMany({
    where: {
      streamLeaseGraceUntil: { lt: now, not: null },
      status: "PAST_DUE",
    },
    select: { userId: true },
  });

  if (expiredGrace.length === 0) {
    return NextResponse.json({ processed: 0, leasesDeactivated: 0, message: "No expired grace periods." });
  }

  const userIds = expiredGrace.map((s) => s.userId);

  // Deactivate all active stream leases for these artists
  const deactivated = await db.streamLease.updateMany({
    where: {
      artistId: { in: userIds },
      isActive: true,
    },
    data: {
      isActive:    false,
      cancelledAt: now,
    },
  });

  // Clear the grace period so this cron doesn't re-process them
  await db.subscription.updateMany({
    where: { userId: { in: userIds } },
    data:  { streamLeaseGraceUntil: null },
  });

  console.log(
    `[stream-lease-grace] Grace expired for ${userIds.length} user(s). ` +
    `Deactivated ${deactivated.count} lease(s).`
  );

  return NextResponse.json({
    processed:         userIds.length,
    leasesDeactivated: deactivated.count,
  });
}
