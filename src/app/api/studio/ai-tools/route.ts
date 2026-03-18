/**
 * POST /api/studio/ai-tools
 *
 * Creates an AI job on behalf of a client, triggered by a studio admin.
 * If a contactId is supplied the studio's contact email is matched against
 * IndieThis ARTIST accounts — if found, artistId is set so the job appears
 * in that artist's dashboard automatically.
 *
 * GET /api/studio/ai-tools
 *
 * Returns the 50 most-recent AI jobs triggered by this studio.
 */

import { NextRequest, NextResponse }  from "next/server";
import { auth }                       from "@/lib/auth";
import { db }                         from "@/lib/db";
import { createAIJob }                from "@/lib/ai-jobs";
import { processAIJob }               from "@/lib/ai-job-processor";
import { AIJobType, AIJobTrigger }    from "@prisma/client";

// ─── Helper: resolve studio for the authenticated admin ────────────────────────

async function resolveStudio(userId: string) {
  return db.studio.findFirst({
    where:  { ownerId: userId },
    select: { id: true },
  });
}

// ─── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await resolveStudio(session.user.id);
  if (!studio) {
    return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Validate type ──────────────────────────────────────────────────────────
  const VALID_TYPES: AIJobType[] = [
    "VIDEO", "COVER_ART", "MASTERING", "LYRIC_VIDEO", "AR_REPORT", "PRESS_KIT",
  ];
  const type = body.type as AIJobType;
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  // ── inputData is passed as-is (validated on the client) ───────────────────
  const inputData = (body.inputData ?? {}) as Record<string, unknown>;

  // ── Resolve artistId from contactId (optional) ────────────────────────────
  let artistId: string | null = null;
  const contactId = typeof body.contactId === "string" ? body.contactId : null;

  if (contactId) {
    // Verify the contact belongs to this studio
    const contact = await db.contact.findFirst({
      where:  { id: contactId, studioId: studio.id },
      select: { email: true },
    });

    if (contact?.email) {
      const linkedUser = await db.user.findFirst({
        where:  { email: contact.email, role: "ARTIST" },
        select: { id: true },
      });
      if (linkedUser) {
        artistId = linkedUser.id;
      }
    }
  }

  // ── Create job ─────────────────────────────────────────────────────────────
  const result = await createAIJob({
    type,
    triggeredBy:   AIJobTrigger.STUDIO,
    triggeredById: session.user.id,
    studioId:      studio.id,
    artistId:      artistId ?? undefined,
    inputData,
    priceAlreadyCharged: body.priceAlreadyCharged === true,
    chargedAmount:
      typeof body.chargedAmount === "number" ? body.chargedAmount : undefined,
    stripePaymentId:
      typeof body.stripePaymentId === "string" ? body.stripePaymentId : undefined,
  });

  if (!result.success) {
    if (result.requiresPayment) {
      return NextResponse.json(
        {
          error:           result.error,
          requiresPayment: true,
          amount:          result.amount,
          amountDollars:   result.amount ? result.amount / 100 : undefined,
          tool:            type,
        },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { jobId } = result;

  // Fire async — client polls GET /api/ai-jobs/[id]
  void processAIJob(jobId).catch((err: unknown) => {
    console.error(`[studio/ai-tools] processAIJob ${jobId} threw:`, err);
  });

  return NextResponse.json(
    {
      success: true,
      jobId,
      type,
      status:  "QUEUED",
      message: "Job queued — poll GET /api/ai-jobs/" + jobId + " for status updates",
    },
    { status: 202 },
  );
}

// ─── GET handler — recent jobs for this studio ─────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await resolveStudio(session.user.id);
  if (!studio) {
    return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  }

  const jobs = await db.aIJob.findMany({
    where:   { studioId: studio.id },
    orderBy: { createdAt: "desc" },
    take:    50,
    select: {
      id:           true,
      type:         true,
      status:       true,
      priceCharged: true,
      createdAt:    true,
      completedAt:  true,
      errorMessage: true,
      outputData:   true,
      artistId:     true,
    },
  });

  // Enrich with artist name where artistId is set
  const artistIds = [...new Set(jobs.map(j => j.artistId).filter((id): id is string => !!id))];
  const artists = artistIds.length > 0
    ? await db.user.findMany({
        where:  { id: { in: artistIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const artistMap = new Map(artists.map(a => [a.id, a]));

  const enriched = jobs.map(j => ({
    ...j,
    artist: j.artistId ? (artistMap.get(j.artistId) ?? null) : null,
  }));

  return NextResponse.json({ jobs: enriched });
}
