/**
 * POST /api/mix-console/webhook/replicate/separate
 *
 * Replicate calls this when the "separate-stems" action completes (VOCAL_BEAT mode only).
 * The Python engine separated the beat into vocal/bass/drums/other stems.
 * We combine the artist's original vocal with the separated beat stems, then fire analyze-mix.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { startMixAction } from "@/lib/mix-console/engine";

export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

function verifySecret(req: NextRequest): boolean {
  const secret = process.env.REPLICATE_WEBHOOK_SECRET;
  if (!secret) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
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
  console.error("separate webhook body:", JSON.stringify(body).slice(0, 500));

  if (body.status !== "succeeded") {
    await prisma.mixJob.update({
      where: { id: jobId },
      data:  { status: "FAILED" },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const raw    = Array.isArray(body.output) ? body.output[body.output.length - 1] : body.output;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Python returns: { vocal_url, bass_url, drums_url, other_url }
    const vocalUrl  = parsed.vocal_url as string | undefined;
    const bassUrl   = parsed.bass_url  as string | undefined;
    const drumsUrl  = parsed.drums_url as string | undefined;
    const otherUrl  = parsed.other_url as string | undefined;

    // Load job to get the artist's original vocal (always first file in VOCAL_BEAT mode)
    const job = await prisma.mixJob.findUniqueOrThrow({ where: { id: jobId } });
    const existingFiles = job.inputFiles as Array<{ url: string; label: string; role?: string }>;
    const originalVocalUrl = existingFiles[0]?.url;

    if (!originalVocalUrl) {
      throw new Error("No original vocal URL found in inputFiles[0]");
    }

    // Build combined stems array: artist vocal + separated beat stems
    const updatedInputFiles = [
      { url: originalVocalUrl,   label: existingFiles[0]?.label ?? "vocal", role: "lead" },
      ...(bassUrl  ? [{ url: bassUrl,  label: "bass",  role: "bass"  }] : []),
      ...(drumsUrl ? [{ url: drumsUrl, label: "drums", role: "drums" }] : []),
      ...(otherUrl ? [{ url: otherUrl, label: "other", role: "other" }] : []),
    ];

    // All stem URLs to pass to analyze
    const allStemUrls = updatedInputFiles.map(f => f.url);

    await prisma.mixJob.update({
      where: { id: jobId },
      data:  {
        inputFiles: updatedInputFiles as any,
        status:     "ANALYZING",
      },
    });

    // Fire analyze-mix
    await startMixAction(
      "analyze-mix",
      {
        stems_urls: JSON.stringify(allStemUrls),
        job_id:     jobId,
      },
      "/api/mix-console/webhook/replicate/analyze",
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`separate webhook failed for job ${jobId}:`, message);
    await prisma.mixJob.update({
      where: { id: jobId },
      data:  { status: "FAILED" },
    });
    return NextResponse.json({ ok: true });
  }
}
