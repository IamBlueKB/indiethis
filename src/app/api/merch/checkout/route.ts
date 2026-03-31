import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

type ShippingAddressInput = {
  name:      string;
  address1:  string;
  address2?: string;
  city:      string;
  state:     string;
  zip:       string;
  country:   string;
};

// Supports two shapes:
//   Legacy: { variantId, buyerEmail, quantity, artistSlug }
//   Cart:   { items: [{variantId, quantity}], buyerEmail, artistSlug, shippingAddress, shippingCost }
export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  try {
    const body = await req.json() as {
      variantId?:      string;
      quantity?:       number;
      items?:          { variantId: string; quantity: number }[];
      buyerEmail:      string;
      artistSlug:      string;
      shippingAddress?: ShippingAddressInput;
      shippingCost?:   number;
    };

    const { buyerEmail, artistSlug } = body;

    if (!buyerEmail || !artistSlug) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (!buyerEmail.includes("@")) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    // Normalize to items array
    const rawItems: { variantId: string; quantity: number }[] = body.items?.length
      ? body.items
      : body.variantId
        ? [{ variantId: body.variantId, quantity: body.quantity ?? 1 }]
        : [];

    if (rawItems.length === 0) {
      return NextResponse.json({ error: "No items in cart." }, { status: 400 });
    }

    // Fetch all variants
    const variantIds = rawItems.map((i) => i.variantId);
    const variants = await db.merchVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        retailPrice: true,
        inStock: true,
        size: true,
        color: true,
        product: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            isActive: true,
            artistId: true,
          },
        },
      },
    });

    // Validate all items
    for (const item of rawItems) {
      const v = variants.find((v) => v.id === item.variantId);
      if (!v || !v.product.isActive || !v.inStock) {
        return NextResponse.json({ error: `Product not available: ${item.variantId}` }, { status: 404 });
      }
      const cents = Math.round(v.retailPrice * 100);
      if (cents < 50) {
        return NextResponse.json({ error: `Price too low for: ${v.product.title}` }, { status: 400 });
      }
    }

    // Ensure all items belong to the same artist
    const artistIds = new Set(variants.map((v) => v.product.artistId));
    if (artistIds.size > 1) {
      return NextResponse.json({ error: "Cart items must be from the same artist." }, { status: 400 });
    }
    const artistId = variants[0]!.product.artistId;

    // Build origin for redirect
    const host   = req.headers.get("host") ?? "";
    const proto  = host.startsWith("localhost") ? "http" : "https";
    const origin = process.env.NEXTAUTH_URL ?? `${proto}://${host}`;

    // Build Stripe line items
    const lineItems = rawItems.map((item) => {
      const v = variants.find((v) => v.id === item.variantId)!;
      const qty = Math.max(1, Math.min(10, Math.round(Number(item.quantity))));
      const variantLabel = [v.size, v.color && v.color !== "N/A" ? v.color : ""].filter(Boolean).join(" · ");
      return {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(v.retailPrice * 100),
          product_data: {
            name: `${v.product.title}${variantLabel ? ` (${variantLabel})` : ""}`,
            images: v.product.imageUrl ? [v.product.imageUrl] : [],
          },
        },
        quantity: qty,
      };
    });

    // Add shipping as a separate line item if applicable
    const shippingCost = body.shippingCost ?? 0;
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          unit_amount: Math.round(shippingCost * 100),
          product_data: {
            name: "Shipping",
            images: [],
          },
        },
        quantity: 1,
      });
    }

    // Metadata: store items as JSON (Stripe metadata values are strings, max 500 chars)
    const metaItems = rawItems.map((i) => ({ v: i.variantId, q: i.quantity }));
    const shippingMeta = body.shippingAddress
      ? JSON.stringify(body.shippingAddress).slice(0, 490)
      : "";

    const session = await stripe.checkout.sessions.create({
      mode:           "payment",
      customer_email: buyerEmail,
      line_items:     lineItems,
      metadata: {
        type:            "MERCH",
        artistId,
        buyerEmail,
        items:           JSON.stringify(metaItems).slice(0, 490),
        shippingAddress: shippingMeta,
        shippingCost:    String(shippingCost),
        // Legacy single-item fields kept for backward compat with webhook
        variantId:       rawItems[0]!.variantId,
        productId:       variants.find((v) => v.id === rawItems[0]!.variantId)!.product.id,
        quantity:        String(rawItems[0]!.quantity ?? 1),
      },
      success_url: `${origin}/${artistSlug}?merch_success=1`,
      cancel_url:  `${origin}/${artistSlug}/merch`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[merch/checkout]", err);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 },
    );
  }
}
