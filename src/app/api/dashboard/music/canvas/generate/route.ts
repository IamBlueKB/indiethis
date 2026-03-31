/**
 * POST /api/dashboard/music/canvas/generate
 *
 * Triggers a Remotion Lambda render of the TrackCanvas composition,
 * polls for completion, saves the output URL, and sends an in-app notification.
 *
 * Body:    { trackId: string; sessionId?: string }
 * Returns: { success: true; canvasVideoUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import { createNotification } from "@/lib/notifications";
import { stripe } from "@/lib/stripe";

type AwsRegion = Parameters<typeof renderMediaOnLambda>[0]["region"];

const MAX_WAIT_MS = 180_000; // 3 minutes
const POLL_INTERVAL_MS = 3_000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { trackId?: string; sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { trackId, sessionId } = body;
  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  // Verify track belongs to user
  const track = await db.track.findUnique({
    where: { id: trackId },
    select: { id: true, artistId: true, fileUrl: true, coverArtUrl: true },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  if (track.artistId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify Stripe payment if sessionId provided
  if (sessionId) {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    if (checkoutSession.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
    }
    if (
      checkoutSession.metadata?.trackId !== trackId ||
      checkoutSession.metadata?.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "Session metadata mismatch" }, { status: 403 });
    }
  }

  const serveUrl = process.env.REMOTION_SERVE_URL;
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const awsRegion = (process.env.REMOTION_REGION ?? process.env.AWS_REGION ?? "us-east-1") as AwsRegion;

  if (!serveUrl || !functionName) {
    return NextResponse.json({ error: "Remotion Lambda not configured" }, { status: 503 });
  }

  // Start render
  const { renderId, bucketName } = await renderMediaOnLambda({
    region: awsRegion,
    functionName,
    serveUrl,
    composition: "TrackCanvas",
    inputProps: {
      coverArtUrl: track.coverArtUrl ?? "",
      audioUrl: track.fileUrl,
      accentColor: "#D4A843",
    },
    codec: "h264",
    imageFormat: "jpeg",
    maxRetries: 1,
    framesPerLambda: 60,
    privacy: "public",
    outName: `canvas-${track.id}-${Date.now()}.mp4`,
  });

  // Poll until done or timeout
  const startTime = Date.now();
  let canvasVideoUrl: string | null = null;

  while (Date.now() - startTime < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region: awsRegion,
    });

    if (progress.fatalErrorEncountered) {
      const errMsg = progress.errors?.[0]?.message ?? "Canvas render failed";
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    if (progress.done) {
      canvasVideoUrl = progress.outputFile ?? null;
      break;
    }
  }

  if (!canvasVideoUrl) {
    return NextResponse.json(
      { error: "Render timed out after 3 minutes" },
      { status: 504 }
    );
  }

  // Save to track
  await db.track.update({
    where: { id: trackId },
    data: { canvasVideoUrl },
  });

  // In-app notification
  void createNotification({
    userId: session.user.id,
    type: "AI_JOB_COMPLETE",
    title: "Your Track Canvas is ready",
    message: "Your canvas video has been generated and is ready to use.",
    link: "/dashboard/music",
  }).catch(() => {});

  return NextResponse.json({ success: true, canvasVideoUrl });
}
