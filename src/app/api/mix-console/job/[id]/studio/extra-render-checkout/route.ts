/**
 * POST /api/mix-console/job/[id]/studio/extra-render-checkout
 *
 * Creates a Stripe Checkout session for an additional Pro Studio re-render
 * after the artist has used their 5 free re-renders. Each extra credit is
 * $1.99 and grants one additional render. The Stripe webhook handler for
 * `metadata.type === "studio_extra_render"` increments
 * MixJob.studioRenderExtraCredits on success.
 *
 * Returns: { url } — Stripe Checkout redirect URL
 */

import { auth }                       from "@/lib/auth";
import { db as prisma }               from "@/lib/db";
import { stripe }                     from "@/lib/stripe";
import { NextRequest, NextResponse }  from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const job = await prisma.mixJob.findUnique({
      where:  { id },
      select: { id: true, userId: true, tier: true },
    });
    if (!job)                            return NextResponse.json({ error: "not found" }, { status: 404 });
    if (job.userId !== session.user.id)  return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (job.tier   !== "PRO")            return NextResponse.json({ error: "pro tier required" }, { status: 403 });

    const user = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { stripeCustomerId: true, email: true },
    });
    const customerId    = user?.stripeCustomerId ?? undefined;
    const customerEmail = !customerId ? (user?.email ?? undefined) : undefined;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode:           "payment",
      customer:        customerId,
      customer_email:  customerEmail,
      line_items: [{
        price_data: {
          currency:     "usd",
          unit_amount:  199,
          product_data: {
            name:        "Pro Studio — Extra Re-render Credit",
            description: "One additional studio re-render for your mix.",
          },
        },
        quantity: 1 as const,
      }],
      metadata: {
        type:   "studio_extra_render",
        jobId:  job.id,
        userId: session.user.id,
      },
      success_url: `${APP_URL}/dashboard/ai/mix-console/${job.id}/studio?extra_render_paid=1`,
      cancel_url:  `${APP_URL}/dashboard/ai/mix-console/${job.id}/studio`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`POST /api/mix-console/job/${id}/studio/extra-render-checkout:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
