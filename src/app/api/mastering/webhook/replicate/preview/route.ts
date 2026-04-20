/**
 * POST /api/mastering/webhook/replicate/preview
 *
 * Replicate calls this when the "preview" action completes (both modes).
 * Final step — marks job COMPLETE, generates guest access token if needed,
 * sends email with the correct download/results URL, sets conversion timer.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { sendMasteringCompleteEmail } from "@/lib/email/mastering";
import type { PreviewResult } from "@/lib/mastering/engine";

export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

function verifySecret(req: NextRequest): boolean {
  const secret = process.env.REPLICATE_WEBHOOK_SECRET;
  if (!secret) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

/** Extract a human-readable track name from the input file URL */
function trackTitleFromUrl(url: string | null): string {
  if (!url) return "Your Track";
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/");
    const filename = segments[segments.length - 1] ?? "";
    // Decode percent-encoding, strip extension, replace dashes/underscores
    const decoded = decodeURIComponent(filename).replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    return decoded.trim() || "Your Track";
  } catch {
    return "Your Track";
  }
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    id:     string;
    status: string;
    output: string | string[];
    error?: string;
    input:  { job_id: string };
  };

  const jobId = body.input?.job_id;
  if (!jobId) return NextResponse.json({ error: "No job_id" }, { status: 400 });
  console.error("Webhook body:", JSON.stringify(body).slice(0, 500));

  if (body.status !== "succeeded") {
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: body.error ?? "Preview step failed" } as any },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const raw    = Array.isArray(body.output) ? body.output[body.output.length - 1] : body.output;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const job    = await prisma.masteringJob.findUniqueOrThrow({ where: { id: jobId } });

    // Python returns preview_url (snake_case); handle both
    const previewUrl = (parsed.previewUrl ?? parsed.preview_url ?? null) as string | null;

    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  {
        status:           "COMPLETE",
        previewUrl,
        previewExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    // Send completion email
    try {
      const isGuest = !job.userId && !!job.guestEmail;

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
        let downloadUrl: string;

        if (isGuest) {
          // Generate a 7-day access token for the guest
          const accessToken = await prisma.masteringAccessToken.create({
            data: {
              jobId:     jobId,
              email:     job.guestEmail!,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
          downloadUrl = `${APP_URL}/master/results?token=${accessToken.token}`;
        } else {
          downloadUrl = `${APP_URL}/dashboard/ai/master`;
        }

        const trackTitle = trackTitleFromUrl(job.inputFileUrl ?? null);

        await sendMasteringCompleteEmail({
          artistEmail: email,
          artistName:  name ?? "Artist",
          trackTitle,
          downloadUrl,
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
