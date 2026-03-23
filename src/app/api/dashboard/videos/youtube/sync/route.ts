/**
 * POST /api/dashboard/videos/youtube/sync
 *
 * Manually triggers a YouTube channel sync for the authenticated artist.
 * Enforces a 1-hour cooldown between manual syncs.
 *
 * Returns: { syncResult, nextAllowedAt }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncYouTubeChannel } from "@/lib/youtube-sync";

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ytSync = await db.youTubeSync.findUnique({ where: { userId: session.user.id } });

  if (!ytSync) {
    return NextResponse.json({ error: "No YouTube channel connected." }, { status: 400 });
  }

  // Cooldown check
  if (ytSync.lastSyncedAt) {
    const elapsed = Date.now() - ytSync.lastSyncedAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      const nextAllowedAt = new Date(ytSync.lastSyncedAt.getTime() + COOLDOWN_MS).toISOString();
      const minutesLeft   = Math.ceil((COOLDOWN_MS - elapsed) / 60_000);
      return NextResponse.json(
        { error: `Sync cooldown active. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`, nextAllowedAt },
        { status: 429 }
      );
    }
  }

  try {
    const syncResult = await syncYouTubeChannel(session.user.id);
    const nextAllowedAt = new Date(Date.now() + COOLDOWN_MS).toISOString();
    return NextResponse.json({ syncResult, nextAllowedAt });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
