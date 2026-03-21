import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  try {
    const body = await req.json() as {
      productId: string;
      buyerEmail: string;
      quantity: number;
      artistSlug: string;
    };

    const { productId, buyerEmail, quantity = 1, artistSlug } = body;

    if (!productId || !buyerEmail || !artistSlug) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (!buyerEmail.includes("@")) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const qty = Math.max(1, Math.min(10, Math.round(Number(quantity))));

    const product = await db.merchProduct.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        basePrice: true,
        artistMarkup: true,
        isActive: true,
        artistId: true,
      },
    });

    if (!product || !product.isActive) {
      return NextResponse.json({ error: "Product not available." }, { status: 404 });
    }

    const unitPriceCents = Math.round((product.basePrice + product.artistMarkup) * 100);

    if (unitPriceCents < 50) {
      return NextResponse.json({ error: "Product price is too low." }, { status: 400 });
    }

    // Build the origin for success/cancel redirect
    const host    = req.headers.get("host") ?? "";
    const proto   = host.startsWith("localhost") ? "http" : "https";
    const origin  = process.env.NEXTAUTH_URL ?? `${proto}://${host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: buyerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: unitPriceCents,
            product_data: {
              name: product.title,
              images: product.imageUrl ? [product.imageUrl] : [],
            },
          },
          quantity: qty,
        },
      ],
      metadata: {
        type: "MERCH",
        productId: product.id,
        artistId: product.artistId,
        buyerEmail,
        quantity: String(qty),
      },
      success_url: `${origin}/${artistSlug}?merch_success=1`,
      cancel_url:  `${origin}/${artistSlug}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[merch/checkout]", err);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    );
  }
}
