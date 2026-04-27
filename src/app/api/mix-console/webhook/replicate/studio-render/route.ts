/**
 * POST /api/mix-console/webhook/replicate/studio-render
 *
 * Replicate calls this when a Pro Studio Mixer render pass completes.
 *
 * Step 25 scope: lightweight handler that flips studioStatus +
 * stores the rendered file path. predict.py's `_studio_render` lands
 * in Step 26 — at that point we'll know the exact output shape (this
 * code already handles the planned `{ studio_file_path }` JSON).
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";

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
  console.error("studio-render webhook body:", JSON.stringify(body).slice(0, 500));

  if (body.status !== "succeeded") {
    await prisma.mixJob.update({
      where: { id: jobId },
      data:  { studioStatus: "STUDIO_FAILED" },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const raw    = Array.isArray(body.output) ? body.output[body.output.length - 1] : body.output;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Expected output shape from Step 26's `_studio_render`:
    //   { studio_file_path: "mixing/{jobId}/studio_mix.wav" }
    // Accept a couple of fallback keys defensively.
    const studioFilePath =
      (parsed.studio_file_path as string | undefined) ??
      (parsed.file_path        as string | undefined) ??
      ((parsed.file_paths as Record<string, string> | undefined)?.studio) ??
      null;

    await prisma.mixJob.update({
      where: { id: jobId },
      data:  {
        studioStatus:     "STUDIO_COMPLETE",
        studioFilePath:   studioFilePath ?? undefined,
        studioRenderedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`studio-render webhook failed for job ${jobId}:`, message);
    await prisma.mixJob.update({
      where: { id: jobId },
      data:  { studioStatus: "STUDIO_FAILED" },
    });
    return NextResponse.json({ ok: true });
  }
}
