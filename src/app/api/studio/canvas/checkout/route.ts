/**
 * POST /api/studio/canvas/checkout
 *
 * Creates a Stripe Checkout session for Canvas Video generation ($1.99),
 * triggered by a studio admin on behalf of a roster artist.
 *
 * Body:    { trackId: string }
 * Returns: { checkoutUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getPricing } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { trackId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { trackId } = body;
  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  // Resolve studio
  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) {
    return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  }

  // Verify the track's artist is on this studio's roster
  const track = await db.track.findUnique({
    where: { id: trackId },
    select: {
      id: true,
      artistId: true,
      artist: { select: { email: true, role: true } },
    },
  });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  if (track.artist.role !== "ARTIST") {
    return NextResponse.json({ error: "Track does not belong to an artist" }, { status: 403 });
  }

  if (track.artist.email) {
    const contact = await db.contact.findFirst({
      where: { studioId: studio.id, email: track.artist.email },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Artist is not on your roster" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Artist has no email — cannot verify roster membership" }, { status: 403 });
  }

  // Look up price
  const pricing = await getPricing();
  const priceItem = pricing["CANVAS_GENERATE"];
  const priceValue = priceItem?.value ?? 1.99;
  const amountCents = Math.round(priceValue * 100);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Canvas Video Generation" },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/studio/ai-tools?canvasPaid=1&trackId=${trackId}`,
    cancel_url:  `${appUrl}/studio/ai-tools`,
    metadata: {
      trackId,
      studioUserId: session.user.id,
      artistId:     track.artistId,
      type:         "canvas_generate",
    },
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
