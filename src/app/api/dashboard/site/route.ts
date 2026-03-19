import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { artistSlug: true, instagramHandle: true },
  });

  const site = await db.artistSite.findFirst({
    where: { artistId: session.user.id },
  });

  return NextResponse.json({ site, slug: user?.artistSlug ?? null, instagramHandle: user?.instagramHandle ?? null });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { bioContent, draftMode, isPublished, heroImage, followGateEnabled, pwywEnabled, credentials } = body;

  const data: Record<string, unknown> = {};
  if (bioContent !== undefined) data.bioContent = bioContent;
  if (draftMode !== undefined) data.draftMode = draftMode;
  if (isPublished !== undefined) data.isPublished = isPublished;
  if (heroImage !== undefined) data.heroImage = heroImage;
  if (followGateEnabled !== undefined) data.followGateEnabled = followGateEnabled;
  if (pwywEnabled !== undefined) data.pwywEnabled = pwywEnabled;
  if (credentials !== undefined && Array.isArray(credentials)) data.credentials = credentials;

  const site = await db.artistSite.upsert({
    where: { artistId: session.user.id },
    update: data,
    create: {
      artistId: session.user.id,
      ...data,
    },
  });

  return NextResponse.json({ site });
}
