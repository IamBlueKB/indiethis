import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { NotificationType } from "@prisma/client";

/**
 * GET /api/dashboard/notifications?page=1&limit=20&type=MERCH_ORDER
 * Returns paginated notifications for the current user.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const type  = searchParams.get("type") as NotificationType | null;

  const where = {
    userId: session.user.id,
    ...(type ? { type } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId: session.user.id, isRead: false } }),
  ]);

  return NextResponse.json({
    notifications,
    total,
    page,
    pages: Math.ceil(total / limit),
    unreadCount,
  });
}

/**
 * POST /api/dashboard/notifications
 * Mark all notifications as read for the current user.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data:  { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
