import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";

const PPU_META: Record<string, { name: string; pricingKey: string; successPath: string }> = {
  LYRIC_VIDEO:      { name: "Lyric Video – IndieThis",          pricingKey: "AI_LYRIC_VIDEO",        successPath: "/dashboard/ai/lyric-video" },
  COVER_ART:        { name: "AI Cover Art – IndieThis",         pricingKey: "AI_COVER_ART_STANDARD", successPath: "/dashboard/ai/cover-art" },
  COVER_ART_PREMIUM:{ name: "AI Cover Art Premium – IndieThis", pricingKey: "AI_COVER_ART_PREMIUM",  successPath: "/dashboard/ai/cover-art" },
  AI_VIDEO:         { name: "AI Video – IndieThis",             pricingKey: "AI_VIDEO_SHORT",        successPath: "/dashboard/ai/video" },
  MASTERING:        { name: "AI Mastering – IndieThis",         pricingKey: "AI_MASTERING",          successPath: "/dashboard/ai/mastering" },
  AAR_REPORT:       { name: "A&R Report – IndieThis",           pricingKey: "AI_AAR_REPORT",         successPath: "/dashboard/ai/ar-report" },
  PRESS_KIT:        { name: "Press Kit – IndieThis",            pricingKey: "AI_PRESS_KIT",          successPath: "/dashboard/ai/press-kit" },
  CONTRACT_SCANNER: { name: "Contract Scanner – IndieThis",     pricingKey: "AI_CONTRACT_SCANNER",   successPath: "/dashboard/ai/contract-scanner" },
};

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { tool?: string };
  const tool = body.tool?.toUpperCase();

  if (!tool || !(tool in PPU_META)) {
    return NextResponse.json({ error: "Invalid tool." }, { status: 400 });
  }

  const meta = PPU_META[tool];

  // Fetch live price from DB (cached 5 min)
  const pricing = await getPricing();
  const priceRow = pricing[meta.pricingKey];
  const defaultVal = PRICING_DEFAULTS[meta.pricingKey as keyof typeof PRICING_DEFAULTS];
  const amount = Math.round((priceRow?.value ?? defaultVal?.value ?? 0) * 100);

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: meta.name },
        unit_amount: amount,
      },
      quantity: 1,
    }],
    success_url: `${appUrl}${meta.successPath}?paid=1${tool === "COVER_ART_PREMIUM" ? "&quality=premium" : ""}`,
    cancel_url:  `${appUrl}${meta.successPath}`,
    metadata: { userId: session.user.id, tool },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
