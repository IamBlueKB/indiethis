/**
 * ai-job-processor.ts — Unified AI job processor / router
 *
 * processAIJob(jobId):
 *   1. Loads the AIJob from the database.
 *   2. Sets status → PROCESSING.
 *   3. Routes to the correct handler based on job.type.
 *   4. On success  → sets status COMPLETE + stores outputData + completedAt.
 *   5. On failure  → sets status FAILED + stores errorMessage.
 *
 * Provider integrations:
 *   Step 4  — AR_REPORT:   Whisper (transcription) + Dolby analyzeMusic + Claude Sonnet
 *   Step 5+ — remaining handlers wired in subsequent steps
 */

import os from "os";
import path from "path";
import fs from "fs";
import { db } from "@/lib/db";
import { AIJobStatus, type AIJob, type Prisma } from "@prisma/client";
import OpenAI, { toFile } from "openai";
import Replicate from "replicate";
import { fal } from "@fal-ai/client";
import type { QueueStatus } from "@fal-ai/client";
import ffmpegFluent from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { UTApi } from "uploadthing/server";
import * as dolbyClient from "@dolbyio/dolbyio-rest-apis-client";
import { claude, SONNET } from "@/lib/claude";

// Set the static ffmpeg binary path once at module load
ffmpegFluent.setFfmpegPath(ffmpegInstaller.path);

// ─── UploadThing server client ────────────────────────────────────────────────
const utapi = new UTApi();

// ─── Handler result type ──────────────────────────────────────────────────────

type HandlerResult = {
  outputData: Record<string, unknown>;
  costToUs?: number; // actual provider cost in dollars
  /**
   * When true, the router skips the automatic COMPLETE transition.
   * Used by handleVideo Phase 1 — job stays PROCESSING until the user
   * approves the preview and triggers Phase 2.
   */
  skipComplete?: boolean;
};

// ─── Stub handlers (replaced in later steps) ─────────────────────────────────

// ─── Video helpers ────────────────────────────────────────────────────────────

/** Maps the 5 style options to descriptive text prompts used by both providers. */
const VIDEO_STYLE_PROMPTS: Record<string, string> = {
  cinematic:
    "Cinematic film quality, dramatic lighting, shallow depth of field, " +
    "smooth dolly movement, professional feature-film look, color graded",
  "music-video":
    "Dynamic music video style, vibrant saturated colors, rhythmic camera motion, " +
    "energetic and stylized, editorial cuts, bold visual treatment",
  "lyric-video":
    "Artistic lyric video aesthetic, smooth ambient camera drift, " +
    "atmospheric mood lighting, poetic visual storytelling, soft bokeh",
  documentary:
    "Documentary style, authentic handheld movement, natural available lighting, " +
    "intimate and raw, observational camera work",
  artistic:
    "Abstract artistic style, expressive painterly motion, creative visual effects, " +
    "experimental aesthetic, surreal and imaginative",
};

/** Kling aspect ratio values supported by the fal.ai endpoint. */
const KLING_RATIO_MAP: Record<string, string> = {
  "16:9": "16:9",
  "9:16": "9:16",
  "1:1":  "1:1",
};

/** Runway aspect ratio strings (width:height pixel counts). */
const RUNWAY_RATIO_MAP: Record<string, string> = {
  "16:9": "1280:768",
  "9:16": "768:1280",
  "1:1":  "960:960",
};

// Kling cost: $0.029 per second of output
const KLING_COST_PER_SEC = 0.029;
// Runway Gen-3 Alpha Turbo cost: ~$0.05 per second
const RUNWAY_COST_PER_SEC = 0.05;

/**
 * Generate video via Kling 1.6 Pro on fal.ai (primary provider).
 * Returns { videoUrl, provider: "kling" } on success.
 */
async function generateWithKling(
  imageUrl: string,
  prompt: string,
  aspectRatio: string,
  durationSeconds: number,
): Promise<{ videoUrl: string; provider: "kling" }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey || falKey.startsWith("your_"))
    throw new Error("FAL_KEY is not configured");

  fal.config({ credentials: falKey });

  // Kling supports 5s and 10s clips natively; longer durations use 10s segments.
  // Phase 1 preview is always capped at 10s.
  const klingSecs = Math.min(durationSeconds, 10) as 5 | 10;

  console.log(
    `[video/kling] submitting image-to-video — ${klingSecs}s, ratio: ${aspectRatio}`,
  );

  // fal.ai Kling 1.6 Pro image-to-video endpoint
  const result = await fal.subscribe("fal-ai/kling-video/v1.6/pro/image-to-video", {
    input: {
      image_url:    imageUrl,
      prompt,
      duration:     String(klingSecs) as "5" | "10",
      aspect_ratio: (KLING_RATIO_MAP[aspectRatio] ?? "16:9") as "16:9" | "9:16" | "1:1",
    },
    logs: true,
    onQueueUpdate(update: QueueStatus) {
      if (update.status === "IN_PROGRESS" && "logs" in update && Array.isArray(update.logs) && update.logs.length) {
        console.log(`[video/kling] ${(update.logs as Array<{ message: string }>).at(-1)?.message}`);
      }
    },
  });

  // fal.ai returns { video: { url } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoUrl = (result.data as any)?.video?.url as string | undefined;
  if (!videoUrl) throw new Error("Kling returned no video URL");

  return { videoUrl, provider: "kling" };
}

/**
 * Generate video via Runway Gen-3 Alpha Turbo (fallback provider).
 * Returns { videoUrl, taskId, provider: "runway" } on success.
 */
async function generateWithRunway(
  imageUrl: string,
  prompt: string,
  aspectRatio: string,
  durationSeconds: number,
): Promise<{ videoUrl: string; taskId: string; provider: "runway" }> {
  const runwayKey = process.env.RUNWAY_API_KEY;
  if (!runwayKey || runwayKey.startsWith("your_"))
    throw new Error("RUNWAY_API_KEY is not configured");

  const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";
  const RUNWAY_VERSION  = "2024-11-06";
  const runwaySecs      = Math.min(durationSeconds, 10);

  console.log(
    `[video/runway] submitting image-to-video — ${runwaySecs}s, ratio: ${RUNWAY_RATIO_MAP[aspectRatio] ?? "1280:768"}`,
  );

  const submitRes = await fetch(`${RUNWAY_API_BASE}/image_to_video`, {
    method: "POST",
    headers: {
      "Content-Type":     "application/json",
      "Authorization":    `Bearer ${runwayKey}`,
      "X-Runway-Version": RUNWAY_VERSION,
    },
    body: JSON.stringify({
      model:       "gen3a_turbo",
      promptImage: imageUrl,
      promptText:  prompt,
      duration:    runwaySecs,
      ratio:       RUNWAY_RATIO_MAP[aspectRatio] ?? "1280:768",
    }),
  });

  if (!submitRes.ok) {
    const errBody = await submitRes.text();
    throw new Error(`Runway submit failed (${submitRes.status}): ${errBody}`);
  }

  const taskId = ((await submitRes.json()) as { id: string }).id;
  if (!taskId) throw new Error("Runway returned no task ID");

  console.log(`[video/runway] task submitted: ${taskId}`);

  // Poll for completion
  const MAX_WAIT_MS = 600_000;
  const POLL_MS     = 8_000;
  const started     = Date.now();

  while (Date.now() - started < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));

    const pollRes = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
      headers: {
        "Authorization":    `Bearer ${runwayKey}`,
        "X-Runway-Version": RUNWAY_VERSION,
      },
    });

    if (!pollRes.ok) { console.warn(`[video/runway] poll ${pollRes.status} — retrying`); continue; }

    const p = (await pollRes.json()) as {
      status: string; output?: string[]; failure?: string; failureCode?: string;
    };

    console.log(`[video/runway] task ${taskId}: ${p.status}`);

    if (p.status === "SUCCEEDED") {
      const videoUrl = p.output?.[0];
      if (!videoUrl) throw new Error("Runway returned SUCCEEDED but no output URL");
      return { videoUrl, taskId, provider: "runway" };
    }
    if (p.status === "FAILED")
      throw new Error(`Runway failed: ${p.failure ?? p.failureCode ?? "unknown"}`);
  }

  throw new Error("Runway video generation timed out after 10 minutes.");
}

// ─── handleVideo — Phase 1 preview ───────────────────────────────────────────

async function handleVideo(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing VIDEO job ${job.id} — Phase 1 preview`);

  // ── Env check: require at least one provider ──────────────────────────────
  const falKey    = process.env.FAL_KEY;
  const runwayKey = process.env.RUNWAY_API_KEY;

  if (
    (!falKey    || falKey.startsWith("your_")) &&
    (!runwayKey || runwayKey.startsWith("your_"))
  ) {
    throw new Error(
      "No video provider configured — add FAL_KEY (Kling) or RUNWAY_API_KEY to .env.local.",
    );
  }

  // ── Extract inputs ────────────────────────────────────────────────────────
  const input = (job.inputData ?? {}) as Record<string, unknown>;
  const {
    imageUrl,
    style           = "cinematic",
    aspectRatio     = "16:9",
    durationSeconds = 60,   // full video duration; Phase 1 always uses 10s
  } = input as {
    imageUrl?:        string;
    style?:           string;
    aspectRatio?:     string;
    durationSeconds?: number;
  };

  if (!imageUrl?.trim())
    throw new Error("VIDEO job missing required input: imageUrl");

  const stylePrompt = VIDEO_STYLE_PROMPTS[style] ?? VIDEO_STYLE_PROMPTS["cinematic"];

  // ── Try Kling first, fall back to Runway ──────────────────────────────────
  let videoUrl: string;
  let providerUsed: "kling" | "runway";
  let extraMeta: Record<string, unknown> = {};

  const klingAvailable = falKey && !falKey.startsWith("your_");

  if (klingAvailable) {
    try {
      const res = await generateWithKling(imageUrl, stylePrompt, aspectRatio, 10);
      videoUrl     = res.videoUrl;
      providerUsed = res.provider;
      extraMeta    = { falModel: "fal-ai/kling-video/v1.6/pro/image-to-video" };
      console.log(`[video] Kling preview generated: ${videoUrl}`);
    } catch (klingErr: unknown) {
      const klingMsg = klingErr instanceof Error ? klingErr.message : String(klingErr);
      console.warn(`[video] Kling failed — falling back to Runway. Error: ${klingMsg}`);

      // Attempt Runway fallback
      const res   = await generateWithRunway(imageUrl, stylePrompt, aspectRatio, 10);
      videoUrl     = res.videoUrl;
      providerUsed = res.provider;
      extraMeta    = { runwayTaskId: res.taskId, runwayModel: "gen3a_turbo", klingError: klingMsg };
      console.log(`[video] Runway fallback preview generated: ${videoUrl}`);
    }
  } else {
    // Kling not configured — go straight to Runway
    const res   = await generateWithRunway(imageUrl, stylePrompt, aspectRatio, 10);
    videoUrl     = res.videoUrl;
    providerUsed = res.provider;
    extraMeta    = { runwayTaskId: res.taskId, runwayModel: "gen3a_turbo" };
    console.log(`[video] Runway preview generated: ${videoUrl}`);
  }

  // Phase 1 cost: 10 seconds @ provider rate
  const costToUs = providerUsed === "kling"
    ? 10 * KLING_COST_PER_SEC
    : 10 * RUNWAY_COST_PER_SEC;

  // ── Write Phase 1 result to DB — status stays PROCESSING ─────────────────
  await db.aIJob.update({
    where: { id: job.id },
    data: {
      outputData: {
        previewUrl:      videoUrl,
        previewReady:    true,
        phase:           1,
        provider:        providerUsed,
        style,
        aspectRatio,
        durationSeconds,      // saved for Phase 2 full render
        stylePrompt,
        previewCostToUs: costToUs,
        ...extraMeta,
      } as import("@prisma/client").Prisma.InputJsonValue,
      costToUs,
      // status intentionally NOT changed — stays PROCESSING until user approves
    },
  });

  console.log(
    `[video] Phase 1 complete (${providerUsed}) — cost $${costToUs.toFixed(3)}. ` +
    `Job ${job.id} awaiting user approval for Phase 2.`,
  );

  return {
    outputData: {},   // already persisted above
    costToUs,
    skipComplete: true,
  };
}

async function handleCoverArt(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing COVER_ART job ${job.id} via ${job.provider}`);

  // ── Env checks ───────────────────────────────────────────────────────────
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const anthropicKey   = process.env.ANTHROPIC_API_KEY;

  if (!replicateToken || replicateToken.startsWith("your_"))
    throw new Error("REPLICATE_API_TOKEN is not configured — add it to .env.local to use Cover Art generation.");
  if (!anthropicKey || anthropicKey === "sk-ant-...")
    throw new Error("ANTHROPIC_API_KEY is not configured — add it to .env.local to use Cover Art generation.");

  // ── Extract inputs ────────────────────────────────────────────────────────
  const input = (job.inputData ?? {}) as Record<string, string>;
  const { artistPrompt, style, mood } = input;

  if (!artistPrompt?.trim())
    throw new Error("COVER_ART job missing required input: artistPrompt");

  let totalCost = 0;

  // ── Step 1: Claude — optimize the prompt for SDXL ────────────────────────
  console.log(`[cover-art] optimizing prompt via Claude`);

  const claudeResponse = await claude.messages.create({
    model:      SONNET,
    max_tokens: 400,
    messages: [{
      role:    "user",
      content: `Convert this artist's cover art request into an optimized image generation prompt for Stable Diffusion XL.

The artist said: "${artistPrompt}"
Style: ${style ?? "Not specified"}
Mood: ${mood ?? "Not specified"}

Write a detailed, specific image prompt that will produce professional album cover art. Include composition, lighting, color palette, and artistic technique details. The output must work as album art — typically square, visually striking, and legible at small sizes.

Return only the prompt text, nothing else. No intro, no explanation.`,
    }],
  });

  const optimizedPrompt = claudeResponse.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  // Claude cost
  const cIn  = claudeResponse.usage.input_tokens;
  const cOut = claudeResponse.usage.output_tokens;
  totalCost += (cIn / 1_000_000) * 3 + (cOut / 1_000_000) * 15;

  console.log(`[cover-art] optimized prompt (${optimizedPrompt.length} chars): ${optimizedPrompt.slice(0, 120)}…`);

  // ── Step 2: Replicate — run SDXL ×4 with varied seeds ───────────────────
  // Model: stability-ai/sdxl — latest public version
  // Cost: ~$0.0023 per image at 1024×1024
  const SDXL_MODEL = "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37ec2475f07bb2f1d00be8ee";
  const NUM_IMAGES = 4;
  const BASE_SEED  = Math.floor(Math.random() * 100_000);

  console.log(`[cover-art] running SDXL ×${NUM_IMAGES} on Replicate (base seed ${BASE_SEED})`);

  const replicate = new Replicate({ auth: replicateToken });

  // Build negative prompt from style/mood to avoid common cover-art pitfalls
  const negativePrompt =
    "text, watermark, logo, signature, blurry, low quality, disfigured, ugly, " +
    "oversaturated, amateur, generic stock photo, multiple panels, collage";

  // Fire all 4 runs in parallel with seeds BASE_SEED + 0,1,2,3
  const predictions = await Promise.allSettled(
    Array.from({ length: NUM_IMAGES }, (_, i) =>
      replicate.run(SDXL_MODEL, {
        input: {
          prompt:          optimizedPrompt,
          negative_prompt: negativePrompt,
          width:           1024,
          height:          1024,
          num_outputs:     1,
          scheduler:       "K_EULER",
          num_inference_steps: 40,
          guidance_scale:  7.5,
          seed:            BASE_SEED + i,
          refine:          "expert_ensemble_refiner",
          high_noise_frac: 0.8,
        },
      })
    ),
  );

  // Collect successful image URLs
  const imageUrls: string[] = [];
  for (const result of predictions) {
    if (result.status === "fulfilled") {
      const output = result.value;
      // Replicate returns string[] for num_outputs:1
      const url = Array.isArray(output) ? (output[0] as string) : (output as unknown as string);
      if (url) imageUrls.push(url);
    } else {
      console.warn(`[cover-art] one SDXL prediction failed: ${result.reason}`);
    }
  }

  if (imageUrls.length === 0)
    throw new Error("All Replicate SDXL predictions failed — no images generated.");

  // Cost: $0.0023 per 1024×1024 image
  const replicateCost = imageUrls.length * 0.0023;
  totalCost += replicateCost;

  console.log(
    `[cover-art] SDXL complete — ${imageUrls.length}/${NUM_IMAGES} images. ` +
    `Total cost: $${totalCost.toFixed(4)}`,
  );

  return {
    outputData: {
      imageUrls,
      optimizedPrompt,
      originalPrompt: artistPrompt,
      style:          style ?? null,
      mood:           mood  ?? null,
      model:          SDXL_MODEL,
      seeds:          Array.from({ length: NUM_IMAGES }, (_, i) => BASE_SEED + i),
    },
    costToUs: totalCost,
  };
}

async function handleMastering(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing MASTERING job ${job.id} via ${job.provider}`);

  // ── Env checks ───────────────────────────────────────────────────────────
  const dolbyKey    = process.env.DOLBY_API_KEY    ?? process.env.DOLBY_APP_KEY;
  const dolbySecret = process.env.DOLBY_API_SECRET ?? process.env.DOLBY_APP_SECRET;

  if (!dolbyKey    || dolbyKey.startsWith("your_"))
    throw new Error("DOLBY_API_KEY is not configured — add it to .env.local to use AI Mastering.");
  if (!dolbySecret || dolbySecret.startsWith("your_"))
    throw new Error("DOLBY_API_SECRET is not configured — add it to .env.local to use AI Mastering.");

  // ── Extract inputs ────────────────────────────────────────────────────────
  const input = (job.inputData ?? {}) as Record<string, string>;
  const { trackUrl } = input;

  if (!trackUrl?.trim())
    throw new Error("MASTERING job missing required input: trackUrl");

  // ── Dolby auth ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dolbyToken: any = await dolbyClient.media.authentication.getApiAccessToken(
    dolbyKey, dolbySecret, 1800,
  );

  // ── Step 1: upload source audio to Dolby temporary storage ───────────────
  console.log(`[mastering] fetching source audio: ${trackUrl}`);
  const audioRes = await fetch(trackUrl);
  if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.statusText}`);
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  const filename    = trackUrl.split("/").pop() ?? "source.mp3";

  console.log(`[mastering] uploading ${audioBuffer.length} bytes to Dolby storage`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploadResult: any = await dolbyClient.media.io.getUploadUrl(dolbyToken, filename);
  const dlbInputUrl: string = uploadResult?.url ?? uploadResult?.dlb_url;
  const signedPutUrl: string = uploadResult?.signed_url ?? uploadResult?.upload_url;

  if (!dlbInputUrl || !signedPutUrl)
    throw new Error("Dolby did not return upload URL — check DOLBY_API_KEY is valid.");

  // PUT the audio to Dolby's signed S3 URL
  const putRes = await fetch(signedPutUrl, {
    method:  "PUT",
    body:    audioBuffer,
    headers: { "Content-Type": audioRes.headers.get("content-type") ?? "audio/mpeg" },
  });
  if (!putRes.ok) throw new Error(`Dolby upload PUT failed: ${putRes.statusText}`);
  console.log(`[mastering] source uploaded → ${dlbInputUrl}`);

  // ── Step 2: define the 3 mastering profiles ───────────────────────────────
  const PROFILES = [
    {
      label:       "Warm",
      description: "Boosted low-mids, gentle compression — ideal for late-night listening",
      preset:      "C",    // Warm / bass-forward
      loudness:    -14,    // Streaming standard
      peak:        -1.0,
      dlbOutputUrl: `dlb://mastering-${job.id}-warm`,
    },
    {
      label:       "Punchy",
      description: "Emphasized transients, tighter compression — energetic and club-ready",
      preset:      "D",    // Dynamic
      loudness:    -9,     // Aggressive / commercial
      peak:        -1.0,
      dlbOutputUrl: `dlb://mastering-${job.id}-punchy`,
    },
    {
      label:       "Broadcast Ready",
      description: "Loudness normalized to -14 LUFS, balanced EQ — Spotify / Apple Music compliant",
      preset:      "A",    // Balanced
      loudness:    -14,
      peak:        -1.5,   // Slightly conservative for broadcast compliance
      dlbOutputUrl: `dlb://mastering-${job.id}-broadcast`,
    },
  ] as const;

  // ── Step 3: start all 3 mastering jobs in parallel ────────────────────────
  console.log(`[mastering] starting 3 mastering jobs in parallel`);

  const jobIds = await Promise.all(
    PROFILES.map(async (profile) => {
      const body = JSON.stringify({
        inputs:  [{ source: dlbInputUrl }],
        outputs: [{
          destination: profile.dlbOutputUrl,
          master: {
            dynamic_eq: { enable: true, preset: profile.preset },
            loudness: {
              enable:              true,
              dialog_intelligence: false,
              peak:                profile.peak,
              loudness:            profile.loudness,
            },
          },
        }],
      });
      const jobId = await dolbyClient.media.mastering.start(dolbyToken, body) as string;
      console.log(`[mastering] ${profile.label} job started: ${jobId}`);
      return { profile, jobId };
    }),
  );

  // ── Step 4: poll all 3 jobs in parallel ──────────────────────────────────
  console.log(`[mastering] polling all 3 jobs for completion`);

  const MAX_WAIT_MS = 600_000; // 10 minutes — mastering can be slow
  const POLL_MS     = 6_000;

  const pollOne = async (jobId: string, label: string): Promise<{ status: string; result: unknown }> => {
    const started = Date.now();
    while (Date.now() - started < MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await dolbyClient.media.mastering.getResults(dolbyToken, jobId);
      const status = res?.status as string;
      console.log(`[mastering] ${label} status: ${status}`);
      if (["Success", "Failed", "Canceled", "Expired"].includes(status)) {
        return { status, result: res };
      }
    }
    return { status: "Timeout", result: null };
  };

  const pollResults = await Promise.allSettled(
    jobIds.map(({ profile, jobId }) => pollOne(jobId, profile.label)),
  );

  // ── Step 5: collect download URLs for completed jobs ─────────────────────
  type MasteringOutput = {
    label:        string;
    description:  string;
    preset:       string;
    loudnessLUFS: number;
    downloadUrl:  string | null;
    measuredLUFS: number | null;
    status:       string;
  };

  const outputs: MasteringOutput[] = [];

  for (let i = 0; i < jobIds.length; i++) {
    const { profile }  = jobIds[i];
    const pollResult   = pollResults[i];

    if (pollResult.status === "rejected" || pollResult.value.status !== "Success") {
      const reason = pollResult.status === "rejected"
        ? String(pollResult.reason)
        : `Job ended with status: ${pollResult.value.status}`;
      console.warn(`[mastering] ${profile.label} failed: ${reason}`);
      outputs.push({
        label:        profile.label,
        description:  profile.description,
        preset:       profile.preset,
        loudnessLUFS: profile.loudness,
        downloadUrl:  null,
        measuredLUFS: null,
        status:       pollResult.status === "rejected" ? "Failed" : pollResult.value.status,
      });
      continue;
    }

    // Get signed HTTPS download URL for this dlb:// output
    let downloadUrl: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dlResult: any = await dolbyClient.media.io.getDownloadUrl(dolbyToken, profile.dlbOutputUrl);
      downloadUrl = (dlResult?.url ?? dlResult?.signed_url) as string;
    } catch (e) {
      console.warn(`[mastering] could not get download URL for ${profile.label}: ${e}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = pollResult.value.result as any;
    const measuredLUFS = r?.result?.loudness?.measured_loudness ?? null;

    outputs.push({
      label:        profile.label,
      description:  profile.description,
      preset:       profile.preset,
      loudnessLUFS: profile.loudness,
      downloadUrl,
      measuredLUFS,
      status:       "Success",
    });

    console.log(
      `[mastering] ${profile.label} complete — measured ${measuredLUFS} LUFS. ` +
      `Download: ${downloadUrl?.slice(0, 60)}…`,
    );
  }

  const successCount = outputs.filter((o) => o.status === "Success").length;
  if (successCount === 0)
    throw new Error("All 3 Dolby mastering jobs failed. Check DOLBY_API_KEY and try again.");

  // Dolby mastering cost: ~$0.006 per minute per job
  const audioDurationMinutes = audioBuffer.length / (1411 * 125); // rough estimate at 1411kbps
  const costToUs = successCount * audioDurationMinutes * 0.006;

  console.log(
    `[mastering] done — ${successCount}/3 succeeded. ` +
    `Est. cost: $${costToUs.toFixed(4)}`,
  );

  return {
    outputData: {
      outputs,           // array of { label, description, downloadUrl, measuredLUFS, status }
      sourceTrackUrl: trackUrl,
      dlbInputUrl,
      successCount,
    },
    costToUs,
  };
}

async function handleLyricVideo(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing LYRIC_VIDEO job ${job.id} via ${job.provider}`);
  // Step 7: wire Remotion Lambda here
  return { outputData: { stub: true, type: "LYRIC_VIDEO" } };
}

async function handleARReport(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing AR_REPORT job ${job.id} via ${job.provider}`);

  // ── Env checks — fail fast with actionable messages ──────────────────────
  const openaiKey  = process.env.OPENAI_API_KEY;
  const dolbyKey   = process.env.DOLBY_API_KEY   ?? process.env.DOLBY_APP_KEY;
  const dolbySecret= process.env.DOLBY_API_SECRET ?? process.env.DOLBY_APP_SECRET;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!openaiKey   || openaiKey.startsWith("your_"))
    throw new Error("OPENAI_API_KEY is not configured — add it to .env.local to use the A&R Report.");
  if (!dolbyKey    || dolbyKey.startsWith("your_"))
    throw new Error("DOLBY_API_KEY is not configured — add it to .env.local to use the A&R Report.");
  if (!dolbySecret || dolbySecret.startsWith("your_"))
    throw new Error("DOLBY_API_SECRET is not configured — add it to .env.local to use the A&R Report.");
  if (!anthropicKey || anthropicKey.startsWith("sk-ant-api") === false && anthropicKey === "sk-ant-...")
    throw new Error("ANTHROPIC_API_KEY is not configured — add it to .env.local to use the A&R Report.");

  // ── Extract job inputs ────────────────────────────────────────────────────
  const input = (job.inputData ?? {}) as Record<string, string>;
  const { trackUrl, genre, artistBio, targetMarket, comparableArtists } = input;

  if (!trackUrl) throw new Error("AR_REPORT job missing required input: trackUrl");

  let totalCost = 0;

  // ── Step 1: Whisper transcription ─────────────────────────────────────────
  console.log(`[ar-report] transcribing audio via Whisper: ${trackUrl}`);
  const openai = new OpenAI({ apiKey: openaiKey });

  // Fetch the audio file from its URL and pass as a File to Whisper
  const audioResponse = await fetch(trackUrl);
  if (!audioResponse.ok) throw new Error(`Failed to fetch audio file: ${audioResponse.statusText}`);
  const audioBuffer  = await audioResponse.arrayBuffer();
  const audioName    = trackUrl.split("/").pop() ?? "track.mp3";
  const audioFile    = await toFile(Buffer.from(audioBuffer), audioName, {
    type: audioResponse.headers.get("content-type") ?? "audio/mpeg",
  });

  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file:  audioFile,
    response_format: "verbose_json",   // includes segments with timestamps
    timestamp_granularities: ["segment"],
  });

  // Estimate Whisper cost: $0.006 per minute
  const audioDurationMinutes = (transcription.duration ?? 180) / 60;
  totalCost += audioDurationMinutes * 0.006;

  const lyrics    = transcription.text ?? "(No lyrics detected — instrumental or transcription failed)";
  const segments  = (transcription.segments ?? []) as Array<{ start: number; end: number; text: string }>;
  const lyricsWithTimestamps = segments.length > 0
    ? segments.map((s) => `[${s.start.toFixed(1)}s] ${s.text.trim()}`).join("\n")
    : lyrics;

  console.log(`[ar-report] Whisper complete — ${audioDurationMinutes.toFixed(1)} min, ${lyrics.length} chars`);

  // ── Step 2: Dolby analyzeMusic ────────────────────────────────────────────
  console.log(`[ar-report] analyzing audio via Dolby analyzeMusic`);

  let audioAnalysis: Record<string, unknown> = {};

  try {
    // Get Dolby access token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dolbyToken: any = await dolbyClient.media.authentication.getApiAccessToken(
      dolbyKey,
      dolbySecret,
      1800,
    );

    // Build the analyze job body
    const analyzeBody = JSON.stringify({
      inputs:  [{ source: trackUrl }],
      outputs: [{ destination: `dlb://ar-report-${job.id}` }],
    });

    // Start analyze job
    const analyzeJobId = await dolbyClient.media.analyzeMusic.start(dolbyToken, analyzeBody) as string;
    console.log(`[ar-report] Dolby analyzeMusic job started: ${analyzeJobId}`);

    // Poll for results (max 3 minutes, 5-second intervals)
    const maxWaitMs  = 180_000;
    const pollMs     = 5_000;
    const started    = Date.now();
    let   analyzeResult: Record<string, unknown> | null = null;

    while (Date.now() - started < maxWaitMs) {
      await new Promise((r) => setTimeout(r, pollMs));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await dolbyClient.media.analyzeMusic.getResults(dolbyToken, analyzeJobId);
      const status = result?.status as string;

      if (status === "Success") {
        analyzeResult = result;
        break;
      }
      if (["Failed", "Canceled", "Expired"].includes(status)) {
        console.warn(`[ar-report] Dolby analyzeMusic ${status} — proceeding without audio analysis`);
        break;
      }
    }

    if (analyzeResult) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = analyzeResult as any;
      audioAnalysis = {
        loudness:      r?.result?.audio?.loudness?.measured     ?? null,
        truePeak:      r?.result?.audio?.loudness?.true_peak    ?? null,
        dynamicRange:  r?.result?.audio?.dynamics?.range        ?? null,
        noiseLevel:    r?.result?.audio?.noise?.snr_avg         ?? null,
        tempo:         r?.result?.music?.tempo?.bpm             ?? null,
        key:           r?.result?.music?.key?.value             ?? null,
        mode:          r?.result?.music?.key?.mode              ?? null,
        energy:        r?.result?.music?.energy?.value          ?? null,
        danceability:  r?.result?.music?.danceability?.value    ?? null,
      };
      // Dolby analyzeMusic: ~$0.003 per minute
      totalCost += audioDurationMinutes * 0.003;
    }
  } catch (dolbyErr: unknown) {
    // Non-fatal — proceed with what we have
    console.warn(`[ar-report] Dolby analyze error (non-fatal): ${dolbyErr instanceof Error ? dolbyErr.message : dolbyErr}`);
  }

  console.log(`[ar-report] audio analysis:`, audioAnalysis);

  // ── Step 3: Claude Sonnet — generate A&R report ───────────────────────────
  console.log(`[ar-report] generating report via Claude Sonnet`);

  const systemPrompt = `You are a music industry A&R consultant with 20 years of experience signing artists to major and independent labels. Analyze this track based on the lyrics, audio characteristics, and artist profile. Write a detailed report covering:

1. **Commercial Viability** — Is this track ready for radio, streaming playlists, or sync licensing? What would need to change?
2. **Lyrical Analysis** — Themes, storytelling quality, hook strength, word economy, emotional resonance.
3. **Sonic Quality Assessment** — Based on the audio measurements provided, assess the production quality, loudness compliance for streaming platforms, and tonal balance.
4. **Target Audience Recommendations** — Who is the primary audience? Age range, geography, platform (TikTok/Spotify/radio), lifestyle segments.
5. **Marketing Strategy Suggestions** — Concrete tactics for this specific track and artist profile. Playlist pitching angles, sync opportunities, brand partnership fits.
6. **Comparable Artist Positioning** — How does this artist sit relative to the market? Who are they most comparable to and what gaps do they fill?

Be specific and actionable, not generic. Reference actual data from the audio analysis and lyrics where possible. Format with clear section headers.`;

  const userMessage = `
**Artist Profile:**
- Genre: ${genre || "Not specified"}
- Bio: ${artistBio || "Not provided"}
- Target Market: ${targetMarket || "Not specified"}
- Comparable Artists: ${comparableArtists || "Not specified"}

**Audio Analysis (Dolby.io):**
- Integrated Loudness: ${audioAnalysis.loudness != null ? `${audioAnalysis.loudness} LUFS` : "Not available"}
- True Peak: ${audioAnalysis.truePeak != null ? `${audioAnalysis.truePeak} dBTP` : "Not available"}
- Dynamic Range: ${audioAnalysis.dynamicRange != null ? `${audioAnalysis.dynamicRange} LU` : "Not available"}
- Tempo: ${audioAnalysis.tempo != null ? `${audioAnalysis.tempo} BPM` : "Not available"}
- Key: ${audioAnalysis.key != null ? `${audioAnalysis.key} ${audioAnalysis.mode ?? ""}`.trim() : "Not available"}
- Energy: ${audioAnalysis.energy != null ? audioAnalysis.energy : "Not available"}
- Danceability: ${audioAnalysis.danceability != null ? audioAnalysis.danceability : "Not available"}
- Audio Duration: ${audioDurationMinutes.toFixed(1)} minutes

**Lyrics (transcribed via Whisper):**
${lyricsWithTimestamps}

Please write the A&R report now.`.trim();

  const claudeResponse = await claude.messages.create({
    model:      SONNET,
    max_tokens: 2048,
    system:     systemPrompt,
    messages:   [{ role: "user", content: userMessage }],
  });

  const reportText = claudeResponse.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Claude Sonnet cost: $3/MTok input, $15/MTok output
  const inputTokens  = claudeResponse.usage.input_tokens;
  const outputTokens = claudeResponse.usage.output_tokens;
  totalCost += (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;

  console.log(
    `[ar-report] Claude complete — ${inputTokens} in / ${outputTokens} out tokens. ` +
    `Total cost: $${totalCost.toFixed(4)}`
  );

  return {
    outputData: {
      report:         reportText,
      lyrics,
      lyricsWithTimestamps,
      audioAnalysis,
      audioDurationMinutes,
      whisperModel:   "whisper-1",
      claudeModel:    SONNET,
      inputTokens,
      outputTokens,
    },
    costToUs: totalCost,
  };
}

async function handlePressKit(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing PRESS_KIT job ${job.id} via ${job.provider}`);

  // ── Env check ────────────────────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || anthropicKey === "sk-ant-...") {
    throw new Error("ANTHROPIC_API_KEY is not configured — add it to .env.local to use Press Kit generation.");
  }

  // ── Extract job inputs ────────────────────────────────────────────────────
  const input = (job.inputData ?? {}) as Record<string, unknown>;
  const {
    artistName,
    bio,
    genre,
    achievements,
    pressQuotes,
    contactEmail,
    photoUrl,
    socialLinks = {},
  } = input as {
    artistName?:   string;
    bio?:          string;
    genre?:        string;
    achievements?: string;
    pressQuotes?:  string;
    contactEmail?: string;
    photoUrl?:     string;
    socialLinks?:  Record<string, string>;
  };

  if (!artistName?.trim()) {
    throw new Error("PRESS_KIT job missing required input: artistName");
  }

  // ── Claude Sonnet — generate structured press kit JSON ───────────────────
  console.log(`[press-kit] generating structured content via Claude Sonnet`);

  const systemPrompt = `You are a music PR professional. Generate a complete press kit document and return it as valid JSON only — no markdown, no code fences, just a raw JSON object.

The JSON must have exactly these fields:
{
  "artistName": "string",
  "tagline": "string — a catchy 1-line artist description",
  "bio": {
    "short": "string — 1-2 sentence bio for social media / brief mentions",
    "medium": "string — 1 paragraph bio for website / press releases",
    "long": "string — 2-3 paragraph bio for full EPK / label submissions"
  },
  "achievements": ["array of bullet point strings — notable milestones, press mentions, chart positions, collabs"],
  "pressQuotes": [
    { "quote": "string", "source": "string — publication or blog name" }
  ],
  "technicalRider": "string — brief technical requirements for live shows, or null if not applicable",
  "contact": {
    "email": "string or null",
    "bookingEmail": "string or null",
    "phone": "string or null"
  },
  "socialLinks": {
    "instagram": "handle only, no @ or URL, or null",
    "tiktok": "handle only or null",
    "youtube": "full URL or null",
    "spotify": "full URL or null",
    "appleMusic": "full URL or null"
  }
}

Be specific, industry-ready, and compelling. If press quotes are not provided by the artist, write 2-3 realistic-sounding fabricated quotes from music publications. Do not include placeholders.`;

  const userMessage = `Generate a press kit for this artist:

Artist Name: ${artistName}
Genre: ${genre ?? "Not specified"}
Bio / Background: ${bio ?? "Not provided"}
Key Achievements: ${achievements ?? "Not provided"}
Existing Press Quotes: ${pressQuotes ?? "None — please generate realistic ones"}
Booking / Contact Email: ${contactEmail ?? "Not provided"}
Social Links: ${JSON.stringify(socialLinks)}

Return only the JSON object. No extra text.`;

  const claudeResponse = await claude.messages.create({
    model:      SONNET,
    max_tokens: 2048,
    system:     systemPrompt,
    messages:   [{ role: "user", content: userMessage }],
  });

  const rawText = claudeResponse.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  // Parse Claude's JSON response — strip any accidental code fences
  const jsonStr = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  let content: import("@/components/pdf/PressKitPDF").PressKitContent;

  try {
    content = JSON.parse(jsonStr) as import("@/components/pdf/PressKitPDF").PressKitContent;
  } catch {
    throw new Error(`Claude returned invalid JSON for press kit. Raw: ${rawText.slice(0, 200)}`);
  }

  // Inject genre/socialLinks from input if Claude missed them
  content.genre ??= genre ?? undefined;
  if (!content.socialLinks) content.socialLinks = {};
  for (const [k, v] of Object.entries(socialLinks ?? {})) {
    if (v && !(content.socialLinks as Record<string, unknown>)[k]) {
      (content.socialLinks as Record<string, unknown>)[k] = v;
    }
  }

  // Claude Sonnet cost: $3/MTok in, $15/MTok out
  const inputTokens  = claudeResponse.usage.input_tokens;
  const outputTokens = claudeResponse.usage.output_tokens;
  const costToUs     = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;

  console.log(
    `[press-kit] Claude complete — ${inputTokens} in / ${outputTokens} out tokens. ` +
    `Cost: $${costToUs.toFixed(4)}`,
  );

  // PDF is generated on-demand at /api/ai-jobs/[id]/press-kit-pdf
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
  const pdfUrl = `${appUrl}/api/ai-jobs/${job.id}/press-kit-pdf`;

  return {
    outputData: {
      content,
      photoUrl: photoUrl ?? null,
      pdfUrl,
      inputTokens,
      outputTokens,
      claudeModel: SONNET,
    },
    costToUs,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function processAIJob(jobId: string): Promise<void> {
  // 1. Load job
  const job = await db.aIJob.findUnique({ where: { id: jobId } });

  if (!job) {
    console.error(`[ai-jobs] job ${jobId} not found`);
    return;
  }

  if (job.status !== AIJobStatus.QUEUED) {
    console.warn(`[ai-jobs] job ${jobId} is ${job.status} — skipping`);
    return;
  }

  // 2. Mark PROCESSING
  await db.aIJob.update({
    where: { id: jobId },
    data: { status: AIJobStatus.PROCESSING },
  });

  // 3. Route to handler
  try {
    let result: HandlerResult;

    switch (job.type) {
      case "VIDEO":
        result = await handleVideo(job);
        break;
      case "COVER_ART":
        result = await handleCoverArt(job);
        break;
      case "MASTERING":
        result = await handleMastering(job);
        break;
      case "LYRIC_VIDEO":
        result = await handleLyricVideo(job);
        break;
      case "AR_REPORT":
        result = await handleARReport(job);
        break;
      case "PRESS_KIT":
        result = await handlePressKit(job);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    // 4. Mark COMPLETE (suppressed for VIDEO Phase 1 which stays PROCESSING)
    if (!result.skipComplete) {
      await db.aIJob.update({
        where: { id: jobId },
        data: {
          status:      AIJobStatus.COMPLETE,
          outputData:  result.outputData as import("@prisma/client").Prisma.InputJsonValue,
          costToUs:    result.costToUs ?? null,
          completedAt: new Date(),
        },
      });
      console.log(`[ai-jobs] job ${jobId} (${job.type}) COMPLETE`);
    } else {
      // Handler manages its own DB writes (e.g. VIDEO Phase 1 preview)
      // Only update costToUs if provided
      if (result.costToUs != null) {
        await db.aIJob.update({
          where: { id: jobId },
          data: { costToUs: result.costToUs },
        });
      }
      console.log(`[ai-jobs] job ${jobId} (${job.type}) Phase 1 preview ready — PROCESSING (awaiting user approval)`);
    }

  } catch (err: unknown) {
    // 5. Mark FAILED
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai-jobs] job ${jobId} FAILED: ${message}`);

    await db.aIJob.update({
      where: { id: jobId },
      data: {
        status:       AIJobStatus.FAILED,
        errorMessage: message,
        completedAt:  new Date(),
      },
    });
  }
}

// ─── Phase 2 types ────────────────────────────────────────────────────────────

type VideoClip = {
  index:       number;
  url:         string | null;
  status:      "pending" | "generating" | "success" | "failed";
  retries:     number;
  costToUs:    number;
  provider?:   "kling" | "runway";
};

// ─── Phase 2 low-level helpers ────────────────────────────────────────────────

/** Persist Phase 2 progress to DB without touching job status. */
async function saveVideoPhase2State(
  jobId: string,
  outputData: Record<string, unknown>,
): Promise<void> {
  await db.aIJob.update({
    where: { id: jobId },
    data:  { outputData: outputData as Prisma.InputJsonValue },
  });
}

/**
 * Generate one 10-second clip using Kling (primary) or Runway (fallback).
 * Returns { url, costToUs, providerUsed }.
 */
async function generateSingleClip(
  imageUrl:    string,
  prompt:      string,
  aspectRatio: string,
): Promise<{ url: string; costToUs: number; providerUsed: "kling" | "runway" }> {
  const klingAvailable = !!(process.env.FAL_KEY) && !process.env.FAL_KEY.startsWith("your_");

  if (klingAvailable) {
    try {
      const res = await generateWithKling(imageUrl, prompt, aspectRatio, 10);
      return { url: res.videoUrl, costToUs: 10 * KLING_COST_PER_SEC, providerUsed: "kling" };
    } catch (err) {
      console.warn(`[video/clip] Kling failed — falling back to Runway: ${err instanceof Error ? err.message : err}`);
    }
  }

  const res = await generateWithRunway(imageUrl, prompt, aspectRatio, 10);
  return { url: res.videoUrl, costToUs: 10 * RUNWAY_COST_PER_SEC, providerUsed: "runway" };
}

/**
 * Extract the last frame from a video URL as a JPEG buffer.
 * Downloads the video to a temp file, runs ffmpeg, returns the JPEG.
 */
async function extractLastFrame(videoUrl: string): Promise<Buffer> {
  const tmpDir   = path.join(os.tmpdir(), `indiethis-frames-${Date.now()}`);
  const videoPath = path.join(tmpDir, "clip.mp4");
  const framePath = path.join(tmpDir, "last.jpg");

  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Download the video
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error(`Failed to fetch video: ${res.statusText}`);
    fs.writeFileSync(videoPath, Buffer.from(await res.arrayBuffer()));

    // Extract last frame: seek to 0.5 s before end
    await new Promise<void>((resolve, reject) => {
      ffmpegFluent()
        .addInput(videoPath)
        .addInputOptions(["-sseof -0.5"])
        .frames(1)
        .output(framePath)
        .on("end",   () => resolve())
        .on("error", (e) => reject(e))
        .run();
    });

    const frameBuffer = fs.readFileSync(framePath);
    return frameBuffer;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Upload a buffer to UploadThing server-side and return the public URL.
 */
async function uploadBufferToUT(
  buffer:   Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const file = new File([new Uint8Array(buffer)], filename, { type: mimeType });
  const res  = await utapi.uploadFiles(file);
  if (res.error) throw new Error(`UploadThing upload failed: ${res.error.message}`);
  if (!res.data?.url) throw new Error("UploadThing returned no URL");
  return res.data.url;
}

/**
 * Download all clip videos, concatenate them with ffmpeg, and return the
 * stitched MP4 as a Buffer.
 */
async function stitchClipsToBuffer(clipUrls: string[], jobId: string): Promise<Buffer> {
  const tmpDir     = path.join(os.tmpdir(), `indiethis-stitch-${jobId}`);
  const outputPath = path.join(tmpDir, "output.mp4");
  const listPath   = path.join(tmpDir, "list.txt");

  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Download each clip to a temp file
    const clipPaths: string[] = [];

    for (let i = 0; i < clipUrls.length; i++) {
      const clipPath = path.join(tmpDir, `clip-${i}.mp4`);
      const res = await fetch(clipUrls[i]);
      if (!res.ok) throw new Error(`Failed to download clip ${i}: ${res.statusText}`);
      fs.writeFileSync(clipPath, Buffer.from(await res.arrayBuffer()));
      clipPaths.push(clipPath);
      console.log(`[video/stitch] downloaded clip ${i + 1}/${clipUrls.length}`);
    }

    // Write ffmpeg concat list (paths must use forward slashes on all platforms)
    const listContent = clipPaths
      .map((p) => `file '${p.replace(/\\/g, "/")}'`)
      .join("\n");
    fs.writeFileSync(listPath, listContent);

    // Concatenate with ffmpeg (stream copy — no re-encode, very fast)
    await new Promise<void>((resolve, reject) => {
      ffmpegFluent()
        .addInput(listPath)
        .addInputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
        .output(outputPath)
        .on("end",   () => resolve())
        .on("error", (e) => reject(e))
        .run();
    });

    console.log(`[video/stitch] stitched ${clipUrls.length} clips → ${outputPath}`);
    return fs.readFileSync(outputPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Stitch all clips, upload to UploadThing, and mark the job COMPLETE.
 * Called when every clip in the array has status "success".
 */
async function stitchAndFinalize(
  jobId:        string,
  clips:        VideoClip[],
  currentOutput: Record<string, unknown>,
): Promise<void> {
  const previewCostToUs = Number(currentOutput.previewCostToUs ?? 0);

  // Mark stitching in progress
  await saveVideoPhase2State(jobId, { ...currentOutput, clips, stitching: true });
  console.log(`[video/stitch] starting stitch for job ${jobId}`);

  const clipUrls = clips.map((c) => c.url!);
  const stitchedBuffer = await stitchClipsToBuffer(clipUrls, jobId);

  // Upload to UploadThing
  const finalVideoUrl = await uploadBufferToUT(
    stitchedBuffer,
    `video-${jobId}.mp4`,
    "video/mp4",
  );

  const phase2CostToUs = clips.reduce((sum, c) => sum + (c.costToUs ?? 0), 0);
  const totalCostToUs  = previewCostToUs + phase2CostToUs;

  await db.aIJob.update({
    where: { id: jobId },
    data: {
      status: AIJobStatus.COMPLETE,
      outputData: {
        ...currentOutput,
        clips,
        stitching:      false,
        finalVideoUrl,
        phase:          2,
        phase2CostToUs,
        totalCostToUs,
      } as Prisma.InputJsonValue,
      costToUs:    totalCostToUs,
      completedAt: new Date(),
    },
  });

  console.log(`[video/stitch] job ${jobId} COMPLETE — final video: ${finalVideoUrl} (cost $${totalCostToUs.toFixed(3)})`);
}

// ─── Phase 2: full video render (called after user approves the preview) ──────

/**
 * continueVideoPhase2(jobId)
 *
 * Called by the approve-video API route after the artist watches the Phase 1
 * preview clip and clicks "Approve Full Render".
 *
 * Generates all clips sequentially:
 *   - Clip 0 starts from the original imageUrl
 *   - Each subsequent clip starts from the last frame of the previous clip
 *     (extracted via ffmpeg) for visual continuity
 * Stitches all clips with ffmpeg and uploads the result to UploadThing.
 * Tracks per-clip state in outputData so failed clips can be individually
 * regenerated via POST /api/ai-jobs/[id]/regenerate-clip.
 */
export async function continueVideoPhase2(jobId: string): Promise<void> {
  const job = await db.aIJob.findUnique({ where: { id: jobId } });

  if (!job) { console.error(`[video/phase2] job ${jobId} not found`); return; }
  if (job.type !== "VIDEO") { console.error(`[video/phase2] job ${jobId} wrong type`); return; }
  if (job.status !== AIJobStatus.PROCESSING) {
    console.warn(`[video/phase2] job ${jobId} is ${job.status} — skipping`); return;
  }

  const phase1Output = (job.outputData ?? {}) as Record<string, unknown>;
  if (!phase1Output.previewReady) {
    console.error(`[video/phase2] job ${jobId} has no Phase 1 preview`); return;
  }

  // ── Extract Phase 1 metadata ───────────────────────────────────────────────
  const {
    style           = "cinematic",
    aspectRatio     = "16:9",
    durationSeconds = 60,
    stylePrompt:      savedPrompt,
  } = phase1Output as {
    style?:           string;
    aspectRatio?:     string;
    durationSeconds?: number;
    stylePrompt?:     string;
  };

  const inputData = (job.inputData ?? {}) as Record<string, unknown>;
  const imageUrl  = (phase1Output.imageUrl ?? inputData.imageUrl) as string | undefined;
  if (!imageUrl?.trim()) {
    await db.aIJob.update({
      where: { id: jobId },
      data: { status: AIJobStatus.FAILED, errorMessage: "Phase 2: imageUrl missing", completedAt: new Date() },
    });
    return;
  }

  const prompt     = savedPrompt ?? VIDEO_STYLE_PROMPTS[style] ?? VIDEO_STYLE_PROMPTS["cinematic"];
  const fullSecs   = Math.min(Number(durationSeconds), 180);
  const totalClips = Math.ceil(fullSecs / 10); // 10 s per clip, max 18 clips

  console.log(`[video/phase2] job ${jobId}: ${totalClips} clips × 10s = ${totalClips * 10}s`);

  // ── Initialize clips array and save to DB ──────────────────────────────────
  const clips: VideoClip[] = Array.from({ length: totalClips }, (_, i) => ({
    index:    i,
    url:      null,
    status:   "pending",
    retries:  0,
    costToUs: 0,
  }));

  const currentOutput = { ...phase1Output, phase: 2, totalClips, clips, stitching: false };
  await saveVideoPhase2State(jobId, currentOutput);

  // ── Generate clips sequentially ────────────────────────────────────────────
  // Each clip's start frame = last frame of the previous clip (visual continuity).
  // If last-frame extraction fails, fall back to the original imageUrl.
  let lastFrameUrl = imageUrl; // seed for clip 0

  for (let i = 0; i < totalClips; i++) {
    clips[i].status = "generating";
    await saveVideoPhase2State(jobId, { ...currentOutput, clips });

    try {
      const startFrame = i === 0 ? imageUrl : lastFrameUrl;

      const { url, costToUs: clipCost, providerUsed } =
        await generateSingleClip(startFrame, prompt, aspectRatio);

      clips[i].url      = url;
      clips[i].status   = "success";
      clips[i].costToUs = clipCost;
      clips[i].provider = providerUsed;

      // Extract last frame for the next clip's continuity
      // Upload to UploadThing so Kling (which needs a URL) can use it
      try {
        const frameBuffer = await extractLastFrame(url);
        lastFrameUrl = await uploadBufferToUT(
          frameBuffer,
          `frame-${jobId}-${i}.jpg`,
          "image/jpeg",
        );
        console.log(`[video/phase2] clip ${i + 1}/${totalClips} ✓ — last frame uploaded`);
      } catch (frameErr) {
        console.warn(`[video/phase2] clip ${i} frame extraction failed, using original: ${frameErr instanceof Error ? frameErr.message : frameErr}`);
        lastFrameUrl = imageUrl;
      }
    } catch (clipErr: unknown) {
      clips[i].status = "failed";
      console.error(`[video/phase2] clip ${i} failed: ${clipErr instanceof Error ? clipErr.message : clipErr}`);
      // Continue to generate remaining clips — failed clips can be regenerated individually
    }

    await saveVideoPhase2State(jobId, { ...currentOutput, clips });
  }

  // ── Check outcome ──────────────────────────────────────────────────────────
  const failedCount = clips.filter((c) => c.status === "failed").length;

  if (failedCount > 0) {
    console.log(
      `[video/phase2] ${failedCount}/${totalClips} clips failed — job stays PROCESSING. ` +
      `Use POST /api/ai-jobs/${jobId}/regenerate-clip to retry individual clips.`,
    );
    // Job stays PROCESSING — user regenerates failed clips via the API
    return;
  }

  // All clips succeeded — stitch and finalize
  await stitchAndFinalize(jobId, clips, { ...currentOutput, clips });
}

// ─── Exported: regenerate a single failed clip ────────────────────────────────

/**
 * regenerateVideoClip(jobId, clipIndex)
 *
 * Re-generates one failed clip (up to MAX_CLIP_RETRIES per clip).
 * If the regeneration succeeds AND all other clips are also successful,
 * stitching is triggered automatically to complete the job.
 *
 * Called by POST /api/ai-jobs/[id]/regenerate-clip.
 */
export const MAX_CLIP_RETRIES = 3;

export async function regenerateVideoClip(jobId: string, clipIndex: number): Promise<void> {
  const job = await db.aIJob.findUnique({ where: { id: jobId } });

  if (!job) throw new Error(`Job ${jobId} not found`);
  if (job.type !== "VIDEO") throw new Error(`Job ${jobId} is not a VIDEO job`);
  if (job.status !== AIJobStatus.PROCESSING)
    throw new Error(`Job ${jobId} is ${job.status} — can only regenerate while PROCESSING`);

  const currentOutput = (job.outputData ?? {}) as Record<string, unknown>;
  const clips = ((currentOutput.clips ?? []) as VideoClip[]).map((c) => ({ ...c })); // shallow copy

  if (clipIndex < 0 || clipIndex >= clips.length)
    throw new Error(`Clip index ${clipIndex} out of range (0–${clips.length - 1})`);

  const clip = clips[clipIndex];

  if (clip.retries >= MAX_CLIP_RETRIES)
    throw new Error(`Clip ${clipIndex} has reached the maximum of ${MAX_CLIP_RETRIES} retries`);

  // ── Resolve inputs ─────────────────────────────────────────────────────────
  const {
    style        = "cinematic",
    aspectRatio  = "16:9",
    stylePrompt: savedPrompt,
  } = currentOutput as { style?: string; aspectRatio?: string; stylePrompt?: string };

  const inputData = (job.inputData ?? {}) as Record<string, unknown>;
  const imageUrl  = (currentOutput.imageUrl ?? inputData.imageUrl) as string | undefined;
  if (!imageUrl?.trim()) throw new Error("regenerateVideoClip: imageUrl missing from job");

  const prompt = savedPrompt ?? VIDEO_STYLE_PROMPTS[style] ?? VIDEO_STYLE_PROMPTS["cinematic"];

  // ── Determine start frame for this clip ────────────────────────────────────
  let startFrame = imageUrl;
  if (clipIndex > 0) {
    const prevClip = clips[clipIndex - 1];
    if (prevClip.url) {
      try {
        const frameBuffer = await extractLastFrame(prevClip.url);
        startFrame = await uploadBufferToUT(
          frameBuffer,
          `frame-regen-${jobId}-${clipIndex}.jpg`,
          "image/jpeg",
        );
      } catch {
        startFrame = imageUrl; // fallback to original on extraction failure
      }
    }
  }

  // ── Mark clip as generating ────────────────────────────────────────────────
  clip.retries += 1;
  clip.status   = "generating";
  clips[clipIndex] = clip;
  await saveVideoPhase2State(jobId, { ...currentOutput, clips });

  // ── Generate ───────────────────────────────────────────────────────────────
  try {
    const { url, costToUs: clipCost, providerUsed } =
      await generateSingleClip(startFrame, prompt, aspectRatio);

    clip.url      = url;
    clip.status   = "success";
    clip.costToUs = clipCost;
    clip.provider = providerUsed;
    clips[clipIndex] = clip;

    console.log(`[video/regen] clip ${clipIndex} regenerated successfully (attempt ${clip.retries})`);
  } catch (err: unknown) {
    clip.status = "failed";
    clips[clipIndex] = clip;
    await saveVideoPhase2State(jobId, { ...currentOutput, clips });
    throw new Error(`Clip ${clipIndex} regeneration failed: ${err instanceof Error ? err.message : err}`);
  }

  await saveVideoPhase2State(jobId, { ...currentOutput, clips });

  // ── If all clips now succeeded, stitch and finalize ────────────────────────
  if (clips.every((c) => c.status === "success")) {
    console.log(`[video/regen] all ${clips.length} clips successful — triggering stitch`);
    await stitchAndFinalize(jobId, clips, { ...currentOutput, clips });
  } else {
    const remaining = clips.filter((c) => c.status === "failed").length;
    console.log(`[video/regen] clip ${clipIndex} fixed — ${remaining} clip(s) still failed`);
  }
}
