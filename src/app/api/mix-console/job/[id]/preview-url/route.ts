/**
 * GET /api/mix-console/job/[id]/preview-url
 *
 * Returns a fresh 1-hour Supabase signed URL for streaming audio in the
 * results page. Audio elements can't send Authorization headers, so the
 * client requests this JSON endpoint and points <audio>.src at the URL.
 *
 * Query params:
 *   version       — clean | polished | aggressive | mix | original
 *   kind          — "preview" (default) | "full"
 *   access_token  — guest token from MixAccessToken (time-limited)
 *
 * Access control mirrors the download route: session owner | guest email
 * cookie | MixAccessToken.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                       from "@/lib/auth";
import { db as prisma }               from "@/lib/db";
import { generateFreshSignedUrl }     from "@/lib/mix-console/engine";

export const dynamic = "force-dynamic";

const VALID_VERSIONS = ["clean", "polished", "aggressive", "mix", "original"];
const VALID_KINDS    = ["preview", "full"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;

  const version    = (searchParams.get("version") ?? "mix").toLowerCase();
  const kind       = (searchParams.get("kind")    ?? "preview").toLowerCase();
  const tokenParam = searchParams.get("access_token") ?? null;

  if (!VALID_VERSIONS.includes(version)) {
    return NextResponse.json(
      { error: `Version must be one of: ${VALID_VERSIONS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: `Kind must be one of: ${VALID_KINDS.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;

    const job = await prisma.mixJob.findUnique({
      where:  { id },
      select: {
        id:                 true,
        status:             true,
        userId:             true,
        guestEmail:         true,
        cleanFilePath:      true,
        polishedFilePath:   true,
        aggressiveFilePath: true,
        mixFilePath:        true,
        previewFilePaths:   true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // Access control
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

    // Resolve file path for (kind, version)
    const previews = (job.previewFilePaths ?? null) as Record<string, string> | null;
    let filePath: string | null = null;

    if (kind === "preview") {
      filePath = previews?.[version] ?? null;
    } else {
      // kind === "full"
      const fullMap: Record<string, string | null> = {
        clean:      job.cleanFilePath      ?? null,
        polished:   job.polishedFilePath   ?? null,
        aggressive: job.aggressiveFilePath ?? null,
        mix:        job.mixFilePath        ?? null,
        // No "original" full-length — fall through to preview if requested
        original:   previews?.original     ?? null,
      };
      filePath = fullMap[version];

      // Premium/Pro fallback: older jobs only populated clean/polished/aggressive
      // (engine ran in 3-version mode) and never wrote a single "mix" file.
      // Prefer polished (mid-strength), then clean, then aggressive so the
      // artist hears the most representative master without us 404'ing.
      if (!filePath && version === "mix") {
        filePath =
          job.polishedFilePath ??
          job.cleanFilePath ??
          job.aggressiveFilePath ??
          null;
      }
    }

    if (!filePath) {
      return NextResponse.json(
        { error: `No ${kind} file for version "${version}".` },
        { status: 404 },
      );
    }

    const signedUrl = await generateFreshSignedUrl(filePath);
    if (!signedUrl) {
      return NextResponse.json({ error: "Could not sign URL." }, { status: 502 });
    }

    return NextResponse.json(
      { url: signedUrl, expiresIn: 3600 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(`GET /api/mix-console/job/${id}/preview-url:`, err);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
}
