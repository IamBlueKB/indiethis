/**
 * /api/samples/[id] — update or delete a single SampleLog
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.sampleLog.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await req.json() as Partial<{
    trackId:         string | null;
    sampleSource:    string;
    sampleType:      string;
    isCleared:       boolean;
    clearanceMethod: string | null;
    clearanceNotes:  string | null;
    clearanceDocUrl: string | null;
  }>;

  const updated = await db.sampleLog.update({
    where: { id },
    data:  {
      ...(body.trackId         !== undefined && { trackId:         body.trackId }),
      ...(body.sampleSource    !== undefined && { sampleSource:    body.sampleSource.trim() }),
      ...(body.sampleType      !== undefined && { sampleType:      body.sampleType }),
      ...(body.isCleared       !== undefined && { isCleared:       body.isCleared }),
      ...(body.clearanceMethod !== undefined && { clearanceMethod: body.clearanceMethod }),
      ...(body.clearanceNotes  !== undefined && { clearanceNotes:  body.clearanceNotes?.trim() ?? null }),
      ...(body.clearanceDocUrl !== undefined && { clearanceDocUrl: body.clearanceDocUrl }),
    },
    include: { track: { select: { id: true, title: true, coverArtUrl: true } } },
  });

  return NextResponse.json({ sample: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.sampleLog.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await db.sampleLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
