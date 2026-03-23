import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/dashboard/release-plans/[id]/tasks
 * Add a custom task to a release plan.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const plan = await db.releasePlan.findFirst({
    where: { id, artistId: session.user.id },
    include: { tasks: { select: { sortOrder: true }, orderBy: { sortOrder: "desc" }, take: 1 } },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    title: string;
    description?: string;
    category: import("@prisma/client").TaskCategory;
    dueDate: string;
    actionUrl?: string;
  };

  if (!body.title?.trim() || !body.dueDate || !body.category) {
    return NextResponse.json({ error: "title, category, and dueDate are required" }, { status: 400 });
  }

  const dueDate = new Date(body.dueDate);
  if (isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
  }

  const maxSortOrder = plan.tasks[0]?.sortOrder ?? -1;

  const task = await db.releasePlanTask.create({
    data: {
      releasePlanId: id,
      title: body.title.trim(),
      description: body.description?.trim() ?? null,
      category: body.category,
      dueDate,
      sortOrder: maxSortOrder + 1,
      actionType: "CUSTOM",
      actionUrl: body.actionUrl?.trim() ?? null,
    },
  });

  // Auto-progress plan status
  if (plan.status === "PLANNING") {
    await db.releasePlan.update({ where: { id }, data: { status: "IN_PROGRESS" } });
  }

  return NextResponse.json({ task }, { status: 201 });
}
