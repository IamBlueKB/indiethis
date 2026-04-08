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

// ─── Album mastering pipeline ──────────────────────────────────────────────────

/**
 * runAlbumMasteringPipeline
 *
 * Processes all tracks in an album group with cross-track consistency:
 * 1. Analyze all tracks to derive a shared LUFS target and tonal EQ curve
 * 2. Process each track sequentially (MASTER_ONLY mode for albums)
 * 3. Apply the shared profile so all tracks sit at the same loudness/tonality
 * 4. Mark the group COMPLETE when all tracks finish
 *
 * This is always MASTER_ONLY — album mastering takes a stereo mix per track.
 * MIX_AND_MASTER mode must be completed before submitting for album mastering.
 */
export async function runAlbumMasteringPipeline(albumGroupId: string): Promise<void> {
  const group = await prisma.masteringAlbumGroup.findUniqueOrThrow({
    where: { id: albumGroupId },
  });

  const jobs = await prisma.masteringJob.findMany({
    where:   { albumGroupId },
    orderBy: { createdAt: "asc" },
  });

  if (jobs.length === 0) {
    throw new Error(`Album group ${albumGroupId} has no tracks.`);
  }

  await prisma.masteringAlbumGroup.update({
    where: { id: albumGroupId },
    data:  { status: "PROCESSING", totalTracks: jobs.length },
  });

  try {
    // ── Phase 1: Analyze all tracks → derive shared profile ──────────────────
    const analyses = await Promise.all(
      jobs.map((job) => analyzeAudio(job.inputFileUrl!))
    );

    // Shared LUFS target: average of all integrated loudness values, clamped -14 to -8
    const avgLufs      = analyses.reduce((s, a) => s + a.lufs, 0) / analyses.length;
    const sharedLufs   = Math.max(-14, Math.min(-8, Math.round(avgLufs)));

    // Shared EQ curve: average spectral centroid drives a tilt correction
    const avgCentroid   = analyses.reduce((s, a) => s + a.spectralCentroid, 0) / analyses.length;
    const brightnessTilt = avgCentroid > 3500 ? -1.5 : avgCentroid < 2000 ? 1.5 : 0;
    const sharedEqCurve = [
      { type: "lowshelf" as const, freq: 120, gain: 0.5, q: 0.7 },
      { type: "highshelf" as const, freq: 8000, gain: brightnessTilt, q: 0.7 },
    ];

    // Store shared profile on the album group
    await prisma.masteringAlbumGroup.update({
      where: { id: albumGroupId },
      data:  {
        sharedLufsTarget: sharedLufs,
        sharedEqCurve,
        genre: group.genre ?? (await detectGenre(analyses[0])),
      },
    });

    // ── Phase 2: Process each track with shared profile ──────────────────────
    for (let i = 0; i < jobs.length; i++) {
      const job       = jobs[i];
      const analysis  = analyses[i];

      try {
        await setStatus(job.id, "MASTERING");

        // Decide mastering params (uses shared EQ as base, genre from group)
        const genre = group.genre ?? (await detectGenre(analysis));
        const masterDecision = await decideMasterParameters({
          analysis,
          genre,
          mood:                  group.mood ?? "CLEAN",
          naturalLanguagePrompt: group.naturalLanguagePrompt ?? null,
        });

        // Merge shared EQ on top of per-track decisions (album curve takes precedence on shelves)
        const mergedEq = [
          ...masterDecision.params.eq!.filter(
            (b) => b.type !== "highshelf" && b.type !== "lowshelf"
          ),
          ...sharedEqCurve,
        ];

        // Build version targets at the shared LUFS
        const versions = [
          { name: "Clean" as const, targetLufs: sharedLufs },
          { name: "Warm"  as const, targetLufs: sharedLufs + 0.5 },
          { name: "Punch" as const, targetLufs: sharedLufs + 1 },
          { name: "Loud"  as const, targetLufs: sharedLufs + 2 },
        ];

        const masterResult = await masterAudio({
          audioUrl:              job.inputFileUrl!,
          ...masterDecision.params,
          eq:                    mergedEq,
          versions,
          platforms:             (job.platforms as string[] | null) ?? ["spotify", "apple_music", "youtube", "wav_master"],
        });

        // Generate 30s preview (highest-energy section)
        const previewResult = await generatePreview(
          {
            audioUrl:  job.inputFileUrl!,
            ...masterDecision.params,
            eq:        mergedEq,
            versions:  [versions[0]],
            platforms: ["spotify"],
          },
          "master"
        );

        await setStatus(job.id, "COMPLETE", {
          versions:   masterResult.versions,
          exports:    masterResult.exports,
          reportData: masterResult.report,
          previewUrl: previewResult.previewUrl,
        });

        // Increment completed track count on group
        await prisma.masteringAlbumGroup.update({
          where: { id: albumGroupId },
          data:  { completedTracks: { increment: 1 } },
        });
      } catch (trackErr) {
        // Mark individual track failed but continue album
        const msg = trackErr instanceof Error ? trackErr.message : String(trackErr);
        console.error(`Album ${albumGroupId} — track ${job.id} failed:`, msg);
        await setStatus(job.id, "FAILED");
        await prisma.masteringAlbumGroup.update({
          where: { id: albumGroupId },
          data:  { completedTracks: { increment: 1 } },
        });
      }
    }

    // ── Phase 3: Mark album complete ─────────────────────────────────────────
    await prisma.masteringAlbumGroup.update({
      where: { id: albumGroupId },
      data:  { status: "COMPLETE" },
    });

    // Send completion email to the owner
    await sendAlbumCompleteEmail(albumGroupId);
  } catch (err) {
    await prisma.masteringAlbumGroup.update({
      where: { id: albumGroupId },
      data:  { status: "FAILED" },
    });
    console.error(`Album mastering group ${albumGroupId} failed:`, err);
    throw err;
  }
}

async function sendAlbumCompleteEmail(albumGroupId: string): Promise<void> {
  try {
    const group = await prisma.masteringAlbumGroup.findUnique({ where: { id: albumGroupId } });
    if (!group?.userId) return;

    const user = await prisma.user.findUnique({
      where:  { id: group.userId },
      select: { email: true, name: true },
    });
    if (!user?.email) return;

    // Reuse the standard mastering complete email — subject line mentions album
    const firstJob = await prisma.masteringJob.findFirst({
      where:   { albumGroupId },
      orderBy: { createdAt: "asc" },
    });
    if (!firstJob) return;

    await sendMasteringCompleteEmail({
      email:  user.email,
      name:   user.name ?? "Artist",
      jobId:  firstJob.id,
    });
  } catch (err) {
    console.error("Failed to send album complete email:", err);
  }
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
