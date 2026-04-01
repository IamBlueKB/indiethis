/**
 * POST /api/dashboard/ai/release-bundle/checkout
 *
 * Creates a Stripe Checkout session for the Release Bundle ($18.99).
 * Bundles: Cover Art (Standard) + Canvas Video + Lyric Video
 * Individual cost: $4.99 + $1.99 + $14.99 = $21.97 — saves $2.99.
 *
 * Validates the track is missing at least 2 of the 3 items before allowing purchase.
 *
 * Body:    { trackId: string }
 * Returns: { url: string }
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";

const BUNDLE_PRICING_KEY = "AI_RELEASE_BUNDLE";

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { trackId?: string };
  const { trackId } = body;
  if (!trackId) return NextResponse.json({ error: "trackId is required" }, { status: 400 });

  // Verify track ownership
  const track = await db.track.findUnique({
    where: { id: trackId },
    select: {
      id: true,
      artistId: true,
      title: true,
      coverArtUrl: true,
      canvasVideoUrl: true,
      fileUrl: true,
    },
  });

  if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });
  if (track.artistId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Count missing release assets
  const missingCoverArt  = !track.coverArtUrl;
  const missingCanvas    = !track.canvasVideoUrl;

  // Check for a completed lyric video AIJob for this track
  const lyricJob = await db.aIJob.findFirst({
    where: {
      triggeredById: session.user.id,
      type: "LYRIC_VIDEO",
      status: "COMPLETE",
      inputData: { path: ["trackId"], equals: trackId },
    },
    select: { id: true },
  });
  const missingLyricVideo = !lyricJob;

  const missingCount = [missingCoverArt, missingCanvas, missingLyricVideo].filter(Boolean).length;
  if (missingCount < 2) {
    return NextResponse.json(
      { error: "This track already has most release assets. The bundle is most useful when 2+ items are missing." },
      { status: 400 }
    );
  }

  // Fetch live price (cached 5 min), fall back to hardcoded default
  const pricing = await getPricing();
  const priceRow = pricing[BUNDLE_PRICING_KEY];
  const amount = Math.round((priceRow?.value ?? PRICING_DEFAULTS.AI_RELEASE_BUNDLE.value) * 100);

  // Ensure Stripe customer exists
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, stripeCustomerId: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name:  user.name  ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await db.user.update({ where: { id: session.user.id }, data: { stripeCustomerId: customerId } });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name:        "Release Bundle – IndieThis",
          description: "Cover art + canvas video + lyric video — saves $2.99 vs individual prices",
        },
        unit_amount: amount,
      },
      quantity: 1,
    }],
    success_url: `${appUrl}/dashboard/music?bundlePaid=1&trackId=${trackId}`,
    cancel_url:  `${appUrl}/dashboard/music`,
    metadata: {
      userId:  session.user.id,
      tool:    "RELEASE_BUNDLE",
      trackId: trackId,
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
