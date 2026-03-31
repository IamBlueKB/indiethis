import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { estimateShipping, type ShippingAddress } from "@/lib/printful";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      items:      { variantId: string; quantity: number }[];
      address:    { name: string; address1: string; address2?: string; city: string; state: string; zip: string; country: string };
      artistSlug: string;
    };

    const { items, address, artistSlug } = body;
    if (!items?.length || !address || !artistSlug) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // Fetch variants with their product + fulfillment type
    const variantIds = items.map((i) => i.variantId);
    const variants = await db.merchVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        printfulVariantId: true,
        product: {
          select: {
            id: true,
            fulfillmentType: true,
            shippingCost: true,
          },
        },
      },
    });

    // Separate POD vs self-fulfilled
    const podItems: { variant_id: number; quantity: number }[] = [];
    let selfFulfilledShipping = 0;
    let hasSelfFulfilled = false;

    for (const item of items) {
      const v = variants.find((v) => v.id === item.variantId);
      if (!v) continue;
      if (v.product.fulfillmentType === "POD" && v.printfulVariantId) {
        podItems.push({ variant_id: v.printfulVariantId, quantity: item.quantity });
      } else {
        // Self-fulfilled: use the highest shippingCost across self-fulfilled products
        selfFulfilledShipping = Math.max(selfFulfilledShipping, v.product.shippingCost);
        hasSelfFulfilled = true;
      }
    }

    // Get Printful rates for POD items
    let podShipping = 0;
    let podRates: { id: string; name: string; rate: string }[] = [];

    if (podItems.length > 0 && process.env.PRINTFUL_API_KEY) {
      try {
        const recipient: ShippingAddress = {
          name:         address.name,
          address1:     address.address1,
          address2:     address.address2,
          city:         address.city,
          state_code:   address.state,
          country_code: address.country || "US",
          zip:          address.zip,
          email:        "noreply@indiethis.com",
        };
        const rates = await estimateShipping(podItems, recipient);
        podRates = rates.map((r) => ({ id: r.id, name: r.name, rate: r.rate }));
        // Use cheapest rate
        if (rates.length > 0) {
          const sorted = [...rates].sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
          podShipping = parseFloat(sorted[0]!.rate);
        }
      } catch {
        // Printful API unavailable — use fallback
        podShipping = 4.99;
      }
    }

    const totalShipping = podShipping + (hasSelfFulfilled ? selfFulfilledShipping : 0);

    return NextResponse.json({
      shippingCost: totalShipping,
      podShipping,
      selfFulfilledShipping: hasSelfFulfilled ? selfFulfilledShipping : 0,
      podRates,
    });
  } catch (err) {
    console.error("[merch/shipping-estimate]", err);
    return NextResponse.json({ error: "Failed to estimate shipping." }, { status: 500 });
  }
}
