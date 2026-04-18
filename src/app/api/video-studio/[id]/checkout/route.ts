/**
 * POST /api/video-studio/[id]/checkout
 *
 * Creates a Stripe Checkout session for a MusicVideo that requires payment.
 * Public — works for guests and subscribers.
 *
 * Body: { email? }  — required for guests (no session); ignored for subscribers
 *
 * Returns: { url } — Stripe Checkout redirect URL
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { stripe }                from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

    const { id } = await params;
    const session = await auth();
    const userId  = session?.user?.id ?? null;

    const body  = await req.json() as { email?: string };
    const email = body.email ?? null;

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { id: true, amount: true, trackTitle: true, mode: true, videoLength: true, status: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (video.status === "COMPLETE") return NextResponse.json({ error: "Already complete" }, { status: 400 });
    if (video.amount === 0) return NextResponse.json({ error: "No payment required" }, { status: 400 });

    // Get Stripe customer for authenticated users
    let customerId: string | undefined;
    let customerEmail: string | undefined;
    if (userId) {
      const user = await db.user.findUnique({
        where:  { id: userId },
        select: { stripeCustomerId: true, email: true },
      });
      customerId    = user?.stripeCustomerId ?? undefined;
      customerEmail = !customerId ? (user?.email ?? undefined) : undefined;
    } else {
      customerEmail = email ?? undefined;
    }

    // Map videoLength/videoTier → Stripe price ID
    const TIER_PRICE_IDS: Record<string, string | undefined> = {
      CANVAS:       process.env.STRIPE_PRICE_VIDEO_CANVAS,
      QUICK_60:     process.env.STRIPE_PRICE_VIDEO_QUICK_60,
      QUICK_120:    process.env.STRIPE_PRICE_VIDEO_QUICK_120,
      DIRECTOR_60:  process.env.STRIPE_PRICE_VIDEO_DIRECTOR_60,
      DIRECTOR_120: process.env.STRIPE_PRICE_VIDEO_DIRECTOR_120,
    };

    const tierKey   = video.videoLength ?? (video.mode === "DIRECTOR" ? "DIRECTOR_60" : "QUICK_60");
    const priceId   = TIER_PRICE_IDS[tierKey];

    const tierLabels: Record<string, string> = {
      CANVAS:       "Canvas (1 shot · up to 9s loop)",
      QUICK_60:     "Quick Mode · 8 shots / 60s",
      QUICK_120:    "Quick Mode · 12 shots / 120s",
      DIRECTOR_60:  "Director Mode · 8 shots / 60s",
      DIRECTOR_120: "Director Mode · 12 shots / 120s",
    };
    const tierLabel = tierLabels[tierKey] ?? "Music Video";

    const lineItem = priceId
      ? { price: priceId, quantity: 1 as const }
      : {
          price_data: {
            currency:     "usd",
            unit_amount:  video.amount,
            product_data: { name: `IndieThis Music Video — ${tierLabel}`, description: `"${video.trackTitle}"` },
          },
          quantity: 1 as const,
        };

    const checkoutSession = await stripe.checkout.sessions.create({
      mode:           "payment",
      customer:        customerId,
      customer_email:  !customerId ? customerEmail : undefined,
      line_items: [lineItem],
      metadata: {
        musicVideoId: video.id,
        tool:         "MUSIC_VIDEO",
        userId:       userId ?? "",
      },
      success_url: `${APP_URL}/video-studio/${video.id}/generating?success=1`,
      cancel_url:  `${APP_URL}/video-studio`,
    });

    return NextResponse.json({ url: checkoutSession.url });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[video-studio/checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
