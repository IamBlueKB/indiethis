/**
 * POST /api/mix-console/webhook/replicate/preview
 *
 * Replicate calls this when "preview-mix" completes. This is the FINAL step:
 * marks the job COMPLETE, creates a guest access token if needed, and sends the
 * completion email so the artist can download their mix.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { sendMixCompleteEmail } from "@/lib/brevo/email";

export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

function verifySecret(req: NextRequest): boolean {
  const secret = process.env.REPLICATE_WEBHOOK_SECRET;
  if (!secret) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

function trackTitleFromInputFiles(inputFiles: unknown): string {
  try {
    const files = inputFiles as Array<{ label?: string; url?: string }>;
    return files?.[0]?.label ?? "Your Mix";
  } catch {
    return "Your Mix";
  }
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    id:     string;
    status: string;
    output: string | string[];
    error?: string;
    input:  { job_id: string; [key: string]: string };
  };

  const jobId = body.input?.job_id;
  if (!jobId) return NextResponse.json({ error: "No job_id" }, { status: 400 });
  console.error("preview webhook body:", JSON.stringify(body).slice(0, 500));

  if (body.status !== "succeeded") {
    await prisma.mixJob.update({
      where: { id: jobId },
      data:  { status: "FAILED" },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    // Mark COMPLETE — don't overwrite previewFilePaths (already stored from mix step)
    await prisma.mixJob.update({
      where: { id: jobId },
      data:  { status: "COMPLETE" },
    });

    // Reload job for email details
    const job = await prisma.mixJob.findUniqueOrThrow({ where: { id: jobId } });

    const artistEmail = job.guestEmail ?? (
      job.userId
        ? (await prisma.user.findUnique({ where: { id: job.userId }, select: { email: true } }))?.email ?? null
        : null
    );
    const artistName = job.guestName ?? (
      job.userId
        ? (await prisma.user.findUnique({ where: { id: job.userId }, select: { name: true } }))?.name ?? null
        : null
    );

    if (!artistEmail) {
      console.error(`preview webhook: no email found for job ${jobId}, skipping email`);
      return NextResponse.json({ ok: true });
    }

    let downloadUrl: string;

    if (job.guestEmail) {
      // Create 7-day access token for guest
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const token = await prisma.mixAccessToken.create({
        data: {
          jobId,
          email:     job.guestEmail,
          expiresAt,
        },
      });
      downloadUrl = `${APP_URL}/mix-console/results?token=${token.token}`;
    } else {
      // Authenticated user — send to dashboard
      downloadUrl = `${APP_URL}/dashboard/ai/mix-console`;
    }

    const trackTitle = trackTitleFromInputFiles(job.inputFiles);

    await sendMixCompleteEmail({
      artistEmail,
      artistName: artistName ?? "Artist",
      trackTitle,
      downloadUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`preview webhook failed for job ${jobId}:`, message);
    await prisma.mixJob.update({
      where: { id: jobId },
      data:  { status: "FAILED" },
    });
    return NextResponse.json({ ok: true });
  }
}
