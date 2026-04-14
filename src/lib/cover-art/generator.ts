/**
 * src/lib/cover-art/generator.ts
 *
 * Core generation logic for the Cover Art Studio.
 *
 * Three tiers:
 *   STANDARD — 4 variations via Seedream V4; credit or $4.99 PPU
 *   PREMIUM  — 8 variations via high-quality model; $7.99 PPU;
 *              optional reference image influence (strength 0.4)
 *   PRO      — 8 initial + 2 refinement rounds via FLUX Kontext; $12.99 PPU
 *
 * All outputs are 1024×1024 (square locked, 1:1).
 * Variations generated in parallel — total wait equals one generation, not N×.
 *
 * No model names are ever exposed to the artist in the UI.
 */

import { fal }         from "@fal-ai/client";
import { db }          from "@/lib/db";
import { UTApi }       from "uploadthing/server";
import { embedIndieThisMetadata } from "@/lib/image-metadata";
import { autoLinkToRelease }      from "@/lib/release-board/auto-link";
import {
  enhanceCoverArtPrompt,
  refinePrompt,
  deriveMood,
  type PromptEnhanceInput,
} from "./prompt-enhancer";

const utapi = new UTApi();

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = "STANDARD" | "PREMIUM" | "PRO";

interface CoverArtGenerateInput {
  jobId:             string;
  tier:              Tier;
  prompt:            string;
  stylePromptBase:   string;
  referenceImageUrl?: string | null;
  // Track context for Claude enhancement
  genre:             string | null;
  mood:              string | null;
  bpm:               number | null;
  energy:            number | null;
  trackTitle:        string;
  artistName:        string;
  // Essentia ML data — preferred over math-based genre/mood
  essentiaGenres:    { label: string; score: number }[] | null;
  essentiaMoods:     { label: string; score: number }[] | null;
  essentiaTimbre:    string | null;
}

interface RefinementInput {
  jobId:                string;
  selectedImageUrl:     string;
  refinementInstruction: string;
  currentPrompt:        string;   // the last used prompt
  round:                number;   // 1 or 2
}

// ─── FAL model routing ────────────────────────────────────────────────────────

const MODEL_STANDARD = "fal-ai/seedream-v4";
const MODEL_PREMIUM  = "fal-ai/seedream-v4";   // same high-quality model, more variations
const MODEL_REFINE   = "fal-ai/flux-kontext/pro";

function variationCount(tier: Tier): number {
  return tier === "STANDARD" ? 4 : 8;
}

// ─── Single image generation via fal.ai ──────────────────────────────────────

async function generateOne(
  model:              string,
  prompt:             string,
  seed:               number,
  referenceImageUrl?: string | null,
): Promise<string> {
  const input: Record<string, unknown> = {
    prompt,
    image_size: { width: 1024, height: 1024 },
    num_images: 1,
    seed,
    enable_safety_checker: true,
  };

  // Reference image — Premium/Pro only; 0.4 strength = inspired by, not a copy
  if (referenceImageUrl && model === MODEL_PREMIUM) {
    input.reference_image_url = referenceImageUrl;
    input.reference_strength  = 0.4;
  }

  const result = await fal.subscribe(model, { input });
  const images = (result.data as { images?: { url: string }[] }).images;
  const url = images?.[0]?.url;
  if (!url) throw new Error(`No image returned from fal.ai model ${model}`);
  return url;
}

// ─── Upload to permanent storage (embed metadata first) ──────────────────────

async function uploadToStorage(falUrl: string, filename: string): Promise<string> {
  try {
    const buffer = await embedIndieThisMetadata(falUrl);
    const file   = new File([new Uint8Array(buffer)], filename, { type: "image/png" });
    const res    = await utapi.uploadFiles(file);
    return res.data?.ufsUrl ?? res.data?.url ?? falUrl;
  } catch {
    // Fall back to fal.ai URL — still usable, just not permanently stored
    return falUrl;
  }
}

// ─── Main: generate all variations in parallel ────────────────────────────────

export async function generateCoverArtJob(input: CoverArtGenerateInput): Promise<void> {
  const { jobId, tier, referenceImageUrl } = input;

  try {
    // Mark as generating
    await db.coverArtJob.update({ where: { id: jobId }, data: { status: "GENERATING" } });

    fal.config({ credentials: process.env.FAL_KEY });

    // ── Enhance prompt via Claude ────────────────────────────────────────────
    const enhanceInput: PromptEnhanceInput = {
      artistDescription: input.prompt,
      stylePromptBase:   input.stylePromptBase,
      genre:             input.genre,
      mood:              input.mood,
      bpm:               input.bpm,
      energy:            input.energy,
      trackTitle:        input.trackTitle,
      artistName:        input.artistName,
      essentiaGenres:    input.essentiaGenres,
      essentiaMoods:     input.essentiaMoods,
      essentiaTimbre:    input.essentiaTimbre,
    };

    let enhancedPrompt: string;
    try {
      enhancedPrompt = await enhanceCoverArtPrompt(enhanceInput);
    } catch (err) {
      // Fall back to simpler prompt if Claude fails
      console.warn("[cover-art] Claude enhancement failed, using fallback:", err);
      enhancedPrompt = [
        input.stylePromptBase,
        input.prompt,
        "album cover art, square format, 1:1 aspect ratio, clean space for text overlay",
      ].join(". ");
    }

    // Save enhanced prompt
    await db.coverArtJob.update({
      where: { id: jobId },
      data:  { enhancedPrompt },
    });

    // ── Generate all variations in parallel ──────────────────────────────────
    const count = variationCount(tier);
    const model = tier === "STANDARD" ? MODEL_STANDARD : MODEL_PREMIUM;

    const generatePromises = Array.from({ length: count }, (_, i) =>
      generateOne(
        model,
        enhancedPrompt,
        Math.floor(Math.random() * 1_000_000) + i,
        referenceImageUrl,
      )
    );

    const falUrls = await Promise.all(generatePromises);

    // ── Upload all to permanent storage in parallel ──────────────────────────
    const uploadPromises = falUrls.map((url, i) =>
      uploadToStorage(url, `cover-art-${jobId}-${i + 1}.png`)
    );
    const variationUrls = await Promise.all(uploadPromises);

    // Mark complete
    await db.coverArtJob.update({
      where: { id: jobId },
      data:  { status: "COMPLETE", variationUrls },
    });

    // Auto-link to Release Board if this job is tied to a track
    const job = await db.coverArtJob.findUnique({ where: { id: jobId }, select: { trackId: true } });
    if (job?.trackId) {
      autoLinkToRelease(job.trackId, "coverArt", jobId).catch(() => {});
    }

  } catch (err) {
    await db.coverArtJob.update({
      where: { id: jobId },
      data:  {
        status:       "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

// ─── Pro tier: refinement round ───────────────────────────────────────────────

export async function refineCoverArtJob(input: RefinementInput): Promise<void> {
  const { jobId, selectedImageUrl, refinementInstruction, currentPrompt, round } = input;

  try {
    await db.coverArtJob.update({ where: { id: jobId }, data: { status: "GENERATING" } });

    fal.config({ credentials: process.env.FAL_KEY });

    // ── Refine prompt via Claude ─────────────────────────────────────────────
    let refinedPrompt: string;
    try {
      refinedPrompt = await refinePrompt(currentPrompt, refinementInstruction);
    } catch {
      refinedPrompt = currentPrompt + `. ${refinementInstruction}`;
    }

    // ── Generate 4 refinement variations via FLUX Kontext (image-to-image) ───
    const refinePromises = Array.from({ length: 4 }, (_, i) =>
      fal.subscribe(MODEL_REFINE, {
        input: {
          prompt:    refinedPrompt,
          image_url: selectedImageUrl,
          seed:      Math.floor(Math.random() * 1_000_000) + i,
        },
      }).then(result => {
        const images = (result.data as { images?: { url: string }[] }).images;
        const url = images?.[0]?.url;
        if (!url) throw new Error("No image from refinement");
        return url;
      })
    );

    const falUrls = await Promise.all(refinePromises);

    // ── Upload to storage ────────────────────────────────────────────────────
    const uploadPromises = falUrls.map((url, i) =>
      uploadToStorage(url, `cover-art-${jobId}-r${round}-${i + 1}.png`)
    );
    const refinementUrls = await Promise.all(uploadPromises);

    // ── Append to refinement history ─────────────────────────────────────────
    const job = await db.coverArtJob.findUnique({
      where:  { id: jobId },
      select: { refinementHistory: true },
    });

    type HistEntry = { round: number; instruction: string; prompt: string; urls: string[]; selectedUrl: string | null };
    const history: HistEntry[] = Array.isArray(job?.refinementHistory)
      ? (job.refinementHistory as HistEntry[])
      : [];

    history.push({
      round,
      instruction: refinementInstruction,
      prompt:      refinedPrompt,
      urls:        refinementUrls,
      selectedUrl: null, // artist selects after seeing variations
    });

    await db.coverArtJob.update({
      where: { id: jobId },
      data:  {
        status:           "COMPLETE",
        refinementRound:  round,
        refinementHistory: history,
      },
    });

  } catch (err) {
    await db.coverArtJob.update({
      where: { id: jobId },
      data:  {
        status:       "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

// ─── ID-only wrapper for the internal trigger endpoint ───────────────────────
// The Stripe webhook fires this by jobId only — all DB lookups happen here so
// the webhook never needs to import this heavy module at all.

export async function generateCoverArtJobById(jobId: string): Promise<void> {
  const job = await db.coverArtJob.findUnique({
    where:  { id: jobId },
    select: {
      id:               true,
      tier:             true,
      prompt:           true,
      referenceImageUrl:true,
      trackId:          true,
      style:            { select: { promptBase: true } },
      userId:           true,
    },
  });

  if (!job) throw new Error(`CoverArtJob ${jobId} not found`);

  const trackData = job.trackId
    ? await db.track.findUnique({
        where:  { id: job.trackId },
        select: {
          title:          true,
          audioFeatures:  { select: { genre: true, mood: true, energy: true } },
          essentiaGenres: true,
          essentiaMoods:  true,
          essentiaTimbre: true,
        },
      })
    : null;

  const user = job.userId
    ? await db.user.findUnique({
        where:  { id: job.userId },
        select: { name: true, artistName: true },
      })
    : null;

  await generateCoverArtJob({
    jobId:             job.id,
    tier:              job.tier as "STANDARD" | "PREMIUM" | "PRO",
    prompt:            job.prompt,
    stylePromptBase:   job.style?.promptBase ?? "",
    referenceImageUrl: job.referenceImageUrl,
    genre:             trackData?.audioFeatures?.genre   ?? null,
    mood:              trackData?.audioFeatures?.mood    ?? null,
    bpm:               null,
    energy:            trackData?.audioFeatures?.energy  ?? null,
    trackTitle:        trackData?.title ?? "Untitled",
    artistName:        user?.artistName ?? user?.name   ?? "Artist",
    essentiaGenres:    (trackData?.essentiaGenres as { label: string; score: number }[] | null) ?? null,
    essentiaMoods:     (trackData?.essentiaMoods  as { label: string; score: number }[] | null) ?? null,
    essentiaTimbre:    (trackData?.essentiaTimbre  as string | null) ?? null,
  });
}

// ─── Re-export mood helper for convenience ────────────────────────────────────
export { deriveMood };
