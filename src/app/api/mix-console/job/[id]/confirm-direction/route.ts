/**
 * POST /api/mix-console/job/[id]/confirm-direction
 *
 * Called from the AI Direction Assistant step after analysis completes.
 * Artist chooses: accept recommendation / modify with custom text / skip (null).
 *
 * Body: { direction: string | null }
 *   - string  → store as directionUsed and fire mix
 *   - null    → skip direction, fire mix with no custom direction
 *
 * Job must be in AWAITING_DIRECTION status.
 * Fires mix-full action on Replicate and transitions status → MIXING.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { startMixAction } from "@/lib/mix-console/engine";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;

    const job = await prisma.mixJob.findUnique({
      where:  { id },
      select: {
        id:               true,
        status:           true,
        userId:           true,
        guestEmail:       true,
        tier:             true,
        mixParameters:    true,
        inputFiles:       true,
        genre:            true,
        analysisData:     true,
        pitchCorrection:  true,
        breathEditing:    true,
        fadeOut:          true,
        mixVibe:          true,
        reverbStyle:      true,
        delayStyle:       true,
        beatPolish:       true,
        referenceNotes:   true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // Access control
    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    if (!isOwner && !isGuest) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    // Must be awaiting direction
    if (job.status !== "AWAITING_DIRECTION") {
      return NextResponse.json({ error: "Job is not awaiting direction." }, { status: 409 });
    }

    const body = await req.json() as { direction?: string | null };
    const direction = body.direction ?? null;

    // Store direction on job and transition to MIXING
    await prisma.mixJob.update({
      where: { id },
      data:  {
        status:        "MIXING",
        directionUsed: direction,
      },
    });

    // Build stems_urls dict from inputFiles: { label: url, ... }
    const inputFiles = (job.inputFiles ?? []) as { url: string; label: string }[];
    const stemsUrlsObj: Record<string, string> = {};
    for (const f of inputFiles) {
      stemsUrlsObj[f.label] = f.url;
    }

    // Embed stems_urls + genre + all job settings + analysis data so Python has everything
    const analysisData = (job.analysisData as Record<string, unknown>) ?? {};
    const mixParams = {
      ...(job.mixParameters as Record<string, unknown> ?? {}),
      stems_urls:       stemsUrlsObj,
      tier:             job.tier         ?? "STANDARD",
      genre:            job.genre        ?? "HIP_HOP",
      pitchCorrection:  job.pitchCorrection ?? "OFF",
      breathEditing:    job.breathEditing   ?? "SUBTLE",
      fadeOut:          job.fadeOut         ?? "AUTO",
      mixVibe:          job.mixVibe         ?? "CLEAN",
      reverbStyle:      job.reverbStyle     ?? "ROOM",
      delayStyle:       job.delayStyle      ?? "STANDARD",
      beatPolish:       job.beatPolish      ?? false,
      referenceNotes:   job.referenceNotes  ?? null,
      roomReverb:       (analysisData.room_reverb as number) ?? 0,
      bpm:              (analysisData.bpm          as number) ?? 120,
      sections:         (analysisData.sections     as unknown[]) ?? [],
    };

    // Fire full mix action — Replicate posts result to /api/mix-console/webhook/replicate/mix
    await startMixAction(
      "mix-full",
      {
        job_id:          id,
        mix_params_json: JSON.stringify(mixParams),
      },
      "/api/mix-console/webhook/replicate/mix",
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/mix-console/job/${id}/confirm-direction:`, err);
    return NextResponse.json({ error: "Failed to confirm direction." }, { status: 500 });
  }
}
