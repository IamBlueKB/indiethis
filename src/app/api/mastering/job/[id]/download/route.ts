/**
 * GET /api/mastering/job/[id]/download
 *
 * Returns a redirect to the appropriate master file URL.
 *
 * Query params:
 *   format  — mp3_320 | wav_16_44 | wav_24_44 | wav_24_48 | flac_24_44 | aiff_24_44 | all
 *   version — Clean | Warm | Punch | Loud (optional, defaults to selectedVersion)
 *
 * All formats are derived from the master WAV 24-bit 48kHz via FFmpeg in the
 * job pipeline. The wav_24_48 URL is the source file; other format URLs are
 * stored in the job's `exports` JSON alongside the platform exports.
 *
 * Accessible by: job owner OR guest with matching email cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

const FORMAT_MIME: Record<string, string> = {
  mp3_320:    "audio/mpeg",
  wav_16_44:  "audio/wav",
  wav_24_44:  "audio/wav",
  wav_24_48:  "audio/wav",
  flac_24_44: "audio/flac",
  aiff_24_44: "audio/aiff",
};

const FORMAT_EXT: Record<string, string> = {
  mp3_320:    "mp3",
  wav_16_44:  "wav",
  wav_24_44:  "wav",
  wav_24_48:  "wav",
  flac_24_44: "flac",
  aiff_24_44: "aiff",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const format  = searchParams.get("format") ?? "wav_24_48";
  const version = searchParams.get("version") ?? null;

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;

    const job = await prisma.masteringJob.findUnique({
      where:  { id },
      select: {
        id:              true,
        status:          true,
        userId:          true,
        guestEmail:      true,
        versions:        true,
        exports:         true,
        selectedVersion: true,
        trackTitle:      true,
      },
    });

    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    if (job.status !== "COMPLETE") return NextResponse.json({ error: "Job not complete." }, { status: 409 });

    // Access control
    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    if (!isOwner && !isGuest) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

    // Resolve version name
    const targetVersion = version ?? job.selectedVersion ?? "Warm";

    // Pull download URL from exports JSON — job pipeline stores format URLs there.
    // Key format: `${format}_${version.toLowerCase()}` e.g. "mp3_320_warm"
    const exportsData = job.exports as Record<string, string> | null ?? {};

    // "all" — redirect to a zip endpoint (not yet implemented, redirect to wav master)
    const effectiveFormat = format === "all" ? "wav_24_48" : format;
    const key = `${effectiveFormat}_${targetVersion.toLowerCase()}`;
    let url = exportsData[key] ?? exportsData[effectiveFormat] ?? null;

    // Fallback: find the wav_master platform export and redirect there
    if (!url) {
      const platformExports = Array.isArray(job.exports)
        ? (job.exports as { platform: string; url: string; format: string }[])
        : [];
      const masterExport = platformExports.find((e) => e.platform === "wav_master");
      url = masterExport?.url ?? null;
    }

    if (!url) {
      return NextResponse.json({ error: "File not available yet." }, { status: 404 });
    }

    // Construct a clean filename
    const title    = (job.trackTitle ?? "master").replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
    const ext      = FORMAT_EXT[effectiveFormat] ?? "wav";
    const filename = `${title}_${targetVersion.toLowerCase()}_indiethis.${ext}`;

    // Redirect to the S3/R2 pre-signed URL with a content-disposition hint
    const redirect = new URL(url);
    redirect.searchParams.set("response-content-disposition", `attachment; filename="${filename}"`);
    redirect.searchParams.set("response-content-type", FORMAT_MIME[effectiveFormat] ?? "audio/wav");

    return NextResponse.redirect(redirect.toString(), { status: 302 });
  } catch (err) {
    console.error(`GET /api/mastering/job/${id}/download:`, err);
    return NextResponse.json({ error: "Download failed." }, { status: 500 });
  }
}
