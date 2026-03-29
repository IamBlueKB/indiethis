import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    title?: string;
    status?: "DRAFT" | "PUBLISHED";
    price?: number | null;
    projectName?: string;
    description?: string;
    coverArtUrl?: string | null;
    fileUrl?: string;
    bpm?: number | null;
    musicalKey?: string | null;
    audioHash?: string | null;
    genre?: string | null;
    tags?: string[];
  };

  const fileUrlChanged = body.fileUrl !== undefined;

  const track = await db.track.updateMany({
    where: { id, artistId: session.user.id },
    data: {
      ...(body.title        !== undefined && { title:       body.title.trim() }),
      ...(body.status       !== undefined && { status:      body.status }),
      ...(body.price        !== undefined && { price:       body.price }),
      ...(body.projectName  !== undefined && { projectName: body.projectName }),
      ...(body.description  !== undefined && { description: body.description }),
      ...(body.coverArtUrl  !== undefined && { coverArtUrl: body.coverArtUrl }),
      ...(body.fileUrl      !== undefined && { fileUrl:     body.fileUrl }),
      ...(body.bpm          !== undefined && { bpm:         body.bpm }),
      ...(body.musicalKey   !== undefined && { musicalKey:  body.musicalKey }),
      ...(body.audioHash    !== undefined && { audioHash:   body.audioHash }),
    },
  });

  // If the file URL changed, delete the stale AudioFeatures record so it
  // gets re-analyzed on the next client visit via triggerAudioAnalysis.
  if (fileUrlChanged && track.count > 0) {
    void db.audioFeatures.deleteMany({ where: { trackId: id } })
      .catch(() => { /* silent — non-critical */ });
  }

  return NextResponse.json({ updated: track.count });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await db.track.deleteMany({ where: { id, artistId: session.user.id } });

  return NextResponse.json({ deleted: true });
}
