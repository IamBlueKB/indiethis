/**
 * POST /api/mastering/webhook/replicate/mix
 *
 * Replicate calls this when the "mix" action completes (MIX_AND_MASTER).
 * Stores the mixdown URL, then fires "analyze" on the mixdown so Claude
 * can decide the final mastering chain.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { startMasteringAction } from "@/lib/mastering/engine";
import type { MixResult } from "@/lib/mastering/engine";

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
      data:  { status: "FAILED", reportData: { error: body.error ?? "Mix step failed" } as any },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const mixResult    = JSON.parse(body.output) as MixResult;
    const job          = await prisma.masteringJob.findUniqueOrThrow({ where: { id: jobId } });
    const analysisData = job.analysisData as Record<string, unknown> | null;

    // Store mixdown URL in analysisData — master and preview webhooks will read it
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  {
        status:       "MASTERING",
        analysisData: { ...analysisData, mixdownUrl: mixResult.mixdownUrl } as any,
      },
    });

    // Analyze the mixdown — result drives Claude's master decision
    await startMasteringAction("analyze", {
      audio_url: mixResult.mixdownUrl,
      job_id:    jobId,
    }, "/api/mastering/webhook/replicate/analyze-mix");

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Mix webhook failed for job ${jobId}:`, message);
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: message } as any },
    });
    return NextResponse.json({ ok: true });
  }
}
