import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/dashboard/splits/user-search?q=...
 * Search IndieThis users by name or email for contributor lookup.
 * Returns basic public info only (no sensitive fields).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ users: [] });

  const users = await db.user.findMany({
    where: {
      role: "ARTIST",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 8,
  });

  return NextResponse.json({ users });
}
