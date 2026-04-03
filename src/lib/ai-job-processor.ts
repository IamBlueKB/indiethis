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
 *   Step 4  — AR_REPORT:   Whisper (transcription) + Auphonic analyzeMusic + Claude Sonnet
 *   Step 5+ — remaining handlers wired in subsequent steps
 */

import os from "os";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { db } from "@/lib/db";
import { AIJobStatus, type AIJob, type Prisma } from "@prisma/client";
import { fal } from "@fal-ai/client";
import type { QueueStatus } from "@fal-ai/client";
import ffmpegFluent from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { UTApi } from "uploadthing/server";
import { claude, SONNET } from "@/lib/claude";
import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import { embedIndieThisMetadata } from "@/lib/image-metadata";
import {
  sendMasteringCompleteEmail,
  sendCoverArtCompleteEmail,
  sendPressKitCompleteEmail,
  sendLyricVideoCompleteEmail,
} from "@/lib/brevo/email";

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

// Kling cost: $0.029 per second of output
const KLING_COST_PER_SEC = 0.029;

// ─── Tiered pricing for AI video generation ───────────────────────────────────

/**
 * Three duration tiers for AI music video generation.
 *
 * The `maxSeconds` cap is enforced at Phase 1 so both preview approval
 * and Phase 2 clip generation always respect the purchased tier.
 * `price` is the flat fee charged to the artist (USD).
 */
export const VIDEO_DURATION_TIERS = {
  SHORT:  { maxSeconds: 30,  price: 19, label: "Up to 30 seconds" },
  MEDIUM: { maxSeconds: 60,  price: 29, label: "Up to 1 minute"   },
  FULL:   { maxSeconds: 180, price: 49, label: "Up to 3 minutes"  },
} as const;

export type VideoDurationTier = keyof typeof VIDEO_DURATION_TIERS;

/**
 * Infer the tier from a raw duration (seconds) when no explicit tier is provided.
 * Rounds up to the smallest tier that covers the requested duration.
 */
function inferTier(seconds: number): VideoDurationTier {
  if (seconds <= 30)  return "SHORT";
  if (seconds <= 60)  return "MEDIUM";
  return "FULL";
}

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

// ─── handleVideo — Phase 1 preview ───────────────────────────────────────────

async function handleVideo(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing VIDEO job ${job.id} — Phase 1 preview`);

  // ── Env check ─────────────────────────────────────────────────────────────
  const falKey = process.env.FAL_KEY;

  if (!falKey || falKey.startsWith("your_"))
    throw new Error("FAL_KEY is not configured — add it to .env.local to use video generation.");

  // ── Extract inputs ────────────────────────────────────────────────────────
  const input = (job.inputData ?? {}) as Record<string, unknown>;
  const {
    imageUrl,
    style            = "cinematic",
    aspectRatio      = "16:9",
    durationSeconds: rawDurationSeconds = 60,
    durationTier:    rawTier,
  } = input as {
    imageUrl?:         string;
    style?:            string;
    aspectRatio?:      string;
    durationSeconds?:  number;
    durationTier?:     string;
  };

  if (!imageUrl?.trim())
    throw new Error("VIDEO job missing required input: imageUrl");

  // ── Resolve duration tier and enforce cap ─────────────────────────────────
  // Accept an explicit tier from the client; infer from raw seconds otherwise.
  const tier: VideoDurationTier =
    rawTier && rawTier in VIDEO_DURATION_TIERS
      ? (rawTier as VideoDurationTier)
      : inferTier(Number(rawDurationSeconds));

  const tierDef       = VIDEO_DURATION_TIERS[tier];
  const priceCharged  = tierDef.price;                               // artist-facing price
  // Cap the requested duration to what the tier permits
  const durationSeconds = Math.min(Number(rawDurationSeconds), tierDef.maxSeconds);

  console.log(
    `[video] tier ${tier} ($${priceCharged}) — capped duration: ${durationSeconds}s / ${tierDef.maxSeconds}s max`,
  );

  const stylePrompt = VIDEO_STYLE_PROMPTS[style] ?? VIDEO_STYLE_PROMPTS["cinematic"];

  // ── Generate via Kling ────────────────────────────────────────────────────
  const res      = await generateWithKling(imageUrl, stylePrompt, aspectRatio, 10);
  const videoUrl = res.videoUrl;
  const extraMeta: Record<string, unknown> = { falModel: "fal-ai/kling-video/v1.6/pro/image-to-video" };
  console.log(`[video] Kling preview generated: ${videoUrl}`);

  // Phase 1 cost: 10 seconds @ Kling rate
  const costToUs = 10 * KLING_COST_PER_SEC;

  // ── Write Phase 1 result to DB — status stays PROCESSING ─────────────────
  await db.aIJob.update({
    where: { id: job.id },
    data: {
      outputData: {
        previewUrl:      videoUrl,
        previewReady:    true,
        phase:           1,
        provider:        "kling",
        style,
        aspectRatio,
        durationSeconds,      // tier-capped value — used by Phase 2 full render
        durationTier:    tier,
        priceCharged,
        stylePrompt,
        previewCostToUs: costToUs,
        ...extraMeta,
      } as import("@prisma/client").Prisma.InputJsonValue,
      costToUs,
      priceCharged,     // flat artist-facing price persisted on the job record
      // status intentionally NOT changed — stays PROCESSING until user approves
    },
  });

  console.log(
    `[video] Phase 1 complete (kling) — tier ${tier} ($${priceCharged}), ` +
    `provider cost $${costToUs.toFixed(3)}. Job ${job.id} awaiting user approval for Phase 2.`,
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
  const falKey       = process.env.FAL_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!falKey || falKey.startsWith("your_"))
    throw new Error("FAL_KEY is not configured — add it to .env.local to use Cover Art generation.");
  if (!anthropicKey || anthropicKey === "sk-ant-...")
    throw new Error("ANTHROPIC_API_KEY is not configured — add it to .env.local to use Cover Art generation.");

  // ── Extract inputs ────────────────────────────────────────────────────────
  const input = (job.inputData ?? {}) as Record<string, string>;
  const { artistPrompt, style, mood, quality } = input;

  if (!artistPrompt?.trim())
    throw new Error("COVER_ART job missing required input: artistPrompt");

  const FAL_MODEL = quality === "premium"
    ? "fal-ai/nano-banana-2"
    : "fal-ai/bytedance/seedream/v4/text-to-image";
  const costPerImage = quality === "premium" ? 0.075 : 0.03;

  let totalCost = 0;

  // ── Step 1: Claude — optimize the prompt for image generation ────────────
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

  // ── Step 2: fal.ai — run image model ×4 with varied seeds ───────────────
  const NUM_IMAGES = 4;
  const BASE_SEED  = Math.floor(Math.random() * 100_000);

  console.log(`[cover-art] running ${quality === "premium" ? "Nano Banana 2" : "Seedream V4"} ×${NUM_IMAGES} on fal.ai (base seed ${BASE_SEED})`);

  fal.config({ credentials: falKey });

  // Fire all 4 runs in parallel with seeds BASE_SEED + 0,1,2,3
  const predictions = await Promise.allSettled(
    Array.from({ length: NUM_IMAGES }, (_, i) =>
      fal.subscribe(FAL_MODEL, {
        input: {
          prompt:     optimizedPrompt,
          image_size: "square_hd",
          seed:       BASE_SEED + i,
        },
      })
    ),
  );

  // Collect successful image URLs
  const imageUrls: string[] = [];
  for (const result of predictions) {
    if (result.status === "fulfilled") {
      const images = (result.value.data as { images?: { url: string }[] }).images;
      const url = images?.[0]?.url;
      if (url) imageUrls.push(url);
    } else {
      console.warn(`[cover-art] one Seedream prediction failed: ${result.reason}`);
    }
  }

  if (imageUrls.length === 0)
    throw new Error("All fal.ai image predictions failed — no images generated.");

  const falCost = imageUrls.length * costPerImage;
  totalCost += falCost;

  console.log(
    `[cover-art] ${quality === "premium" ? "Nano Banana 2" : "Seedream V4"} complete — ${imageUrls.length}/${NUM_IMAGES} images. ` +
    `Total cost: $${totalCost.toFixed(4)}`,
  );

  // ── Step 3: Embed IndieThis metadata + re-upload to UploadThing ──────────
  // Replicate CDN URLs are temporary; re-uploading gives permanent URLs and
  // embeds invisible EXIF metadata (Copyright, Artist, Software).
  console.log(`[cover-art] embedding metadata and re-uploading ${imageUrls.length} image(s)…`);
  const storedUrls: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const buffer = await embedIndieThisMetadata(imageUrls[i]);
      const url    = await uploadBufferToUT(buffer, `cover-art-${job.id}-${i}.png`, "image/png");
      storedUrls.push(url);
    } catch (err) {
      console.warn(`[cover-art] metadata embed failed for image ${i}, keeping original URL: ${err}`);
      storedUrls.push(imageUrls[i]); // fall back to original Replicate URL
    }
  }
  console.log(`[cover-art] re-upload complete → ${storedUrls.length} permanent URL(s)`);

  return {
    outputData: {
      imageUrls: storedUrls,
      optimizedPrompt,
      originalPrompt: artistPrompt,
      style:          style ?? null,
      mood:           mood  ?? null,
      quality:        quality ?? "standard",
      model:          FAL_MODEL,
      seeds:          Array.from({ length: NUM_IMAGES }, (_, i) => BASE_SEED + i),
    },
    costToUs: totalCost,
  };
}

async function handleMastering(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing MASTERING job ${job.id} via ${job.provider}`);

  // ── Env checks ───────────────────────────────────────────────────────────
  const auphonicKey = process.env.AUPHONIC_API_KEY;

  if (!auphonicKey || auphonicKey.startsWith("your_"))
    throw new Error("AUPHONIC_API_KEY is not configured — add it to .env.local to use AI Mastering.");

  // ── Extract inputs ────────────────────────────────────────────────────────
  const input = (job.inputData ?? {}) as Record<string, string>;
  const { trackUrl } = input;

  if (!trackUrl?.trim())
    throw new Error("MASTERING job missing required input: trackUrl");

  // ── Define the 3 mastering profiles ──────────────────────────────────────
  const PROFILES = [
    {
      label:          "Warm",
      description:    "Boosted low-mids, gentle compression — ideal for late-night listening",
      loudnesstarget: "-14",
      filtering:      "0",
    },
    {
      label:          "Punchy",
      description:    "Emphasized transients, tighter compression — energetic and club-ready",
      loudnesstarget: "-9",
      filtering:      "0",
    },
    {
      label:          "Broadcast Ready",
      description:    "Loudness normalized to -14 LUFS, balanced EQ — Spotify / Apple Music compliant",
      loudnesstarget: "-14",
      filtering:      "1",
    },
  ] as const;

  const authHeader = `bearer ${auphonicKey}`;

  // ── Start all 3 productions in parallel ──────────────────────────────────
  console.log(`[mastering] starting 3 Auphonic productions in parallel`);

  type AuphonicProduction = {
    profile: (typeof PROFILES)[number];
    uuid:    string;
  };

  const startResults = await Promise.allSettled(
    PROFILES.map(async (profile): Promise<AuphonicProduction> => {
      const form = new URLSearchParams();
      form.set("input_file",      trackUrl);
      form.set("action",          "start");
      form.set("loudnesstarget",  profile.loudnesstarget);
      form.set("filtering",       profile.filtering);

      const res = await fetch("https://auphonic.com/api/simple/productions.json", {
        method:  "POST",
        headers: {
          Authorization:  authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Auphonic create failed for ${profile.label}: ${res.status} ${text}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      const uuid: string = json?.data?.uuid;
      if (!uuid) throw new Error(`Auphonic did not return uuid for ${profile.label}`);
      console.log(`[mastering] ${profile.label} production started — uuid: ${uuid}`);
      return { profile, uuid };
    }),
  );

  // ── Poll each production until Done / Error ───────────────────────────────
  const MAX_WAIT_MS = 600_000; // 10 minutes
  const POLL_MS     = 6_000;

  type PollResult = {
    statusString: string;
    downloadUrl:  string | null;
    measuredLUFS: number | null;
  };

  const pollProduction = async (uuid: string, label: string): Promise<PollResult> => {
    const started = Date.now();
    while (Date.now() - started < MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const res = await fetch(`https://auphonic.com/api/production/${uuid}.json`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        console.warn(`[mastering] poll HTTP error for ${label}: ${res.status}`);
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      const statusString: string = json?.data?.status_string ?? "Unknown";
      console.log(`[mastering] ${label} status: ${statusString}`);
      if (statusString === "Done") {
        const downloadUrl = (json?.data?.output_files?.[0]?.download_url as string) ?? null;
        return { statusString, downloadUrl, measuredLUFS: null };
      }
      if (statusString === "Error") {
        return { statusString, downloadUrl: null, measuredLUFS: null };
      }
    }
    return { statusString: "Timeout", downloadUrl: null, measuredLUFS: null };
  };

  // Build poll tasks only for successfully started productions
  type OutputEntry = {
    label:        string;
    description:  string;
    downloadUrl:  string | null;
    measuredLUFS: number | null;
    status:       string;
  };

  const outputs: OutputEntry[] = [];
  const pollTasks: Array<{ index: number; profile: (typeof PROFILES)[number]; uuid: string }> = [];

  for (let i = 0; i < startResults.length; i++) {
    const sr = startResults[i];
    const profile = PROFILES[i];
    if (sr.status === "rejected") {
      console.warn(`[mastering] ${profile.label} start failed: ${sr.reason}`);
      outputs.push({
        label:       profile.label,
        description: profile.description,
        downloadUrl: null,
        measuredLUFS: null,
        status:      "Failed",
      });
    } else {
      pollTasks.push({ index: i, profile, uuid: sr.value.uuid });
      outputs.push(null as unknown as OutputEntry); // placeholder
    }
  }

  const pollResults = await Promise.allSettled(
    pollTasks.map(({ profile, uuid }) => pollProduction(uuid, profile.label)),
  );

  for (let t = 0; t < pollTasks.length; t++) {
    const { index, profile } = pollTasks[t];
    const pr = pollResults[t];
    if (pr.status === "rejected") {
      console.warn(`[mastering] ${profile.label} poll threw: ${pr.reason}`);
      outputs[index] = {
        label:       profile.label,
        description: profile.description,
        downloadUrl: null,
        measuredLUFS: null,
        status:      "Failed",
      };
    } else {
      const { statusString, downloadUrl, measuredLUFS } = pr.value;
      outputs[index] = {
        label:       profile.label,
        description: profile.description,
        downloadUrl: statusString === "Done" ? downloadUrl : null,
        measuredLUFS,
        status:      statusString === "Done" ? "Success" : statusString,
      };
      if (statusString === "Done") {
        console.log(
          `[mastering] ${profile.label} complete. ` +
          `Download: ${downloadUrl?.slice(0, 60)}…`,
        );
      } else {
        console.warn(`[mastering] ${profile.label} ended with status: ${statusString}`);
      }
    }
  }

  const successCount = outputs.filter((o) => o.status === "Success").length;
  if (successCount === 0)
    throw new Error("All 3 Auphonic mastering productions failed. Check AUPHONIC_API_KEY and try again.");

  console.log(`[mastering] done — ${successCount}/3 succeeded.`);

  return {
    outputData: {
      outputs,        // array of { label, description, downloadUrl, measuredLUFS, status }
      sourceTrackUrl: trackUrl,
      successCount,
    },
  };
}

async function handleLyricVideo(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing LYRIC_VIDEO job ${job.id} — Step 10a: Whisper transcription`);

  // ── Env check ────────────────────────────────────────────────────────────
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!replicateToken || replicateToken.startsWith("your_"))
    throw new Error("REPLICATE_API_TOKEN is not configured — add it to .env.local to use Lyric Video generation.");

  // ── Extract inputs ────────────────────────────────────────────────────────
  const input = (job.inputData ?? {}) as Record<string, unknown>;
  const {
    trackUrl,
    visualStyle  = "gradient",   // background style for Remotion render (Step 11)
    fontStyle    = "bold",        // lyric text font style
    accentColor  = "#D4A843",     // highlight color for active word (gold default)
    aspectRatio  = "16:9",        // video dimensions
  } = input as {
    trackUrl?:    string;
    visualStyle?: string;
    fontStyle?:   string;
    accentColor?: string;
    aspectRatio?: string;
  };

  if (!trackUrl?.trim())
    throw new Error("LYRIC_VIDEO job missing required input: trackUrl");

  // ── Step 10a: Replicate Whisper — word-level transcription ───────────────
  console.log(`[lyric-video] transcribing with Replicate Whisper large-v3: ${trackUrl}`);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Replicate = require("replicate");
  const replicate = new Replicate({ auth: replicateToken });

  const replicateOutput = await replicate.run(
    "openai/whisper:4d50797290df275329f202e48c76360b3f22b08d6d5b9b6b2e3d7d4b31d5c0b6",
    {
      input: {
        audio:           trackUrl,  // direct URL works
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

  // Flatten segments[].words[] into a flat words array
  type WhisperWord    = { word: string; start: number; end: number };
  type WhisperSegment = { id: number; start: number; end: number; text: string };

  const words: WhisperWord[] = (replicateOutput.segments ?? []).flatMap((seg) =>
    (seg.words ?? []).map((w) => ({ word: w.word, start: w.start, end: w.end })),
  );

  const segments: WhisperSegment[] = (replicateOutput.segments ?? []).map((seg, i) => ({
    id:    i,
    start: seg.start,
    end:   seg.end,
    text:  seg.text,
  }));

  const fullText = replicateOutput.transcription ?? "";

  // Estimate duration from last segment end (Replicate doesn't return explicit duration)
  const audioDuration = segments.length > 0 ? segments[segments.length - 1].end : 0;
  // Cost: Replicate whisper large-v3 ~$0.0088/min
  const costToUs = (audioDuration / 60) * 0.0088;

  console.log(
    `[lyric-video] Whisper complete — ${words.length} words, ` +
    `${segments.length} segments, ${(audioDuration / 60).toFixed(2)} min. ` +
    `Cost: $${costToUs.toFixed(4)}`,
  );

  // ── Write transcription to DB — status stays PROCESSING ──────────────────
  // The user reviews and optionally corrects lyrics before rendering begins.
  // Step 11 (Remotion render) is triggered via POST /api/ai-jobs/[id]/approve-lyrics.
  await db.aIJob.update({
    where: { id: job.id },
    data: {
      outputData: {
        // Transcription output
        transcriptionReady: true,
        words,               // [{ word, start, end }] — used by Remotion for word-by-word animation
        segments,            // sentence-level segments with start/end times
        text:        fullText,
        duration:    audioDuration > 0 ? audioDuration : null,
        whisperModel: "openai/whisper:large-v3",
        transcriptionCostToUs: costToUs,

        // Render metadata saved for Step 11
        trackUrl,
        visualStyle,
        fontStyle,
        accentColor,
        aspectRatio,
      } as Prisma.InputJsonValue,
      costToUs,
      // status intentionally NOT changed — stays PROCESSING until user approves lyrics
    },
  });

  console.log(
    `[lyric-video] transcription saved to job ${job.id}. ` +
    `Artist reviews lyrics → POST /api/ai-jobs/${job.id}/approve-lyrics to start render.`,
  );

  return {
    outputData:   {},   // already written above
    costToUs,
    skipComplete: true, // stays PROCESSING until lyrics are approved
  };
}

async function handleARReport(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing AR_REPORT job ${job.id} via ${job.provider}`);

  // ── Env checks — fail fast with actionable messages ──────────────────────
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const anthropicKey   = process.env.ANTHROPIC_API_KEY;

  if (!replicateToken || replicateToken.startsWith("your_"))
    throw new Error("REPLICATE_API_TOKEN is not configured — add it to .env.local to use the A&R Report.");
  if (!anthropicKey || anthropicKey.startsWith("sk-ant-api") === false && anthropicKey === "sk-ant-...")
    throw new Error("ANTHROPIC_API_KEY is not configured — add it to .env.local to use the A&R Report.");

  // ── Extract job inputs ────────────────────────────────────────────────────
  const input = (job.inputData ?? {}) as Record<string, string>;
  const { trackUrl, trackId, genre, artistBio, targetMarket, comparableArtists } = input;

  if (!trackUrl) throw new Error("AR_REPORT job missing required input: trackUrl");

  let totalCost = 0;

  // ── Step 0: Look up AudioFeatures from DB ─────────────────────────────────
  let audioFeatures: {
    bpm?: number | null;
    musicalKey?: string | null;
    energy?: number | null;
    danceability?: number | null;
    valence?: number | null;
    acousticness?: number | null;
    instrumentalness?: number | null;
    liveness?: number | null;
    speechiness?: number | null;
    loudness?: number | null;
  } = {};

  try {
    // Try by trackId first, fall back to matching by fileUrl
    const track = trackId
      ? await db.track.findUnique({ where: { id: trackId }, include: { audioFeatures: true } })
      : await db.track.findFirst({ where: { fileUrl: trackUrl }, include: { audioFeatures: true } });

    if (track) {
      audioFeatures = {
        bpm:              track.bpm             ?? track.audioFeatures?.energy    ?? null,
        musicalKey:       track.musicalKey      ?? null,
        energy:           track.audioFeatures?.energy           ?? null,
        danceability:     track.audioFeatures?.danceability     ?? null,
        valence:          track.audioFeatures?.valence          ?? null,
        acousticness:     track.audioFeatures?.acousticness     ?? null,
        instrumentalness: track.audioFeatures?.instrumentalness ?? null,
        liveness:         track.audioFeatures?.liveness         ?? null,
        speechiness:      track.audioFeatures?.speechiness      ?? null,
        loudness:         track.audioFeatures?.loudness         ?? null,
      };
      // Fix bpm — it's on the Track model directly, not AudioFeatures
      audioFeatures.bpm = track.bpm ?? null;
      console.log(`[ar-report] AudioFeatures loaded for track ${track.id}`);
    } else {
      console.log(`[ar-report] No track found for URL — proceeding without AudioFeatures`);
    }
  } catch (e) {
    console.warn(`[ar-report] Failed to load AudioFeatures: ${e}`);
  }

  // ── Step 1: Whisper transcription via Replicate ───────────────────────────
  console.log(`[ar-report] transcribing audio via Replicate Whisper: ${trackUrl}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Replicate = require("replicate");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const replicate = new Replicate({ auth: replicateToken });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whisperOutput = await replicate.run(
    "openai/whisper:4d50797290df275329f202e48c76360b3f22b08d6d5b9b6b2e3d7d4b31d5c0b6",
    { input: { audio: trackUrl, word_timestamps: true } },
  ) as Record<string, unknown>;

  // Flatten segments[].words[] into a flat words array and extract segments
  type WhisperSegment = { start: number; end: number; text: string; words?: Array<{ word: string; start: number; end: number }> };
  const rawSegments = (whisperOutput?.segments ?? []) as WhisperSegment[];
  const segments    = rawSegments.map((s) => ({ start: s.start, end: s.end, text: s.text }));

  // Estimate Replicate Whisper cost: $0.0088/min
  const lastSeg              = rawSegments[rawSegments.length - 1];
  const audioDurationSeconds = lastSeg?.end ?? 180;
  const audioDurationMinutes = audioDurationSeconds / 60;
  totalCost += audioDurationMinutes * 0.0088;

  const lyrics = (whisperOutput?.transcription as string) ?? "(No lyrics detected — instrumental or transcription failed)";
  const lyricsWithTimestamps = segments.length > 0
    ? segments.map((s) => `[${s.start.toFixed(1)}s] ${s.text.trim()}`).join("\n")
    : lyrics;

  console.log(`[ar-report] Whisper complete — ${audioDurationMinutes.toFixed(1)} min, ${lyrics.length} chars`);

  // ── Step 2: audio analysis — from AudioFeatures DB record ────────────────
  console.log(`[ar-report] audio analysis: ${Object.values(audioFeatures).some(v => v != null) ? "loaded from AudioFeatures" : "not available"}`);

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

**Audio Analysis:**
- BPM / Tempo: ${audioFeatures.bpm != null ? `${audioFeatures.bpm} BPM` : "Not available"}
- Musical Key: ${audioFeatures.musicalKey != null ? audioFeatures.musicalKey : "Not available"}
- Energy: ${audioFeatures.energy != null ? `${(audioFeatures.energy * 100).toFixed(0)}% (${audioFeatures.energy >= 0.7 ? "high" : audioFeatures.energy >= 0.4 ? "medium" : "low"})` : "Not available"}
- Danceability: ${audioFeatures.danceability != null ? `${(audioFeatures.danceability * 100).toFixed(0)}% (${audioFeatures.danceability >= 0.7 ? "highly danceable" : audioFeatures.danceability >= 0.4 ? "moderately danceable" : "low danceability"})` : "Not available"}
- Valence (mood): ${audioFeatures.valence != null ? `${(audioFeatures.valence * 100).toFixed(0)}% (${audioFeatures.valence >= 0.6 ? "positive/upbeat" : audioFeatures.valence >= 0.4 ? "neutral" : "dark/melancholic"})` : "Not available"}
- Acousticness: ${audioFeatures.acousticness != null ? `${(audioFeatures.acousticness * 100).toFixed(0)}% (${audioFeatures.acousticness >= 0.7 ? "primarily acoustic" : audioFeatures.acousticness >= 0.3 ? "mixed" : "primarily electronic/produced"})` : "Not available"}
- Instrumentalness: ${audioFeatures.instrumentalness != null ? `${(audioFeatures.instrumentalness * 100).toFixed(0)}% (${audioFeatures.instrumentalness >= 0.5 ? "likely instrumental" : "vocal track"})` : "Not available"}
- Liveness: ${audioFeatures.liveness != null ? `${(audioFeatures.liveness * 100).toFixed(0)}% (${audioFeatures.liveness >= 0.8 ? "likely live recording" : "studio recording"})` : "Not available"}
- Speechiness: ${audioFeatures.speechiness != null ? `${(audioFeatures.speechiness * 100).toFixed(0)}% (${audioFeatures.speechiness >= 0.66 ? "spoken word" : audioFeatures.speechiness >= 0.33 ? "rap/hybrid" : "sung vocals"})` : "Not available"}
- Loudness: ${audioFeatures.loudness != null ? `${(audioFeatures.loudness * 60 - 60).toFixed(1)} LUFS (estimated)` : "Not available"}
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

  const reportText =
    claudeResponse.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("") +
    "\n\n---\n*Generated by IndieThis | indiethis.com*";

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
      audioFeatures,
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

      // Auto-trigger canvas video when a Release Bundle cover art job completes
      if (job.type === "COVER_ART") {
        const inputData    = job.inputData as Record<string, unknown> | null;
        const bundleUserId  = inputData?.bundleUserId  as string | undefined;
        const bundleTrackId = inputData?.bundleTrackId as string | undefined;
        const imageUrls = (result.outputData as Record<string, unknown>)?.imageUrls as string[] | undefined;
        if (bundleUserId && bundleTrackId && imageUrls?.[0]) {
          void triggerBundleCanvas(bundleTrackId, imageUrls[0], bundleUserId).catch((e: unknown) => {
            console.error("[bundle-canvas] triggerBundleCanvas error:", e);
          });
        }
      }

      // Branded completion email (non-fatal, fire-and-forget)
      if (job.artistId && (job.type === "MASTERING" || job.type === "COVER_ART" || job.type === "PRESS_KIT")) {
        const completionArtistId = job.artistId;
        void (async () => {
          try {
            const artist = await db.user.findUnique({
              where:  { id: completionArtistId },
              select: { email: true, name: true, artistName: true, artistSlug: true },
            });
            if (!artist?.email) return;
            const artistName = artist.artistName ?? artist.name ?? "Artist";
            const artistSlug = artist.artistSlug !== null ? artist.artistSlug : undefined;
            const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

            if (job.type === "MASTERING") {
              const outputs = (result.outputData.outputs as Array<{ downloadUrl: string | null; status: string }> | undefined) ?? [];
              const first   = outputs.find((o) => o.status === "Success" && o.downloadUrl);
              await sendMasteringCompleteEmail({
                artistEmail: artist.email,
                artistName,
                artistSlug,
                trackTitle:  "your track",
                downloadUrl: first?.downloadUrl ?? `${appUrl}/dashboard/ai/mastering`,
              });
            } else if (job.type === "COVER_ART") {
              const imageUrls = (result.outputData.imageUrls as string[] | undefined) ?? [];
              await sendCoverArtCompleteEmail({
                artistEmail: artist.email,
                artistName,
                artistSlug,
                trackTitle:  "your latest",
                artUrl:      imageUrls[0] ?? `${appUrl}/dashboard/ai/cover-art`,
              });
            } else if (job.type === "PRESS_KIT") {
              const pdfUrl = (result.outputData.pdfUrl as string | undefined) ?? `${appUrl}/dashboard/ai/press-kit`;
              await sendPressKitCompleteEmail({
                artistEmail: artist.email,
                artistName,
                artistSlug,
                pressKitUrl: pdfUrl,
              });
            }
          } catch (emailErr) {
            console.error(`[ai-jobs] completion email failed for job ${jobId}:`, emailErr);
          }
        })();
      }
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

// ─── Release Bundle: auto-generate canvas after cover art ─────────────────────

/**
 * Fires a Remotion Lambda canvas render for a release bundle purchase.
 * Called after the bundle's COVER_ART job completes — runs fire-and-forget.
 */
async function triggerBundleCanvas(trackId: string, coverArtUrl: string, userId: string): Promise<void> {
  const serveUrl     = process.env.REMOTION_SERVE_URL;
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const awsRegion    = (process.env.REMOTION_REGION ?? process.env.AWS_REGION ?? "us-east-1") as Parameters<typeof renderMediaOnLambda>[0]["region"];

  if (!serveUrl || !functionName) {
    console.warn("[bundle-canvas] Remotion not configured — skipping canvas render");
    return;
  }

  const track = await db.track.findUnique({ where: { id: trackId }, select: { fileUrl: true } });
  if (!track) return;

  const { renderId, bucketName } = await renderMediaOnLambda({
    region:      awsRegion,
    functionName,
    serveUrl,
    composition: "TrackCanvas",
    inputProps:  { coverArtUrl, audioUrl: track.fileUrl, accentColor: "#D4A843" },
    codec:           "h264",
    imageFormat:     "jpeg",
    maxRetries:      1,
    framesPerLambda: 60,
    privacy:         "public",
    outName:         `canvas-bundle-${trackId}-${Date.now()}.mp4`,
  });

  // Poll for completion (up to 3 minutes)
  const maxMs = 180_000;
  const start  = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise<void>((r) => setTimeout(r, 4_000));
    const progress = await getRenderProgress({ renderId, bucketName, functionName, region: awsRegion });
    if (progress.fatalErrorEncountered) {
      console.error("[bundle-canvas] Remotion render error:", progress.errors?.[0]?.message);
      break;
    }
    if (progress.done && progress.outputFile) {
      await db.track.update({ where: { id: trackId }, data: { canvasVideoUrl: progress.outputFile } });
      const { createNotification } = await import("@/lib/notifications");
      void createNotification({
        userId,
        type:    "AI_JOB_COMPLETE",
        title:   "Canvas video ready",
        message: "Your release bundle canvas video is ready. Head to your music page to view it.",
        link:    "/dashboard/music",
      }).catch(() => {});
      console.log(`[bundle-canvas] canvas saved for track ${trackId}`);
      break;
    }
  }
}

// ─── Phase 2 types ────────────────────────────────────────────────────────────

type VideoClip = {
  index:       number;
  url:         string | null;
  status:      "pending" | "generating" | "success" | "failed";
  retries:     number;
  costToUs:    number;
  provider?:   "kling";
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
 * Generate one 10-second clip using Kling.
 * Returns { url, costToUs, providerUsed }.
 */
async function generateSingleClip(
  imageUrl:    string,
  prompt:      string,
  aspectRatio: string,
): Promise<{ url: string; costToUs: number; providerUsed: "kling" }> {
  const res = await generateWithKling(imageUrl, prompt, aspectRatio, 10);
  return { url: res.videoUrl, costToUs: 10 * KLING_COST_PER_SEC, providerUsed: "kling" };
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

// ─── Video resolution map (aspect ratio → pixel dimensions) ──────────────────
const VIDEO_DIM: Record<string, { w: number; h: number }> = {
  "16:9": { w: 1280, h: 720  },
  "9:16": { w: 720,  h: 1280 },
  "1:1":  { w: 960,  h: 960  },
};

/**
 * Render a black-background IndieThis outro frame as a PNG file.
 * Returns the absolute path to the created PNG.
 */
async function generateOutroFrame(aspectRatio: string, tmpDir: string): Promise<string> {
  const { w, h } = VIDEO_DIM[aspectRatio] ?? VIDEO_DIM["16:9"];
  const short     = Math.min(w, h);
  const iconSize  = Math.round(short * 0.12);
  const cx        = w / 2;
  const iconY     = Math.round(h / 2 - iconSize * 0.9);

  // Icon geometry (proportional to icon square)
  const rx     = Math.round(iconSize * 0.22);
  const barX   = Math.round(iconSize * 0.41);
  const barY   = Math.round(iconSize * 0.31);
  const barW   = Math.round(iconSize * 0.14);
  const barH   = Math.round(iconSize * 0.47);
  const barRx  = Math.round(iconSize * 0.07);
  const triPts = [
    `${Math.round(iconSize * 0.375)},${Math.round(iconSize * 0.155)}`,
    `${Math.round(iconSize * 0.375)},${Math.round(iconSize * 0.390)}`,
    `${Math.round(iconSize * 0.594)},${Math.round(iconSize * 0.273)}`,
  ].join(" ");

  const fontSize = Math.round(short * 0.045);
  const textY    = iconY + iconSize + Math.round(fontSize * 1.5);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#000000"/>
  <g transform="translate(${Math.round(cx - iconSize / 2)}, ${iconY})">
    <rect x="0" y="0" width="${iconSize}" height="${iconSize}" rx="${rx}" fill="#D4A843"/>
    <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${barRx}" fill="#FFFFFF"/>
    <polygon points="${triPts}" fill="#E85D4A"/>
  </g>
  <text x="${cx}" y="${textY}" text-anchor="middle" fill="#FFFFFF"
        font-family="sans-serif" font-size="${fontSize}" font-weight="700"
        letter-spacing="-1">IndieThis</text>
</svg>`;

  const pngPath = path.join(tmpDir, "outro-frame.png");
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  return pngPath;
}

/**
 * Convert a static PNG into a 2-second H.264 MP4 with 0.5s fade-in and fade-out.
 * Returns the absolute path to the created MP4.
 */
async function generateOutroVideo(
  pngPath:     string,
  aspectRatio: string,
  tmpDir:      string,
): Promise<string> {
  const { w, h }   = VIDEO_DIM[aspectRatio] ?? VIDEO_DIM["16:9"];
  const outroPath  = path.join(tmpDir, "outro.mp4");
  const fps        = 30;
  const duration   = 2;           // total seconds
  const fadeFr     = Math.round(fps * 0.5); // 15 frames = 0.5 s fade
  const fadeOutAt  = Math.round(fps * (duration - 0.5)); // frame 45

  await new Promise<void>((resolve, reject) => {
    ffmpegFluent()
      .addInput(pngPath)
      .addInputOptions(["-loop 1", `-t ${duration}`, `-r ${fps}`])
      .outputOptions([
        `-vf scale=${w}:${h},fade=in:0:${fadeFr},fade=out:${fadeOutAt}:${fadeFr}`,
        "-c:v libx264",
        "-pix_fmt yuv420p",
        `-r ${fps}`,
        "-an",
        "-movflags +faststart",
      ])
      .output(outroPath)
      .on("end",   () => resolve())
      .on("error", (e) => reject(e))
      .run();
  });

  return outroPath;
}

/**
 * Download all clip videos, concatenate them with ffmpeg, append a 2-second
 * IndieThis outro card, and return the stitched MP4 as a Buffer.
 */
async function stitchClipsToBuffer(
  clipUrls:    string[],
  jobId:       string,
  aspectRatio = "16:9",
): Promise<Buffer> {
  const tmpDir     = path.join(os.tmpdir(), `indiethis-stitch-${jobId}`);
  const outputPath = path.join(tmpDir, "output.mp4");

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

    // Generate outro card and append it
    let outroPath: string | null = null;
    try {
      const pngPath = await generateOutroFrame(aspectRatio, tmpDir);
      outroPath     = await generateOutroVideo(pngPath, aspectRatio, tmpDir);
      console.log(`[video/stitch] outro card generated (${aspectRatio})`);
    } catch (err) {
      console.warn(`[video/stitch] outro generation failed, skipping: ${err}`);
    }

    const allPaths = outroPath ? [...clipPaths, outroPath] : clipPaths;

    // Write ffmpeg concat list (paths must use forward slashes on all platforms)
    const listPath    = path.join(tmpDir, "list.txt");
    const listContent = allPaths
      .map((p) => `file '${p.replace(/\\/g, "/")}'`)
      .join("\n");
    fs.writeFileSync(listPath, listContent);

    // Concatenate. When an outro is included the clips must be re-encoded so
    // the codec/resolution matches; otherwise use lossless stream copy.
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpegFluent()
        .addInput(listPath)
        .addInputOptions(["-f concat", "-safe 0"]);

      if (outroPath) {
        cmd.outputOptions([
          "-c:v libx264",
          "-crf 23",
          "-preset fast",
          "-an",
          "-movflags +faststart",
        ]);
      } else {
        cmd.outputOptions(["-c copy"]);
      }

      cmd
        .output(outputPath)
        .on("end",   () => resolve())
        .on("error", (e) => reject(e))
        .run();
    });

    console.log(`[video/stitch] stitched ${allPaths.length} clips → ${outputPath}`);
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

  const clipUrls   = clips.map((c) => c.url!);
  const ratio      = (currentOutput.aspectRatio as string | undefined) ?? "16:9";
  const stitchedBuffer = await stitchClipsToBuffer(clipUrls, jobId, ratio);

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

// ─── Step 11: Lyric Video Phase 2 — Remotion Lambda render ───────────────────

/** Word-level timestamp from Whisper (mirrors the inline type in handleLyricVideo). */
export type WhisperWord = { word: string; start: number; end: number };

/**
 * continueLyricVideoRender(jobId, correctedWords?)
 *
 * Called by POST /api/ai-jobs/[id]/approve-lyrics after the artist reviews and
 * (optionally) edits the Whisper transcript.
 *
 *  1. Groups words into lyric lines using the saved segment timestamps.
 *  2. Calls Claude Sonnet to generate a Remotion animation script (JSON array).
 *  3. Renders the lyric video on AWS Lambda via @remotion/lambda.
 *  4. Polls for completion (max 30 min), then uploads the output URL to outputData.
 *  5. Marks the job COMPLETE.
 *
 * @param jobId          - The AIJob id.
 * @param correctedWords - Optional artist-corrected word array.  Falls back to
 *                         the words saved during Step 10a transcription.
 */
export async function continueLyricVideoRender(
  jobId:           string,
  correctedWords?: WhisperWord[],
): Promise<void> {
  const job = await db.aIJob.findUnique({ where: { id: jobId } });

  if (!job) { console.error(`[lyric-video/phase2] job ${jobId} not found`); return; }
  if (job.type !== "LYRIC_VIDEO") { console.error(`[lyric-video/phase2] job ${jobId} wrong type`); return; }
  if (job.status !== AIJobStatus.PROCESSING) {
    console.warn(`[lyric-video/phase2] job ${jobId} is ${job.status} — skipping`); return;
  }

  const savedOutput = (job.outputData ?? {}) as Record<string, unknown>;

  if (!savedOutput.transcriptionReady) {
    await db.aIJob.update({
      where: { id: jobId },
      data: { status: AIJobStatus.FAILED, errorMessage: "Lyric video Phase 2: transcription not ready", completedAt: new Date() },
    });
    return;
  }

  // ── Env checks ────────────────────────────────────────────────────────────
  const serveUrl     = process.env.REMOTION_SERVE_URL;
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const awsRegion    = process.env.AWS_REGION ?? "us-east-1";

  if (!serveUrl || serveUrl.startsWith("your_"))
    throw new Error("REMOTION_SERVE_URL is not configured — add it to .env.local");
  if (!functionName)
    console.warn("[lyric-video/phase2] REMOTION_FUNCTION_NAME is not set — render may fail");

  // ── Resolve word list (corrected or from transcription) ───────────────────
  const words: WhisperWord[] =
    correctedWords ??
    ((savedOutput.words ?? []) as WhisperWord[]);

  const {
    trackUrl,
    accentColor   = "#D4A843",
    aspectRatio   = "16:9",
    textStyle     = "captions",
    fontChoice    = "inter",
    textPosition  = "bottom",
    backgroundUrl = "",
    backgroundType = "image",
    trackTitle    = "Untitled",
    artistName    = "Artist",
  } = savedOutput as {
    trackUrl?:      string;
    accentColor?:   string;
    aspectRatio?:   string;
    textStyle?:     string;
    fontChoice?:    string;
    textPosition?:  string;
    backgroundUrl?: string;
    backgroundType?: string;
    trackTitle?:    string;
    artistName?:    string;
  };

  if (!trackUrl?.trim())
    throw new Error("Lyric video Phase 2: trackUrl missing from outputData");

  // ── Convert words (start/end in seconds) → lyrics (startMs/endMs) ─────────
  const lyrics = words.map((w) => ({
    word:    w.word,
    startMs: Math.round(w.start * 1000),
    endMs:   Math.round(w.end   * 1000),
  }));

  const durationMs = lyrics.length > 0
    ? lyrics[lyrics.length - 1].endMs + 500
    : Number(savedOutput.duration ?? 180) * 1000;

  const claudeCostToUs = 0; // No Claude step needed — composition handles animation

  // Save render start to job output
  await db.aIJob.update({
    where: { id: jobId },
    data: {
      outputData: {
        ...savedOutput,
        renderStartedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  // ── Step 11b: Remotion Lambda — render the lyric video ────────────────────
  console.log(`[lyric-video/phase2] dispatching Remotion Lambda render for job ${jobId}…`);

  const totalDurationFrames = Math.ceil((durationMs / 1000) * 30);

  const { renderId, bucketName } = await renderMediaOnLambda({
    region:       awsRegion as Parameters<typeof renderMediaOnLambda>[0]["region"],
    functionName: functionName!,
    serveUrl,
    composition:  "LyricVideo",
    inputProps: {
      lyrics,
      audioUrl:        trackUrl,
      trackTitle,
      artistName,
      backgroundUrl,
      backgroundType,
      accentColor,
      textStyle,
      fontChoice,
      textPosition,
      aspectRatio,
      durationMs,
    },
    codec:       "h264",
    imageFormat: "jpeg",
    maxRetries:  2,
    privacy:     "public",
    outName:     `lyric-video-${jobId}.mp4`,
  });

  console.log(`[lyric-video/phase2] render dispatched — renderId: ${renderId}, bucket: ${bucketName}`);

  // ── Step 11c: Poll for completion (max 30 min) ────────────────────────────
  const MAX_RENDER_MS  = 30 * 60 * 1_000;
  const POLL_INTERVAL  = 10_000; // 10 s
  const renderStart    = Date.now();

  let finalVideoUrl: string | null = null;

  while (Date.now() - renderStart < MAX_RENDER_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName: functionName!,
      region:       awsRegion as Parameters<typeof getRenderProgress>[0]["region"],
    });

    const pct = Math.round((progress.overallProgress ?? 0) * 100);
    console.log(`[lyric-video/phase2] render ${renderId}: ${pct}%`);

    if (progress.fatalErrorEncountered) {
      const errMsg = progress.errors?.[0]?.message ?? "Unknown Remotion render error";
      throw new Error(`Remotion render failed: ${errMsg}`);
    }

    if (progress.done) {
      finalVideoUrl = progress.outputFile ?? null;
      break;
    }
  }

  if (!finalVideoUrl) {
    throw new Error("Remotion render timed out after 30 minutes");
  }

  console.log(`[lyric-video/phase2] render complete — output: ${finalVideoUrl}`);

  // ── Mark job COMPLETE ─────────────────────────────────────────────────────
  const transcriptionCost = Number(savedOutput.transcriptionCostToUs ?? 0);
  // Remotion Lambda cost is primarily AWS Lambda + S3 — estimate based on duration
  // ~$0.0000166667/GB-second; 2GB RAM × (durationFrames/30) seconds ≈ rough estimate
  const renderSecs        = totalDurationFrames / 30;
  const remotionCostEst   = renderSecs * 2 * 0.0000166667;
  const totalCostToUs     = transcriptionCost + claudeCostToUs + remotionCostEst;

  await db.aIJob.update({
    where: { id: jobId },
    data: {
      status: AIJobStatus.COMPLETE,
      outputData: {
        ...savedOutput,
        finalVideoUrl,
        renderId,
        bucketName,
        renderCompletedAt: new Date().toISOString(),
        remotionCostEst,
        totalCostToUs,
      } as Prisma.InputJsonValue,
      costToUs:    totalCostToUs,
      completedAt: new Date(),
    },
  });

  console.log(
    `[lyric-video/phase2] job ${jobId} COMPLETE — ` +
    `video: ${finalVideoUrl}, total cost $${totalCostToUs.toFixed(4)}`,
  );

  // Branded completion email (non-fatal)
  if (job.artistId) {
    const lyricArtistId = job.artistId;
    void (async () => {
      try {
        const artist = await db.user.findUnique({
          where:  { id: lyricArtistId },
          select: { email: true, name: true, artistName: true, artistSlug: true },
        });
      if (!artist?.email) return;
      await sendLyricVideoCompleteEmail({
        artistEmail: artist.email,
        artistName:  artist.artistName ?? artist.name ?? "Artist",
        artistSlug:  artist.artistSlug !== null ? artist.artistSlug : undefined,
        trackTitle:  "your track",
        videoUrl:    finalVideoUrl,
      });
    } catch (emailErr) {
      console.error(`[lyric-video/phase2] completion email failed for job ${jobId}:`, emailErr);
    }
    })();
  }
}
