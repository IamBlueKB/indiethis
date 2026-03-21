import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ artistSlug: string }> }
) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  try {
    const { artistSlug } = await params;
    const body = await req.json() as {
      amount:      number;   // dollars (e.g. 5.00)
      email:       string;
      message?:    string;
    };

    const { amount, email, message } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    const amountDollars = Number(amount);
    if (!amountDollars || amountDollars < 0.5) {
      return NextResponse.json({ error: "Minimum amount is $0.50." }, { status: 400 });
    }

    const artist = await db.user.findUnique({
      where:  { artistSlug },
      select: {
        id:         true,
        name:       true,
        artistName: true,
        artistSite: { select: { pwywEnabled: true, isPublished: true } },
      },
    });

    if (!artist || !artist.artistSite?.isPublished) {
      return NextResponse.json({ error: "Artist not found." }, { status: 404 });
    }

    if (!artist.artistSite.pwywEnabled) {
      return NextResponse.json({ error: "Support not enabled for this artist." }, { status: 403 });
    }

    const displayName  = artist.artistName || artist.name;
    const amountCents  = Math.round(amountDollars * 100);

    const host   = req.headers.get("host") ?? "";
    const proto  = host.startsWith("localhost") ? "http" : "https";
    const origin = process.env.NEXTAUTH_URL ?? `${proto}://${host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency:     "usd",
            unit_amount:  amountCents,
            product_data: {
              name:        `Support ${displayName}`,
              description: message
                ? `"${message.slice(0, 200)}"`
                : `A tip for ${displayName}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type:         "SUPPORT_TIP",
        artistId:     artist.id,
        artistSlug,
        supporterEmail: email,
        message:      message?.slice(0, 500) ?? "",
      },
      success_url: `${origin}/${artistSlug}?support_success=true`,
      cancel_url:  `${origin}/${artistSlug}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[support/checkout]", err);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
