/**
 * POST /api/dashboard/ai/cover-art/[id]/refine
 *
 * Pro tier only — triggers a refinement round.
 * Artist picks a variation and provides a refinement instruction.
 * Generates 4 new image-to-image variations using FLUX Kontext.
 *
 * Body: {
 *   selectedUrl:           string;  // the variation to refine from
 *   refinementInstruction: string;  // "make it darker", "add more red", etc.
 *   round:                 1 | 2;
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";
import { refineCoverArtJob }         from "@/lib/cover-art/generator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body   = await req.json() as {
    selectedUrl:            string;
    refinementInstruction:  string;
    round:                  number;
  };

  if (!body.selectedUrl)           return NextResponse.json({ error: "selectedUrl required" }, { status: 400 });
  if (!body.refinementInstruction) return NextResponse.json({ error: "refinementInstruction required" }, { status: 400 });
  if (body.round !== 1 && body.round !== 2) return NextResponse.json({ error: "round must be 1 or 2" }, { status: 400 });

  const job = await db.coverArtJob.findUnique({
    where:  { id },
    select: {
      id:               true,
      userId:           true,
      tier:             true,
      status:           true,
      enhancedPrompt:   true,
      refinementRound:  true,
      refinementHistory:true,
    },
  });

  if (!job)                           return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (job.tier !== "PRO")             return NextResponse.json({ error: "Refinement is Pro tier only" }, { status: 403 });
  if (job.status === "GENERATING")    return NextResponse.json({ error: "Already generating" }, { status: 409 });
  if (job.refinementRound >= 2)       return NextResponse.json({ error: "Maximum refinement rounds reached" }, { status: 400 });

  // The current working prompt is either the latest refinement prompt or the original enhanced prompt
  type HistEntry = { round: number; instruction: string; prompt: string; urls: string[]; selectedUrl: string | null };
  const history: HistEntry[] = Array.isArray(job.refinementHistory)
    ? (job.refinementHistory as HistEntry[])
    : [];

  const lastPrompt = history.length > 0
    ? history[history.length - 1].prompt
    : (job.enhancedPrompt ?? "album cover art, square format, 1:1 aspect ratio");

  // Fire and forget — UI polls /api/cover-art/[id]/status
  refineCoverArtJob({
    jobId:                 id,
    selectedImageUrl:      body.selectedUrl,
    refinementInstruction: body.refinementInstruction,
    currentPrompt:         lastPrompt,
    round:                 body.round,
  }).catch(console.error);

  return NextResponse.json({ ok: true, jobId: id, round: body.round });
}
