/**
 * POST /api/mastering/webhook/replicate/master
 *
 * Replicate calls this when the "master" action completes (both modes).
 * Stores the 4 mastered versions + platform exports, then fires "preview".
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { startMasteringAction } from "@/lib/mastering/engine";
import type { MasterResult } from "@/lib/mastering/engine";

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
    output: string | string[];
    error?: string;
    input:  { job_id: string; audio_url: string };
  };

  const jobId = body.input?.job_id;
  if (!jobId) return NextResponse.json({ error: "No job_id" }, { status: 400 });
  console.error("Webhook body:", JSON.stringify(body).slice(0, 500));

  if (body.status !== "succeeded") {
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: body.error ?? "Master step failed" } as any },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const raw    = Array.isArray(body.output) ? body.output[body.output.length - 1] : body.output;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const job    = await prisma.masteringJob.findUniqueOrThrow({ where: { id: jobId } });

    // Python returns versions as {clean: url, warm: url, punch: url, loud: url}
    // Frontend expects [{name, url, lufs, truePeak, waveformData}]
    const versionsRaw = (parsed.versions ?? {}) as Record<string, string>;
    const versionOrder: [string, string][] = [
      ["clean", "Clean"],
      ["warm",  "Warm"],
      ["punch", "Punch"],
      ["loud",  "Loud"],
    ];
    const versionsArray = versionOrder
      .filter(([key]) => versionsRaw[key])
      .map(([key, name]) => ({
        name,
        url:          versionsRaw[key],
        lufs:         0,
        truePeak:     0,
        waveformData: [] as number[],
      }));

    const masterResult = parsed as unknown as MasterResult;

    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  {
        versions:   versionsArray as any,
        exports:    (masterResult.exports  ?? []) as any,
        reportData: (masterResult.report   ?? null) as any,
      },
    });

    // Determine audio URL for preview:
    // MASTER_ONLY → inputFileUrl
    // MIX_AND_MASTER → mixdownUrl stored in analysisData during mix step
    const analysisData = job.analysisData as Record<string, unknown> | null;
    const previewAudioUrl = (analysisData?.mixdownUrl as string | undefined)
      ?? job.inputFileUrl
      ?? body.input.audio_url;

    // Fire preview action
    await startMasteringAction("preview", {
      audio_url: previewAudioUrl,
      job_id:    jobId,
    }, "/api/mastering/webhook/replicate/preview");

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Master webhook failed for job ${jobId}:`, message);
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: message } as any },
    });
    return NextResponse.json({ ok: true });
  }
}
