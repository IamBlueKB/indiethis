import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/dashboard/release-plans/[id]
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const plan = await db.releasePlan.findFirst({
    where: { id, artistId: session.user.id },
    include: {
      track: { select: { id: true, title: true, coverArtUrl: true } },
      release: { select: { id: true, title: true, coverUrl: true } },
      tasks: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ plan });
}

/**
 * PATCH /api/dashboard/release-plans/[id]
 * Update plan title, releaseDate, or status.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.releasePlan.findFirst({
    where: { id, artistId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    title?: string;
    releaseDate?: string;
    status?: import("@prisma/client").ReleasePlanStatus;
  };

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.status !== undefined) data.status = body.status;
  if (body.releaseDate !== undefined) {
    const d = new Date(body.releaseDate);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid releaseDate" }, { status: 400 });
    }
    data.releaseDate = d;
  }

  const updated = await db.releasePlan.update({
    where: { id },
    data,
    include: {
      track: { select: { id: true, title: true, coverArtUrl: true } },
      release: { select: { id: true, title: true, coverUrl: true } },
      tasks: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json({ plan: updated });
}

/**
 * DELETE /api/dashboard/release-plans/[id]
 * Cancel/delete a release plan.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.releasePlan.findFirst({
    where: { id, artistId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.releasePlan.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
