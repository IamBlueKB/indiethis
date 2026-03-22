import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// DELETE /api/dashboard/stream-leases/[id]
// Cancels an active stream lease owned by the authenticated artist.
// - Sets isActive = false, cancelledAt = now
// - Song stays live until end of the current billing period
// - Audio file is retained for 30 days (handled by cron/stream-lease-cleanup)
// - No further $1 invoice items will be added (invoice.created checks isActive)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load lease and verify ownership
  const lease = await db.streamLease.findUnique({
    where: { id },
    select: {
      id:         true,
      artistId:   true,
      isActive:   true,
      trackTitle: true,
      beat:       { select: { title: true } },
    },
  });

  if (!lease) {
    return NextResponse.json({ error: "Stream lease not found" }, { status: 404 });
  }
  if (lease.artistId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!lease.isActive) {
    return NextResponse.json({ error: "This lease is already cancelled" }, { status: 409 });
  }

  // Cancel the lease
  const cancelled = await db.streamLease.update({
    where: { id },
    data: {
      isActive:    false,
      cancelledAt: new Date(),
    },
    select: {
      id:          true,
      trackTitle:  true,
      isActive:    true,
      cancelledAt: true,
    },
  });

  return NextResponse.json({
    lease: cancelled,
    message: "Stream lease cancelled. Your song stays live until the end of your current billing period.",
  });
}

// PATCH /api/dashboard/stream-leases/[id]
// Future: reactivate a cancelled lease within the 30-day window
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lease = await db.streamLease.findUnique({
    where: { id },
    select: { id: true, artistId: true, isActive: true, cancelledAt: true },
  });

  if (!lease) return NextResponse.json({ error: "Stream lease not found" }, { status: 404 });
  if (lease.artistId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (lease.isActive) return NextResponse.json({ error: "Lease is already active" }, { status: 409 });

  // Only allow reactivation within 30 days of cancellation
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (lease.cancelledAt && lease.cancelledAt < thirtyDaysAgo) {
    return NextResponse.json(
      { error: "This lease cannot be reactivated — the 30-day window has passed." },
      { status: 410 }
    );
  }

  const reactivated = await db.streamLease.update({
    where: { id },
    data: { isActive: true, cancelledAt: null },
    select: { id: true, trackTitle: true, isActive: true },
  });

  return NextResponse.json({ lease: reactivated });
}
