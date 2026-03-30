import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

// POST /api/digital-products/checkout
// Public route — buyer provides email and productId, returns Stripe checkout URL
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await req.json() as { productId?: string; buyerEmail?: string };

  // Read DJ attribution cookie — format: dj_attribution_{djProfileId}
  let djAttributionId: string | null = null;
  const cookieHeader = req.headers.get("cookie") ?? "";
  const attrMatch = cookieHeader.match(/dj_attribution_([^=;]+)=([^;]+)/);
  if (attrMatch) {
    const djProfileId = attrMatch[2].trim();
    // Verify the profile exists
    const djProfile = await db.dJProfile.findUnique({ where: { id: djProfileId }, select: { id: true } });
    if (djProfile) djAttributionId = djProfile.id;
  }

  if (!body.productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });
  if (!body.buyerEmail?.includes("@")) {
    return NextResponse.json({ error: "A valid buyer email is required" }, { status: 400 });
  }

  const product = await db.digitalProduct.findUnique({
    where: { id: body.productId },
    select: {
      id: true,
      title: true,
      price: true,
      type: true,
      published: true,
      coverArtUrl: true,
      userId: true,
    },
  });

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (!product.published) return NextResponse.json({ error: "Product not available" }, { status: 404 });

  const platformFee    = Math.round(product.price * 0.10);
  const artistEarnings = product.price - platformFee;
  const appUrl         = process.env.NEXTAUTH_URL ?? "https://indiethis.com";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: product.price,
          product_data: {
            name: product.title,
            ...(product.coverArtUrl && { images: [product.coverArtUrl] }),
          },
        },
        quantity: 1,
      },
    ],
    customer_email: body.buyerEmail,
    success_url: `${appUrl}/dl/digital/{CHECKOUT_SESSION_ID}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}`,
    metadata: {
      type: "DIGITAL_PRODUCT",
      productId: product.id,
      buyerEmail: body.buyerEmail,
      platformFee: String(platformFee),
      artistEarnings: String(artistEarnings),
      artistId: product.userId,
      ...(djAttributionId ? { djAttributionId } : {}),
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
