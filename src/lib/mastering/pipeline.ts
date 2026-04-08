/**
 * pipeline.ts — Full orchestration from upload to complete
 *
 * Handles both MIX_AND_MASTER and MASTER_ONLY flows.
 * All status updates write directly to the MasteringJob record.
 * Designed to run as a background job (called from an API route, not blocking).
 */

import { db as prisma } from "@/lib/db";
import {
  analyzeAudio,
  separateStems,
  classifyStems,
  mixStems,
  masterAudio,
  generatePreview,
  getVersionTargets as _getVersionTargets,
  PLATFORM_TARGETS,
} from "./engine";
import {
  decideMixParameters,
  decideMasterParameters,
  detectGenre,
  getVersionTargets,
} from "./decisions";
import { validateUpload } from "@/lib/upload/validateUpload";
import { sendMasteringCompleteEmail } from "@/lib/email/mastering";

// ─── Status helpers ────────────────────────────────────────────────────────────

async function setStatus(jobId: string, status: string, extra?: Record<string, unknown>) {
  await prisma.masteringJob.update({
    where: { id: jobId },
    data:  { status, ...extra },
  });
}

// ─── Upload validation ─────────────────────────────────────────────────────────

export interface UploadedFile {
  url:          string;
  filename:     string;
  mimeType:     string;
  sizeBytes:    number;
}

const ALLOWED_AUDIO_TYPES = [
  "audio/wav",
  "audio/x-wav",
  "audio/aiff",
  "audio/x-aiff",
  "audio/flac",
  "audio/mpeg",
  "audio/mp3",
];

export async function validateMasteringUpload(file: UploadedFile): Promise<void> {
  await validateUpload(file, {
    maxSizeMB:    500,
    allowedTypes: ALLOWED_AUDIO_TYPES,
    label:        "audio file",
  });
}

// ─── Mix & Master pipeline ─────────────────────────────────────────────────────

export async function runMixAndMasterPipeline(jobId: string): Promise<void> {
  const job = await prisma.masteringJob.findUniqueOrThrow({ where: { id: jobId } });

  try {
    // ── 1. Analyze + classify stems ──────────────────────────────────────────
    await setStatus(jobId, "ANALYZING");

    const stems = job.stems as { url: string; filename: string }[];
    const stemUrls = stems.map((s) => s.url);

    const [classifiedStems, firstStemAnalysis] = await Promise.all([
      classifyStems(stemUrls),
      analyzeAudio(stemUrls[0]),
    ]);

    // Detect genre if not set
    let genre = job.genre ?? await detectGenre(firstStemAnalysis);

    const analysisData = {
      bpm:     firstStemAnalysis.bpm,
      key:     firstStemAnalysis.key,
      sections: firstStemAnalysis.sections,
      stems:   classifiedStems.map((s) => ({
        url:          s.url,
        detectedType: s.detectedType,
        confidence:   s.confidence,
        analysis:     s.analysis,
      })),
    };

    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  {
        genre,
        analysisData,
      },
    });

    // ── 2. Claude decides mix parameters ──────────────────────────────────────
    await setStatus(jobId, "MIXING");

    const mood          = job.mood ?? "CLEAN";
    const nlPrompt      = (job.mixParameters as { naturalLanguagePrompt?: string } | null)
                            ?.naturalLanguagePrompt ?? null;
    const referenceUrl  = job.referenceTrackUrl ?? null;
    const presetName    = getPresetNameForGenre(genre);

    const mixDecision = await decideMixParameters({
      stems:                 classifiedStems,
      analysis:              firstStemAnalysis,
      genre,
      mood,
      naturalLanguagePrompt: nlPrompt,
      referenceUrl,
      presetName,
    });

    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  {
        mixParameters: {
          chains:    mixDecision.chains,
          reasoning: mixDecision.reasoning,
          naturalLanguagePrompt: nlPrompt,
        },
      },
    });

    // ── 3. Mix stems → stereo ─────────────────────────────────────────────────
    const mixResult = await mixStems({
      stems:        mixDecision.chains,
      sections:     firstStemAnalysis.sections,
      bpm:          firstStemAnalysis.bpm,
      referenceUrl: referenceUrl ?? undefined,
    });

    // ── 4. Analyze the mixdown ─────────────────────────────────────────────────
    const mixAnalysis = await analyzeAudio(mixResult.mixdownUrl);

    // ── 5. Claude decides mastering parameters ─────────────────────────────────
    await setStatus(jobId, "MASTERING");

    const masterDecision = await decideMasterParameters({
      analysis:              mixAnalysis,
      genre,
      mood,
      naturalLanguagePrompt: nlPrompt,
      presetName,
    });

    const versionTargets = getVersionTargets(genre);
    const platforms      = (job.platforms as string[] | null) ?? ["spotify", "apple_music", "youtube", "wav_master"];

    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  {
        masterParameters: {
          ...masterDecision.params,
          reasoning: masterDecision.reasoning,
        },
      },
    });

    // ── 6. Master → 4 versions + platform exports ──────────────────────────────
    const masterResult = await masterAudio({
      audioUrl:             mixResult.mixdownUrl,
      ...masterDecision.params,
      versions:             versionTargets,
      referenceUrl:         referenceUrl ?? undefined,
      platforms,
    });

    // ── 7. Generate free 30-second preview (always, even for guests) ───────────
    const preview = await generatePreview(
      {
        audioUrl:   mixResult.mixdownUrl,
        ...masterDecision.params,
        versions:   versionTargets,
        platforms:  [],
      },
      "master"
    );

    // ── 8. Persist results ─────────────────────────────────────────────────────
    await setStatus(jobId, "COMPLETE", {
      versions:         masterResult.versions,
      exports:          masterResult.exports,
      reportData:       masterResult.report,
      previewUrl:       preview.previewUrl,
      previewExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h
    });

    // ── 9. Send completion email ───────────────────────────────────────────────
    await sendCompletionEmail(jobId);

    // ── 10. Start conversion agent for guests ──────────────────────────────────
    if (!job.userId && job.guestEmail) {
      await prisma.masteringJob.update({
        where: { id: jobId },
        data:  {
          conversionStep:   1,
          conversionNextAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(jobId, "FAILED");
    console.error(`MasteringJob ${jobId} failed:`, message);
    throw err;
  }
}

// ─── Master Only pipeline ──────────────────────────────────────────────────────

export async function runMasterOnlyPipeline(jobId: string): Promise<void> {
  const job = await prisma.masteringJob.findUniqueOrThrow({ where: { id: jobId } });

  try {
    // ── 1. Analyze the stereo mix ──────────────────────────────────────────────
    await setStatus(jobId, "ANALYZING");

    const stereoUrl = job.inputFileUrl!;
    const analysis  = await analyzeAudio(stereoUrl);
    let genre       = job.genre ?? await detectGenre(analysis);

    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { genre, analysisData: analysis as unknown as Record<string, unknown> },
    });

    // ── 2. Separate stems (for per-stem mastering adjustments) ────────────────
    await setStatus(jobId, "SEPARATING");

    const separated = await separateStems(stereoUrl);
    const stemUrls  = [separated.vocals, separated.bass, separated.drums, separated.other];

    // ── 3. Classify separated stems ───────────────────────────────────────────
    const classifiedStems = await classifyStems(stemUrls);

    // ── 4. Claude decides per-stem mastering adjustments ─────────────────────
    await setStatus(jobId, "MIXING");

    const mood        = job.mood ?? "CLEAN";
    const nlPrompt    = null; // no NL prompt in Master Only mode at this stage
    const presetName  = getPresetNameForGenre(genre);

    const mixDecision = await decideMixParameters({
      stems:                 classifiedStems,
      analysis,
      genre,
      mood,
      naturalLanguagePrompt: nlPrompt,
      referenceUrl:          job.referenceTrackUrl ?? null,
      presetName,
    });

    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { mixParameters: { chains: mixDecision.chains, reasoning: mixDecision.reasoning } },
    });

    // ── 5. Reprocess stems and recombine ──────────────────────────────────────
    const mixResult = await mixStems({
      stems:        mixDecision.chains,
      sections:     analysis.sections,
      bpm:          analysis.bpm,
      referenceUrl: job.referenceTrackUrl ?? undefined,
    });

    // ── 6. Analyze recombined mix ─────────────────────────────────────────────
    const mixAnalysis = await analyzeAudio(mixResult.mixdownUrl);

    // ── 7. Claude decides mastering chain ─────────────────────────────────────
    await setStatus(jobId, "MASTERING");

    const masterDecision = await decideMasterParameters({
      analysis:              mixAnalysis,
      genre,
      mood,
      naturalLanguagePrompt: nlPrompt,
      presetName,
    });

    const versionTargets = getVersionTargets(genre);
    const platforms      = (job.platforms as string[] | null) ?? ["spotify", "apple_music", "youtube", "wav_master"];

    await prisma.masteringJob.update({
      where: { id: jobId },
      data:  { masterParameters: { ...masterDecision.params, reasoning: masterDecision.reasoning } },
    });

    // ── 8. Master → 4 versions + platform exports ─────────────────────────────
    const masterResult = await masterAudio({
      audioUrl:    mixResult.mixdownUrl,
      ...masterDecision.params,
      versions:    versionTargets,
      referenceUrl: job.referenceTrackUrl ?? undefined,
      platforms,
    });

    // ── 9. Generate free 30-second preview ────────────────────────────────────
    const preview = await generatePreview(
      {
        audioUrl:   mixResult.mixdownUrl,
        ...masterDecision.params,
        versions:   versionTargets,
        platforms:  [],
      },
      "master"
    );

    // ── 10. Persist results ────────────────────────────────────────────────────
    await setStatus(jobId, "COMPLETE", {
      versions:         masterResult.versions,
      exports:          masterResult.exports,
      reportData:       masterResult.report,
      previewUrl:       preview.previewUrl,
      previewExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    });

    await sendCompletionEmail(jobId);

    if (!job.userId && job.guestEmail) {
      await prisma.masteringJob.update({
        where: { id: jobId },
        data:  {
          conversionStep:   1,
          conversionNextAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(jobId, "FAILED");
    console.error(`MasteringJob ${jobId} (MasterOnly) failed:`, message);
    throw err;
  }
}

// ─── Revision pipeline (Pro tier) ─────────────────────────────────────────────

export async function runRevisionPipeline(jobId: string, revisionNote: string): Promise<void> {
  const job = await prisma.masteringJob.findUniqueOrThrow({ where: { id: jobId } });

  if (job.revisionUsed) throw new Error("Revision already used for this job.");
  if (job.tier !== "PRO")  throw new Error("Revisions are only available on the Pro tier.");

  await prisma.masteringJob.update({
    where: { id: jobId },
    data:  { revisionNote, revisionUsed: true, status: "MIXING" },
  });

  // Re-run with the revision note injected as the NL prompt
  if (job.mode === "MIX_AND_MASTER") {
    await runMixAndMasterPipeline(jobId);
  } else {
    await runMasterOnlyPipeline(jobId);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPresetNameForGenre(genre: string): string {
  const map: Record<string, string> = {
    HIP_HOP:    "Hip-Hop Clean",
    POP:        "Bright Pop",
    RNB:        "R&B Smooth",
    ELECTRONIC: "Electronic / EDM",
    INDIE:      "Lo-Fi Chill",
    ACOUSTIC:   "Lo-Fi Chill",
    JAZZ:       "R&B Smooth",
    ROCK:       "Hip-Hop Clean",
  };
  return map[genre.toUpperCase()] ?? "Bright Pop";
}

async function sendCompletionEmail(jobId: string): Promise<void> {
  try {
    const job = await prisma.masteringJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    const email = job.guestEmail ?? (
      job.userId
        ? (await prisma.user.findUnique({ where: { id: job.userId }, select: { email: true } }))?.email
        : null
    );
    const name = job.guestName ?? (
      job.userId
        ? (await prisma.user.findUnique({ where: { id: job.userId }, select: { name: true } }))?.name
        : "Artist"
    );

    if (!email) return;
    await sendMasteringCompleteEmail({ email, name: name ?? "Artist", jobId });
  } catch (err) {
    // Non-fatal — don't fail the pipeline over email
    console.error("Failed to send mastering complete email:", err);
  }
}
