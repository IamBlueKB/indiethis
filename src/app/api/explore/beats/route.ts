import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/explore/beats
 * "Hot Beats" — beat marketplace tracks ranked by quality score
 * (which incorporates license purchases + crate adds).
 * Cold start: if < 5 results with quality score, falls back to recency.
 */
export async function GET() {
  // Primary: qualityScore-ranked beats
  const beats = await db.track.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { beatLeaseSettings: { isNot: null } },
        { streamLeases:      { some: {} } },
      ],
      qualityScore: { gt: 0 },
    },
    select: {
      id: true, title: true, coverArtUrl: true, fileUrl: true,
      bpm: true, musicalKey: true, price: true, genre: true,
      qualityScore: true,
      artist: {
        select: {
          id: true, name: true, photo: true, artistSlug: true,
          artistSite: { select: { isPublished: true } },
        },
      },
      beatLeaseSettings: {
        select: { streamLeaseEnabled: true, maxStreamLeases: true },
      },
      _count: {
        select: { beatLicenses: true, streamLeases: true },
      },
    },
    orderBy: { qualityScore: "desc" },
    take:    20,
  });

  if (beats.length >= 5) {
    return NextResponse.json({ beats, source: "quality" });
  }

  // Cold start fallback: all beats ordered by license count then recency
  const fallback = await db.track.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { beatLeaseSettings: { isNot: null } },
        { streamLeases:      { some: {} } },
      ],
    },
    select: {
      id: true, title: true, coverArtUrl: true, fileUrl: true,
      bpm: true, musicalKey: true, price: true, genre: true,
      qualityScore: true,
      artist: {
        select: {
          id: true, name: true, photo: true, artistSlug: true,
          artistSite: { select: { isPublished: true } },
        },
      },
      beatLeaseSettings: {
        select: { streamLeaseEnabled: true, maxStreamLeases: true },
      },
      _count: {
        select: { beatLicenses: true, streamLeases: true },
      },
    },
    orderBy: [{ beatLicenses: { _count: "desc" } }, { createdAt: "desc" }],
    take:    20,
  });

  return NextResponse.json({ beats: fallback, source: "cold_start" });
}
