/**
 * POST /api/ai-tools/vocal-remover
 * Initiates a stem separation job.
 * Flow:
 *  1. Validate auth + subscription
 *  2. Create Stripe Checkout for $1.99 (pay-per-use)
 *  3. On return from checkout (?paid=1&session_id=xxx), start Replicate prediction
 *  4. Return { checkoutUrl } or { separationId } depending on step
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { replicate } from "@/lib/replicate";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";
import { getMonthlyStudioSeparations } from "@/lib/stem-separation-usage";

export const maxDuration = 30;

// ── POST: create checkout or start job ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    fileUrl?: string;
    fileName?: string;
    // Set after Stripe redirect
    stripeSessionId?: string;
    separationId?: string;
  };

  const userId = session.user.id;

  // ── Determine if this is a studio user (free) or artist (paid) ───────────
  const isStudio = session?.user?.role === "STUDIO_ADMIN";

  // ── Step 2: Start Replicate job after Stripe payment confirmed ────────────
  // (artist-only path — studios never go through this step)
  if (body.stripeSessionId && body.separationId) {
    return startReplicateJob(userId, body.separationId, body.stripeSessionId);
  }

  // ── Validate input ────────────────────────────────────────────────────────
  if (!body.fileUrl?.trim() || !body.fileName?.trim()) {
    return NextResponse.json({ error: "fileUrl and fileName are required" }, { status: 400 });
  }

  // ── Studio path: free, skip Stripe ───────────────────────────────────────
  if (isStudio) {
    // Soft ceiling: 200 completed separations per calendar month
    const monthlyUsage = await getMonthlyStudioSeparations(userId);
    if (monthlyUsage >= 200) {
      // TODO: send admin alert when admin notification system is available
      console.warn(`[stem-separation] Studio ${userId} has ${monthlyUsage} completed separations this month (soft ceiling: 200)`);
    }

    // Create separation record and kick off Replicate immediately
    const separation = await db.stemSeparation.create({
      data: {
        userId,
        originalFileUrl:  body.fileUrl.trim(),
        originalFileName: body.fileName.trim(),
        status: "pending",
      },
    });

    return startReplicateJobDirect(userId, separation.id);
  }

  // ── Artist path: require active subscription + $1.99 Stripe checkout ─────
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      stripeCustomerId: true,
      subscription: { select: { status: true } },
    },
  });
  if (!user || user.subscription?.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Active subscription required", requiresUpgrade: true },
      { status: 402 }
    );
  }

  // Get price from DB (falls back to default if not seeded yet)
  const pricing = await getPricing();
  const price = pricing["AI_VOCAL_REMOVER"] ?? PRICING_DEFAULTS.AI_VOCAL_REMOVER;
  const amountCents = Math.round(price.value * 100);

  // Create a pending StemSeparation record so we have an ID for the checkout
  const separation = await db.stemSeparation.create({
    data: {
      userId,
      originalFileUrl: body.fileUrl.trim(),
      originalFileName: body.fileName.trim(),
      status: "pending",
    },
  });

  if (!stripe) {
    return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3456");

  const successUrl = `${appUrl}/dashboard/ai/vocal-remover?paid=1&session_id={CHECKOUT_SESSION_ID}&separationId=${separation.id}`;
  const cancelUrl  = `${appUrl}/dashboard/ai/vocal-remover?cancelled=1`;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: user.stripeCustomerId ?? undefined,
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: "Vocal Remover & Stem Separator – IndieThis" },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    metadata: {
      type: "vocal_remover",
      separationId: separation.id,
      userId,
    },
    success_url: successUrl,
    cancel_url:  cancelUrl,
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url, separationId: separation.id });
}

// ── Internal: start Replicate prediction after payment ───────────────────────

async function startReplicateJob(userId: string, separationId: string, stripeSessionId: string) {
  // Verify the separation belongs to this user
  const separation = await db.stemSeparation.findFirst({
    where: { id: separationId, userId },
  });
  if (!separation) {
    return NextResponse.json({ error: "Separation not found" }, { status: 404 });
  }
  // Don't double-process
  if (separation.status !== "pending") {
    return NextResponse.json({ separationId: separation.id, status: separation.status });
  }

  // Verify Stripe payment
  let stripePaymentId: string | null = null;
  if (stripe) {
    try {
      const cs = await stripe.checkout.sessions.retrieve(stripeSessionId);
      if (cs.payment_status !== "paid") {
        return NextResponse.json({ error: "Payment not confirmed" }, { status: 402 });
      }
      stripePaymentId = cs.payment_intent as string ?? null;
    } catch {
      return NextResponse.json({ error: "Could not verify payment" }, { status: 402 });
    }
  }

  if (!replicate) {
    await db.stemSeparation.update({
      where: { id: separationId },
      data: { status: "failed", errorMessage: "Replicate not configured" },
    });
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  // Start Replicate prediction (async)
  try {
    const prediction = await replicate.predictions.create({
      model: "cjwbw/demucs",
      input: {
        audio:       separation.originalFileUrl,
        model_name:  "htdemucs_ft",
        stem:        "no_stem",
        clip_mode:   "rescale",
        shifts:      1,
        overlap:     0.25,
      },
    });

    await db.stemSeparation.update({
      where: { id: separationId },
      data: {
        status:          "processing",
        replicateId:     prediction.id,
        stripePaymentId: stripePaymentId,
      },
    });

    return NextResponse.json({ separationId, status: "processing", replicateId: prediction.id });
  } catch (err) {
    await db.stemSeparation.update({
      where: { id: separationId },
      data: { status: "failed", errorMessage: String(err) },
    });
    return NextResponse.json({ error: "Failed to start separation", detail: String(err) }, { status: 500 });
  }
}

// ── Internal: start Replicate prediction for studio (no payment) ─────────────

async function startReplicateJobDirect(userId: string, separationId: string) {
  const separation = await db.stemSeparation.findFirst({
    where: { id: separationId, userId },
  });
  if (!separation) {
    return NextResponse.json({ error: "Separation not found" }, { status: 404 });
  }
  if (separation.status !== "pending") {
    return NextResponse.json({ separationId: separation.id, status: separation.status });
  }

  if (!replicate) {
    await db.stemSeparation.update({
      where: { id: separationId },
      data: { status: "failed", errorMessage: "Replicate not configured" },
    });
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  try {
    const prediction = await replicate.predictions.create({
      model: "cjwbw/demucs",
      input: {
        audio:      separation.originalFileUrl,
        model_name: "htdemucs_ft",
        stem:       "no_stem",
        clip_mode:  "rescale",
        shifts:     1,
        overlap:    0.25,
      },
    });

    await db.stemSeparation.update({
      where: { id: separationId },
      data: {
        status:      "processing",
        replicateId: prediction.id,
        // stripePaymentId intentionally null — free studio separation
      },
    });

    return NextResponse.json({ separationId, status: "processing", replicateId: prediction.id });
  } catch (err) {
    await db.stemSeparation.update({
      where: { id: separationId },
      data: { status: "failed", errorMessage: String(err) },
    });
    return NextResponse.json({ error: "Failed to start separation", detail: String(err) }, { status: 500 });
  }
}

// ── GET: list history ────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isStudio = session.user.role === "STUDIO_ADMIN";

  const [separations, pricing, monthlyUsage] = await Promise.all([
    db.stemSeparation.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getPricing(),
    isStudio ? getMonthlyStudioSeparations(session.user.id) : Promise.resolve(0),
  ]);

  const price = pricing["AI_VOCAL_REMOVER"] ?? PRICING_DEFAULTS.AI_VOCAL_REMOVER;

  return NextResponse.json({
    separations,
    priceDisplay:  price.display,
    priceValue:    price.value,
    isStudio,
    monthlyUsage,
  });
}
