/**
 * POST /api/mastering/job/[id]/confirm-direction
 *
 * Called from the AI Direction Assistant step after analyze completes.
 * Artist chooses: Accept recommendation / Modify (custom text) / Skip (no direction).
 *
 * Body: { direction: string | null }
 *   - string  → apply this direction text
 *   - null    → skip, master with no direction
 *
 * Stores direction, fires master action, sets status → MASTERING.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { startMasteringAction } from "@/lib/mastering/engine";
import { getVersionTargets } from "@/lib/mastering/decisions";

export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;

    const job = await prisma.masteringJob.findUnique({
      where:  { id },
      select: {
        id:               true,
        status:           true,
        userId:           true,
        guestEmail:       true,
        inputFileUrl:     true,
        referenceTrackUrl: true,
        mixParameters:    true,
        masterParameters: true,
        genre:            true,
        mood:             true,
        platforms:        true,
        inputBalance:     true,
      },
    });

    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    // Access control
    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    if (!isOwner && !isGuest) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

    // Must be in AWAITING_DIRECTION state
    if (job.status !== "AWAITING_DIRECTION") {
      return NextResponse.json({ error: "Job is not awaiting direction." }, { status: 409 });
    }

    const body = await req.json() as { direction?: string | null };
    const direction = body.direction ?? null;

    // Store direction and set status to MASTERING
    const updatedMixParams = {
      ...(job.mixParameters as Record<string, unknown> ?? {}),
      naturalLanguagePrompt: direction,
    };

    await prisma.masteringJob.update({
      where: { id },
      data:  {
        status:        "MASTERING",
        directionUsed: direction,
        mixParameters: updatedMixParams as any,
      },
    });

    // Fire master action now that direction is confirmed
    const masterParams = job.masterParameters as Record<string, unknown> | null ?? {};
    const genre        = job.genre ?? "POP";
    const versionTargets = getVersionTargets(genre);
    const platforms      = (job.platforms as string[] | null) ?? ["spotify", "apple_music", "youtube", "wav_master"];

    await startMasteringAction("master", {
      audio_url:          job.inputFileUrl!,
      reference_url:      job.referenceTrackUrl ?? "",
      master_params_json: JSON.stringify({
        audioUrl:     job.inputFileUrl!,
        ...masterParams,
        versions:     versionTargets,
        referenceUrl: job.referenceTrackUrl ?? null,
        platforms,
      }),
      job_id:        id,
      genre:         genre,
      input_balance: JSON.stringify(job.inputBalance ?? {}),
    }, "/api/mastering/webhook/replicate/master");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/mastering/job/${id}/confirm-direction:`, err);
    return NextResponse.json({ error: "Failed to confirm direction." }, { status: 500 });
  }
}
