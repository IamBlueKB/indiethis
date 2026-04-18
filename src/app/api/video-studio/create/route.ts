/**
 * POST /api/video-studio/create
 *
 * Creates a MusicVideo record and determines payment path.
 *
 * Body:
 *   audioUrl:       string   - UploadThing URL or Track.fileUrl
 *   trackTitle:     string
 *   trackDuration:  number   - seconds
 *   trackId?:       string   - IndieThis Track ID (subscribers only)
 *   mode:           QUICK | DIRECTOR
 *   videoLength:    SHORT | STANDARD | EXTENDED
 *   style:          string   - VideoStyle.name
 *   aspectRatio:    16:9 | 9:16 | 1:1
 *   guestEmail?:    string   - for non-subscribers
 *
 * Returns:
 *   { id, requiresPayment, amount }
 *   - requiresPayment=false → generation starts immediately (subscriber with included credit)
 *   - requiresPayment=true  → call /api/video-studio/[id]/checkout to pay
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { VIDEO_TIER_PRICES, SUBSCRIBER_INCLUDED_TIER, type VideoTier } from "@/lib/video-studio/model-router";

// Which tiers get a free monthly video, and which VideoTier it maps to
// PUSH → DIRECTOR_60, REIGN → DIRECTOR_120 (per spec)
// Launch → no included video

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId  = session?.user?.id ?? null;

    const body = await req.json() as {
      audioUrl:          string;
      trackTitle:        string;
      trackDuration:     number;
      trackId?:          string;
      mode:              string;
      videoTier?:        VideoTier;  // new tier system
      videoLength?:      string;     // legacy — mapped to videoTier if videoTier absent
      style:             string;
      aspectRatio:       string;
      guestEmail?:       string;
      characterRefs?:    string[];
      referenceImageUrl?: string;
      imageSource?:       string;
    };

    const {
      audioUrl, trackTitle, trackDuration, trackId,
      mode, style, aspectRatio, guestEmail,
      characterRefs, referenceImageUrl, imageSource,
    } = body;

    // Resolve videoTier — prefer explicit videoTier, fall back to mapping legacy videoLength
    const videoTier: VideoTier = body.videoTier
      ?? (mode === "DIRECTOR" ? "DIRECTOR_60" : "QUICK_60");
    // Keep videoLength in DB for backwards compat
    const videoLength = body.videoLength ?? videoTier;

    if (!audioUrl || !trackTitle || !trackDuration) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ── Determine billing ────────────────────────────────────────────────────
    let amount = VIDEO_TIER_PRICES[videoTier] ?? 3999;
    let isFree = false;

    if (userId) {
      const user = await db.user.findUnique({
        where:  { id: userId },
        select: {
          videoStudioCreditUsedAt: true,
          subscription: { select: { tier: true } },
        },
      });

      const subTier = user?.subscription?.tier ?? null;
      const includedTier = subTier ? SUBSCRIBER_INCLUDED_TIER[subTier] : undefined;

      if (includedTier) {
        // Check if credit was used this calendar month
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);

        const creditUsedAt = user?.videoStudioCreditUsedAt;
        const creditAvailable = !creditUsedAt || creditUsedAt < monthStart;

        // Credit covers the included tier exactly — not upgrades
        if (creditAvailable && videoTier === includedTier) {
          isFree = true;
          amount = 0;
        }
      }
    }

    // ── Mark credit used (if applicable) ────────────────────────────────────
    if (isFree && userId) {
      await db.user.update({
        where: { id: userId },
        data:  { videoStudioCreditUsedAt: new Date() },
      });
    }

    // ── Create record ────────────────────────────────────────────────────────
    const video = await db.musicVideo.create({
      data: {
        userId:            userId ?? undefined,
        guestEmail:        guestEmail ?? undefined,
        trackId:           trackId ?? undefined,
        trackTitle,
        trackDuration:     Math.round(trackDuration),
        audioUrl,
        mode,
        videoLength,
        style,
        aspectRatio,
        status:            "PENDING",
        amount,
        progress:          0,
        characterRefs:     characterRefs && characterRefs.length > 0 ? characterRefs : undefined,
        referenceImageUrl: referenceImageUrl ?? undefined,
        imageSource:       imageSource ?? undefined,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";

    // ── Director Mode: route analysis through isolated trigger (has ML stack bundled) ──
    if (mode === "DIRECTOR") {
      // Save track to library if logged in and not already linked to a Track record
      if (userId && !trackId) {
        void db.track.create({
          data: {
            artistId:   userId,
            title:      trackTitle,
            fileUrl:    audioUrl,
            status:     "DRAFT",
          },
        }).then((track) => {
          // Link the MusicVideo to the new Track and fire audio analysis
          void db.musicVideo.update({
            where: { id: video.id },
            data:  { trackId: track.id },
          }).catch(() => {});
          void fetch(`${baseUrl}/api/internal/trigger/audio-features`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", authorization: `Bearer ${process.env.CRON_SECRET}` },
            body:    JSON.stringify({ trackId: track.id, audioUrl }),
          }).catch(() => {});
        }).catch(() => {});
      }

      // Route song analysis through video trigger (node-web-audio-api + essentia bundled there)
      void fetch(`${baseUrl}/api/internal/trigger/video`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${process.env.CRON_SECRET}` },
        body:    JSON.stringify({ musicVideoId: video.id, analysisOnly: true }),
      }).catch(err => console.error("[video-studio/create] director trigger failed:", err));

      return NextResponse.json({ id: video.id, requiresPayment: false, amount: 0 });
    }

    // ── Quick Mode: Start immediately if free ─────────────────────────────────
    if (isFree) {
      void fetch(`${baseUrl}/api/internal/trigger/video`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${process.env.CRON_SECRET}` },
        body:    JSON.stringify({ musicVideoId: video.id }),
      }).catch(err => console.error("[video-studio/create] generation trigger failed:", err));
    }

    return NextResponse.json({
      id:              video.id,
      requiresPayment: !isFree,
      amount,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[video-studio/create]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
