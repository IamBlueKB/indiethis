/**
 * POST /api/mix-console/job/[id]/revise
 *
 * Premium/Pro only. Artist submits revision feedback after a COMPLETE mix.
 * Claude adjusts the mix parameters based on feedback and re-fires the engine.
 *
 * Body: { feedback: string }
 *
 * Enforces revision limits per tier:
 *   STANDARD → 0  (blocked entirely)
 *   PREMIUM  → 2
 *   PRO      → 3
 *
 * Revisions increment revisionCount and append to revisionHistory.
 * Status transitions: COMPLETE → REVISING → (webhook) → COMPLETE
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { startMixAction } from "@/lib/mix-console/engine";
import { reviseParameters } from "@/lib/mix-console/decisions";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;
    const body       = await req.json() as { feedback: string };

    if (!body.feedback?.trim()) {
      return NextResponse.json({ error: "Feedback is required." }, { status: 400 });
    }
    if (body.feedback.length > 1000) {
      return NextResponse.json({ error: "Feedback must be under 1000 characters." }, { status: 400 });
    }

    const job = await prisma.mixJob.findUnique({
      where:  { id },
      select: {
        id:              true,
        status:          true,
        userId:          true,
        guestEmail:      true,
        tier:            true,
        genre:           true,
        revisionCount:   true,
        maxRevisions:    true,
        mixParameters:   true,
        analysisData:    true,
        inputFiles:      true,
        revisionHistory: true,
        pitchCorrection: true,
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

    // Must be complete before requesting a revision
    if (job.status !== "COMPLETE") {
      return NextResponse.json(
        { error: "Job must be complete before requesting a revision." },
        { status: 409 },
      );
    }

    // Revision quota check
    if (job.revisionCount >= job.maxRevisions) {
      return NextResponse.json({ error: "No revisions remaining for this job." }, { status: 403 });
    }

    // Adjust mix parameters via Claude based on feedback
    const revised = await reviseParameters({
      previousParams: job.mixParameters as any,
      feedback:       body.feedback.trim(),
      analysis:       job.analysisData as any,
      genre:          job.genre ?? "",
    });

    // Build revision history entry
    const prevHistory = Array.isArray(job.revisionHistory)
      ? (job.revisionHistory as object[])
      : [];
    const historyEntry = {
      feedback:           body.feedback.trim(),
      parametersApplied:  revised,
      timestamp:          new Date().toISOString(),
    };

    // Update job: REVISING, incremented count, updated params, appended history
    await prisma.mixJob.update({
      where: { id },
      data:  {
        status:          "REVISING",
        mixParameters:   revised as any,
        revisionCount:   { increment: 1 },
        revisionHistory: [...prevHistory, historyEntry] as any,
      },
    });

    // Rebuild stems_urls dict from inputFiles (same as confirm-direction)
    const inputFiles = (job.inputFiles ?? []) as { url: string; label: string }[];
    const stemsUrlsObj: Record<string, string> = {};
    for (const f of inputFiles) {
      stemsUrlsObj[f.label] = f.url;
    }

    // Merge revised Claude params with stems + genre + job settings + analysis data
    const analysisData = (job.analysisData ?? {}) as Record<string, unknown>;
    const fullMixParams = {
      ...revised,
      stems_urls:      stemsUrlsObj,
      genre:           job.genre ?? "HIP_HOP",
      pitchCorrection: job.pitchCorrection ?? "OFF",
      roomReverb:      (analysisData.room_reverb as number) ?? 0,
      bpm:             (analysisData.bpm         as number) ?? 120,
    };

    // Fire revise-mix action on Replicate
    await startMixAction(
      "revise-mix",
      {
        job_id:          id,
        mix_params_json: JSON.stringify(fullMixParams),
      },
      "/api/mix-console/webhook/replicate/revise",
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/mix-console/job/${id}/revise:`, err);
    return NextResponse.json({ error: "Failed to start revision." }, { status: 500 });
  }
}
