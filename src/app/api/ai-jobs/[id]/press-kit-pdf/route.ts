/**
 * GET /api/ai-jobs/[id]/press-kit-pdf
 *
 * Generates and streams the press kit PDF on demand.
 * Accessible by the job owner (artist or studio who triggered it).
 */

import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import PressKitPDF, { type PressKitContent } from "@/components/pdf/PressKitPDF";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await db.aIJob.findUnique({ where: { id } });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Only the user who triggered it (or a platform admin) can download
  if (
    job.triggeredById !== session.user.id &&
    session.user.role !== "PLATFORM_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (job.type !== "PRESS_KIT" || job.status !== "COMPLETE") {
    return NextResponse.json(
      { error: "Press kit not ready yet." },
      { status: 400 },
    );
  }

  const output = (job.outputData ?? {}) as Record<string, unknown>;
  const content = output.content as PressKitContent | undefined;
  const photoUrl = output.photoUrl as string | undefined;

  if (!content) {
    return NextResponse.json(
      { error: "Press kit content not found in job output." },
      { status: 404 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    createElement(PressKitPDF, { content, photoUrl }) as any,
  );

  const filename = `press-kit-${content.artistName?.replace(/\s+/g, "-").toLowerCase() ?? id.slice(-8)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
