/**
 * GET /api/ai-jobs/[id]/receipt
 *
 * Generates and streams an AI generation ownership receipt PDF on demand.
 * Accessible by the job owner (or PLATFORM_ADMIN).
 */

import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import AIReceiptPDF, { type AIReceiptData } from "@/components/pdf/AIReceiptPDF";

const TOOL_NAMES: Record<string, string> = {
  COVER_ART:   "IndieThis AI Cover Art",
  VIDEO:       "IndieThis AI Music Video",
  MASTERING:   "IndieThis AI Mastering",
  LYRIC_VIDEO: "IndieThis AI Lyric Video",
  AR_REPORT:   "IndieThis A&R Report",
  PRESS_KIT:   "IndieThis Press Kit",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [job, user] = await Promise.all([
    db.aIJob.findUnique({ where: { id } }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, subscription: { select: { tier: true } } },
    }),
  ]);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (
    job.triggeredById !== session.user.id &&
    session.user.role !== "PLATFORM_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const toolName  = TOOL_NAMES[job.type] ?? `IndieThis AI — ${job.type}`;
  const tierName  = (user?.subscription as { tier?: string } | null)?.tier ?? "Standard";
  const artistName = user?.name ?? "Artist";

  const data: AIReceiptData = {
    jobId:            job.id,
    toolName,
    dateGenerated:    (job.completedAt ?? job.createdAt).toISOString(),
    subscriptionTier: tierName,
    artistName,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(AIReceiptPDF, { data }) as any);

  const slug     = toolName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const filename = `indiethis-receipt-${slug}-${id.slice(-8)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
