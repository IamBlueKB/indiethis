/**
 * POST /api/dashboard/ai/track-shield/checkout
 * Creates a Stripe Checkout session for a Track Shield scan.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";

type PackageType = "SINGLE" | "PACK_5" | "PACK_10" | "CATALOG";

const PACKAGE_LIMITS: Record<PackageType, number> = {
  SINGLE:  1,
  PACK_5:  5,
  PACK_10: 10,
  CATALOG: 50,
};

const PRICING_KEYS: Record<PackageType, string> = {
  SINGLE:  "TRACK_SHIELD_SINGLE",
  PACK_5:  "TRACK_SHIELD_5",
  PACK_10: "TRACK_SHIELD_10",
  CATALOG: "TRACK_SHIELD_CATALOG",
};

const PACKAGE_NAMES: Record<PackageType, string> = {
  SINGLE:  "Track Shield — Single Track",
  PACK_5:  "Track Shield — 5-Track Pack",
  PACK_10: "Track Shield — 10-Track Pack",
  CATALOG: "Track Shield — Full Catalog",
};

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { trackIds?: string[]; packageType?: string };
  const { trackIds, packageType } = body;

  if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
    return NextResponse.json({ error: "trackIds is required" }, { status: 400 });
  }

  const pkg = packageType as PackageType;
  if (!pkg || !(pkg in PACKAGE_LIMITS)) {
    return NextResponse.json({ error: "Invalid packageType" }, { status: 400 });
  }

  const limit = PACKAGE_LIMITS[pkg];
  if (trackIds.length > limit) {
    return NextResponse.json(
      { error: `${pkg} supports up to ${limit} track(s). You selected ${trackIds.length}.` },
      { status: 400 }
    );
  }

  // Verify all tracks belong to user
  const tracks = await db.track.findMany({
    where: { id: { in: trackIds }, artistId: session.user.id },
    select: { id: true },
  });
  if (tracks.length !== trackIds.length) {
    return NextResponse.json({ error: "One or more tracks not found" }, { status: 404 });
  }

  // Get price
  const pricing = await getPricing();
  const pricingKey = PRICING_KEYS[pkg];
  const defaultVal = (PRICING_DEFAULTS as Record<string, { value: number }>)[pricingKey];
  const priceValue = pricing[pricingKey]?.value ?? defaultVal?.value ?? 2.99;
  const amountCents = Math.round(priceValue * 100);

  // Ensure Stripe customer
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, stripeCustomerId: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await db.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  // Create pending scan record
  const scan = await db.trackShieldScan.create({
    data: {
      userId: session.user.id,
      packageType: pkg,
      amount: amountCents,
      status: "PENDING",
      tracks: {
        create: trackIds.map((trackId) => ({
          trackId,
          matches: [],
          matchCount: 0,
        })),
      },
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: PACKAGE_NAMES[pkg] + " – IndieThis" },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    success_url: `${appUrl}/dashboard/ai/track-shield?paid=1&scanId=${scan.id}`,
    cancel_url:  `${appUrl}/dashboard/ai/track-shield`,
    metadata: { userId: session.user.id, type: "track_shield", scanId: scan.id },
  });

  return NextResponse.json({ url: checkoutSession.url, scanId: scan.id });
}
