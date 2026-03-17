import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

const PPU_ITEMS = {
  LYRIC_VIDEO: { name: "Lyric Video – IndieThis",  amount: 2499, successPath: "/dashboard/ai/lyric-video" },
  COVER_ART:   { name: "AI Cover Art – IndieThis", amount:  499, successPath: "/dashboard/ai/cover-art" },
  AI_VIDEO:    { name: "AI Video – IndieThis",     amount: 1999, successPath: "/dashboard/ai/video" },
  MASTERING:   { name: "AI Mastering – IndieThis", amount:  999, successPath: "/dashboard/ai/mastering" },
  AAR_REPORT:  { name: "A&R Report – IndieThis",   amount: 1499, successPath: "/dashboard/ai/ar-report" },
  PRESS_KIT:   { name: "Press Kit – IndieThis",    amount: 1999, successPath: "/dashboard/ai/press-kit" },
} as const;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { tool?: string };
  const tool = body.tool?.toUpperCase() as keyof typeof PPU_ITEMS | undefined;

  if (!tool || !(tool in PPU_ITEMS)) {
    return NextResponse.json({ error: "Invalid tool." }, { status: 400 });
  }

  const item = PPU_ITEMS[tool];

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
        product_data: { name: item.name },
        unit_amount: item.amount,
      },
      quantity: 1,
    }],
    success_url: `${appUrl}${item.successPath}?paid=1`,
    cancel_url:  `${appUrl}${item.successPath}`,
    metadata: { userId: session.user.id, tool },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
