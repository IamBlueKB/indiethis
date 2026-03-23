import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string; taskId: string }> };

/**
 * PATCH /api/dashboard/release-plans/[id]/tasks/[taskId]
 * Update a task: complete, edit title/description/dueDate, reorder.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, taskId } = await params;

  // Verify ownership
  const plan = await db.releasePlan.findFirst({
    where: { id, artistId: session.user.id },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const task = await db.releasePlanTask.findFirst({
    where: { id: taskId, releasePlanId: id },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const body = await req.json() as {
    isCompleted?: boolean;
    title?: string;
    description?: string;
    dueDate?: string;
    sortOrder?: number;
    linkedItemId?: string;
  };

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description?.trim() ?? null;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
  if (body.linkedItemId !== undefined) data.linkedItemId = body.linkedItemId;

  if (body.dueDate !== undefined) {
    const d = new Date(body.dueDate);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
    }
    data.dueDate = d;
  }

  if (body.isCompleted !== undefined) {
    data.isCompleted = body.isCompleted;
    data.completedAt = body.isCompleted ? new Date() : null;
  }

  const updated = await db.releasePlanTask.update({
    where: { id: taskId },
    data,
  });

  // Auto-update plan status based on completion
  if (body.isCompleted !== undefined) {
    const allTasks = await db.releasePlanTask.findMany({ where: { releasePlanId: id } });
    const allDone = allTasks.every((t) => t.id === taskId ? body.isCompleted : t.isCompleted);
    const anyDone = allTasks.some((t) => t.id === taskId ? body.isCompleted : t.isCompleted);
    const now = new Date();
    const released = plan.releaseDate <= now;

    if (allDone && released) {
      await db.releasePlan.update({ where: { id }, data: { status: "LAUNCHED" } });
    } else if (anyDone && plan.status === "PLANNING") {
      await db.releasePlan.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    }
  }

  return NextResponse.json({ task: updated });
}

/**
 * DELETE /api/dashboard/release-plans/[id]/tasks/[taskId]
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, taskId } = await params;

  const plan = await db.releasePlan.findFirst({
    where: { id, artistId: session.user.id },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const task = await db.releasePlanTask.findFirst({
    where: { id: taskId, releasePlanId: id },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  await db.releasePlanTask.delete({ where: { id: taskId } });

  return NextResponse.json({ ok: true });
}
