/**
 * GET /api/mastering/album/[id]
 *
 * Poll the status of an album mastering group.
 * Returns the group metadata + all linked job statuses.
 *
 * Auth: must be the album owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const group = await prisma.masteringAlbumGroup.findUnique({
      where: { id: params.id },
    });

    if (!group) {
      return NextResponse.json({ error: "Album group not found." }, { status: 404 });
    }
    if (group.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    const jobs = await prisma.masteringJob.findMany({
      where:   { albumGroupId: params.id },
      orderBy: { createdAt: "asc" },
      select: {
        id:              true,
        status:          true,
        inputFileUrl:    true,
        versions:        true,
        exports:         true,
        reportData:      true,
        previewUrl:      true,
        selectedVersion: true,
      },
    });

    return NextResponse.json({
      group: {
        id:               group.id,
        title:            group.title,
        artist:           group.artist,
        genre:            group.genre,
        mood:             group.mood,
        status:           group.status,
        completedTracks:  group.completedTracks,
        totalTracks:      group.totalTracks,
        sharedLufsTarget: group.sharedLufsTarget,
        trackOrder:       group.trackOrder,
      },
      tracks: jobs,
    });
  } catch (err) {
    console.error("GET /api/mastering/album/[id]:", err);
    return NextResponse.json({ error: "Failed to fetch album status." }, { status: 500 });
  }
}
