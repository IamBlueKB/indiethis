import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// ─── Ownership guard ──────────────────────────────────────────────────────────

async function getOwnedDoc(docId: string, userId: string) {
  return db.licenseDocument.findFirst({ where: { id: docId, userId } });
}

// ─── PATCH /api/dashboard/vault/[id] ─────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getOwnedDoc(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as {
    title?:        string;
    source?:       string;
    notes?:        string | null;
    trackId?:      string | null;
    streamLeaseId?: string | null;
    fileUrl?:      string;
    fileType?:     string;
  };

  const doc = await db.licenseDocument.update({
    where: { id },
    data: {
      ...(body.title        !== undefined && { title: body.title.trim() }),
      ...(body.source       !== undefined && { source: body.source as never }),
      ...(body.notes        !== undefined && { notes: body.notes?.trim() || null }),
      ...(body.trackId      !== undefined && { trackId: body.trackId || null }),
      ...(body.streamLeaseId !== undefined && { streamLeaseId: body.streamLeaseId || null }),
      ...(body.fileUrl      !== undefined && { fileUrl: body.fileUrl }),
      ...(body.fileType     !== undefined && { fileType: body.fileType }),
    },
    include: {
      track:       { select: { id: true, title: true, beatLeaseSettings: { select: { id: true } } } },
      streamLease: { select: { id: true, trackTitle: true } },
      aiJob:       { select: { id: true, type: true } },
    },
  });

  const out = {
    ...doc,
    track: doc.track
      ? { id: doc.track.id, title: doc.track.title, isBeat: !!doc.track.beatLeaseSettings }
      : null,
  };

  return NextResponse.json({ doc: out });
}

// ─── DELETE /api/dashboard/vault/[id] ────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getOwnedDoc(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.licenseDocument.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
