import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/settings
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      artistName: true,
      email: true,
      phone: true,
      smsOptIn: true,
      bio: true,
      photo: true,
      instagramHandle: true,
      tiktokHandle: true,
      youtubeChannel: true,
      spotifyUrl: true,
      appleMusicUrl: true,
      artistSlug: true,
      djMode: true,
      djDiscoveryOptIn: true,
    },
  });

  return NextResponse.json({ user });
}

// PATCH /api/dashboard/settings
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Check slug uniqueness across both artist pages and studios
  if (body.artistSlug) {
    const slug = body.artistSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const [artistConflict, studioConflict] = await Promise.all([
      db.user.findFirst({
        where:  { artistSlug: slug, NOT: { id: session.user.id } },
        select: { id: true },
      }),
      db.studio.findFirst({
        where:  { slug },
        select: { id: true },
      }),
    ]);
    if (artistConflict || studioConflict) {
      return NextResponse.json({ error: "That URL is already taken" }, { status: 409 });
    }
    body.artistSlug = slug;
  }

  const user = await db.user.update({
    where: { id: session.user.id },
    data: {
      name: body.name?.trim() || undefined,
      artistName: body.artistName?.trim() ?? undefined,
      phone: body.phone?.trim() ?? undefined,
      smsOptIn: typeof body.smsOptIn === "boolean" ? body.smsOptIn : undefined,
      bio: body.bio?.trim() ?? undefined,
      photo: body.photo ?? undefined,
      instagramHandle: body.instagramHandle?.trim() ?? undefined,
      tiktokHandle: body.tiktokHandle?.trim() ?? undefined,
      youtubeChannel: body.youtubeChannel?.trim() ?? undefined,
      spotifyUrl: body.spotifyUrl?.trim() ?? undefined,
      appleMusicUrl: body.appleMusicUrl?.trim() ?? undefined,
      artistSlug: body.artistSlug ?? undefined,
      djDiscoveryOptIn: typeof body.djDiscoveryOptIn === "boolean" ? body.djDiscoveryOptIn : undefined,
    },
    select: {
      id: true, name: true, artistName: true, email: true, phone: true, smsOptIn: true,
      bio: true, photo: true, instagramHandle: true, tiktokHandle: true,
      youtubeChannel: true, spotifyUrl: true, appleMusicUrl: true, artistSlug: true,
      djDiscoveryOptIn: true,
    },
  });

  return NextResponse.json({ user });
}
