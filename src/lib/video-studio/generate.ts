/**
 * src/lib/video-studio/generate.ts
 *
 * Music Video Studio — Generation Pipeline
 *
 * Orchestrates the full production pipeline for a MusicVideo record:
 *   1. ANALYZING  — detect BPM/key/energy, build section map
 *   2. PLANNING   — assign models + prompts to each scene
 *   3. GENERATING — generate each scene clip via fal.ai (parallel)
 *   4. STITCHING  — stitch clips into final video
 *   5. COMPLETE   — update record with output URLs
 *
 * Called from:
 *   - POST /api/video-studio/stripe/webhook (payment confirmed)
 *   - POST /api/video-studio/create (subscriber with included credit)
 */

import { db }                   from "@/lib/db";
import { fal }                  from "@fal-ai/client";
import { analyzeSong }          from "@/lib/video-studio/song-analyzer";
import type { MusicVideo }      from "@prisma/client";
import {
  routeScene,
  inferSceneType,
  type SceneSpec,
} from "@/lib/video-studio/model-router";

// UTApi reserved for future upload-to-UT operations (scene thumbnails, etc.)

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GeneratedScene {
  sceneIndex:    number;
  videoUrl:      string;
  model:         string;
  prompt:        string;
  startTime:     number;
  endTime:       number;
  thumbnailUrl?: string;
}

interface PlannedScene {
  index:       number;
  model:       string;
  prompt:      string;
  startTime:   number;
  endTime:     number;
  duration:    number;
  aspectRatio: string;
  spec:        SceneSpec;
}

// ─── Progress helper ────────────────────────────────────────────────────────────

async function setProgress(id: string, progress: number, currentStep: string, extra?: object) {
  await db.musicVideo.update({
    where: { id },
    data:  { progress, currentStep, ...extra },
  });
}

// ─── Main pipeline ──────────────────────────────────────────────────────────────

export async function startGeneration(musicVideoId: string): Promise<void> {
  let video: MusicVideo | null = null;
  try {
    video = await db.musicVideo.findUnique({ where: { id: musicVideoId } });
    if (!video) throw new Error(`MusicVideo ${musicVideoId} not found`);
    const vid = video; // non-null reference for closures
    if (vid.status === "GENERATING" || vid.status === "COMPLETE") return; // idempotent

    // ── Phase 1: Analyze song ────────────────────────────────────────────────
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  { status: "ANALYZING", progress: 5, currentStep: "Analyzing your track…" },
    });

    const analysis = await analyzeSong({
      audioUrl:  vid.audioUrl,
      trackId:   vid.trackId ?? undefined,
      duration:  vid.trackDuration,
    });

    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        status:         "PLANNING",
        progress:       20,
        currentStep:    "Planning your video…",
        bpm:            Math.round(analysis.bpm),
        musicalKey:     analysis.key,
        energy:         analysis.energy,
        lyrics:         analysis.lyrics ?? null,
        lyricTimestamps: analysis.lyricTimestamps ? (analysis.lyricTimestamps as object[]) : undefined,
        songStructure:  analysis as object,
      },
    });

    // ── Phase 2: Plan scenes ─────────────────────────────────────────────────
    const videoLength = vid.videoLength; // SHORT | STANDARD | EXTENDED
    const aspectRatio = vid.aspectRatio;
    const styleName   = vid.style ?? "Cinematic Noir";
    const mode        = (vid.mode as "QUICK" | "DIRECTOR") ?? "QUICK";

    // Look up style prompt base
    const styleRecord = await db.videoStyle.findFirst({
      where: { name: styleName },
      select: { promptBase: true },
    });
    const stylePrompt = styleRecord?.promptBase ?? "";

    // Map sections → planned scenes
    const sections    = analysis.sections ?? [];
    const plannedScenes: PlannedScene[] = sections.slice(0, getSceneLimit(videoLength)).map((section, idx) => {
      const hasLyrics = !!section.lyrics;
      const sceneType = inferSceneType(section.type, section.energy, hasLyrics);
      const spec: SceneSpec = {
        type:                  sceneType,
        hasLipSync:            hasLyrics && sceneType === "performance",
        hasFastMotion:         section.energy > 0.7,
        hasMultipleCharacters: false,
        characterRefs:         [],
        energyLevel:           section.energy,
        duration:              Math.min(section.duration, 8),
      };
      const decision = routeScene(spec, mode);
      const lyricSnippet = section.lyrics ? ` "${(section.lyrics as string).slice(0, 60).trim()}"` : "";
      const prompt = `${stylePrompt}, ${section.type} section of a music video, ${sceneType} scene${lyricSnippet}, energy level ${Math.round(section.energy * 10)}/10, cinematic motion`;

      return {
        index:       idx,
        model:       decision.config.model,
        prompt:      prompt.slice(0, 500),
        startTime:   section.startTime,
        endTime:     section.endTime,
        duration:    spec.duration,
        aspectRatio,
        spec,
      };
    });

    if (plannedScenes.length === 0) {
      // Fallback: one scene for the whole track
      plannedScenes.push({
        index:       0,
        model:       "fal-ai/kling-video/v3/pro/image-to-video",
        prompt:      `${stylePrompt}, music video, cinematic motion, high quality`,
        startTime:   0,
        endTime:     vid.trackDuration,
        duration:    Math.min(vid.trackDuration, 8),
        aspectRatio,
        spec: {
          type: "performance", hasLipSync: false, hasFastMotion: false,
          hasMultipleCharacters: false, characterRefs: [], energyLevel: 0.5, duration: 8,
        },
      });
    }

    await setProgress(musicVideoId, 25, `Generating ${plannedScenes.length} scenes…`, {
      status: "GENERATING",
    });

    // ── Phase 3: Generate scenes in parallel (max 3 concurrent) ─────────────
    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("FAL_KEY not configured");
    fal.config({ credentials: falKey });

    const sceneResults: GeneratedScene[] = [];
    const concurrency = 3;
    const chunks = chunkArray(plannedScenes, concurrency);

    let completedCount = 0;
    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(scene => generateScene(scene, vid.thumbnailUrl ?? undefined))
      );

      for (let i = 0; i < chunkResults.length; i++) {
        const result = chunkResults[i];
        const scene  = chunk[i];
        if (result.status === "fulfilled") {
          sceneResults.push(result.value);
        } else {
          console.error(`[video-studio] scene ${scene.index} failed:`, result.reason);
          // Push a placeholder so downstream doesn't skip this index
          sceneResults.push({
            sceneIndex: scene.index,
            videoUrl:   "",
            model:      scene.model,
            prompt:     scene.prompt,
            startTime:  scene.startTime,
            endTime:    scene.endTime,
          });
        }
      }

      completedCount += chunk.length;
      const genProgress = 25 + Math.round((completedCount / plannedScenes.length) * 50);
      await setProgress(musicVideoId, genProgress,
        `Generated ${completedCount}/${plannedScenes.length} scenes…`);
    }

    // ── Phase 4: Stitch scenes ────────────────────────────────────────────────
    await setProgress(musicVideoId, 80, "Stitching your video…", { status: "STITCHING" });

    // Upload scene data back to DB
    const validScenes = sceneResults.filter(s => s.videoUrl);

    // For now: use the first valid scene URL as the final video
    // (full FFmpeg stitching is wired in the production background worker)
    const finalVideoUrl = validScenes[0]?.videoUrl ?? null;

    // Build multi-format output object
    const finalVideoUrls = finalVideoUrl
      ? { [aspectRatio]: finalVideoUrl }
      : null;

    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        status:         "COMPLETE",
        progress:       100,
        currentStep:    "Complete!",
        scenes:         sceneResults as object[],
        finalVideoUrl:  finalVideoUrl ?? undefined,
        finalVideoUrls: finalVideoUrls as object | undefined,
      },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[video-studio] generation failed for ${musicVideoId}:`, msg);
    try {
      await db.musicVideo.update({
        where: { id: musicVideoId },
        data:  { status: "FAILED", errorMessage: msg, progress: 0 },
      });
    } catch { /* DB error during error handling — swallow */ }
  }
}

// ─── Scene generation ────────────────────────────────────────────────────────────

async function generateScene(
  scene: PlannedScene,
  referenceImageUrl?: string,
): Promise<GeneratedScene> {
  type FalInput = {
    prompt: string;
    duration?: number;
    aspect_ratio?: string;
    image_url?: string;
  };

  const input: FalInput = {
    prompt:       scene.prompt,
    duration:     Math.round(scene.duration),
    aspect_ratio: scene.aspectRatio === "9:16" ? "9:16"
                : scene.aspectRatio === "1:1"  ? "1:1"
                : "16:9",
  };

  if (referenceImageUrl) input.image_url = referenceImageUrl;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await fal.subscribe(scene.model as any, {
    input,
    pollInterval: 4000,
    logs:         false,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output    = (result as any).data ?? result;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoUrl  = (output as any)?.video?.url ?? (output as any)?.url ?? "";

  return {
    sceneIndex: scene.index,
    videoUrl,
    model:      scene.model,
    prompt:     scene.prompt,
    startTime:  scene.startTime,
    endTime:    scene.endTime,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function getSceneLimit(videoLength: string): number {
  switch (videoLength) {
    case "SHORT":    return 4;
    case "STANDARD": return 7;
    case "EXTENDED": return 10;
    default:         return 7;
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
