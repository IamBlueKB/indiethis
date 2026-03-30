import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function getDjProfileAndCrate(userId: string, crateId: string) {
  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!djProfile) return null;

  const crate = await db.crate.findUnique({
    where: { id: crateId },
    select: { id: true, djProfileId: true },
  });

  if (!crate) return null;

  // Allow access if owner OR collaborator
  if (crate.djProfileId !== djProfile.id) {
    const collab = await db.crateCollaborator.findUnique({
      where: { crateId_djProfileId: { crateId, djProfileId: djProfile.id } },
    });
    if (!collab) return null;
  }

  return { djProfileId: djProfile.id, crateOwnerId: crate.djProfileId };
}

// GET /api/dashboard/dj/crates/[id]/items
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getDjProfileAndCrate(session.user.id as string, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const crateData = await db.crate.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, isPublic: true, djProfileId: true },
  });

  const items = await db.crateItem.findMany({
    where: { crateId: id },
    orderBy: { addedAt: "desc" },
    select: {
      id: true,
      trackId: true,
      addedAt: true,
      notes: true,
      track: {
        select: {
          id: true,
          title: true,
          coverArtUrl: true,
          fileUrl: true,
          genre: true,
          bpm: true,
          musicalKey: true,
          audioFeatures: {
            select: { danceability: true, energy: true },
          },
          artist: {
            select: {
              id: true,
              name: true,
              artistName: true,
              artistSlug: true,
              artistSite: { select: { isPublished: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ items, crate: crateData });
}

// POST /api/dashboard/dj/crates/[id]/items — add track
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getDjProfileAndCrate(session.user.id as string, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as { trackId?: string };
  if (!body.trackId) return NextResponse.json({ error: "trackId is required" }, { status: 400 });

  try {
    const item = await db.crateItem.create({
      data: { crateId: id, trackId: body.trackId },
    });
    return NextResponse.json({ item });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Track already in crate" }, { status: 409 });
    }
    throw e;
  }
}
