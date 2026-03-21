import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const users = await db.user.findMany({
    where: {
      artistSlug: { not: null },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { artistName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, artistName: true, artistSlug: true, photo: true },
    take: 8,
    orderBy: { name: "asc" },
  });

  const results = users.map((u) => ({
    id: u.id,
    name: u.artistName ?? u.name,
    slug: u.artistSlug!,
    photo: u.photo,
  }));

  return NextResponse.json({ results });
}
