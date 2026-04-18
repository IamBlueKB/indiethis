/**
 * src/lib/video-studio/stitch-recovery.ts
 *
 * Stuck Stitch Recovery Agent
 *
 * Finds MusicVideo records stuck in STITCHING status for >30 minutes and
 * attempts to recover them by:
 *   1. Checking if the Remotion render actually completed (webhook may have missed)
 *   2. If complete → mark COMPLETE in the DB
 *   3. If fatal error or >2h stale → mark FAILED
 *   4. If still rendering → leave alone (might still complete)
 *
 * Wired into /api/cron/agents on every tick (no shouldRun guard — it's lightweight).
 */

import { db }                    from "@/lib/db";
import { getRenderProgress }     from "@remotion/lambda/client";
import { renderMediaOnLambda }   from "@remotion/lambda/client";

const STALE_MINUTES = 30;   // consider stuck after this many minutes in STITCHING
const FATAL_MINUTES = 120;  // mark FAILED if stuck longer than this (Lambda timeout exceeded)

// Remotion env config
const AWS_REGION    = (process.env.REMOTION_REGION ?? process.env.AWS_REGION ?? "us-east-1") as "us-east-1";
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME ?? "";
const SERVE_URL     = process.env.REMOTION_SERVE_URL ?? "";
const BUCKET_NAME   = (() => {
  const url = SERVE_URL;
  return url.match(/^https?:\/\/([^.]+)\.s3\./)?.[1] ?? "";
})();
const APP_URL       = process.env.APP_WEBHOOK_URL ?? "https://indiethis.com";

interface RecoveryResult {
  checked:   number;
  recovered: number;
  failed:    number;
  skipped:   number;
}

export async function recoverStuckStitches(): Promise<RecoveryResult> {
  const result: RecoveryResult = { checked: 0, recovered: 0, failed: 0, skipped: 0 };

  const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
  const fatalThreshold = new Date(Date.now() - FATAL_MINUTES * 60 * 1000);

  const stuckVideos = await db.musicVideo.findMany({
    where: {
      status:    "STITCHING",
      updatedAt: { lt: staleThreshold },
    },
    select: {
      id:            true,
      errorMessage:  true,
      updatedAt:     true,
      audioUrl:      true,
      aspectRatio:   true,
      trackDuration: true,
      scenes:        true,
    },
  });

  console.log(`[stitch-recovery] Found ${stuckVideos.length} stuck video(s)`);

  for (const video of stuckVideos) {
    result.checked++;

    // Parse renderId from errorMessage field (format: remotion:{renderId}:{bucketName})
    const match    = video.errorMessage?.match(/^remotion:([^:]+):(.+)$/);
    const renderId = match?.[1];
    const bucket   = match?.[2] ?? BUCKET_NAME;

    if (!renderId) {
      // No renderId stored — can't check progress. If fatally old, mark failed.
      if (video.updatedAt < fatalThreshold) {
        await db.musicVideo.update({
          where: { id: video.id },
          data: {
            status:       "FAILED",
            progress:     0,
            currentStep:  "Video render failed",
            errorMessage: "Stitch timed out — no render ID found. Please regenerate.",
          },
        });
        console.warn(`[stitch-recovery] ${video.id} — no renderId, marked FAILED`);
        result.failed++;
      } else {
        result.skipped++;
      }
      continue;
    }

    try {
      const progress = await getRenderProgress({
        renderId,
        bucketName:   bucket,
        region:       AWS_REGION,
        functionName: FUNCTION_NAME,
      });

      if (progress.done && progress.outputFile) {
        // Render completed — webhook was missed. Mark complete now.
        await db.musicVideo.update({
          where: { id: video.id },
          data: {
            status:        "COMPLETE",
            progress:      100,
            currentStep:   "Complete!",
            finalVideoUrl: progress.outputFile,
            errorMessage:  null,
          },
        });
        console.log(`[stitch-recovery] ${video.id} — recovered! Output: ${progress.outputFile}`);
        result.recovered++;

      } else if (progress.fatalErrorEncountered) {
        // Remotion render fatally failed. If we still have clips, re-submit.
        const scenes = (video.scenes as Record<string, unknown>[] | null) ?? [];
        const clips  = scenes.filter(s => s.videoUrl).map(s => ({
          videoUrl:  s.videoUrl  as string,
          startTime: s.startTime as number,
          endTime:   s.endTime   as number,
          duration:  (s.endTime as number) - (s.startTime as number),
        }));

        if (clips.length > 0 && FUNCTION_NAME && SERVE_URL) {
          console.log(`[stitch-recovery] ${video.id} — fatal error, re-submitting stitch with ${clips.length} clips`);
          const validRatio = (video.aspectRatio === "9:16" || video.aspectRatio === "1:1")
            ? video.aspectRatio : "16:9";

          try {
            const submitted = await renderMediaOnLambda({
              region:          AWS_REGION,
              functionName:    FUNCTION_NAME,
              serveUrl:        SERVE_URL,
              composition:     "MusicVideoComposition",
              inputProps: {
                scenes:      clips,
                audioUrl:    video.audioUrl,
                aspectRatio: validRatio,
                durationMs:  Math.round(video.trackDuration * 1000),
                crossfadeMs: 800,
              } as unknown as Record<string, unknown>,
              codec:           "h264" as const,
              imageFormat:     "jpeg" as const,
              maxRetries:      2,
              privacy:         "public" as const,
              framesPerLambda: 300,
              outName:         `music-video-${video.id}-${validRatio.replace(":", "x")}.mp4`,
              webhook: {
                url:        `${APP_URL}/api/video-studio/webhook/remotion`,
                secret:     process.env.REMOTION_WEBHOOK_SECRET ?? null,
                customData: { musicVideoId: video.id },
              },
            });

            await db.musicVideo.update({
              where: { id: video.id },
              data: {
                status:       "STITCHING",
                progress:     75,
                currentStep:  "Stitching your video…",
                errorMessage: `remotion:${submitted.renderId}:${submitted.bucketName}`,
              },
            });
            console.log(`[stitch-recovery] ${video.id} — re-submitted render: ${submitted.renderId}`);
            result.recovered++;
          } catch (resubErr) {
            console.error(`[stitch-recovery] ${video.id} — re-submit failed:`, resubErr);
            await db.musicVideo.update({
              where: { id: video.id },
              data: {
                status:       "FAILED",
                progress:     0,
                currentStep:  "Video render failed",
                errorMessage: `Render failed: ${String(resubErr).slice(0, 200)}`,
              },
            });
            result.failed++;
          }
        } else {
          // No clips or no Remotion config — can't recover
          await db.musicVideo.update({
            where: { id: video.id },
            data: {
              status:       "FAILED",
              progress:     0,
              currentStep:  "Video render failed",
              errorMessage: "All render attempts failed. Please regenerate.",
            },
          });
          result.failed++;
        }

      } else if (video.updatedAt < fatalThreshold) {
        // Still "rendering" but has been stuck for >2h — something is wrong
        await db.musicVideo.update({
          where: { id: video.id },
          data: {
            status:       "FAILED",
            progress:     0,
            currentStep:  "Video render failed",
            errorMessage: "Render timed out after 2 hours. Please regenerate.",
          },
        });
        console.warn(`[stitch-recovery] ${video.id} — 2h timeout, marked FAILED`);
        result.failed++;

      } else {
        // Still actively rendering — leave it alone
        console.log(`[stitch-recovery] ${video.id} — render in progress (${(progress.overallProgress * 100).toFixed(0)}%), skipping`);
        result.skipped++;
      }

    } catch (err) {
      console.error(`[stitch-recovery] Error checking ${video.id}:`, err);
      result.skipped++;
    }
  }

  return result;
}
