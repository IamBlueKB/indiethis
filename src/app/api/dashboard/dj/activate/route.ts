import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// POST /api/dashboard/dj/activate
// Creates a DJProfile and sets user.djMode = true
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id as string;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { artistSlug: true, name: true, artistName: true, djMode: true },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Build a slug: prefer artistSlug, otherwise generate from name
  let baseSlug = user.artistSlug ?? (user.artistName ?? user.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!baseSlug) baseSlug = `dj-${userId.slice(0, 8)}`;

  // Ensure unique slug
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const existing = await db.dJProfile.findUnique({ where: { slug }, select: { id: true, userId: true } });
    if (!existing) break;
    if (existing.userId === userId) {
      // Already own this slug, reuse it
      break;
    }
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  // Upsert DJProfile
  const djProfile = await db.dJProfile.upsert({
    where: { userId },
    create: { userId, slug },
    update: {},
  });

  // Set djMode on user
  await db.user.update({ where: { id: userId }, data: { djMode: true } });

  return NextResponse.json({ ok: true, djProfile });
}
