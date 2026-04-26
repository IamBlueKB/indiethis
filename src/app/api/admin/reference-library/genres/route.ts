/**
 * GET /api/admin/reference-library/genres
 * Returns genre stats for the admin Reference Library table.
 * PLATFORM_ADMIN only.
 */

import { NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { assertReferenceAdmin } from "@/lib/reference-library/auth";

export async function GET() {
  const admin = await assertReferenceAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Per-genre row counts split by source-quality bucket.
  const profiles = await prisma.referenceProfile.findMany({
    select: {
      genre: true, source: true, sourceQuality: true, qualityGatePassed: true,
      profileData: true, separationConfidence: true, createdAt: true,
    },
  });

  const targets = await prisma.genreTarget.findMany();
  const targetByGenre = new Map(targets.map(t => [t.genre, t]));

  const HIGH = new Set(["spotify"]);
  const STANDARD = new Set(["youtube", "soundcloud", "other"]);
  const LOSSLESS = new Set(["lossless", "apple_music", "tidal", "amazon_hd", "deezer"]);

  const groups = new Map<string, {
    genre: string; tracks: number; lossless: number; high: number; standard: number;
    lastUpdated: Date | null; avgLufs: number | null; status: "READY" | "BUILDING" | "EMPTY";
    commercialCount: number; userRefCount: number; userOutcomeCount: number;
  }>();

  for (const p of profiles) {
    const g = p.genre;
    if (!groups.has(g)) {
      groups.set(g, {
        genre: g, tracks: 0, lossless: 0, high: 0, standard: 0,
        lastUpdated: null, avgLufs: null, status: "EMPTY",
        commercialCount: 0, userRefCount: 0, userOutcomeCount: 0,
      });
    }
    const row = groups.get(g)!;
    row.tracks++;
    const sq = (p.sourceQuality ?? "other").toLowerCase();
    if      (LOSSLESS.has(sq)) row.lossless++;
    else if (HIGH.has(sq))     row.high++;
    else if (STANDARD.has(sq)) row.standard++;
    if (!row.lastUpdated || p.createdAt > row.lastUpdated) row.lastUpdated = p.createdAt;
    if      (p.source === "commercial")       row.commercialCount++;
    else if (p.source === "user_reference")   row.userRefCount++;
    else if (p.source === "user_mix_outcome") row.userOutcomeCount++;
  }

  // Compute avg LUFS + status
  for (const row of groups.values()) {
    const t = targetByGenre.get(row.genre);
    const lufs = (t?.targetData as any)?.mix_lufs?.mean;
    if (typeof lufs === "number") row.avgLufs = Math.round(lufs * 10) / 10;
    row.status = row.tracks >= 20 ? "READY" : row.tracks > 0 ? "BUILDING" : "EMPTY";
  }

  return NextResponse.json({
    genres: [...groups.values()].sort((a, b) => b.tracks - a.tracks),
  });
}
