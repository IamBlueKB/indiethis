/**
 * POST /api/dashboard/lyric-video/preview
 *
 * Triggers a Remotion Lambda render of the first 300 frames (10 seconds at 30fps)
 * for free preview. No credit is deducted.
 *
 * Body: all LyricVideoProps + previewOnly: true
 * Response: { previewUrl?: string, renderId?: string, message?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const serveUrl    = process.env.REMOTION_SERVE_URL;
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const awsRegion   = process.env.AWS_REGION ?? "us-east-1";

  if (!serveUrl || serveUrl.startsWith("your_") || !functionName) {
    // Preview not yet configured — return a graceful message
    return NextResponse.json(
      { message: "Preview rendering is not yet configured. Proceed to generate the full video." },
      { status: 200 },
    );
  }

  const {
    lyrics,
    audioUrl,
    trackTitle      = "Untitled",
    artistName      = "Artist",
    backgroundUrl   = "",
    backgroundType  = "image",
    accentColor     = "#D4A843",
    textStyle       = "captions",
    fontChoice      = "inter",
    textPosition    = "bottom",
    aspectRatio     = "16:9",
  } = body as {
    lyrics?:         Array<{ word: string; startMs: number; endMs: number }>;
    audioUrl?:       string;
    trackTitle?:     string;
    artistName?:     string;
    backgroundUrl?:  string;
    backgroundType?: string;
    accentColor?:    string;
    textStyle?:      string;
    fontChoice?:     string;
    textPosition?:   string;
    aspectRatio?:    string;
    durationMs?:     number;
  };

  if (!audioUrl?.trim()) {
    return NextResponse.json({ error: "audioUrl is required" }, { status: 400 });
  }

  // Preview: first 300 frames = 10 seconds @ 30fps
  const PREVIEW_FRAMES = 300;
  const PREVIEW_MS     = 10_000;

  const { renderId, bucketName } = await renderMediaOnLambda({
    region:       awsRegion as Parameters<typeof renderMediaOnLambda>[0]["region"],
    functionName,
    serveUrl,
    composition:  "LyricVideo",
    inputProps: {
      lyrics:        lyrics ?? [],
      audioUrl,
      trackTitle,
      artistName,
      backgroundUrl,
      backgroundType,
      accentColor,
      textStyle,
      fontChoice,
      textPosition,
      aspectRatio,
      durationMs:    PREVIEW_MS,
    },
    // Only render first 300 frames
    frameRange:   [0, PREVIEW_FRAMES - 1],
    codec:        "h264",
    imageFormat:  "jpeg",
    maxRetries:   1,
    privacy:      "public",
    outName:      `preview-${session.user.id}-${Date.now()}.mp4`,
  });

  // Poll for up to 2 minutes
  const MAX_WAIT_MS   = 120_000;
  const POLL_INTERVAL = 5_000;
  const startTime     = Date.now();
  let previewUrl: string | null = null;

  while (Date.now() - startTime < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region: awsRegion as Parameters<typeof getRenderProgress>[0]["region"],
    });

    if (progress.fatalErrorEncountered) {
      const errMsg = progress.errors?.[0]?.message ?? "Preview render failed";
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    if (progress.done) {
      previewUrl = progress.outputFile ?? null;
      break;
    }
  }

  if (!previewUrl) {
    return NextResponse.json(
      { message: "Preview is taking longer than expected. Proceed to generate the full video." },
      { status: 200 },
    );
  }

  return NextResponse.json({ previewUrl, renderId });
}
