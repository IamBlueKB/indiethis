/**
 * GET /api/cover-art/[id]/status
 *
 * Polling endpoint for CoverArtJob status.
 * Public — access is by knowing the ID (same pattern as video studio).
 * Returns enough data for the UI to render the current phase.
 */

import { db }           from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const job = await db.coverArtJob.findUnique({
    where:  { id },
    select: {
      id:                true,
      status:            true,
      tier:              true,
      styleId:           true,
      enhancedPrompt:    true,
      variationUrls:     true,
      selectedUrl:       true,
      refinementRound:   true,
      refinementHistory: true,
      errorMessage:      true,
      createdAt:         true,
      updatedAt:         true,
    },
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id:                job.id,
    status:            job.status,
    tier:              job.tier,
    styleId:           job.styleId,
    enhancedPrompt:    job.enhancedPrompt,
    variationUrls:     Array.isArray(job.variationUrls) ? job.variationUrls : [],
    selectedUrl:       job.selectedUrl,
    refinementRound:   job.refinementRound,
    refinementHistory: Array.isArray(job.refinementHistory) ? job.refinementHistory : [],
    errorMessage:      job.errorMessage,
    createdAt:         job.createdAt.toISOString(),
    updatedAt:         job.updatedAt.toISOString(),
  });
}
