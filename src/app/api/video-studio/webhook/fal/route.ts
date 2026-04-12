/**
 * POST /api/video-studio/webhook/fal
 *
 * Receives completion callbacks from fal.ai when scene generation finishes.
 * fal.ai POSTs here (via the `fal_webhook` query param) with the result of
 * each fal.queue.submit() call.
 *
 * Flow:
 *   1. Look up FalSceneJob by request_id to identify which video/scene completed
 *   2. Mark job COMPLETE or FAILED, storing videoUrl
 *   3. Update MusicVideo progress
 *   4. When all scenes are done → stitch with Remotion → mark COMPLETE
 *
 * maxDuration: 300 — the last scene callback triggers Remotion Lambda stitching
 * which polls an external AWS Lambda. 5 minutes covers most video lengths.
 */

import { NextRequest, NextResponse }    from "next/server";
import { db }                           from "@/lib/db";
import {
  generateMultiFormatVideos,
  pickThumbnailScene,
  type GeneratedSceneOutput,
}                                       from "@/lib/video-studio/generator";
import { sendMusicVideoCompleteEmail }  from "@/lib/brevo/email";
import { sendVideoConversionEmail1 }    from "@/lib/agents/video-conversion";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await req.json() as Record<string, any>;
    const { request_id, status, payload } = body;

    if (!request_id) {
      return NextResponse.json({ error: "Missing request_id" }, { status: 400 });
    }

    // ── 1. Look up the scene job ─────────────────────────────────────────────
    const job = await db.falSceneJob.findUnique({ where: { requestId: request_id } });
    if (!job) {
      // fal.ai may send retries — return 200 so it doesn't keep retrying
      console.warn(`[fal webhook] No FalSceneJob for request_id: ${request_id}`);
      return NextResponse.json({ received: true });
    }

    const { musicVideoId, sceneIndex, sceneTotal } = job;

    // Guard: if video already failed or completed (e.g. a late retry), skip
    const videoCheck = await db.musicVideo.findUnique({
      where:  { id: musicVideoId },
      select: { status: true },
    });
    if (!videoCheck || videoCheck.status === "COMPLETE" || videoCheck.status === "FAILED") {
      return NextResponse.json({ received: true });
    }

    // ── 2. Record result ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoUrl:     string      = payload?.video?.url ?? "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const thumbnailUrl: string|null = payload?.video?.thumbnail_url ?? null;

    if (status === "OK" && videoUrl) {
      await db.falSceneJob.update({
        where: { id: job.id },
        data:  { status: "COMPLETE", videoUrl, thumbnailUrl },
      });
      console.log(`[fal webhook] Scene ${sceneIndex}/${sceneTotal - 1} of ${musicVideoId} ✓`);
    } else {
      await db.falSceneJob.update({
        where: { id: job.id },
        data:  { status: "FAILED" },
      });
      console.error(`[fal webhook] Scene ${sceneIndex} of ${musicVideoId} failed — fal status: ${status}`);
    }

    // ── 3. Count completed / failed jobs for this video ──────────────────────
    const doneJobs = await db.falSceneJob.findMany({
      where:   { musicVideoId, status: { in: ["COMPLETE", "FAILED"] } },
      orderBy: { sceneIndex: "asc" },
    });

    const doneCount = doneJobs.length;

    // Update progress (scene gen = 25–75% of overall progress)
    const genProgress = 25 + Math.round((doneCount / sceneTotal) * 50);
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        progress:    genProgress,
        currentStep: `Generated ${doneCount}/${sceneTotal} scenes…`,
      },
    });

    if (doneCount < sceneTotal) {
      // More scenes still pending — nothing more to do yet
      return NextResponse.json({ received: true });
    }

    // ── 4. All scenes done — build GeneratedSceneOutput[] ────────────────────
    const allJobs = await db.falSceneJob.findMany({
      where:   { musicVideoId },
      orderBy: { sceneIndex: "asc" },
    });

    const video = await db.musicVideo.findUnique({
      where:  { id: musicVideoId },
      select: {
        audioUrl:     true,
        aspectRatio:  true,
        trackDuration:true,
        thumbnailUrl: true,
        userId:       true,
        guestEmail:   true,
        trackTitle:   true,
        amount:       true,
        mode:         true,
        scenes:       true,   // placeholder scenes written during submission
      },
    });

    if (!video) {
      console.error(`[fal webhook] MusicVideo ${musicVideoId} not found during final assembly`);
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Merge job results with the placeholder scene metadata (model, prompt, timing)
    const placeholders = (video.scenes as GeneratedSceneOutput[] | null) ?? [];

    const sceneResults: GeneratedSceneOutput[] = allJobs.map(j => {
      const ph = placeholders.find(s => s.sceneIndex === j.sceneIndex);
      return {
        sceneIndex:       j.sceneIndex,
        videoUrl:         j.videoUrl  ?? "",
        thumbnailUrl:     j.thumbnailUrl ?? null,
        model:            ph?.model            ?? "",
        prompt:           ph?.prompt           ?? "",
        startTime:        ph?.startTime        ?? 0,
        endTime:          ph?.endTime          ?? 0,
        energyLevel:      ph?.energyLevel      ?? 0.5,
        qaApproved:       null,
        qaReason:         j.status === "FAILED" ? "Generation failed" : null,
        qaRetried:        false,
        originalPrompt:   ph?.originalPrompt   ?? "",
        refinedPrompt:    null,
        primaryModel:     ph?.primaryModel     ?? "",
        actualModel:      ph?.actualModel      ?? "",
        fallbackUsed:     ph?.fallbackUsed     ?? false,
        fallbackAttempts: ph?.fallbackAttempts ?? 0,
      };
    });

    const completedScenes = sceneResults.filter(s => s.videoUrl);

    if (completedScenes.length === 0) {
      await db.musicVideo.update({
        where: { id: musicVideoId },
        data:  {
          status:       "FAILED",
          progress:     0,
          currentStep:  "Generation failed",
          errorMessage: "All scenes failed to generate",
        },
      });
      console.error(`[fal webhook] All scenes failed for ${musicVideoId}`);
      return NextResponse.json({ received: true });
    }

    // ── 5. Write assembled scenes → stitch with Remotion ─────────────────────
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        scenes:      sceneResults as object[],
        status:      "STITCHING",
        progress:    75,
        currentStep: "Stitching your video…",
      },
    });

    const durationMs    = Math.round(video.trackDuration * 1000);
    const finalVideoUrls = await generateMultiFormatVideos(
      musicVideoId,
      sceneResults,
      video.audioUrl,
      [video.aspectRatio],
      durationMs,
    );

    const finalVideoUrl    = finalVideoUrls[video.aspectRatio] ?? Object.values(finalVideoUrls)[0] ?? null;
    const thumbScene       = pickThumbnailScene(sceneResults);
    const finalThumbnailUrl = thumbScene?.videoUrl ?? video.thumbnailUrl ?? null;

    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        status:         "COMPLETE",
        progress:       100,
        currentStep:    "Complete!",
        scenes:         sceneResults as object[],
        finalVideoUrl:  finalVideoUrl  ?? undefined,
        finalVideoUrls: (Object.keys(finalVideoUrls).length > 0 ? finalVideoUrls : null) as object | undefined,
        thumbnailUrl:   finalThumbnailUrl ?? undefined,
      },
    });

    console.log(`[fal webhook] ${musicVideoId} complete — ${completedScenes.length}/${sceneTotal} scenes`);

    // ── 6. Notification email ─────────────────────────────────────────────────
    try {
      const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
      const previewUrl = `${appUrl}/video-studio/${musicVideoId}/preview`;

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
          id:            musicVideoId,
          trackTitle:    video.trackTitle,
          guestEmail:    video.guestEmail,
          amount:        video.amount,
          mode:          video.mode,
          finalVideoUrl: finalVideoUrl ?? null,
          finalVideoUrls: null,
        });
        await db.musicVideo.update({
          where: { id: musicVideoId },
          data:  {
            conversionStep:   1,
            conversionNextAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
      }
    } catch (emailErr) {
      console.warn("[fal webhook] notification email failed:", emailErr);
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fal webhook] Unhandled error:", msg);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
