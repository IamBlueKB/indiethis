/**
 * POST /api/dashboard/lyric-video/transcribe
 *
 * Fetches a track by ID, runs Replicate Whisper large-v3 transcription,
 * and returns word-level and segment-level timestamps.
 *
 * Body: { trackId: string }
 * Response: { words: [...], segments: [...], text: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { trackId?: string; trackUrl?: string };
  try {
    body = await req.json() as { trackId?: string; trackUrl?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { trackId, trackUrl: directTrackUrl } = body;

  let audioUrl: string;

  if (directTrackUrl?.trim()) {
    // Studio mode: direct URL supplied (no DB lookup needed)
    audioUrl = directTrackUrl.trim();
  } else if (trackId?.trim()) {
    // Artist mode: look up track by ID
    const track = await db.track.findFirst({
      where:  { id: trackId, artistId: session.user.id },
      select: { id: true, title: true, fileUrl: true },
    });

    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }
    if (!track.fileUrl) {
      return NextResponse.json({ error: "Track has no audio file" }, { status: 400 });
    }
    audioUrl = track.fileUrl;
  } else {
    return NextResponse.json({ error: "trackId or trackUrl is required" }, { status: 400 });
  }

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!replicateToken || replicateToken.startsWith("your_")) {
    return NextResponse.json(
      { error: "Transcription service is not configured" },
      { status: 503 },
    );
  }

  // Run Replicate Whisper
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Replicate = require("replicate");
  const replicate = new Replicate({ auth: replicateToken });

  const output = await replicate.run(
    "openai/whisper:4d50797290df275329f202e48c76360b3f22b08d6d5b9b6b2e3d7d4b31d5c0b6",
    {
      input: {
        audio:           audioUrl,
        model:           "large-v3",
        word_timestamps: true,
        temperature:     0,
      },
    },
  ) as {
    transcription: string;
    segments: Array<{
      text:  string;
      start: number;
      end:   number;
      words: Array<{ word: string; start: number; end: number; probability: number }>;
    }>;
  };

  // Flatten words from segments
  const words = (output.segments ?? []).flatMap((seg) =>
    (seg.words ?? []).map((w) => ({ word: w.word, start: w.start, end: w.end })),
  );

  const segments = (output.segments ?? []).map((seg, i) => ({
    id:    i,
    start: seg.start,
    end:   seg.end,
    text:  seg.text,
  }));

  const text = output.transcription ?? "";

  return NextResponse.json({ words, segments, text });
}
