/**
 * POST /api/dashboard/videos/youtube/connect
 *
 * Validates a YouTube channel URL/handle, resolves the UCxxxxxx channel ID via
 * the YouTube Data API, then saves it to the YouTubeSync record and triggers
 * an initial sync.
 *
 * Body: { channelInput: string }   e.g. "https://youtube.com/@ArtistName"
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveChannelId, syncYouTubeChannel } from "@/lib/youtube-sync";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelInput } = await req.json() as { channelInput?: string };
  if (!channelInput?.trim()) {
    return NextResponse.json({ error: "channelInput is required" }, { status: 400 });
  }

  let channel;
  try {
    channel = await resolveChannelId(channelInput.trim());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "YouTube API error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!channel) {
    return NextResponse.json({ error: "Channel not found. Check the URL or handle and try again." }, { status: 404 });
  }

  // Upsert YouTubeSync record
  await db.youTubeSync.upsert({
    where:  { userId: session.user.id },
    create: {
      userId:        session.user.id,
      channelId:     channel.channelId,
      channelUrl:    channelInput.trim(),
      channelName:   channel.title ?? null,
      channelAvatar: channel.thumbnailUrl ?? null,
      syncStatus:    "PENDING",
    },
    update: {
      channelId:     channel.channelId,
      channelUrl:    channelInput.trim(),
      channelName:   channel.title ?? null,
      channelAvatar: channel.thumbnailUrl ?? null,
      syncStatus:    "PENDING",
      nextSyncAt:    null,
    },
  });

  // Fire initial sync (non-blocking — errors logged but not propagated)
  let syncResult = { added: 0, updated: 0, total: 0 };
  try {
    syncResult = await syncYouTubeChannel(session.user.id);
  } catch (err) {
    console.error("[youtube/connect] initial sync failed:", err);
  }

  return NextResponse.json({ channel, syncResult });
}
