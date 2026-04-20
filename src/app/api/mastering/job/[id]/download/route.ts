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
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, ""); // strip trailing slash
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("[download] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
    return null;
  }

  try {
    const endpoint = `${supabaseUrl}/storage/v1/object/sign/processed/${filePath}`;
    const res = await fetch(endpoint, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type":  "application/json",
        "apikey":        serviceKey,  // some Supabase versions require this header too
      },
      body: JSON.stringify({ expiresIn }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[download] Supabase sign failed ${res.status} for ${filePath}:`, errBody);
      return null;
    }

    const data = await res.json() as { signedURL?: string; error?: string };
    if (!data.signedURL) {
      console.error("[download] Supabase sign returned no signedURL:", data);
      return null;
    }
    // signedURL is a relative path like /object/sign/processed/...?token=...
    return `${supabaseUrl}/storage/v1${data.signedURL}`;
  } catch (err) {
    console.error("[download] generateSupabaseSignedUrl threw:", err);
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
    const vKey = targetVersion.toLowerCase();
    const effectiveFormat = format === "all" ? "wav_24_48" : format;

    let url: string | null = null;

    // PRIMARY: generate a fresh signed URL from the permanent stored file path.
    // Stored signed URLs in exports/versions expire (1h from mastering time).
    // File paths are permanent — always generate a fresh 1-hour signed URL.
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

    // FALLBACK A: exports JSON (stored during pipeline — may be expired)
    if (!url) {
      const exportsData = job.exports as Record<string, string> | null ?? {};
      const key = `${effectiveFormat}_${vKey}`;
      url = exportsData[key] ?? exportsData[effectiveFormat] ?? null;
    }

    // FALLBACK B: platform exports array
    if (!url) {
      const platformExports = Array.isArray(job.exports)
        ? (job.exports as { platform: string; url: string; format: string }[])
        : [];
      const masterExport = platformExports.find((e) => e.platform === "wav_master");
      url = masterExport?.url ?? null;
    }

    // FALLBACK C: versions field (Replicate delivery URLs — short-lived)
    if (!url) {
      if (Array.isArray(job.versions)) {
        const v = (job.versions as { name: string; url: string }[])
          .find((v) => v.name.toLowerCase() === vKey);
        url = v?.url ?? null;
      } else if (job.versions && typeof job.versions === "object") {
        url = (job.versions as Record<string, string>)[vKey] ?? null;
      }
    }

    if (!url) {
      return NextResponse.json({ error: "File not available yet." }, { status: 404 });
    }

    // Construct a clean filename
    const ext      = FORMAT_EXT[effectiveFormat] ?? "wav";
    const filename = `master_${targetVersion.toLowerCase()}_${id.slice(-6)}_indiethis.${ext}`;
    const mime     = FORMAT_MIME[effectiveFormat] ?? "audio/wav";

    // PROXY the file through this route instead of redirecting.
    // The <a download> attribute only works for same-origin URLs — if we redirect
    // to Supabase (cross-origin), the browser ignores `download` and plays the file.
    // By streaming through here we keep same-origin and force a file download.
    const fileRes = await fetch(url);
    if (!fileRes.ok) {
      console.error(`[download] Upstream fetch failed ${fileRes.status} for ${url}`);
      return NextResponse.json({ error: "File fetch failed." }, { status: 502 });
    }

    return new Response(fileRes.body, {
      status: 200,
      headers: {
        "Content-Type":        mime,
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Forward Content-Length if present so browser shows progress
        ...(fileRes.headers.get("content-length")
          ? { "Content-Length": fileRes.headers.get("content-length")! }
          : {}),
        // Don't cache — signed URLs are per-request
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(`GET /api/mastering/job/${id}/download:`, err);
    return NextResponse.json({ error: "Download failed." }, { status: 500 });
  }
}
