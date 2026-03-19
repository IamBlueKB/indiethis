/**
 * POST /api/public/artist-trackplay
 * Body: { trackId: string, artistSlug: string }
 *
 * Records a track play event. Fire-and-forget from client; no auth required.
 * Deduplicates: same IP + same track within 10 minutes = skip (prevents loop inflation).
 * Also increments the Track.plays counter.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { db } from "@/lib/db";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + (process.env.NEXTAUTH_SECRET ?? "")).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const { trackId, artistSlug } = body ?? {};

    if (!trackId || !artistSlug) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    // Resolve artist
    const artist = await db.user.findUnique({
      where:  { artistSlug },
      select: { id: true },
    });
    if (!artist) return NextResponse.json({ ok: true, skipped: "not_found" });

    // Verify track belongs to artist
    const track = await db.track.findFirst({
      where:  { id: trackId, artistId: artist.id },
      select: { id: true },
    });
    if (!track) return NextResponse.json({ ok: true, skipped: "track_not_found" });

    // Hash IP
    const headersList = await headers();
    const forwarded   = headersList.get("x-forwarded-for");
    const ip          = forwarded
      ? forwarded.split(",")[0].trim()
      : (headersList.get("x-real-ip") ?? "unknown");
    const ipHash = hashIp(ip);

    // 10-minute dedup per track per IP
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const recent = await db.trackPlay.findFirst({
      where:  { trackId, ipHash, playedAt: { gte: cutoff } },
      select: { id: true },
    });
    if (recent) return NextResponse.json({ ok: true, skipped: "duplicate" });

    // Record play + increment counter (parallel)
    await Promise.all([
      db.trackPlay.create({ data: { trackId, artistId: artist.id, ipHash } }),
      db.track.update({ where: { id: trackId }, data: { plays: { increment: 1 } } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[artist-trackplay]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
