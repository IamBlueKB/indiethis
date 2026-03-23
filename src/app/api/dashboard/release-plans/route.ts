import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateDefaultTasks } from "@/lib/release-plan-template";

/**
 * GET /api/dashboard/release-plans
 * List all release plans for the artist.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plans = await db.releasePlan.findMany({
    where: { artistId: session.user.id },
    include: {
      track: { select: { id: true, title: true, coverArtUrl: true } },
      release: { select: { id: true, title: true, coverUrl: true } },
      tasks: { select: { id: true, isCompleted: true }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { releaseDate: "asc" },
  });

  return NextResponse.json({ plans });
}

/**
 * POST /api/dashboard/release-plans
 * Create a new release plan and auto-generate default tasks.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    title: string;
    releaseDate: string;
    trackId?: string;
    releaseId?: string;
  };

  if (!body.title?.trim() || !body.releaseDate) {
    return NextResponse.json({ error: "title and releaseDate are required" }, { status: 400 });
  }

  const releaseDate = new Date(body.releaseDate);
  if (isNaN(releaseDate.getTime())) {
    return NextResponse.json({ error: "Invalid releaseDate" }, { status: 400 });
  }

  // Create the plan
  const plan = await db.releasePlan.create({
    data: {
      artistId: session.user.id,
      title: body.title.trim(),
      releaseDate,
      trackId: body.trackId ?? null,
      releaseId: body.releaseId ?? null,
      status: "PLANNING",
    },
  });

  // Auto-generate default tasks
  const taskData = generateDefaultTasks(plan.id, releaseDate);
  await db.releasePlanTask.createMany({ data: taskData });

  // Return full plan with tasks
  const full = await db.releasePlan.findUnique({
    where: { id: plan.id },
    include: {
      track: { select: { id: true, title: true, coverArtUrl: true } },
      release: { select: { id: true, title: true, coverUrl: true } },
      tasks: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json({ plan: full }, { status: 201 });
}
