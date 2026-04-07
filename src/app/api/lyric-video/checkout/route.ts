/**
 * POST /api/lyric-video/checkout
 *
 * Creates a LyricVideo job and returns a Stripe Checkout URL.
 * Public — no auth required.
 *
 * Body (Quick Mode):
 *   mode:               "quick"
 *   audioUrl:           string
 *   trackTitle:         string
 *   coverArtUrl?:       string
 *   typographyStyleId?: string
 *   visionPrompt?:      string
 *   guestEmail:         string
 *   guestName?:         string
 *   isSubscriber?:      boolean
 *
 * Body (Director Mode):
 *   mode:               "director"
 *   existingJobId:      string   ← draft job from /api/lyric-video/brief
 *   sectionPlan:        SectionPlan[]
 *   isSubscriber?:      boolean
 *
 * Response: { jobId: string; url: string }
 */

import { NextRequest, NextResponse }    from "next/server";
import { db }                           from "@/lib/db";
import { stripe }                       from "@/lib/stripe";
import { auth }                         from "@/lib/auth";
import { getPricing, PRICING_DEFAULTS } from "@/lib/pricing";

export const runtime = "nodejs";

const QUICK_GUEST_KEY    = "LYRIC_VIDEO_QUICK_GUEST";
const QUICK_SUB_KEY      = "LYRIC_VIDEO_QUICK_SUB";
const DIRECTOR_GUEST_KEY = "LYRIC_VIDEO_DIRECTOR_GUEST";
const DIRECTOR_SUB_KEY   = "LYRIC_VIDEO_DIRECTOR_SUB";

function emailValid(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const body = await req.json() as {
    mode:               "quick" | "director";
    // Quick Mode fields
    audioUrl?:          string;
    trackTitle?:        string;
    coverArtUrl?:       string;
    typographyStyleId?: string;
    visionPrompt?:      string;
    guestEmail?:        string;
    guestName?:         string;
    // Director Mode fields
    existingJobId?:     string;
    sectionPlan?:       unknown[];
    // Shared
    isSubscriber?:      boolean;
  };

  const { mode, isSubscriber } = body;
  if (mode !== "quick" && mode !== "director") {
    return NextResponse.json({ error: "mode must be quick or director" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";
  const pricing = await getPricing();

  // Try to get session for subscriber price
  const session  = await auth();
  const isSub    = isSubscriber || !!session?.user?.id;
  const priceKey =
    mode === "quick"
      ? (isSub ? QUICK_SUB_KEY    : QUICK_GUEST_KEY)
      : (isSub ? DIRECTOR_SUB_KEY : DIRECTOR_GUEST_KEY);

  const amount = Math.round(
    (pricing[priceKey]?.value ?? (PRICING_DEFAULTS as Record<string, { value: number }>)[priceKey]?.value ?? 0) * 100,
  );

  const modeLabel  = mode === "quick" ? "Quick Mode" : "Director Mode";
  const toolMetaKey = mode === "quick" ? "LYRIC_VIDEO_QUICK" : "LYRIC_VIDEO_DIRECTOR";

  let jobId: string;
  let guestEmail: string;

  if (mode === "quick") {
    // ── Quick Mode: create a new job ─────────────────────────────────────
    const { audioUrl, trackTitle, coverArtUrl, typographyStyleId, visionPrompt, guestName } = body;

    if (!audioUrl || !trackTitle?.trim()) {
      return NextResponse.json({ error: "audioUrl and trackTitle required" }, { status: 400 });
    }

    const emailRaw = body.guestEmail ?? session?.user?.email ?? "";
    if (!emailRaw || !emailValid(emailRaw.trim())) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    guestEmail = emailRaw.trim();

    // Estimate duration from audio (we'll get real duration during analysis)
    const job = await db.lyricVideo.create({
      data: {
        userId:            session?.user?.id ?? null,
        guestEmail:        session?.user?.id ? null : guestEmail,
        guestName:         guestName?.trim() ?? null,
        mode:              "QUICK",
        audioUrl,
        trackTitle:        trackTitle.trim(),
        trackDuration:     180, // placeholder; real value set during analysis
        coverArtUrl:       coverArtUrl?.trim() || null,
        typographyStyleId: typographyStyleId ?? null,
        visionPrompt:      visionPrompt?.trim() || null,
        status:            "PENDING",
        amount,
      },
    });
    jobId = job.id;

  } else {
    // ── Director Mode: update existing draft job ─────────────────────────
    const { existingJobId, sectionPlan } = body;
    if (!existingJobId) return NextResponse.json({ error: "existingJobId required for director mode" }, { status: 400 });

    const existing = await db.lyricVideo.findUnique({
      where:  { id: existingJobId },
      select: { id: true, guestEmail: true, userId: true },
    });
    if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    guestEmail = existing.guestEmail ?? session?.user?.email ?? "";

    await db.lyricVideo.update({
      where: { id: existingJobId },
      data:  { sectionPlan: (sectionPlan ?? []) as object[], amount },
    });
    jobId = existingJobId;
  }

  // ── Stripe customer lookup/create ────────────────────────────────────────
  let customerId: string | undefined;
  const existingUser = await db.user.findUnique({
    where:  { email: guestEmail },
    select: { stripeCustomerId: true },
  });
  if (existingUser?.stripeCustomerId) {
    customerId = existingUser.stripeCustomerId;
  } else if (guestEmail) {
    const customer = await stripe.customers.create({
      email:    guestEmail,
      metadata: { guestEmail },
    });
    customerId = customer.id;
  }

  // ── Stripe checkout session ──────────────────────────────────────────────
  const checkoutSession = await stripe.checkout.sessions.create({
    customer:      customerId,
    mode:          "payment",
    line_items: [{
      price_data: {
        currency:     "usd",
        product_data: { name: `Lyric Video Studio — ${modeLabel} — IndieThis` },
        unit_amount:  amount,
      },
      quantity: 1,
    }],
    customer_email: customerId ? undefined : guestEmail,
    success_url:    `${appUrl}/lyric-video?paid=1&jobId=${jobId}&mode=${mode}`,
    cancel_url:     `${appUrl}/lyric-video`,
    metadata:       { guestEmail, tool: toolMetaKey, jobId },
  });

  return NextResponse.json({ jobId, url: checkoutSession.url });
}
