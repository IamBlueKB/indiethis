/**
 * GET /api/mix-console/job/[id]/download
 *
 * Proxies the mixed audio file for download. Does not redirect — proxying
 * through this route keeps same-origin so the browser honors the
 * Content-Disposition header and saves the file instead of playing it.
 *
 * Query params:
 *   version      — "clean" | "polished" | "aggressive" | "mix"  (default: "mix")
 *   format       — mp3_320 | wav_16_44 | wav_24_44 | wav_24_48 | flac | aiff
 *   access_token — guest token from MixAccessToken (time-limited)
 *
 * Access control: session owner | guest email cookie | MixAccessToken.
 * File path resolution: stored *FilePath field → fresh Supabase signed URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { generateFreshSignedUrl } from "@/lib/mix-console/engine";

export const maxDuration = 300;

const FORMAT_MIME: Record<string, string> = {
  mp3_320:  "audio/mpeg",
  wav_16_44: "audio/wav",
  wav_24_44: "audio/wav",
  wav_24_48: "audio/wav",
  flac:     "audio/flac",
  aiff:     "audio/aiff",
};

const FORMAT_EXT: Record<string, string> = {
  mp3_320:  "mp3",
  wav_16_44: "wav",
  wav_24_44: "wav",
  wav_24_48: "wav",
  flac:     "flac",
  aiff:     "aiff",
};

const VALID_FORMATS  = Object.keys(FORMAT_MIME);
const VALID_VERSIONS = ["clean", "polished", "aggressive", "mix"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;

  const version    = (searchParams.get("version") ?? "mix").toLowerCase();
  const format     = searchParams.get("format") ?? "wav_24_44";
  const tokenParam = searchParams.get("access_token") ?? null;

  try {
    if (!VALID_VERSIONS.includes(version)) {
      return NextResponse.json(
        { error: `Version must be one of: ${VALID_VERSIONS.join(", ")}` },
        { status: 400 },
      );
    }
    if (!VALID_FORMATS.includes(format)) {
      return NextResponse.json(
        { error: `Format must be one of: ${VALID_FORMATS.join(", ")}` },
        { status: 400 },
      );
    }

    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;

    const job = await prisma.mixJob.findUnique({
      where:  { id },
      select: {
        id:                  true,
        status:              true,
        userId:              true,
        guestEmail:          true,
        cleanFilePath:       true,
        polishedFilePath:    true,
        aggressiveFilePath:  true,
        mixFilePath:         true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    if (job.status !== "COMPLETE") {
      return NextResponse.json({ error: "Job not complete yet." }, { status: 409 });
    }

    // Access control — session owner, guest email cookie, or access token
    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    let isAuthorized = !!(isOwner || isGuest);

    if (!isAuthorized && tokenParam) {
      const t = await prisma.mixAccessToken.findUnique({ where: { token: tokenParam } });
      if (t?.jobId === id && t.expiresAt > new Date()) isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    // Resolve stored file path for the requested version
    const pathMap: Record<string, string | null> = {
      clean:      job.cleanFilePath      ?? null,
      polished:   job.polishedFilePath   ?? null,
      aggressive: job.aggressiveFilePath ?? null,
      mix:        job.mixFilePath        ?? null,
    };
    const filePath = pathMap[version] ?? null;

    if (!filePath) {
      return NextResponse.json({ error: "File not available for this version." }, { status: 404 });
    }

    // Generate a fresh 1-hour signed URL from Supabase (stored URLs expire)
    const signedUrl = await generateFreshSignedUrl(filePath);
    if (!signedUrl) {
      console.error(`[mix-console/download] Failed to generate signed URL for ${filePath}`);
      return NextResponse.json({ error: "File not available." }, { status: 404 });
    }

    // Proxy the file — keeps same-origin so Content-Disposition is honored
    const fileRes = await fetch(signedUrl);
    if (!fileRes.ok) {
      console.error(`[mix-console/download] Upstream fetch failed ${fileRes.status} for ${signedUrl}`);
      return NextResponse.json({ error: "File fetch failed." }, { status: 502 });
    }

    const ext      = FORMAT_EXT[format] ?? "wav";
    const mime     = FORMAT_MIME[format] ?? "audio/wav";
    const filename = `mix_${version}_${format}.${ext}`;

    return new Response(fileRes.body, {
      status: 200,
      headers: {
        "Content-Type":        mime,
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Forward Content-Length if available so browser can show download progress
        ...(fileRes.headers.get("content-length")
          ? { "Content-Length": fileRes.headers.get("content-length")! }
          : {}),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(`GET /api/mix-console/job/${id}/download:`, err);
    return NextResponse.json({ error: "Download failed." }, { status: 500 });
  }
}
