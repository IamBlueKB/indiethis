import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * PATCH /api/dashboard/notifications/[id]
 * Body: { isRead: boolean }
 * Marks a single notification as read or unread.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as { isRead?: boolean };

  const notification = await db.notification.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!notification || notification.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.notification.update({
    where: { id },
    data:  { isRead: body.isRead ?? true },
  });

  return NextResponse.json({ notification: updated });
}
