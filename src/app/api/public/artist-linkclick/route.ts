/**
 * POST /api/public/artist-linkclick
 * Body: { artistSlug: string, platform: string, trackId?: string }
 *
 * Records a streaming link click (Spotify, Apple Music, YouTube, etc.).
 * Fire-and-forget; no auth required. No dedup — every click is counted.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ALLOWED_PLATFORMS = new Set([
  "spotify", "apple", "youtube", "soundcloud", "tidal", "amazon",
  "deezer", "tiktok", "instagram",
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const { artistSlug, platform, trackId } = body ?? {};

    if (!artistSlug || !platform) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    // Normalise platform key and guard against arbitrary strings
    const normalised = String(platform).toLowerCase().slice(0, 32);
    if (!ALLOWED_PLATFORMS.has(normalised)) {
      return NextResponse.json({ ok: true, skipped: "unknown_platform" });
    }

    const artist = await db.user.findUnique({
      where:  { artistSlug },
      select: { id: true },
    });
    if (!artist) return NextResponse.json({ ok: true, skipped: "not_found" });

    await db.linkClick.create({
      data: {
        artistId: artist.id,
        platform: normalised,
        trackId:  trackId ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[artist-linkclick]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
