/**
 * GET /api/mix-console/job/[id]
 *
 * Returns full MixJob data for polling. Frontend polls every 3–5 seconds
 * during processing and uses this to update the wizard state.
 *
 * Access control: authenticated owner (userId match) OR guest with
 * matching `indiethis_guest_email` cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

const SUPABASE_URL         = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

async function signPaths(paths: Record<string, string>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    Object.entries(paths).map(async ([key, filePath]) => {
      if (!filePath) { out[key] = filePath; return; }
      try {
        const res = await fetch(
          `${SUPABASE_URL}/storage/v1/object/sign/processed/${encodeURIComponent(filePath)}`,
          {
            method:  "POST",
            headers: {
              "apikey":        SUPABASE_SERVICE_KEY,
              "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
              "Content-Type":  "application/json",
            },
            body: JSON.stringify({ expiresIn: 3600 }),
          },
        );
        if (res.ok) {
          const data = await res.json() as { signedURL?: string };
          // signedURL is a relative path like /object/sign/processed/...
          out[key] = data.signedURL
            ? `${SUPABASE_URL}/storage/v1${data.signedURL}`
            : filePath;
        } else {
          out[key] = filePath;
        }
      } catch {
        out[key] = filePath;
      }
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

    const job = await prisma.mixJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // Access control: owner or matching guest email cookie
    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    if (!isOwner && !isGuest) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    // If job is COMPLETE, convert previewFilePaths storage paths → signed URLs
    let responseJob: typeof job & { previewFilePaths?: unknown } = job;
    if (job.status === "COMPLETE" && job.previewFilePaths) {
      const paths = job.previewFilePaths as Record<string, string>;
      const signed = await signPaths(paths);
      responseJob = { ...job, previewFilePaths: signed };
    }

    return NextResponse.json(responseJob);
  } catch (err) {
    console.error(`GET /api/mix-console/job/${id}:`, err);
    return NextResponse.json({ error: "Failed to fetch job." }, { status: 500 });
  }
}
