import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  try {
    const body = await req.json() as {
      trackId:    string;
      artistSlug: string;
    };

    const { trackId, artistSlug } = body;

    if (!trackId || !artistSlug) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const track = await db.track.findUnique({
      where:   { id: trackId, status: "PUBLISHED" },
      select:  { id: true, title: true, price: true, coverArtUrl: true, artistId: true,
                 artist: { select: { name: true, artistName: true } } },
    });

    if (!track)                        return NextResponse.json({ error: "Track not found." },          { status: 404 });
    if (!track.price || track.price <= 0) return NextResponse.json({ error: "Track has no price set." }, { status: 400 });

    const priceCents = Math.round(track.price * 100);
    if (priceCents < 50) return NextResponse.json({ error: "Price too low." }, { status: 400 });

    const host   = req.headers.get("host") ?? "";
    const proto  = host.startsWith("localhost") ? "http" : "https";
    const origin = process.env.NEXTAUTH_URL ?? `${proto}://${host}`;

    const artistLabel = track.artist.artistName ?? track.artist.name;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency:     "usd",
          unit_amount:  priceCents,
          product_data: {
            name:   `"${track.title}" by ${artistLabel}`,
            images: track.coverArtUrl ? [track.coverArtUrl] : [],
          },
        },
        quantity: 1,
      }],
      metadata: {
        type:     "TRACK_PURCHASE",
        trackId:  track.id,
        artistId: track.artistId,
      },
      success_url: `${origin}/${artistSlug}?track_purchased=1`,
      cancel_url:  `${origin}/${artistSlug}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[public/tracks/checkout]", err);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
