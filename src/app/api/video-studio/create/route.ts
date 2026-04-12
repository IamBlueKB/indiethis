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
import { getVideoPrice }         from "@/lib/video-studio/model-router";
import { startGeneration, startAnalysisOnly } from "@/lib/video-studio/generate";

// Included credits per tier per month
const INCLUDED_VIDEOS: Record<string, number> = {
  LAUNCH: 1,
  PUSH:   2,
  REIGN:  4,
};

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
      videoLength:       string;
      style:             string;
      aspectRatio:       string;
      guestEmail?:       string;
      characterRefs?:    string[]; // pre-seeded from cover art studio or Director Mode uploads
      referenceImageUrl?: string;  // primary image from Image Source wizard step
      imageSource?:       string;  // UPLOAD | AVATAR | AI_GENERATED
    };

    const {
      audioUrl, trackTitle, trackDuration, trackId,
      mode, videoLength, style, aspectRatio, guestEmail,
      characterRefs, referenceImageUrl, imageSource,
    } = body;

    if (!audioUrl || !trackTitle || !trackDuration) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ── Determine billing ────────────────────────────────────────────────────
    let tier: "GUEST" | "LAUNCH" | "PUSH" | "REIGN" = "GUEST";
    let amount     = 0;
    let isFree     = false;

    if (userId) {
      const sub = await db.subscription.findFirst({
        where:  { userId, status: "ACTIVE" },
        select: { tier: true },
      });
      if (sub?.tier && ["LAUNCH", "PUSH", "REIGN"].includes(sub.tier)) {
        tier = sub.tier as "LAUNCH" | "PUSH" | "REIGN";

        // Count videos used this calendar month
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);

        const usedThisMonth = await db.musicVideo.count({
          where: {
            userId,
            amount: 0,
            createdAt: { gte: monthStart },
          },
        });

        const included = INCLUDED_VIDEOS[tier] ?? 0;
        if (usedThisMonth < included) {
          isFree = true;
          amount = 0;
        }
      }
    }

    if (!isFree) {
      amount = getVideoPrice(tier, mode as "QUICK" | "DIRECTOR", videoLength as "SHORT" | "STANDARD" | "EXTENDED");
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

    // ── Director Mode: start analysis immediately (feeds Director chat) ──────
    if (mode === "DIRECTOR") {
      // Only analyze — don't generate yet (generation triggered after shot list approval)
      void startAnalysisOnly(video.id).catch(err =>
        console.error("[video-studio/create] director analysis error:", err)
      );
      return NextResponse.json({ id: video.id, requiresPayment: false, amount: 0 });
    }

    // ── Quick Mode: Start immediately if free ─────────────────────────────────
    if (isFree) {
      void startGeneration(video.id).catch(err =>
        console.error("[video-studio/create] generation error:", err)
      );
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
