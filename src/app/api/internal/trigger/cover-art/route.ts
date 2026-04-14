/**
 * POST /api/internal/trigger/cover-art
 *
 * Fires generateCoverArtJobById() in isolation so Vercel's nft tracer
 * only bundles this function's deps (fal.ai, Anthropic Claude, UploadThing,
 * Prisma) — no ML/native binaries.
 *
 * Protected by CRON_SECRET. Caller fires and forgets.
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = (await req.json()) as { jobId: string };

  const { generateCoverArtJobById } = await import("@/lib/cover-art/generator");
  void generateCoverArtJobById(jobId).catch((err) =>
    console.error("[internal/trigger/cover-art] generateCoverArtJobById failed:", err),
  );

  return NextResponse.json({ ok: true });
}
