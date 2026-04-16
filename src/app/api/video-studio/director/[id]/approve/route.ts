/**
 * POST /api/video-studio/director/[id]/approve
 *
 * Approves the shot list and starts generation (or initiates Stripe checkout).
 * Body: { guestEmail? }
 * Returns: { requiresPayment, amount } | { url } (Stripe)
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { stripe }                from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import { getVideoPrice }         from "@/lib/video-studio/model-router";
import { startGeneration }       from "@/lib/video-studio/generate";

export const maxDuration = 300; // full pipeline (FLUX keyframes up to 120s + Kling submit)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

const INCLUDED_VIDEOS: Record<string, number> = { LAUNCH: 1, PUSH: 2, REIGN: 4 };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }   = await params;
    const session  = await auth();
    const userId   = session?.user?.id ?? null;
    const body     = await req.json() as { guestEmail?: string };

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: {
        id: true, mode: true, videoLength: true, status: true, amount: true,
        trackTitle: true, shotList: true, userId: true,
      },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (video.status === "COMPLETE") return NextResponse.json({ error: "Already complete" }, { status: 400 });
    if (!video.shotList) return NextResponse.json({ error: "Shot list required first" }, { status: 400 });

    // Determine billing (same logic as /create route)
    let tier: "GUEST" | "LAUNCH" | "PUSH" | "REIGN" = "GUEST";
    let amount = 0;
    let isFree = true; // DEV: bypass payment for testing

    if (userId) {
      const sub = await db.subscription.findFirst({
        where:  { userId, status: "ACTIVE" },
        select: { tier: true },
      });
      if (sub?.tier && ["LAUNCH", "PUSH", "REIGN"].includes(sub.tier)) {
        tier = sub.tier as "LAUNCH" | "PUSH" | "REIGN";
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);
        const usedThisMonth = await db.musicVideo.count({
          where: { userId, amount: 0, createdAt: { gte: monthStart } },
        });
        if (usedThisMonth < (INCLUDED_VIDEOS[tier] ?? 0)) {
          isFree = true; amount = 0;
        }
      }
    }

    if (!isFree) {
      amount = getVideoPrice(tier, "DIRECTOR", video.videoLength as "SHORT" | "STANDARD" | "EXTENDED");
    }

    // Update amount on record
    await db.musicVideo.update({ where: { id }, data: { amount } });

    if (isFree) {
      await startGeneration(id);
      return NextResponse.json({ requiresPayment: false, amount: 0 });
    }

    // Requires payment
    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

    let customerId: string | undefined;
    let customerEmail: string | undefined;
    if (userId) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true, email: true } });
      customerId    = user?.stripeCustomerId ?? undefined;
      customerEmail = !customerId ? (user?.email ?? undefined) : undefined;
    } else {
      customerEmail = body.guestEmail ?? undefined;
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer:       customerId,
      customer_email: !customerId ? customerEmail : undefined,
      line_items: [{
        price_data: {
          currency:     "usd",
          unit_amount:  amount,
          product_data: {
            name:        "IndieThis Music Video — Director Mode",
            description: `"${video.trackTitle}" · ${video.videoLength.charAt(0) + video.videoLength.slice(1).toLowerCase()}`,
          },
        },
        quantity: 1,
      }],
      metadata: { musicVideoId: id, tool: "MUSIC_VIDEO", userId: userId ?? "" },
      success_url: `${APP_URL}/video-studio/${id}/generating?success=1`,
      cancel_url:  `${APP_URL}/video-studio/director/${id}`,
    });

    return NextResponse.json({ requiresPayment: true, amount, url: checkoutSession.url });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[director/approve]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
