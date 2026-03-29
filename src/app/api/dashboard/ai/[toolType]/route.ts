/**
 * POST /api/dashboard/ai/[toolType]
 *
 * Single entry point for all 6 AI tools (VIDEO, COVER_ART, MASTERING,
 * LYRIC_VIDEO, AR_REPORT, PRESS_KIT).
 *
 * URL segment is case-insensitive and accepts both kebab-case and uppercase:
 *   /api/dashboard/ai/video
 *   /api/dashboard/ai/cover-art   → COVER_ART
 *   /api/dashboard/ai/ar-report   → AR_REPORT
 *   /api/dashboard/ai/lyric-video → LYRIC_VIDEO
 *   /api/dashboard/ai/press-kit   → PRESS_KIT
 *   /api/dashboard/ai/mastering
 *
 * Flow:
 *  1. Normalize + validate toolType.
 *  2. Parse + validate per-tool request body.
 *  3. Call createAIJob (handles billing: credit deduct or Stripe charge).
 *     If no credits and no saved card → 402 with { requiresPayment, amount }.
 *  4. Fire processAIJob async (returns immediately — client polls for updates).
 *  5. Return { jobId, status: "QUEUED" }.
 *
 * Auth: ARTIST role required.
 */

import { NextRequest, NextResponse }        from "next/server";
import { auth }                             from "@/lib/auth";
import { db }                               from "@/lib/db";
import { createAIJob }                      from "@/lib/ai-jobs";
import { processAIJob }                     from "@/lib/ai-job-processor";
import { AIJobType, AIJobTrigger }          from "@prisma/client";
import { getPricing, PRICING_DEFAULTS }     from "@/lib/pricing";

// ─── URL param → AIJobType normalisation ──────────────────────────────────────

const SLUG_TO_TYPE: Record<string, AIJobType> = {
  video:        "VIDEO",
  "cover-art":  "COVER_ART",
  coverart:     "COVER_ART",
  mastering:    "MASTERING",
  "lyric-video":"LYRIC_VIDEO",
  lyricvideo:   "LYRIC_VIDEO",
  "ar-report":  "AR_REPORT",
  arrreport:    "AR_REPORT",
  arreport:     "AR_REPORT",
  "press-kit":  "PRESS_KIT",
  presskit:     "PRESS_KIT",
};

function resolveToolType(raw: string): AIJobType | null {
  const normalized = raw.toLowerCase().replace(/[_]/g, "-");
  return SLUG_TO_TYPE[normalized] ?? null;
}

// ─── Per-tool input validation ─────────────────────────────────────────────────

type ValidationResult =
  | { ok: true;  inputData: Record<string, unknown> }
  | { ok: false; error: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateVideo(body: any): ValidationResult {
  if (!body.imageUrl?.trim())
    return { ok: false, error: "imageUrl is required for VIDEO generation" };

  const VALID_STYLES = ["cinematic", "music-video", "lyric-video", "documentary", "artistic"];
  const VALID_RATIOS = ["16:9", "9:16", "1:1"];
  const VALID_TIERS  = ["SHORT", "MEDIUM", "FULL"];

  const style       = body.style ?? "cinematic";
  const aspectRatio = body.aspectRatio ?? "16:9";
  const durationTier = body.durationTier ?? "MEDIUM";

  if (!VALID_STYLES.includes(style))
    return { ok: false, error: `style must be one of: ${VALID_STYLES.join(", ")}` };
  if (!VALID_RATIOS.includes(aspectRatio))
    return { ok: false, error: `aspectRatio must be one of: ${VALID_RATIOS.join(", ")}` };
  if (!VALID_TIERS.includes(durationTier))
    return { ok: false, error: `durationTier must be one of: ${VALID_TIERS.join(", ")}` };

  return {
    ok: true,
    inputData: {
      imageUrl:       body.imageUrl.trim(),
      style,
      aspectRatio,
      durationTier,
      durationSeconds: body.durationSeconds ?? undefined,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateCoverArt(body: any): ValidationResult {
  if (!body.artistPrompt?.trim())
    return { ok: false, error: "artistPrompt is required for COVER_ART generation" };

  return {
    ok: true,
    inputData: {
      artistPrompt: body.artistPrompt.trim(),
      style:        body.style  ?? "Photorealistic",
      mood:         body.mood   ?? "",
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateMastering(body: any): ValidationResult {
  if (!body.trackUrl?.trim())
    return { ok: false, error: "trackUrl is required for MASTERING" };

  return {
    ok: true,
    inputData: {
      trackUrl:       body.trackUrl.trim(),
      genre:          body.genre          ?? "",
      loudnessTarget: body.loudnessTarget ?? -14,   // LUFS
      noiseReduction: body.noiseReduction ?? false,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateLyricVideo(body: any): ValidationResult {
  if (!body.trackUrl?.trim())
    return { ok: false, error: "trackUrl is required for LYRIC_VIDEO" };

  const VALID_RATIOS = ["16:9", "9:16", "1:1"];
  const aspectRatio  = body.aspectRatio ?? "16:9";

  if (!VALID_RATIOS.includes(aspectRatio))
    return { ok: false, error: `aspectRatio must be one of: ${VALID_RATIOS.join(", ")}` };

  return {
    ok: true,
    inputData: {
      trackUrl:    body.trackUrl.trim(),
      visualStyle: body.visualStyle ?? "cinematic",
      fontStyle:   body.fontStyle   ?? "default",
      accentColor: body.accentColor ?? "#FFFFFF",
      aspectRatio,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateARReport(body: any): ValidationResult {
  if (!body.trackUrl?.trim())
    return { ok: false, error: "trackUrl is required for AR_REPORT" };

  return {
    ok: true,
    inputData: {
      trackUrl:           body.trackUrl.trim(),
      genre:              body.genre              ?? "",
      artistBio:          body.artistBio          ?? "",
      targetMarket:       body.targetMarket       ?? "",
      comparableArtists:  body.comparableArtists  ?? "",
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validatePressKit(body: any): ValidationResult {
  if (!body.artistName?.trim())
    return { ok: false, error: "artistName is required for PRESS_KIT" };

  return {
    ok: true,
    inputData: {
      artistName:   body.artistName.trim(),
      genre:        body.genre        ?? "",
      location:     body.location     ?? "",
      bio:          body.bio          ?? "",
      achievements: body.achievements ?? "",
      trackList:    Array.isArray(body.trackList) ? body.trackList : [],
      instagram:    body.instagram    ?? "",
      tiktok:       body.tiktok       ?? "",
      youtube:      body.youtube      ?? "",
      spotify:      body.spotify      ?? "",
      appleMusic:   body.appleMusic   ?? "",
      bookingEmail: body.bookingEmail ?? "",
      tone:         body.tone         ?? "professional",
      photoUrl:     body.photoUrl     ?? null,
    },
  };
}

const VALIDATORS: Partial<Record<AIJobType, (body: unknown) => ValidationResult>> = {
  VIDEO:       validateVideo,
  COVER_ART:   validateCoverArt,
  MASTERING:   validateMastering,
  LYRIC_VIDEO: validateLyricVideo,
  AR_REPORT:   validateARReport,
  PRESS_KIT:   validatePressKit,
};

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  req:    NextRequest,
  { params }: { params: Promise<{ toolType: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ARTIST") {
    return NextResponse.json(
      { error: "Only artists can trigger AI generation jobs" },
      { status: 403 },
    );
  }

  // ── Resolve tool type ─────────────────────────────────────────────────────
  const { toolType: rawToolType } = await params;
  const type = resolveToolType(rawToolType);

  if (!type) {
    return NextResponse.json(
      {
        error: `Unknown tool type: "${rawToolType}". Valid values: video, cover-art, mastering, lyric-video, ar-report, press-kit`,
      },
      { status: 400 },
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Per-tool validation ───────────────────────────────────────────────────
  const validator = VALIDATORS[type];
  if (!validator) {
    return NextResponse.json({ error: `No validator for tool type: ${type}` }, { status: 400 });
  }
  const validation = validator(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // ── Create job + handle billing ───────────────────────────────────────────
  // priceAlreadyCharged / chargedAmount are passed when the caller has already
  // completed a Stripe Checkout session (PPU redirect flow).
  const bodyObj = body as Record<string, unknown>;
  const result = await createAIJob({
    type,
    triggeredBy:         AIJobTrigger.ARTIST,
    triggeredById:       session.user.id,
    artistId:            session.user.id,
    inputData:           validation.inputData,
    priceAlreadyCharged: bodyObj.priceAlreadyCharged === true,
    chargedAmount:       typeof bodyObj.chargedAmount === "number" ? bodyObj.chargedAmount : undefined,
    stripePaymentId:     typeof bodyObj.stripePaymentId === "string" ? bodyObj.stripePaymentId : undefined,
  });

  if (!result.success) {
    // No credits + no saved payment method → tell client to redirect to Checkout
    if (result.requiresPayment) {
      return NextResponse.json(
        {
          error:            result.error,
          requiresPayment:  true,
          amount:           result.amount,       // cents
          amountDollars:    result.amount ? result.amount / 100 : undefined,
          tool:             type,
        },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { jobId } = result;

  // ── Fire processAIJob async — do NOT await ────────────────────────────────
  // The handler runs in the background; client polls GET /api/ai-jobs/[id]
  void processAIJob(jobId).catch((err: unknown) => {
    console.error(`[dashboard/ai/${type}] processAIJob ${jobId} threw:`, err);
  });

  return NextResponse.json(
    {
      success:  true,
      jobId,
      type,
      status:   "QUEUED",
      message:  "Job queued — poll GET /api/ai-jobs/" + jobId + " for status updates",
    },
    { status: 202 },
  );
}

// ─── GET /api/dashboard/ai/[toolType] — job history ───────────────────────────

export async function GET(
  _req:   NextRequest,
  { params }: { params: Promise<{ toolType: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { toolType: rawToolType } = await params;
  const type = resolveToolType(rawToolType);
  if (!type) {
    return NextResponse.json({ error: "Unknown tool type" }, { status: 400 });
  }

  // Credit field + pricing key for each tool type
  type ToolCreditFields = {
    usedField:  "aiArtCreditsUsed" | "aiMasterCreditsUsed" | "lyricVideoCreditsUsed" |
                "aarReportCreditsUsed" | "pressKitCreditsUsed" | "aiVideoCreditsUsed";
    limitField: "aiArtCreditsLimit" | "aiMasterCreditsLimit" | "lyricVideoCreditsLimit" |
                "aarReportCreditsLimit" | "pressKitCreditsLimit" | "aiVideoCreditsLimit";
    pricingKey: string;
  };
  const TOOL_CREDIT_FIELDS: Partial<Record<AIJobType, ToolCreditFields>> = {
    COVER_ART:   { usedField: "aiArtCreditsUsed",      limitField: "aiArtCreditsLimit",      pricingKey: "AI_COVER_ART"    },
    MASTERING:   { usedField: "aiMasterCreditsUsed",   limitField: "aiMasterCreditsLimit",   pricingKey: "AI_MASTERING"    },
    LYRIC_VIDEO: { usedField: "lyricVideoCreditsUsed", limitField: "lyricVideoCreditsLimit", pricingKey: "AI_LYRIC_VIDEO"  },
    AR_REPORT:   { usedField: "aarReportCreditsUsed",  limitField: "aarReportCreditsLimit",  pricingKey: "AI_AAR_REPORT"   },
    PRESS_KIT:   { usedField: "pressKitCreditsUsed",   limitField: "pressKitCreditsLimit",   pricingKey: "AI_PRESS_KIT"    },
    VIDEO:       { usedField: "aiVideoCreditsUsed",    limitField: "aiVideoCreditsLimit",    pricingKey: "AI_VIDEO_MEDIUM" },
  };

  const creditFields = TOOL_CREDIT_FIELDS[type];

  if (creditFields) {
    const { usedField, limitField, pricingKey } = creditFields;
    const [jobs, subscription, pricing] = await Promise.all([
      db.aIJob.findMany({
        where:   { triggeredById: session.user.id, type },
        orderBy: { createdAt: "desc" },
        take:    20,
        select:  { id: true, type: true, status: true, priceCharged: true, createdAt: true, completedAt: true, errorMessage: true, outputData: true },
      }),
      db.subscription.findUnique({
        where:  { userId: session.user.id },
        select: { tier: true, [usedField]: true, [limitField]: true },
      }),
      getPricing(),
    ]);
    const subRecord = subscription as Record<string, unknown> | null;
    const credits = subRecord
      ? {
          used:  subRecord[usedField] as number,
          limit: subRecord[limitField] as number,
          tier:  (subRecord.tier as string).toLowerCase(),
        }
      : null;
    const fallbackPrice = PRICING_DEFAULTS[pricingKey as keyof typeof PRICING_DEFAULTS];
    const priceDisplay = pricing[pricingKey]?.display ?? (fallbackPrice ? fallbackPrice.display : "");
    return NextResponse.json({ jobs, credits, priceDisplay });
  }

  // Tools without per-tool credit tracking (shouldn't happen with current tools, but safe fallback)
  const jobs = await db.aIJob.findMany({
    where:   { triggeredById: session.user.id, type },
    orderBy: { createdAt: "desc" },
    take:    20,
    select:  { id: true, type: true, status: true, priceCharged: true, createdAt: true, completedAt: true, errorMessage: true, outputData: true },
  });
  return NextResponse.json({ jobs });
}
