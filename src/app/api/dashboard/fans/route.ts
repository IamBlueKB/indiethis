import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source"); // RELEASE_NOTIFY | SHOW_NOTIFY | null (all)

  const where = {
    artistId: session.user.id,
    ...(source === "RELEASE_NOTIFY" || source === "SHOW_NOTIFY"
      ? { source: source as "RELEASE_NOTIFY" | "SHOW_NOTIFY" }
      : {}),
  };

  const [contacts, total] = await Promise.all([
    db.fanContact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id:        true,
        email:     true,
        phone:     true,
        zip:       true,
        source:    true,
        createdAt: true,
      },
    }),
    db.fanContact.count({ where: { artistId: session.user.id } }),
  ]);

  const releaseCount = await db.fanContact.count({
    where: { artistId: session.user.id, source: "RELEASE_NOTIFY" },
  });
  const showCount = await db.fanContact.count({
    where: { artistId: session.user.id, source: "SHOW_NOTIFY" },
  });

  return NextResponse.json({ contacts, total, releaseCount, showCount });
}
