import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/vault
// Returns all license documents for the user, plus tracks/leases for the upload modal dropdown.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [rawDocs, tracks, streamLeases] = await Promise.all([
    db.licenseDocument.findMany({
      where: { userId },
      include: {
        track: {
          select: {
            id: true,
            title: true,
            beatLeaseSettings: { select: { id: true } },
          },
        },
        streamLease: { select: { id: true, trackTitle: true } },
        aiJob:       { select: { id: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.track.findMany({
      where: { artistId: userId },
      select: {
        id: true,
        title: true,
        beatLeaseSettings: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.streamLease.findMany({
      where:   { artistId: userId },
      select:  { id: true, trackTitle: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  // Annotate docs with isBeat flag
  const docs = rawDocs.map((d) => ({
    ...d,
    track: d.track
      ? { id: d.track.id, title: d.track.title, isBeat: !!d.track.beatLeaseSettings }
      : null,
  }));

  // Annotate tracks with isBeat flag
  const tracksOut = tracks.map((t) => ({
    id:     t.id,
    title:  t.title,
    isBeat: !!t.beatLeaseSettings,
  }));

  return NextResponse.json({ docs, tracks: tracksOut, streamLeases });
}

// PATCH /api/dashboard/vault/[id] lives in the [id] sub-route — see below.
// This route handles the POST (create unattached / freely-attached doc).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    title: string;
    fileUrl: string;
    fileType: string;
    source: string;
    notes?: string;
    trackId?: string;
    streamLeaseId?: string;
  };

  if (!body.title?.trim() || !body.fileUrl || !body.source) {
    return NextResponse.json({ error: "title, fileUrl, and source are required." }, { status: 400 });
  }

  const doc = await db.licenseDocument.create({
    data: {
      userId:       session.user.id,
      title:        body.title.trim(),
      fileUrl:      body.fileUrl,
      fileType:     body.fileType,
      source:       body.source as never,
      notes:        body.notes?.trim() || null,
      trackId:      body.trackId       || null,
      streamLeaseId: body.streamLeaseId || null,
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

  return NextResponse.json({ doc: out }, { status: 201 });
}
