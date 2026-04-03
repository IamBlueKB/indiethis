/**
 * POST /api/dashboard/ai/track-shield/scan
 * Triggers scanning for a paid TrackShieldScan.
 * Called after Stripe payment completes (?paid=1&scanId=X).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendTrackShieldCompleteEmail } from "@/lib/brevo/email";

export const maxDuration = 60;

interface AuddResult {
  title:        string;
  artist:       string;
  album:        string;
  release_date: string;
  timecode:     string;
  song_link:    string | null;
}

interface AuddResponse {
  status: string;
  result: AuddResult | null;
}

interface MatchEntry {
  platform:   string;
  url:        string | null;
  uploader:   string;
  confidence: number;
  foundAt:    string;
  title:      string;
  artist:     string;
  album:      string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { scanId?: string };
  if (!body.scanId) {
    return NextResponse.json({ error: "scanId is required" }, { status: 400 });
  }

  // Verify scan belongs to user
  const scan = await db.trackShieldScan.findFirst({
    where: { id: body.scanId, userId: session.user.id },
    include: {
      tracks: {
        include: { track: { select: { id: true, fileUrl: true, title: true } } },
      },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  if (scan.status === "SCANNING" || scan.status === "COMPLETED") {
    return NextResponse.json({ scan });
  }

  if (scan.status === "FAILED") {
    return NextResponse.json({ error: "Scan previously failed" }, { status: 400 });
  }

  // Mark as SCANNING
  await db.trackShieldScan.update({
    where: { id: scan.id },
    data: { status: "SCANNING" },
  });

  const apiToken = process.env.AUDD_API_KEY;

  // Scan each track
  for (const result of scan.tracks) {
    const track = result.track;
    let matches: MatchEntry[] = [];

    if (apiToken) {
      try {
        const auddRes = await fetch("https://api.audd.io/recognize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_token: apiToken,
            url:       track.fileUrl,
            return:    "apple_music,spotify",
          }),
        });
        const auddData = await auddRes.json() as AuddResponse;
        if (auddData.result) {
          matches = [{
            platform:   "Track Shield Database",
            url:        auddData.result.song_link ?? null,
            uploader:   auddData.result.artist,
            confidence: 95,
            foundAt:    new Date().toISOString(),
            title:      auddData.result.title,
            artist:     auddData.result.artist,
            album:      auddData.result.album,
          }];
        }
      } catch (err) {
        console.error(`[track-shield] AudD scan failed for track ${track.id}:`, err);
      }
    }

    await db.trackShieldResult.update({
      where: { id: result.id },
      data: {
        matches:    matches as unknown as import("@prisma/client").Prisma.InputJsonValue,
        matchCount: matches.length,
        scannedAt:  new Date(),
      },
    });
  }

  // Mark completed
  const completedScan = await db.trackShieldScan.update({
    where: { id: scan.id },
    data: { status: "COMPLETED", completedAt: new Date() },
    include: {
      tracks: {
        include: { track: { select: { id: true, title: true, coverArtUrl: true } } },
      },
    },
  });

  // Branded completion email (non-fatal)
  void (async () => {
    try {
      const user = await db.user.findUnique({
        where:  { id: session.user.id },
        select: { email: true, name: true, artistName: true, artistSlug: true },
      });
      if (!user?.email) return;
      const totalIssues = completedScan.tracks.reduce((sum, t) => sum + t.matchCount, 0);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
      await sendTrackShieldCompleteEmail({
        artistEmail: user.email,
        artistName:  user.artistName ?? user.name ?? "Artist",
        artistSlug:  user.artistSlug ?? undefined,
        trackTitle:  completedScan.tracks[0]?.track.title ?? "your track",
        issuesFound: totalIssues,
        reportUrl:   `${appUrl}/dashboard/ai/track-shield`,
      });
    } catch (emailErr) {
      console.error("[track-shield/scan] completion email failed:", emailErr);
    }
  })();

  return NextResponse.json({ scan: completedScan });
}
