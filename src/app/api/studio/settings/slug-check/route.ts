import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/studio/settings/slug-check?slug=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get("slug")?.trim().toLowerCase();
  if (!slug) return NextResponse.json({ available: false });

  // Validate slug format: lowercase alphanumeric + hyphens only
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ available: false, error: "Only letters, numbers, and hyphens allowed." });
  }

  // Find own studio so we can exclude it from the conflict check
  const ownStudio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true, slug: true },
  });
  if (!ownStudio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  // Own current slug is always "available"
  if (ownStudio.slug === slug) {
    return NextResponse.json({ available: true });
  }

  // Check conflict within studios (excluding own) AND against any artist slug
  const [studioConflict, artistConflict] = await Promise.all([
    db.studio.findFirst({
      where:  { slug, id: { not: ownStudio.id } },
      select: { id: true },
    }),
    db.user.findFirst({
      where:  { artistSlug: slug },
      select: { id: true },
    }),
  ]);

  if (studioConflict || artistConflict) {
    return NextResponse.json({ available: false });
  }

  return NextResponse.json({ available: true });
}
