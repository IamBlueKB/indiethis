/**
 * POST /api/mastering/job/[id]/revision
 *
 * Pro tier only. Artist submits a revision note and the job re-processes
 * with their direction injected as the natural language prompt.
 * One revision per job — enforced.
 *
 * Body: { note: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runRevisionPipeline } from "@/lib/mastering/pipeline";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;
    const body       = await req.json() as { note: string };

    if (!body.note?.trim()) {
      return NextResponse.json({ error: "Revision note is required." }, { status: 400 });
    }
    if (body.note.length > 1000) {
      return NextResponse.json({ error: "Revision note must be under 1000 characters." }, { status: 400 });
    }

    const job = await prisma.masteringJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    if (!isOwner && !isGuest) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

    if (job.tier !== "PRO") {
      return NextResponse.json({ error: "Revisions require the Pro tier." }, { status: 403 });
    }
    if (job.revisionUsed) {
      return NextResponse.json({ error: "Revision already used for this job." }, { status: 409 });
    }
    if (job.status !== "COMPLETE") {
      return NextResponse.json({ error: "Job must be complete before requesting a revision." }, { status: 400 });
    }

    // Fire revision pipeline in background
    runRevisionPipeline(id, body.note.trim()).catch((err) => {
      console.error(`Revision pipeline failed for job ${id}:`, err);
    });

    return NextResponse.json({ ok: true, status: "MIXING" });
  } catch (err) {
    console.error(`POST /api/mastering/job/${id}/revision:`, err);
    return NextResponse.json({ error: "Failed to start revision." }, { status: 500 });
  }
}
