/**
 * GET /api/mix-console/job/[id]
 *
 * Returns full MixJob data for polling. Frontend polls every 3–5 seconds
 * during processing and uses this to update the wizard state.
 *
 * Access control: authenticated owner (userId match) OR guest with
 * matching `indiethis_guest_email` cookie OR a valid MixAccessToken
 * passed as `?access_token=` (used by the email-linked results page
 * when the guest returns on a different device without the cookie).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { generateFreshSignedUrl } from "@/lib/mix-console/engine";

async function signPaths(paths: Record<string, string>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    Object.entries(paths).map(async ([key, filePath]) => {
      if (!filePath) { out[key] = filePath; return; }
      const signed = await generateFreshSignedUrl(filePath);
      out[key] = signed ?? filePath;
    }),
  );
  return out;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;
    const tokenParam = req.nextUrl.searchParams.get("access_token") ?? null;

    const job = await prisma.mixJob.findUnique({
      where:   { id },
      include: { accessToken: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // Access control: owner | matching guest email cookie | valid MixAccessToken
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

    // If job is COMPLETE, convert previewFilePaths storage paths → signed URLs
    let responseJob: typeof job & { previewFilePaths?: unknown; accessTokenValue?: string | null } = job;
    if (job.status === "COMPLETE" && job.previewFilePaths) {
      const paths = job.previewFilePaths as Record<string, string>;
      const signed = await signPaths(paths);
      responseJob = { ...job, previewFilePaths: signed };
    }

    // Surface the access token string (when present) so the wizard can
    // redirect guests to /mix-console/results?token=... on COMPLETE.
    responseJob = {
      ...responseJob,
      accessTokenValue: job.accessToken?.token ?? null,
    };

    return NextResponse.json(responseJob);
  } catch (err) {
    console.error(`GET /api/mix-console/job/${id}:`, err);
    return NextResponse.json({ error: "Failed to fetch job." }, { status: 500 });
  }
}
