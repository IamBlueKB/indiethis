import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/studio/artists — artists linked to this studio
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const studioArtists = await db.studioArtist.findMany({
    where: { studioId: studio.id },
    orderBy: { joinedAt: "desc" },
    include: {
      artist: {
        select: {
          id: true,
          name: true,
          artistName: true,
          email: true,
          instagramHandle: true,
          photo: true,
          createdAt: true,
          sessions: {
            where: { studioId: studio.id },
            select: { id: true, status: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ artists: studioArtists });
}
