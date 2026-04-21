/**
 * POST /api/mix-console/job/[id]/select
 *
 * Artist selects their preferred mix version for download.
 * Stores the selection in mixParameters.selectedVersion.
 *
 * Body: { version: "clean" | "polished" | "aggressive" | "mix" }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

const VALID_VERSIONS = ["clean", "polished", "aggressive", "mix"] as const;
type ValidVersion = typeof VALID_VERSIONS[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session    = await auth();
    const guestEmail = req.cookies.get("indiethis_guest_email")?.value ?? null;
    const body       = await req.json() as { version: string };

    if (!VALID_VERSIONS.includes(body.version as ValidVersion)) {
      return NextResponse.json(
        { error: `Version must be one of: ${VALID_VERSIONS.join(", ")}` },
        { status: 400 },
      );
    }

    const job = await prisma.mixJob.findUnique({
      where:  { id },
      select: {
        id:            true,
        userId:        true,
        guestEmail:    true,
        mixParameters: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // Access control
    const isOwner = session?.user?.id && job.userId === session.user.id;
    const isGuest = guestEmail && job.guestEmail === guestEmail;
    if (!isOwner && !isGuest) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    // Store selected version in mixParameters
    const updatedParams = {
      ...(job.mixParameters as Record<string, unknown> ?? {}),
      selectedVersion: body.version,
    };

    await prisma.mixJob.update({
      where: { id },
      data:  { mixParameters: updatedParams as any },
    });

    return NextResponse.json({ ok: true, selectedVersion: body.version });
  } catch (err) {
    console.error(`POST /api/mix-console/job/${id}/select:`, err);
    return NextResponse.json({ error: "Failed to select version." }, { status: 500 });
  }
}
