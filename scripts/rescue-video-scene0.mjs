/**
 * rescue-video-scene0.mjs
 *
 * Regenerates scene 0 for video cmo3sh11w0000ikgbomvvfozm,
 * uploads the clip to UploadThing, updates the DB,
 * then triggers Remotion Lambda stitch for all 5 scenes.
 *
 * Polls fal.ai directly — no webhook dependency.
 *
 * Run: node scripts/rescue-video-scene0.mjs
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

// Load .env.local manually (dotenv/config only reads .env)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocal  = path.join(__dirname, "../.env.local");
try {
  const lines = readFileSync(envLocal, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch { /* no .env.local */ }

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const { fal }          = require("@fal-ai/client");
const { UTApi }        = require("uploadthing/server");
const { renderMediaOnLambda } = require("@remotion/lambda/client");

const VIDEO_ID       = "cmo3sh11w0000ikgbomvvfozm";
const KEYFRAME_URL   = "https://gcghrqi4kv.ufs.sh/f/rOmWbMsp1xCGhNkjcLZxPscKHFh2lCq5Zo4MgbufdIzAYEek";
const PROMPT         =
  "Full body shot, complete figure visible from head to toe. " +
  "The artist stands silhouetted against a textured brick wall, warm golden light creating rim lighting around their profile. " +
  "Polaroid-style warmth bathes the urban landscape as synthesizer tones begin. " +
  "Static framing captures the contemplative moment before movement begins. static_wide. 35mm_film. " +
  "natural movement, consistent body orientation, anatomically correct";
const NEGATIVE_PROMPT =
  "cropped body, cut off legs, torso only, disembodied, floating head, backwards legs, twisted limbs, " +
  "distorted anatomy, deformed body, wrong body direction, anatomical errors, warped figure, disconnected body parts";

const db    = new PrismaClient();
const utapi = new UTApi();

async function main() {
  fal.config({ credentials: process.env.FAL_KEY });

  // ── 1. Submit Kling job for scene 0 ──────────────────────────────────────────
  console.log("[rescue] Submitting Kling job for scene 0…");
  const submitted = await fal.queue.submit("fal-ai/kling-video/v3/pro/image-to-video", {
    input: {
      start_image_url: KEYFRAME_URL,
      prompt:          PROMPT,
      negative_prompt: NEGATIVE_PROMPT,
      duration:        "8",
      generate_audio:  false,
      aspect_ratio:    "16:9",
    },
  });
  const requestId = submitted.request_id;
  console.log(`[rescue] Submitted — request_id: ${requestId}`);

  // ── 2. Poll until complete ────────────────────────────────────────────────────
  console.log("[rescue] Polling fal.ai (this takes ~2 min for Kling)…");
  let result;
  while (true) {
    await new Promise(r => setTimeout(r, 15000)); // poll every 15s
    try {
      const status = await fal.queue.status("fal-ai/kling-video/v3/pro/image-to-video", {
        requestId,
        logs: false,
      });
      console.log(`[rescue] Status: ${status.status}`);
      if (status.status === "COMPLETED") {
        result = await fal.queue.result("fal-ai/kling-video/v3/pro/image-to-video", { requestId });
        break;
      }
      if (status.status === "FAILED") {
        throw new Error(`fal.ai job failed: ${JSON.stringify(status)}`);
      }
    } catch (err) {
      if (err.message?.includes("fal.ai job failed")) throw err;
      console.warn("[rescue] Poll error (will retry):", err.message);
    }
  }

  const falVideoUrl = result?.data?.video?.url ?? result?.video?.url;
  if (!falVideoUrl) throw new Error("No video URL in fal.ai result: " + JSON.stringify(result));
  console.log(`[rescue] Got clip from fal.ai: ${falVideoUrl}`);

  // ── 3. Upload to UploadThing (fal.ai URLs expire) ─────────────────────────────
  console.log("[rescue] Uploading to UploadThing…");
  const uploaded = await utapi.uploadFilesFromUrl([falVideoUrl]);
  const ut = uploaded[0];
  if (!ut?.data?.url) throw new Error("UploadThing upload failed: " + JSON.stringify(ut));
  const permanentUrl = ut.data.url;
  console.log(`[rescue] UploadThing URL: ${permanentUrl}`);

  // ── 4. Update scene 0 in the DB ──────────────────────────────────────────────
  console.log("[rescue] Updating scene 0 in DB…");
  const video = await db.musicVideo.findUnique({
    where:  { id: VIDEO_ID },
    select: { scenes: true, audioUrl: true, trackDuration: true, aspectRatio: true },
  });

  const scenes = video.scenes;
  scenes[0] = {
    ...scenes[0],
    videoUrl:   permanentUrl,
    qaReason:   "Rescued — regenerated scene 0",
    qaApproved: true,
  };

  await db.musicVideo.update({
    where: { id: VIDEO_ID },
    data: {
      scenes:      scenes,
      status:      "STITCHING",
      progress:    75,
      currentStep: "Stitching your video…",
      errorMessage: null,
    },
  });

  // Also update FalSceneJob record
  await db.falSceneJob.updateMany({
    where: { musicVideoId: VIDEO_ID, sceneIndex: 0 },
    data:  { status: "COMPLETE", videoUrl: permanentUrl },
  });

  console.log("[rescue] DB updated — all 5 scenes now have clips");

  // ── 5. Trigger Remotion Lambda stitch ─────────────────────────────────────────
  console.log("[rescue] Submitting Remotion render…");
  const sceneClips = scenes.map(s => ({
    videoUrl:  s.videoUrl,
    startTime: s.startTime,
    endTime:   s.endTime,
    duration:  s.endTime - s.startTime,
  }));

  const serveUrl     = process.env.REMOTION_SERVE_URL;
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const awsRegion    = process.env.REMOTION_REGION ?? process.env.AWS_REGION ?? "us-east-1";
  const durationMs   = Math.round(video.trackDuration * 1000);
  const aspectRatio  = video.aspectRatio === "9:16" ? "9:16" : "16:9";

  // Webhook base: use APP_WEBHOOK_URL (production), never localhost
  const webhookBase  = process.env.APP_WEBHOOK_URL ?? "https://indiethis.com";
  const webhookUrl   = `${webhookBase}/api/video-studio/webhook/remotion`;

  const MAX_RETRIES  = 4;
  const DELAYS       = [8000, 20000, 45000, 60000];
  let submitted2     = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      submitted2 = await renderMediaOnLambda({
        region:          awsRegion,
        functionName,
        serveUrl,
        composition:     "MusicVideoComposition",
        inputProps: {
          scenes:      sceneClips,
          audioUrl:    video.audioUrl,
          aspectRatio,
          durationMs,
          crossfadeMs: 800,
        },
        codec:           "h264",
        imageFormat:     "jpeg",
        maxRetries:      1,
        privacy:         "public",
        framesPerLambda: 500,
        outName:         `music-video-${VIDEO_ID}-16x9.mp4`,
        webhook: {
          url:        webhookUrl,
          secret:     process.env.REMOTION_WEBHOOK_SECRET ?? null,
          customData: { musicVideoId: VIDEO_ID },
        },
      });
      console.log(`[rescue] Remotion render submitted — renderId: ${submitted2.renderId}`);
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRate = msg.includes("Rate Exceeded") || msg.includes("TooManyRequests") || msg.includes("ConcurrentInvocationLimitExceeded");
      if (isRate && attempt < MAX_RETRIES) {
        const delay = DELAYS[attempt - 1] ?? 60000;
        console.warn(`[rescue] AWS rate limit (attempt ${attempt}/${MAX_RETRIES}) — retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }

  if (!submitted2) throw new Error("Remotion render failed after all retries");

  // Store renderId so remotion webhook can complete the video
  await db.musicVideo.update({
    where: { id: VIDEO_ID },
    data:  { errorMessage: `remotion:${submitted2.renderId}:${submitted2.bucketName}` },
  });

  console.log(`[rescue] Done! Remotion is rendering. Video will complete when webhook fires.`);
  console.log(`[rescue] renderId: ${submitted2.renderId}`);
}

main()
  .catch(err => { console.error("[rescue] FATAL:", err); process.exit(1); })
  .finally(() => db.$disconnect());
