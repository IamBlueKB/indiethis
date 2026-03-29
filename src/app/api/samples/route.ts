/**
 * /api/samples — CRUD for SampleLog entries
 * GET  — list all sample logs for the authenticated user
 * POST — create a new sample log
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [samples, tracks] = await Promise.all([
    db.sampleLog.findMany({
      where:   { userId: session.user.id },
      include: { track: { select: { id: true, title: true, coverArtUrl: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.track.findMany({
      where:   { artistId: session.user.id, status: { not: "DRAFT" } },
      select:  { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take:    200,
    }),
  ]);

  const unclearedCount = samples.filter(s => !s.isCleared).length;

  return NextResponse.json({ samples, tracks, unclearedCount });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    trackId?:        string;
    sampleSource:    string;
    sampleType:      string;
    isCleared?:      boolean;
    clearanceMethod?: string;
    clearanceNotes?:  string;
    clearanceDocUrl?: string;
  };

  if (!body.sampleSource?.trim()) {
    return NextResponse.json({ error: "Sample source is required." }, { status: 400 });
  }
  if (!body.sampleType?.trim()) {
    return NextResponse.json({ error: "Sample type is required." }, { status: 400 });
  }

  // Verify track belongs to user if provided
  if (body.trackId) {
    const track = await db.track.findFirst({ where: { id: body.trackId, artistId: session.user.id } });
    if (!track) return NextResponse.json({ error: "Track not found." }, { status: 404 });
  }

  const sample = await db.sampleLog.create({
    data: {
      userId:          session.user.id,
      trackId:         body.trackId || null,
      sampleSource:    body.sampleSource.trim(),
      sampleType:      body.sampleType,
      isCleared:       body.isCleared ?? false,
      clearanceMethod: body.clearanceMethod || null,
      clearanceNotes:  body.clearanceNotes?.trim() || null,
      clearanceDocUrl: body.clearanceDocUrl || null,
    },
    include: { track: { select: { id: true, title: true, coverArtUrl: true } } },
  });

  return NextResponse.json({ sample }, { status: 201 });
}
