import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { artistId, amount, fanName, fanEmail, message } = body;

    if (!artistId || !amount || !fanEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const amountInt = Math.round(Number(amount));
    if (isNaN(amountInt) || amountInt < 100 || amountInt > 50000) {
      return NextResponse.json({ error: "Amount must be between $1.00 and $500.00" }, { status: 400 });
    }

    // Validate artist exists with active subscription
    const artist = await db.user.findUnique({
      where: { id: artistId },
      select: {
        id: true,
        name: true,
        artistSlug: true,
        artistName: true,
        subscription: { select: { status: true } },
      },
    });

    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    const artistDisplayName = artist.artistName || artist.name || "this artist";
    const slug = artist.artistSlug;

    if (!stripe) {
      return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3456";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountInt,
            product_data: {
              name: `Support ${artistDisplayName} on IndieThis`,
              description: "Your support goes directly toward their music production, mastering, and promotion.",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "fan_funding",
        artistId,
        fanName: fanName || "",
        fanEmail,
        message: message || "",
      },
      customer_email: fanEmail,
      success_url: `${appUrl}/${slug}?funded=true`,
      cancel_url: `${appUrl}/${slug}`,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("[fan-funding] checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
