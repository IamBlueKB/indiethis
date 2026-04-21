/**
 * GET /api/mix-console/job/[id]
 *
 * Returns full MixJob data for polling. Frontend polls every 3–5 seconds
 * during processing and uses this to update the wizard state.
 *
 * Access control: authenticated owner (userId match) OR guest with
 * matching `indiethis_guest_email` cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;

    const job = await prisma.mixJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // Access control: owner or matching guest email cookie
    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    if (!isOwner && !isGuest) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    return NextResponse.json(job);
  } catch (err) {
    console.error(`GET /api/mix-console/job/${id}:`, err);
    return NextResponse.json({ error: "Failed to fetch job." }, { status: 500 });
  }
}
