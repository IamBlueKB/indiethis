import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getStreamLeasePricing } from "@/lib/stream-lease-pricing";

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
// Reactivates a cancelled lease within the 30-day window.
// Sets isActive = true, clears cancelledAt, creates a new Stripe invoice item.
// Same agreement applies — no re-signing required.
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lease = await db.streamLease.findUnique({
    where: { id },
    select: {
      id: true, artistId: true, isActive: true, cancelledAt: true,
      trackTitle: true, beatId: true, producerId: true,
      beat:     { select: { title: true } },
      producer: { select: { name: true, artistName: true } },
    },
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

  // Reactivate the lease
  const reactivated = await db.streamLease.update({
    where: { id },
    data: { isActive: true, cancelledAt: null },
    select: { id: true, trackTitle: true, isActive: true },
  });

  // Create new Stripe invoice item for the upcoming billing cycle
  if (stripe) {
    try {
      const [artist, pricing] = await Promise.all([
        db.user.findUnique({
          where: { id: session.user.id },
          select: { stripeCustomerId: true },
        }),
        getStreamLeasePricing(),
      ]);

      if (artist?.stripeCustomerId) {
        const producerName = lease.producer.artistName ?? lease.producer.name;
        await stripe.invoiceItems.create({
          customer:    artist.stripeCustomerId,
          amount:      pricing.monthlyPriceCents,
          currency:    "usd",
          description: `Stream Lease (Reactivated): ${lease.trackTitle} — ${producerName}`,
          metadata: {
            streamLeaseId: id,
            artistId:      session.user.id,
            producerId:    lease.producerId,
            beatId:        lease.beatId,
          },
        });
      }
    } catch (stripeErr) {
      // Log but don't fail — lease is reactivated; invoice item can be added manually
      console.error("[stream-lease-reactivate] Stripe invoice item creation failed:", stripeErr);
    }
  }

  return NextResponse.json({
    lease: reactivated,
    message: "Stream lease reactivated. $1/mo will be added to your next invoice.",
  });
}
