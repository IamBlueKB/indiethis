/**
 * PATCH /api/dashboard/ai/cover-art/[id]/select
 *
 * Store the artist's selected variation URL.
 * Also optionally sets the image as the track's coverArtUrl ("Set as Track Cover").
 *
 * Body: { selectedUrl: string; setAsTrackCover?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body   = await req.json() as {
    selectedUrl:      string;
    setAsTrackCover?: boolean;
    refinementRound?: number; // if selecting from a refinement round
    round?:           number;
  };

  if (!body.selectedUrl) {
    return NextResponse.json({ error: "selectedUrl required" }, { status: 400 });
  }

  const job = await db.coverArtJob.findUnique({
    where:  { id },
    select: {
      id:               true,
      userId:           true,
      trackId:          true,
      refinementHistory:true,
      refinementRound:  true,
    },
  });

  if (!job)                              return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.userId !== session.user.id)    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // If selecting from a refinement round, update that round's selectedUrl in history
  if (body.round !== undefined) {
    type HistEntry = { round: number; instruction: string; prompt: string; urls: string[]; selectedUrl: string | null };
    const history: HistEntry[] = Array.isArray(job.refinementHistory)
      ? (job.refinementHistory as HistEntry[])
      : [];

    const updated = history.map(h =>
      h.round === body.round ? { ...h, selectedUrl: body.selectedUrl } : h
    );

    await db.coverArtJob.update({
      where: { id },
      data:  { selectedUrl: body.selectedUrl, refinementHistory: updated },
    });
  } else {
    await db.coverArtJob.update({
      where: { id },
      data:  { selectedUrl: body.selectedUrl },
    });
  }

  // Optionally set as track cover art
  if (body.setAsTrackCover && job.trackId) {
    await db.track.update({
      where: { id: job.trackId },
      data:  { coverArtUrl: body.selectedUrl },
    }).catch(() => {}); // Non-fatal — track may not exist
  }

  return NextResponse.json({ ok: true, selectedUrl: body.selectedUrl });
}
