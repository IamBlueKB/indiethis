/**
 * POST /api/mastering/webhook/replicate/classify
 *
 * Replicate calls this when "classify-stems" completes (MIX_AND_MASTER).
 * Stores classified stem data, then fires "analyze" on the first stem
 * to get BPM/key/sections for Claude's mix decision.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { startMasteringAction } from "@/lib/mastering/engine";
import type { ClassifiedStem } from "@/lib/mastering/engine";

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
    input:  { job_id: string; stems_json: string };
  };

  const jobId = body.input?.job_id;
  if (!jobId) return NextResponse.json({ error: "No job_id" }, { status: 400 });

  if (body.status !== "succeeded") {
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: body.error ?? "Classify stems failed" } as any },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const classifiedStems = JSON.parse(body.output) as ClassifiedStem[];
    const job             = await prisma.masteringJob.findUniqueOrThrow({ where: { id: jobId } });

    // Store classified stems in analysisData for the next handler to read
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { analysisData: { classifiedStems } as any },
    });

    // Analyze the first stem to get BPM, key, sections
    const stems = job.stems as { url: string; filename: string }[];
    const firstStemUrl = classifiedStems[0]?.url ?? stems[0]?.url;
    if (!firstStemUrl) throw new Error("No stem URL available for analysis");

    await startMasteringAction("analyze", {
      audio_url: firstStemUrl,
      job_id:    jobId,
    }, "/api/mastering/webhook/replicate/analyze-stem");

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Classify webhook failed for job ${jobId}:`, message);
    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { status: "FAILED", reportData: { error: message } as any },
    });
    return NextResponse.json({ ok: true });
  }
}
