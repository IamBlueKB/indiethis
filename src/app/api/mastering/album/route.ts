/**
 * POST /api/mastering/album
 *
 * Creates a MasteringAlbumGroup and linked MasteringJob records (one per track).
 * All tracks are MASTER_ONLY — provide a stereo mix URL per track.
 *
 * Requires auth (subscribers only — album mastering is a premium workflow).
 *
 * Body:
 *   title:         string
 *   artist?:       string
 *   genre?:        string
 *   mood?:         "CLEAN" | "WARM" | "PUNCH" | "LOUD"
 *   naturalLanguagePrompt?: string
 *   referenceTrackUrl?:     string
 *   tier:          "STANDARD" | "PREMIUM" | "PRO"
 *   tracks: [
 *     { inputFileUrl: string; trackTitle?: string; stripePaymentId: string }
 *   ]
 *
 * Returns:
 *   { albumGroupId, jobIds }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { runAlbumMasteringPipeline } from "@/lib/mastering/pipeline";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json() as {
      title:                  string;
      artist?:                string;
      genre?:                 string;
      mood?:                  "CLEAN" | "WARM" | "PUNCH" | "LOUD";
      naturalLanguagePrompt?: string;
      referenceTrackUrl?:     string;
      tier:                   string;
      tracks: {
        inputFileUrl:     string;
        trackTitle?:      string;
        stripePaymentId:  string;
      }[];
    };

    const { title, artist, genre, mood, naturalLanguagePrompt, referenceTrackUrl, tier, tracks } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Album title is required." }, { status: 400 });
    }
    if (!tracks || tracks.length < 2) {
      return NextResponse.json({ error: "At least 2 tracks required for album mastering." }, { status: 400 });
    }
    if (tracks.length > 20) {
      return NextResponse.json({ error: "Maximum 20 tracks per album." }, { status: 400 });
    }

    // Verify all payments succeeded
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

    for (const track of tracks) {
      if (!track.stripePaymentId) {
        return NextResponse.json({ error: "All tracks require a confirmed payment." }, { status: 402 });
      }
      const pi = await stripe.paymentIntents.retrieve(track.stripePaymentId);
      if (pi.status !== "succeeded") {
        return NextResponse.json({ error: `Payment not confirmed for track: ${track.trackTitle ?? track.inputFileUrl}` }, { status: 402 });
      }
    }

    // Create album group
    const group = await prisma.masteringAlbumGroup.create({
      data: {
        userId:               session.user.id,
        title:                title.trim(),
        artist,
        genre,
        mood,
        naturalLanguagePrompt,
        referenceTrackUrl,
        totalTracks:          tracks.length,
        status:               "PENDING",
        paymentIds:           tracks.map((t) => ({ stripePaymentId: t.stripePaymentId })),
      },
    });

    // Create one MasteringJob per track linked to this album group
    const jobs = await Promise.all(
      tracks.map((track, i) =>
        prisma.masteringJob.create({
          data: {
            userId:          session.user!.id,
            albumGroupId:    group.id,
            mode:            "MASTER_ONLY",
            inputType:       "STEREO",
            inputFileUrl:    track.inputFileUrl,
            tier,
            mood,
            genre,
            platforms:       ["spotify", "apple_music", "youtube", "wav_master"],
            status:          "PENDING",
            stripePaymentId: track.stripePaymentId,
            amount:          0, // pre-verified above
          },
        })
      )
    );

    // Store track order on album group
    const trackOrder = jobs.map((j) => j.id);
    await prisma.masteringAlbumGroup.update({
      where: { id: group.id },
      data:  { trackOrder },
    });

    // Kick off pipeline in background (non-blocking)
    runAlbumMasteringPipeline(group.id).catch((err) => {
      console.error(`Album mastering pipeline failed for group ${group.id}:`, err);
    });

    return NextResponse.json({
      albumGroupId: group.id,
      jobIds:       trackOrder,
    });
  } catch (err) {
    console.error("POST /api/mastering/album:", err);
    return NextResponse.json({ error: "Failed to create album mastering job." }, { status: 500 });
  }
}
