/**
 * POST /api/video-studio/director/[id]/approve
 *
 * Approves the shot list and starts generation (or initiates Stripe checkout).
 * Body: { guestEmail? }
 * Returns: { requiresPayment, amount } | { url } (Stripe)
 *
 * After payment clears (or for free/included credits), fires an Inngest event
 * instead of calling startGeneration() synchronously:
 *
 *   - video.status !== "STORYBOARD"  → video/generate.requested  (keyframes → approval → Kling)
 *   - video.status === "STORYBOARD"  → video/scenes.approved      (user approved; Kling i2v starts)
 *
 * The route returns in <1s. All heavy work runs in Inngest steps.
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { stripe }                from "@/lib/stripe";
import { inngest }               from "@/inngest/client";
import { NextRequest, NextResponse } from "next/server";
import { getVideoPrice }         from "@/lib/video-studio/model-router";

export const maxDuration = 60; // Route only fires an Inngest event — no long work here

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
        referenceImageUrl: true, thumbnailUrl: true,
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
      await fireInngestPipelineEvent(id, video);
      return NextResponse.json({ requiresPayment: false, amount: 0 });
    }

    // Requires payment — create Stripe checkout session
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

// ─── Inngest event dispatcher ────────────────────────────────────────────────────

type VideoRecord = {
  id:                string;
  status:            string;
  shotList:          unknown;
  referenceImageUrl: string | null;
  thumbnailUrl:      string | null;
  videoLength:       string;
};

async function fireInngestPipelineEvent(videoId: string, video: VideoRecord): Promise<void> {
  const artistImageUrl = video.referenceImageUrl ?? video.thumbnailUrl ?? "";

  if (video.status === "STORYBOARD") {
    // User has already approved storyboard — all keyframes are done.
    // Skip keyframe generation; fire scenes.approved to start Kling i2v directly.
    await inngest.send({
      name: "video/scenes.approved",
      data: { videoId },
    });
    console.log(`[director/approve] Storyboard approved — fired scenes.approved for ${videoId}`);
    return;
  }

  // First time through — fire generate.requested with the existing shotList.
  // Orchestrator fans out keyframe.generate events (one per scene).
  const shotList = (video.shotList as Record<string, unknown>[]) ?? [];

  await inngest.send({
    name: "video/generate.requested",
    data: {
      videoId,
      scenes:         shotList,
      artistImageUrl,
    },
  });

  console.log(`[director/approve] Fired generate.requested for ${videoId} — ${shotList.length} scenes`);
}
