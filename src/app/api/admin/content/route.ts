/**
 * GET /api/admin/content
 *
 * Returns beats, tracks, and stream leases with their attached
 * license documents for the admin content review panel.
 *
 * Auth: any admin session.
 */

import { NextResponse }      from "next/server";
import { getAdminSession }   from "@/lib/admin-auth";
import { db }                from "@/lib/db";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const licenseDocSelect = {
    id:            true,
    title:         true,
    fileUrl:       true,
    fileType:      true,
    source:        true,
    notes:         true,
    createdAt:     true,
  } as const;

  const artistSelect = {
    id:    true,
    name:  true,
    email: true,
  } as const;

  const [beats, tracks, streamLeases] = await Promise.all([
    // Beats = Tracks that have a BeatLeaseSettings record
    db.track.findMany({
      where:   { beatLeaseSettings: { isNot: null } },
      select:  {
        id:        true,
        title:     true,
        createdAt: true,
        artist:    { select: artistSelect },
        licenseDocuments: { select: licenseDocSelect, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take:    200,
    }),
    // Tracks = Tracks without BeatLeaseSettings
    db.track.findMany({
      where:   { beatLeaseSettings: { is: null } },
      select:  {
        id:        true,
        title:     true,
        createdAt: true,
        artist:    { select: artistSelect },
        licenseDocuments: { select: licenseDocSelect, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take:    200,
    }),
    // Stream Leases
    db.streamLease.findMany({
      select: {
        id:            true,
        trackTitle:    true,
        createdAt:     true,
        duplicateFlag: true,
        duplicateFlagNote: true,
        isActive:      true,
        artist:        { select: artistSelect },
        licenseDocuments: { select: licenseDocSelect, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take:    200,
    }),
  ]);

  return NextResponse.json({ beats, tracks, streamLeases });
}
