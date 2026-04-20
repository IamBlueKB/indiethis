/**
 * GET /api/mastering/job/[id]/download
 *
 * Returns a redirect to the appropriate master file URL.
 *
 * Query params:
 *   format       — mp3_320 | wav_16_44 | wav_24_44 | wav_24_48 | flac_24_44 | aiff_24_44 | all
 *   version      — Clean | Warm | Punch | Loud (optional, defaults to selectedVersion)
 *   access_token — guest token from MasteringAccessToken (7-day expiry)
 *
 * All formats are derived from the master WAV 24-bit 48kHz via FFmpeg in the
 * job pipeline. The wav_24_48 URL is the source file; other format URLs are
 * stored in the job's `exports` JSON alongside the platform exports.
 *
 * Accessible by: job owner | guest with matching email cookie | guest access token
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

/** Generate a fresh Supabase signed URL via REST API (no SDK needed) */
async function generateSupabaseSignedUrl(filePath: string, expiresIn = 3600): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/processed/${filePath}`,
      {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({ expiresIn }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { signedURL?: string };
    return data.signedURL ? `${supabaseUrl}/storage/v1${data.signedURL}` : null;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const format      = searchParams.get("format") ?? "wav_24_48";
  const version     = searchParams.get("version") ?? null;
  const accessToken = searchParams.get("access_token") ?? null;

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
        cleanFilePath:   true,
        warmFilePath:    true,
        punchFilePath:   true,
        loudFilePath:    true,
      },
    });

    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    if (job.status !== "COMPLETE") return NextResponse.json({ error: "Job not complete." }, { status: 409 });

    // Access control — owner, email cookie, or access token
    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    let tokenValid = false;
    if (accessToken) {
      const t = await prisma.masteringAccessToken.findUnique({ where: { token: accessToken } });
      if (t && t.jobId === id && t.expiresAt > new Date()) tokenValid = true;
    }
    if (!isOwner && !isGuest && !tokenValid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    // Resolve version name
    const targetVersion = version ?? job.selectedVersion ?? "Warm";

    // Pull download URL from exports JSON
    const exportsData = job.exports as Record<string, string> | null ?? {};
    const effectiveFormat = format === "all" ? "wav_24_48" : format;
    const key = `${effectiveFormat}_${targetVersion.toLowerCase()}`;
    let url: string | null = exportsData[key] ?? exportsData[effectiveFormat] ?? null;

    // Fallback: platform exports array
    if (!url) {
      const platformExports = Array.isArray(job.exports)
        ? (job.exports as { platform: string; url: string; format: string }[])
        : [];
      const masterExport = platformExports.find((e) => e.platform === "wav_master");
      url = masterExport?.url ?? null;
    }

    // Fallback: pull directly from versions field (signed URL from Replicate)
    if (!url) {
      const vKey = targetVersion.toLowerCase();
      if (Array.isArray(job.versions)) {
        const v = (job.versions as { name: string; url: string }[])
          .find((v) => v.name.toLowerCase() === vKey);
        url = v?.url ?? null;
      } else if (job.versions && typeof job.versions === "object") {
        url = (job.versions as Record<string, string>)[vKey] ?? null;
      }
    }

    // Fallback: generate fresh signed URL from stored file path (never expires)
    if (!url) {
      const vKey = targetVersion.toLowerCase();
      const pathMap: Record<string, string | null> = {
        clean: job.cleanFilePath ?? null,
        warm:  job.warmFilePath  ?? null,
        punch: job.punchFilePath ?? null,
        loud:  job.loudFilePath  ?? null,
      };
      const storedPath = pathMap[vKey] ?? null;
      if (storedPath) {
        url = await generateSupabaseSignedUrl(storedPath, 3600);
      }
    }

    if (!url) {
      return NextResponse.json({ error: "File not available yet." }, { status: 404 });
    }

    // Construct a clean filename
    const ext      = FORMAT_EXT[effectiveFormat] ?? "wav";
    const filename = `master_${targetVersion.toLowerCase()}_${id.slice(-6)}_indiethis.${ext}`;

    // Redirect to the pre-signed URL with content-disposition hint
    const redirect = new URL(url);
    redirect.searchParams.set("response-content-disposition", `attachment; filename="${filename}"`);
    redirect.searchParams.set("response-content-type", FORMAT_MIME[effectiveFormat] ?? "audio/wav");

    return NextResponse.redirect(redirect.toString(), { status: 302 });
  } catch (err) {
    console.error(`GET /api/mastering/job/${id}/download:`, err);
    return NextResponse.json({ error: "Download failed." }, { status: 500 });
  }
}
