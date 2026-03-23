import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/dashboard/videos/reorder
// Body: { orderedIds: string[] }
// Updates sortOrder for each video in the given order.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { orderedIds } = body as { orderedIds: string[] };

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds required" }, { status: 400 });
  }

  // Verify all videos belong to this artist
  const count = await db.artistVideo.count({
    where: { id: { in: orderedIds }, artistId: session.user.id },
  });
  if (count !== orderedIds.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Bulk update sortOrder
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.artistVideo.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
