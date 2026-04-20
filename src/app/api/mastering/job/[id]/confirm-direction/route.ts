/**
 * POST /api/mastering/job/[id]/confirm-direction
 *
 * Called from the AI Direction Assistant step after analyze completes.
 * Artist chooses: Accept recommendation / Modify (custom text) / Skip (no direction).
 *
 * Body: { direction: string | null }
 *   - string  → apply this direction text
 *   - null    → skip, master with no direction
 *
 * Stores direction, fires master action, sets status → MASTERING.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { startMasteringAction } from "@/lib/mastering/engine";
import { getVersionTargets } from "@/lib/mastering/decisions";

export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;

    const job = await prisma.masteringJob.findUnique({
      where:  { id },
      select: {
        id:               true,
        status:           true,
        userId:           true,
        guestEmail:       true,
        inputFileUrl:     true,
        referenceTrackUrl: true,
        mixParameters:    true,
        masterParameters: true,
        genre:            true,
        mood:             true,
        platforms:        true,
        inputBalance:     true,
        vibeDirection:    true,
        platformTarget:   true,
        customDirection:  true,
        mixDirection:     true,
      },
    });

    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    // Access control
    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    if (!isOwner && !isGuest) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

    // Must be in AWAITING_DIRECTION state
    if (job.status !== "AWAITING_DIRECTION") {
      return NextResponse.json({ error: "Job is not awaiting direction." }, { status: 409 });
    }

    const body = await req.json() as { direction?: string | null };
    const textDirection = body.direction ?? null;

    // Build combined direction from dropdowns + text
    const VIBE_LABELS: Record<string, string> = {
      warm_full:           "warm and full tone with low shelf boost and gentle high roll-off",
      bright_crisp:        "bright and crisp sound with high shelf boost and clean limiting",
      punchy_loud:         "punchy and loud with mid presence boost and aggressive compression",
      lofi_vintage:        "lo-fi vintage feel with subtle saturation, rolled highs, and relaxed dynamics",
      natural_transparent: "natural and transparent — minimal processing, preserve original character",
    };
    const PLATFORM_LABELS: Record<string, string> = {
      spotify:     "Spotify-ready at -14 LUFS",
      apple_music: "Apple Music-ready at -16 LUFS with more dynamic range preserved",
      youtube:     "YouTube-ready at -14 LUFS, slightly brighter for video playback",
      club_dj:     "Club/DJ-ready at -8 to -10 LUFS, louder with punchy low end",
      radio:       "Radio-ready at -12 LUFS with controlled dynamics",
      tiktok:      "TikTok/Reels-ready at -14 LUFS, bright with strong high end",
    };
    const MIX_LABELS: Record<string, string> = {
      vocal_forward: "vocal forward — boost vocal presence and duck competing frequencies",
      bass_heavy:    "bass heavy — sub boost, tighten kick, side-chain compression",
      balanced_mix:  "balanced mix — even stem levels with gentle processing",
      drum_focused:  "drum focused — punch kicks and snares, tighten cymbals",
    };

    const parts: string[] = [];
    if (job.vibeDirection && VIBE_LABELS[job.vibeDirection]) parts.push(VIBE_LABELS[job.vibeDirection]);
    if (job.platformTarget && PLATFORM_LABELS[job.platformTarget]) parts.push(PLATFORM_LABELS[job.platformTarget]);
    if (job.mixDirection && MIX_LABELS[job.mixDirection]) parts.push(MIX_LABELS[job.mixDirection]);
    if (textDirection) parts.push(textDirection);
    if (job.customDirection) parts.push(job.customDirection);

    const combinedDirection = parts.length > 0 ? parts.join(". ") : null;

    // Store direction and set status to MASTERING
    const updatedMixParams = {
      ...(job.mixParameters as Record<string, unknown> ?? {}),
      naturalLanguagePrompt: combinedDirection,
    };

    await prisma.masteringJob.update({
      where: { id },
      data:  {
        status:        "MASTERING",
        directionUsed: combinedDirection,
        mixParameters: updatedMixParams as any,
      },
    });

    // Fire master action now that direction is confirmed
    const masterParams = job.masterParameters as Record<string, unknown> | null ?? {};
    const genre        = job.genre ?? "POP";
    const versionTargets = getVersionTargets(genre);
    const platforms      = (job.platforms as string[] | null) ?? ["spotify", "apple_music", "youtube", "wav_master"];

    // Resolve LUFS target from platform selection
    const PLATFORM_LUFS: Record<string, number> = {
      spotify:     -14,
      apple_music: -16,
      youtube:     -14,
      club_dj:     -9,
      radio:       -12,
      tiktok:      -14,
    };
    const targetLufs = job.platformTarget ? (PLATFORM_LUFS[job.platformTarget] ?? -14) : -14;

    await startMasteringAction("master", {
      audio_url:          job.inputFileUrl!,
      reference_url:      job.referenceTrackUrl ?? "",
      master_params_json: JSON.stringify({
        audioUrl:     job.inputFileUrl!,
        ...masterParams,
        versions:     versionTargets,
        referenceUrl: job.referenceTrackUrl ?? null,
        platforms,
        targetLufs,
        naturalLanguagePrompt: combinedDirection,
      }),
      job_id:        id,
      genre:         genre,
      input_balance: JSON.stringify(job.inputBalance ?? {}),
    }, "/api/mastering/webhook/replicate/master");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/mastering/job/${id}/confirm-direction:`, err);
    return NextResponse.json({ error: "Failed to confirm direction." }, { status: 500 });
  }
}
