import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import type { LicenseType } from "@prisma/client";

const VALID_LICENSE_TYPES: LicenseType[] = ["NON_EXCLUSIVE", "EXCLUSIVE", "LEASE", "CUSTOM"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    trackId?: string;
    previewId?: string;
    licenseType?: string;
  };
  const { trackId: directTrackId, previewId, licenseType } = body;

  if (!licenseType) {
    return NextResponse.json({ error: "License type is required." }, { status: 400 });
  }
  if (!VALID_LICENSE_TYPES.includes(licenseType as LicenseType)) {
    return NextResponse.json({ error: "Invalid license type." }, { status: 400 });
  }
  if (!directTrackId && !previewId) {
    return NextResponse.json({ error: "Track ID or preview ID is required." }, { status: 400 });
  }

  // ── Resolve track + producer from either a direct trackId or a previewId ──
  let trackId: string;
  let producerId: string;
  let trackTitle: string;
  let trackPrice: number;
  let producerName: string;

  if (previewId) {
    // My Previews flow — producer already shared this beat with the current user
    const preview = await db.beatPreview.findUnique({
      where: { id: previewId },
      include: {
        track: { select: { id: true, title: true, price: true } },
        producer: { select: { id: true, name: true, artistName: true } },
      },
    });
    if (!preview) {
      return NextResponse.json({ error: "Preview not found." }, { status: 404 });
    }
    if (preview.artistId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (!preview.track.price || preview.track.price <= 0) {
      return NextResponse.json({ error: "This track does not have a price set." }, { status: 400 });
    }
    trackId = preview.track.id;
    producerId = preview.producerId;
    trackTitle = preview.track.title;
    trackPrice = preview.track.price;
    producerName = preview.producer.artistName ?? preview.producer.name;
  } else {
    // Browse Beats flow — artist licensing directly from the marketplace
    const track = await db.track.findUnique({
      where: { id: directTrackId!, status: "PUBLISHED" },
      include: { artist: { select: { id: true, name: true, artistName: true } } },
    });
    if (!track) {
      return NextResponse.json({ error: "Track not found." }, { status: 404 });
    }
    if (!track.price || track.price <= 0) {
      return NextResponse.json({ error: "This track does not have a price set." }, { status: 400 });
    }
    if (track.artistId === session.user.id) {
      return NextResponse.json({ error: "You cannot license your own track." }, { status: 400 });
    }
    trackId = track.id;
    producerId = track.artistId;
    trackTitle = track.title;
    trackPrice = track.price;
    producerName = track.artist.artistName ?? track.artist.name;
  }

  // ── Get or create Stripe customer for the buyer ──
  const buyer = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, stripeCustomerId: true },
  });
  if (!buyer) return NextResponse.json({ error: "User not found." }, { status: 404 });

  let customerId = buyer.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: buyer.email ?? undefined,
      name: buyer.name ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await db.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";
  const licenseLabel = licenseType.replace("_", " ");

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${licenseLabel} License — "${trackTitle}" by ${producerName}`,
            description: "Beat license purchased on IndieThis",
          },
          unit_amount: Math.round(trackPrice * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/dashboard/marketplace?licensed=1`,
    cancel_url: `${appUrl}/dashboard/marketplace`,
    metadata: {
      type: "BEAT_LICENSE",
      userId: session.user.id,
      trackId,
      producerId,
      licenseType,
      ...(previewId ? { previewId } : {}),
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
