/**
 * POST /api/mastering/job/[id]/select-version
 *
 * Artist picks which of the 4 mastered versions (Clean/Warm/Punch/Loud)
 * they want to download. Stores the selection on the job.
 *
 * Body: { version: "Clean" | "Warm" | "Punch" | "Loud" }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

const VALID_VERSIONS = ["Clean", "Warm", "Punch", "Loud"] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;
    const body       = await req.json() as { version: string };

    if (!VALID_VERSIONS.includes(body.version as typeof VALID_VERSIONS[number])) {
      return NextResponse.json(
        { error: `Version must be one of: ${VALID_VERSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const job = await prisma.masteringJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    if (!isOwner && !isGuest) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

    if (job.status !== "COMPLETE") {
      return NextResponse.json({ error: "Job is not complete yet." }, { status: 400 });
    }

    await prisma.masteringJob.update({
      where: { id },
      data:  { selectedVersion: body.version },
    });

    return NextResponse.json({ ok: true, selectedVersion: body.version });
  } catch (err) {
    console.error(`POST /api/mastering/job/${id}/select-version:`, err);
    return NextResponse.json({ error: "Failed to select version." }, { status: 500 });
  }
}
