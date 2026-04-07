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

    const modeLabel   = video.mode === "DIRECTOR" ? "Director Mode" : "Quick Mode";
    const lengthLabel = video.videoLength === "SHORT" ? "Short (up to 1 min)"
                      : video.videoLength === "EXTENDED" ? "Extended (full song)"
                      : "Standard (up to 3 min)";

    const checkoutSession = await stripe.checkout.sessions.create({
      mode:           "payment",
      customer:        customerId,
      customer_email:  !customerId ? customerEmail : undefined,
      line_items: [{
        price_data: {
          currency:     "usd",
          unit_amount:  video.amount,
          product_data: {
            name:        `IndieThis Music Video — ${modeLabel}`,
            description: `"${video.trackTitle}" · ${lengthLabel}`,
          },
        },
        quantity: 1,
      }],
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
