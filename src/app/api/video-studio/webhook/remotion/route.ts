/**
 * POST /api/video-studio/webhook/remotion
 *
 * Receives Remotion Lambda render completion callbacks.
 * Called by Remotion when a render finishes (success or error).
 *
 * Flow:
 *   1. Validate webhook signature (optional — skipped if no REMOTION_WEBHOOK_SECRET)
 *   2. Find video by renderId stored in errorMessage field (temp storage)
 *   3. On success: mark COMPLETE, save finalVideoUrl, send notification email
 *   4. On error: mark FAILED with error message
 *
 * maxDuration: 10 — just DB writes + email, no heavy work.
 */

import { NextRequest, NextResponse }    from "next/server";
import { db }                           from "@/lib/db";
import { validateWebhookSignature }     from "@remotion/lambda/client";
import { sendMusicVideoCompleteEmail }  from "@/lib/brevo/email";
import { sendVideoConversionEmail1 }    from "@/lib/agents/video-conversion";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = JSON.parse(rawBody) as Record<string, any>;

    // Optional signature validation
    const secret = process.env.REMOTION_WEBHOOK_SECRET;
    if (secret) {
      const signature = req.headers.get("x-remotion-signature") ?? "";
      try {
        validateWebhookSignature({ body: rawBody, secret, signatureHeader: signature });
      } catch {
        console.warn("[remotion webhook] Invalid signature — ignoring");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const { type, renderId, bucketName, outputFile, errors, customData } = payload;

    // Look up video — first try customData (most reliable), fall back to renderId scan
    let musicVideoId: string | null = customData?.musicVideoId ?? null;

    if (!musicVideoId && renderId) {
      const video = await db.musicVideo.findFirst({
        where:  { errorMessage: { startsWith: `remotion:${renderId}:` } },
        select: { id: true },
      });
      musicVideoId = video?.id ?? null;
    }

    if (!musicVideoId) {
      console.warn(`[remotion webhook] No video found for renderId: ${renderId}`);
      return NextResponse.json({ received: true });
    }

    console.log(`[remotion webhook] type=${type} renderId=${renderId} musicVideoId=${musicVideoId}`);

    if (type === "success") {
      const finalVideoUrl = outputFile ?? null;

      // Fetch video metadata for email
      const video = await db.musicVideo.findUnique({
        where:  { id: musicVideoId },
        select: {
          userId:     true,
          guestEmail: true,
          trackTitle: true,
          amount:     true,
          mode:       true,
          thumbnailUrl: true,
          scenes:     true,
          aspectRatio: true,
        },
      });

      if (!video) return NextResponse.json({ received: true });

      // Build finalVideoUrls map
      const aspectRatio   = video.aspectRatio ?? "16:9";
      const finalVideoUrls = finalVideoUrl ? { [aspectRatio]: finalVideoUrl } : {};

      // Thumbnail — first completed scene's video URL
      type SceneRow = { videoUrl?: string };
      const scenes = (video.scenes as SceneRow[] | null) ?? [];
      const thumbUrl = scenes.find(s => s.videoUrl)?.videoUrl ?? video.thumbnailUrl ?? null;

      await db.musicVideo.update({
        where: { id: musicVideoId },
        data: {
          status:         "COMPLETE",
          progress:       100,
          currentStep:    "Complete!",
          finalVideoUrl:  finalVideoUrl ?? undefined,
          finalVideoUrls: Object.keys(finalVideoUrls).length > 0
            ? (finalVideoUrls as object)
            : undefined,
          thumbnailUrl:   thumbUrl ?? undefined,
          errorMessage:   null, // clear the renderId temp storage
        },
      });

      console.log(`[remotion webhook] ${musicVideoId} COMPLETE — ${finalVideoUrl}`);

      // Notification email
      const previewUrl = `${APP_URL}/video-studio/${musicVideoId}/preview`;
      try {
        if (video.userId) {
          const user = await db.user.findUnique({
            where:  { id: video.userId },
            select: { email: true, name: true, artistSlug: true },
          });
          if (user?.email) {
            await sendMusicVideoCompleteEmail({
              toEmail:    user.email,
              toName:     user.name ?? "Artist",
              trackTitle: video.trackTitle,
              previewUrl,
              mode:       video.mode as "QUICK" | "DIRECTOR",
              artistSlug: user.artistSlug ?? undefined,
            });
          }
        } else if (video.guestEmail) {
          await sendVideoConversionEmail1({
            id:             musicVideoId,
            trackTitle:     video.trackTitle,
            guestEmail:     video.guestEmail,
            amount:         video.amount,
            mode:           video.mode,
            finalVideoUrl:  finalVideoUrl ?? null,
            finalVideoUrls: null,
          });
          await db.musicVideo.update({
            where: { id: musicVideoId },
            data: {
              conversionStep:   1,
              conversionNextAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            },
          });
        }
      } catch (emailErr) {
        console.warn("[remotion webhook] Notification email failed:", emailErr);
      }

    } else if (type === "error" || type === "timeout") {
      const errMsg = errors?.[0]?.message ?? `Remotion render ${type}`;
      await db.musicVideo.update({
        where: { id: musicVideoId },
        data: {
          status:       "FAILED",
          progress:     0,
          currentStep:  "Video render failed",
          errorMessage: errMsg,
        },
      });
      console.error(`[remotion webhook] ${musicVideoId} FAILED — ${errMsg}`);
    } else {
      // "timeout" or unknown type — log but don't crash
      console.warn(`[remotion webhook] Unhandled type=${type} for ${musicVideoId}`);
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[remotion webhook] Unhandled error:", msg);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
