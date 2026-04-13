/**
 * GET  /api/dashboard/ai/cover-art — job history + credit info for current user
 * POST /api/dashboard/ai/cover-art — create a CoverArtJob and start or gate on payment
 *
 * Subscriber only.
 *
 * POST body:
 * {
 *   tier:               "STANDARD" | "PREMIUM" | "PRO"
 *   styleId:            string
 *   prompt:             string
 *   referenceImageUrl?: string
 *   trackId?:           string
 *   priceAlreadyCharged?: boolean  // set to true when returning from Stripe ?paid=1
 *   jobId?:             string     // if resuming a pending job after payment
 * }
 *
 * Response:
 * { jobId, requiresPayment?: false }                  → start immediately
 * { requiresPayment: true, url: string }              → redirect to Stripe
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";
import { stripe }                    from "@/lib/stripe";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";
import { generateCoverArtJob }       from "@/lib/cover-art/generator";

// ─── Tier credit limits per subscription tier ─────────────────────────────────
// Standard only — Premium/Pro always PPU
const ART_CREDITS: Record<string, number> = {
  LAUNCH: 5,
  PUSH:   10,
  REIGN:  15,
};

const PRICING_KEY: Record<string, string> = {
  STANDARD: "AI_COVER_ART_STANDARD",
  PREMIUM:  "AI_COVER_ART_PREMIUM",
  PRO:      "AI_COVER_ART_PRO",
};

// ─── GET — history + credit status ───────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [jobs, subscription] = await Promise.all([
    db.coverArtJob.findMany({
      where:   { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take:    20,
      select: {
        id:             true,
        tier:           true,
        status:         true,
        variationUrls:  true,
        selectedUrl:    true,
        prompt:         true,
        createdAt:      true,
        errorMessage:   true,
        style:          { select: { name: true, category: true } },
      },
    }),
    db.subscription.findFirst({
      where:  { userId: session.user.id, status: "ACTIVE" },
      select: { tier: true },
    }),
  ]);

  // Calculate how many standard cover arts used this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usedThisMonth = await db.coverArtJob.count({
    where: {
      userId:    session.user.id,
      tier:      "STANDARD",
      status:    "COMPLETE",
      createdAt: { gte: startOfMonth },
    },
  });

  const tier       = subscription?.tier ?? "FREE";
  const creditLimit = ART_CREDITS[tier] ?? 0;
  const creditsLeft = Math.max(0, creditLimit - usedThisMonth);

  const pricing = await getPricing();

  return NextResponse.json({
    jobs,
    credits: {
      used:  usedThisMonth,
      limit: creditLimit,
      left:  creditsLeft,
      tier:  tier.toLowerCase(),
    },
    pricing: {
      STANDARD: pricing["AI_COVER_ART_STANDARD"]?.display ?? PRICING_DEFAULTS.AI_COVER_ART_STANDARD.display,
      PREMIUM:  pricing["AI_COVER_ART_PREMIUM"]?.display  ?? PRICING_DEFAULTS.AI_COVER_ART_PREMIUM.display,
      PRO:      pricing["AI_COVER_ART_PRO"]?.display      ?? PRICING_DEFAULTS.AI_COVER_ART_PRO.display,
    },
  });
}

// ─── POST — create job ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    tier?:                string;
    styleId?:             string;
    prompt?:              string;
    referenceImageUrl?:   string;
    trackId?:             string;
    priceAlreadyCharged?: boolean;
    jobId?:               string;
  };

  // Resume an existing job after Stripe payment
  if (body.priceAlreadyCharged && body.jobId) {
    const existingJob = await db.coverArtJob.findUnique({
      where:  { id: body.jobId },
      select: {
        id:               true,
        tier:             true,
        prompt:           true,
        referenceImageUrl:true,
        stripePaymentId:  true,
        styleId:          true,
        trackId:          true,
        style:            { select: { promptBase: true } },
        status:           true,
      },
    });

    if (!existingJob || existingJob.status !== "PENDING") {
      return NextResponse.json({ error: "Job not found or already started" }, { status: 404 });
    }

    // Load track data for prompt enhancement
    const trackData = existingJob.trackId
      ? await db.track.findUnique({
          where:  { id: existingJob.trackId },
          select: {
            title:                true,
            audioFeatures:        { select: { genre: true, mood: true, energy: true, valence: true } },
            essentiaGenres:       true,
            essentiaMoods:        true,
            essentiaTimbre:       true,
          },
        })
      : null;

    const user = await db.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, artistName: true },
    });

    generateCoverArtJob({
      jobId:           existingJob.id,
      tier:            existingJob.tier as "STANDARD" | "PREMIUM" | "PRO",
      prompt:          existingJob.prompt,
      stylePromptBase: existingJob.style?.promptBase ?? "",
      referenceImageUrl: existingJob.referenceImageUrl,
      genre:           trackData?.audioFeatures?.genre ?? null,
      mood:            trackData?.audioFeatures?.mood  ?? null,
      bpm:             null,
      energy:          trackData?.audioFeatures?.energy ?? null,
      trackTitle:      trackData?.title ?? "Untitled",
      artistName:      user?.artistName ?? user?.name ?? "Artist",
      essentiaGenres:  (trackData?.essentiaGenres as { label: string; score: number }[] | null) ?? null,
      essentiaMoods:   (trackData?.essentiaMoods  as { label: string; score: number }[] | null) ?? null,
      essentiaTimbre:  (trackData?.essentiaTimbre  as string | null) ?? null,
    }).catch(console.error);

    return NextResponse.json({ jobId: existingJob.id });
  }

  // Validate new job inputs
  const tier = (body.tier ?? "STANDARD").toUpperCase() as "STANDARD" | "PREMIUM" | "PRO";
  if (!["STANDARD", "PREMIUM", "PRO"].includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (!body.styleId) {
    return NextResponse.json({ error: "Style selection is required" }, { status: 400 });
  }

  // Verify style exists
  const style = await db.coverArtStyle.findUnique({
    where:  { id: body.styleId },
    select: { id: true, promptBase: true },
  });
  if (!style) return NextResponse.json({ error: "Style not found" }, { status: 404 });

  // Load track data (optional — improves prompt quality)
  const trackData = body.trackId
    ? await db.track.findUnique({
        where:  { id: body.trackId },
        select: {
          title:          true,
          audioFeatures:  { select: { genre: true, mood: true, energy: true, valence: true } },
          essentiaGenres: true,
          essentiaMoods:  true,
          essentiaTimbre: true,
        },
      })
    : null;

  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { name: true, artistName: true, stripeCustomerId: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // ── Credit check for STANDARD tier ──────────────────────────────────────────
  const subscription = await db.subscription.findFirst({
    where:  { userId: session.user.id, status: "ACTIVE" },
    select: { tier: true },
  });

  const subTier     = subscription?.tier ?? "FREE";
  const creditLimit = ART_CREDITS[subTier] ?? 0;

  if (tier === "STANDARD" && creditLimit > 0) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usedThisMonth = await db.coverArtJob.count({
      where: {
        userId:    session.user.id,
        tier:      "STANDARD",
        status:    "COMPLETE",
        createdAt: { gte: startOfMonth },
      },
    });

    if (usedThisMonth < creditLimit) {
      // Has credits — create job and start immediately
      const job = await db.coverArtJob.create({
        data: {
          userId:           session.user.id,
          tier:             "STANDARD",
          styleId:          body.styleId,
          trackId:          body.trackId ?? null,
          prompt:           body.prompt.trim(),
          referenceImageUrl: body.referenceImageUrl ?? null,
          status:           "PENDING",
        },
      });

      generateCoverArtJob({
        jobId:           job.id,
        tier:            "STANDARD",
        prompt:          body.prompt.trim(),
        stylePromptBase: style.promptBase,
        referenceImageUrl: body.referenceImageUrl ?? null,
        genre:           trackData?.audioFeatures?.genre ?? null,
        mood:            trackData?.audioFeatures?.mood  ?? null,
        bpm:             null,
        energy:          trackData?.audioFeatures?.energy ?? null,
        trackTitle:      trackData?.title ?? "Untitled",
        artistName:      user.artistName ?? user.name ?? "Artist",
        essentiaGenres:  (trackData?.essentiaGenres as { label: string; score: number }[] | null) ?? null,
        essentiaMoods:   (trackData?.essentiaMoods  as { label: string; score: number }[] | null) ?? null,
        essentiaTimbre:  (trackData?.essentiaTimbre  as string | null) ?? null,
      }).catch(console.error);

      return NextResponse.json({ jobId: job.id });
    }
  }

  // ── PPU via Stripe checkout ───────────────────────────────────────────────
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const pricing = await getPricing();
  const pricingKey = PRICING_KEY[tier];
  const amount = Math.round(
    (pricing[pricingKey]?.value ?? (PRICING_DEFAULTS as Record<string, { value: number }>)[pricingKey]?.value ?? 0) * 100
  );

  // Create the job in PENDING state — generation starts after Stripe webhook
  const job = await db.coverArtJob.create({
    data: {
      userId:           session.user.id,
      tier,
      styleId:          body.styleId,
      trackId:          body.trackId ?? null,
      prompt:           body.prompt.trim(),
      referenceImageUrl: body.referenceImageUrl ?? null,
      status:           "PENDING",
    },
  });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name:  user.name  ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await db.user.update({ where: { id: session.user.id }, data: { stripeCustomerId: customerId } });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode:     "payment",
    line_items: [{
      price_data: {
        currency:     "usd",
        product_data: { name: `Cover Art Studio — ${tier.charAt(0) + tier.slice(1).toLowerCase()} — IndieThis` },
        unit_amount:  amount,
      },
      quantity: 1,
    }],
    success_url: `${appUrl}/dashboard/ai/cover-art?paid=1&jobId=${job.id}`,
    cancel_url:  `${appUrl}/dashboard/ai/cover-art`,
    metadata:    { userId: session.user.id, tool: `COVER_ART_${tier}`, jobId: job.id },
  });

  return NextResponse.json({ requiresPayment: true, url: checkoutSession.url, jobId: job.id });
}
