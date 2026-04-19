/**
 * POST /api/mastering/webhook/replicate/preview
 *
 * Replicate calls this when the "preview" action completes (both modes).
 * Final step — marks job COMPLETE, sends email, sets conversion timer.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { sendMasteringCompleteEmail } from "@/lib/email/mastering";
import type { PreviewResult } from "@/lib/mastering/engine";

export const maxDuration = 60;

function verifySecret(req: NextRequest): boolean {
  const secret = process.env.REPLICATE_WEBHOOK_SECRET;
  if (!secret) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    id:     string;
    status: string;
    output: string;
    error?: string;
    input:  { job_id: string };
  };

  const jobId = body.input?.job_id;
  if (!jobId) return NextResponse.json({ error: "No job_id" }, { status: 400 });

  if (body.status !== "succeeded") {
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: body.error ?? "Preview step failed" } as any },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const previewResult = JSON.parse(body.output) as PreviewResult;
    const job           = await prisma.masteringJob.findUniqueOrThrow({ where: { id: jobId } });

    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  {
        status:           "COMPLETE",
        previewUrl:       previewResult.previewUrl,
        previewExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    // Send completion email
    try {
      const email = job.guestEmail ?? (
        job.userId
          ? (await prisma.user.findUnique({ where: { id: job.userId }, select: { email: true } }))?.email
          : null
      );
      const name = job.guestName ?? (
        job.userId
          ? (await prisma.user.findUnique({ where: { id: job.userId }, select: { name: true } }))?.name
          : "Artist"
      );
      if (email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
        await sendMasteringCompleteEmail({
          artistEmail: email,
          artistName:  name ?? "Artist",
          trackTitle:  "Your Track",
          downloadUrl: `${appUrl}/dashboard/ai/master`,
        });
      }
    } catch (emailErr) {
      console.error("Failed to send mastering complete email:", emailErr);
    }

    // Kick off guest conversion drip
    if (!job.userId && job.guestEmail) {
      await prisma.masteringJob.update({
        where: { id: jobId },
        data:  {
          conversionStep:   1,
          conversionNextAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Preview webhook failed for job ${jobId}:`, message);
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: message } as any },
    });
    return NextResponse.json({ ok: true });
  }
}
