/**
 * POST /api/mix-console/webhook/replicate/mix
 *
 * Replicate calls this when the "mix-full" action completes (initial mix pass).
 * Stores file paths + waveform data, then fires preview-mix.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { startMixAction } from "@/lib/mix-console/engine";

export const maxDuration = 60;

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
  console.error("mix webhook body:", JSON.stringify(body).slice(0, 500));

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

    // Python returns:
    // file_paths: { clean, polished, aggressive, mix }
    // waveforms: { clean, polished, aggressive, mix }
    // original_waveform: [...]
    // preview_file_paths: { clean, polished, aggressive, mix, original }
    // applied_parameters: {}
    const filePaths     = (parsed.file_paths         as Record<string, string>) ?? {};
    const waveforms     = (parsed.waveforms           as Record<string, number[]>) ?? {};
    const originalWave  = (parsed.original_waveform   as number[]) ?? null;
    const previewPaths  = (parsed.preview_file_paths  as Record<string, string>) ?? null;
    const qaResults     = (parsed.qa_results          as Record<string, unknown>) ?? null;

    await prisma.mixJob.update({
      where: { id: jobId },
      data:  {
        cleanFilePath:           filePaths["clean"]      ?? null,
        polishedFilePath:        filePaths["polished"]   ?? null,
        aggressiveFilePath:      filePaths["aggressive"] ?? null,
        mixFilePath:             filePaths["mix"]        ?? null,
        previewWaveformMixed:    waveforms               as any,
        previewWaveformOriginal: originalWave            as any,
        previewFilePaths:        previewPaths            as any,
        qaCheckResults:          qaResults               as any,
        status:                  "PREVIEWING",
      },
    });

    // Fire preview-mix
    await startMixAction(
      "preview-mix",
      { job_id: jobId },
      "/api/mix-console/webhook/replicate/preview",
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`mix webhook failed for job ${jobId}:`, message);
    await prisma.mixJob.update({
      where: { id: jobId },
      data:  { status: "FAILED" },
    });
    return NextResponse.json({ ok: true });
  }
}
