/**
 * GET /api/mastering/job/[id]/status
 *
 * Polls job status. Frontend polls every 3 seconds during processing.
 * Returns full job data once COMPLETE.
 * Accessible by: job owner (userId match) OR guest with matching email cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;

    const job = await prisma.masteringJob.findUnique({
      where: { id },
      select: {
        id:                   true,
        status:               true,
        mode:                 true,
        tier:                 true,
        genre:                true,
        mood:                 true,
        versions:             true,
        exports:              true,
        reportData:           true,
        previewUrl:           true,
        previewExpiresAt:     true,
        selectedVersion:      true,
        revisionUsed:         true,
        albumGroupId:         true,
        createdAt:            true,
        userId:               true,
        guestEmail:           true,
        analysisData:         true,
        inputFileUrl:         true,
        // Preview player fields
        inputLufs:            true,
        referenceTrackUrl:    true,
        referenceFileName:    true,
        previewWaveform:      true,
        versionWaveforms:     true,
        versionStats:         true,
        originalPreviewPath:  true,
        previewCleanPath:     true,
        previewWarmPath:      true,
        previewPunchPath:     true,
        previewLoudPath:      true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // Access control: owner or matching guest
    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    if (!isOwner && !isGuest) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    return NextResponse.json(job);
  } catch (err) {
    console.error(`GET /api/mastering/job/${id}/status:`, err);
    return NextResponse.json({ error: "Failed to fetch job status." }, { status: 500 });
  }
}
