import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { detectAudioFeaturesFromUrls } from "@/lib/audio-analysis";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({ where: { ownerId: session.user.id }, select: { id: true } });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const { id } = await params;
  const submission = await db.intakeSubmission.findUnique({
    where: { id },
    select: { id: true, studioId: true, fileUrls: true },
  });

  if (!submission || submission.studioId !== studio.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (submission.fileUrls.length === 0) {
    return NextResponse.json({ error: "No files found" }, { status: 400 });
  }

  let bpm: number | null = null;
  let musicalKey: string | null = null;
  try {
    const features = await detectAudioFeaturesFromUrls(submission.fileUrls);
    bpm        = features.bpm;
    musicalKey = features.musicalKey;
  } catch (err) {
    console.error("[analyze] detectAudioFeaturesFromUrls failed:", err);
    return NextResponse.json({ error: "Analysis failed", detail: String(err) }, { status: 500 });
  }

  const updated = await db.intakeSubmission.update({
    where: { id },
    data: {
      ...(bpm        !== null && { bpmDetected: bpm }),
      ...(musicalKey !== null && { keyDetected: musicalKey }),
    },
    select: { bpmDetected: true, keyDetected: true },
  });

  return NextResponse.json({ bpmDetected: updated.bpmDetected, keyDetected: updated.keyDetected });
}
