import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const revalidate = 3600;

/**
 * GET /api/explore/beats
 * Tracks that have beatLeaseSettings or beatLicenses — the beat marketplace.
 */
export async function GET() {
  const beats = await db.track.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { beatLeaseSettings: { isNot: null } },
        { streamLeases: { some: {} } },
      ],
    },
    select: {
      id: true,
      title: true,
      coverArtUrl: true,
      fileUrl: true,
      bpm: true,
      musicalKey: true,
      price: true,
      genre: true,
      artist: {
        select: { id: true, name: true, photo: true },
      },
      beatLeaseSettings: {
        select: { streamLeaseEnabled: true, maxStreamLeases: true },
      },
      _count: {
        select: { beatLicenses: true, streamLeases: true },
      },
    },
    orderBy: { plays: "desc" },
    take: 8,
  });

  return NextResponse.json({ beats });
}
