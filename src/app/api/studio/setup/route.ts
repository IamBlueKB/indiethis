import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Don't allow creating a second studio
  const existing = await db.studio.findFirst({ where: { ownerId: userId } });
  if (existing) {
    return NextResponse.json({ error: "Studio already exists.", studioId: existing.id }, { status: 409 });
  }

  const body = await req.json() as {
    name?: string; address?: string; phone?: string; email?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Studio name is required." }, { status: 400 });
  }

  // Generate a slug from the studio name
  const baseSlug = body.name.trim().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);

  // Ensure slug is unique
  let slug = baseSlug;
  let suffix = 1;
  while (await db.studio.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const studio = await db.studio.create({
    data: {
      name: body.name.trim(),
      slug,
      address: body.address?.trim() ?? null,
      phone: body.phone?.trim() ?? null,
      email: body.email?.trim() ?? null,
      ownerId: userId,
    },
  });

  return NextResponse.json({ studioId: studio.id, slug: studio.slug });
}
