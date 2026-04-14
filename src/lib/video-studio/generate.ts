/**
 * src/lib/video-studio/generate.ts
 *
 * Music Video Studio — Generation Pipeline
 *
 * Orchestrates the full production pipeline for a MusicVideo record:
 *   1. ANALYZING  — detect BPM/key/energy, build section map
 *   2. PLANNING   — assign models + prompts to each scene
 *   3. GENERATING — generate each scene clip via fal.ai (parallel, max 3)
 *   4. STITCHING  — stitch clips into final video via Remotion Lambda
 *   5. COMPLETE   — update record with output URLs + send notification email
 *
 * Called from:
 *   - POST /api/video-studio/stripe/webhook (payment confirmed)
 *   - POST /api/video-studio/create (subscriber with included credit)
 *   - POST /api/video-studio/[id]/generate (manual trigger)
 */

import { db }                   from "@/lib/db";
import { fal }                  from "@fal-ai/client";
// NOTE: analyzeSong imported dynamically at call sites to prevent song-analyzer
// (and its transitive deps: essentia, node-web-audio-api, onnxruntime-web) from
// being statically bundled into routes that import generate.ts (e.g. stripe/webhook).
import type { SongAnalysis } from "@/lib/video-studio/song-analyzer";
import { claude, SONNET }       from "@/lib/claude";
import { sendMusicVideoCompleteEmail } from "@/lib/brevo/email";
import { autoLinkToRelease }    from "@/lib/release-board/auto-link";
import { sendVideoConversionEmail1 }  from "@/lib/agents/video-conversion";
import type { MusicVideo }      from "@prisma/client";
import {
  inferSceneType,
  type SceneSpec,
} from "@/lib/video-studio/model-router";
import {
  generateAllScenes,
  generateMultiShotVideo,
  generateCharacterPortrait,
  generateMultiFormatVideos,
  pickThumbnailScene,
  type PlannedSceneInput,
  type GeneratedSceneOutput,
} from "@/lib/video-studio/generator";
import { VIDEO_MODELS, DEFAULT_QUICK_MODEL, DEFAULT_DIRECTOR_MODEL } from "@/lib/video-studio/models";

// ─── Types ─────────────────────────────────────────────────────────────────────

// Re-export for backward compatibility
export type { PlannedSceneInput as PlannedScene, GeneratedSceneOutput as GeneratedScene };

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

    // Guard: never generate without confirmed payment (unless it's a free/included credit)
    if (vid.amount > 0 && !vid.stripePaymentId) {
      throw new Error(`Cannot start generation for MusicVideo ${musicVideoId}: payment not confirmed.`);
    }

    // ── Phase 1: Analyze song ────────────────────────────────────────────────
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  { status: "ANALYZING", progress: 5, currentStep: "Analyzing your track…" },
    });

    const { analyzeSong } = await import("@/lib/video-studio/song-analyzer");
    const analysis = await analyzeSong({
      audioUrl:  vid.audioUrl,
      trackId:   vid.trackId ?? undefined,
      duration:  vid.trackDuration,
    });

    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        status:          "PLANNING",
        progress:        20,
        currentStep:     "Planning your video…",
        bpm:             Math.round(analysis.bpm),
        musicalKey:      analysis.key,
        energy:          analysis.energy,
        lyrics:          analysis.lyrics ?? null,
        lyricTimestamps: analysis.lyricTimestamps ? (analysis.lyricTimestamps as object[]) : undefined,
        songStructure:   analysis as object,
      },
    });

    // ── Phase 2: Plan scenes ─────────────────────────────────────────────────
    const videoLength = vid.videoLength;
    const aspectRatio = vid.aspectRatio;
    const styleName   = vid.style ?? "Cinematic Noir";
    const mode        = (vid.mode as "QUICK" | "DIRECTOR") ?? "QUICK";

    // Look up style prompt base
    const styleRecord = await db.videoStyle.findFirst({
      where: { name: styleName },
      select: { promptBase: true },
    });
    const stylePrompt = styleRecord?.promptBase ?? "";

    // ── Director Mode: build planned scenes from shot list ──────────────────
    // In Director Mode the user built a shot list via the AI Director chat.
    // Each shot has a description, camera direction, film look, and optional
    // per-scene model override.  Use those prompts directly — do NOT fall back
    // to auto-generated section prompts, which ignore the Director's creative work.
    type ShotListItem = {
      index?:              number;
      title?:              string;
      description?:        string;
      cameraDirection?:    string;
      filmLook?:           string;
      model?:              string;
      energyLevel?:        number;
      startTime?:          number;
      endTime?:            number;
      hasLipSync?:         boolean;
      referenceImageUrl?:  string;
    };

    const directorShotList: ShotListItem[] =
      mode === "DIRECTOR" && Array.isArray(vid.shotList) && (vid.shotList as ShotListItem[]).length > 0
        ? (vid.shotList as ShotListItem[])
        : [];

    // Map sections → planned scenes
    const sections = analysis.sections ?? [];
    const sceneLimit = getSceneLimit(videoLength);

    const plannedScenes: PlannedSceneInput[] = directorShotList.length > 0
      // ── Director path: use Director shot list prompts ──────────────────────
      ? directorShotList.slice(0, sceneLimit).map((shot, idx) => {
          const energy    = shot.energyLevel ?? (sections[idx]?.energy ?? 0.5);
          const hasLyrics = shot.hasLipSync ?? false;
          const sceneType = inferSceneType("verse", energy, hasLyrics);
          const spec: SceneSpec = {
            type:                  sceneType,
            hasLipSync:            hasLyrics,
            hasFastMotion:         energy > 0.7,
            hasMultipleCharacters: false,
            characterRefs:         [],
            energyLevel:           energy,
            duration:              Math.min(
              (shot.endTime ?? 0) - (shot.startTime ?? 0) || 5,
              8,
            ),
          };

          // Build rich cinematic prompt from Director's creative notes
          const parts = [stylePrompt];
          if (shot.description) parts.push(shot.description);
          if (shot.cameraDirection) parts.push(`Camera: ${shot.cameraDirection}`);
          if (shot.filmLook) parts.push(`Film look: ${shot.filmLook}`);
          parts.push("cinematic motion, high quality music video");

          return {
            index:              idx,
            model:              VIDEO_MODELS["kling-3-pro"].id, // multi-shot t2v default
            prompt:             parts.filter(Boolean).join(", ").slice(0, 500),
            startTime:          shot.startTime ?? (sections[idx]?.startTime ?? idx * 8),
            endTime:            shot.endTime   ?? (sections[idx]?.endTime   ?? (idx + 1) * 8),
            duration:           spec.duration,
            aspectRatio,
            spec,
            referenceImageUrl:  shot.referenceImageUrl,
          };
        })
      // ── Quick / fallback path: auto-generate from song sections ────────────
      : sections.slice(0, sceneLimit).map((section, idx) => {
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
          const lyricSnippet = section.lyrics ? ` "${(section.lyrics as string).slice(0, 60).trim()}"` : "";
          const prompt = `${stylePrompt}, ${section.type} section of a music video, ${sceneType} scene${lyricSnippet}, energy level ${Math.round(section.energy * 10)}/10, cinematic motion`;

          return {
            index:       idx,
            model:       VIDEO_MODELS["kling-3-pro"].id,
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
      const defaultSpec: SceneSpec = {
        type: "performance", hasLipSync: false, hasFastMotion: false,
        hasMultipleCharacters: false, characterRefs: [], energyLevel: 0.5, duration: 8,
      };
      plannedScenes.push({
        index:       0,
        model:       VIDEO_MODELS["kling-3-pro"].id,
        prompt:      `${stylePrompt}, music video, cinematic motion, high quality`,
        startTime:   0,
        endTime:     vid.trackDuration,
        duration:    Math.min(vid.trackDuration, 8),
        aspectRatio,
        spec:        defaultSpec,
      });
    }

    await setProgress(musicVideoId, 25, `Generating ${plannedScenes.length} scenes…`, {
      status: "GENERATING",
    });

    // ── Phase 3: Resolve reference image + character portrait ────────────────
    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("FAL_KEY not configured");
    fal.config({ credentials: falKey });

    // Primary reference image: prefer the user-chosen referenceImageUrl, fall
    // back to thumbnailUrl (cover art pre-seed or legacy path).
    const primaryRefImage: string | undefined =
      vid.referenceImageUrl ?? vid.thumbnailUrl ?? undefined;

    if (!primaryRefImage) {
      throw new Error(
        "No reference image provided. Please go back and add a visual in the Image Source step.",
      );
    }

    let characterPortraitUrl: string | undefined;
    if (plannedScenes.some(s => s.spec.characterRefs.length > 0 || s.spec.hasLipSync)) {
      try {
        characterPortraitUrl = await generateCharacterPortrait(primaryRefImage, stylePrompt);
        await setProgress(musicVideoId, 27, "Character portrait generated…");
      } catch (err) {
        console.warn("[video-studio] Character portrait failed — using raw reference image:", err);
      }
    }

    // Resolved image: portrait if generated, otherwise raw reference
    const resolvedRefImage = characterPortraitUrl ?? primaryRefImage;

    // ── Phase 4a (PRODUCTION): Submit scenes via fal.queue.submit + webhook ──
    // fal.ai processes scenes externally; the webhook route handles stitching +
    // completion. startGeneration returns here — no blocking on Vercel.
    const isWebhookMode = process.env.NODE_ENV === "production";
    const appUrl        = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

    if (isWebhookMode) {
      const webhookUrl = `${appUrl}/api/video-studio/webhook/fal`;

      if (mode === "QUICK") {
        // ── Quick Mode V2: Kling 3.0 multi-shot text-to-video ────────────────
        // generateMultiShotVideo writes segment placeholders + submits to fal.queue.
        // The webhook handles assembly and stitching when all segments complete.
        const hasVocals = plannedScenes.some(s => s.spec.hasLipSync);
        await generateMultiShotVideo(
          musicVideoId,
          plannedScenes,
          resolvedRefImage,
          vid.audioUrl,
          aspectRatio,
          hasVocals,
          webhookUrl,
          DEFAULT_QUICK_MODEL,
        );
      } else {
        // ── Director Mode: multi-shot text-to-video (same engine as Quick Mode) ─
        // Uses the Director's shot list prompts.  The uploaded artist photo becomes
        // elements[0] for character consistency — NOT the source frame for animation.
        const hasVocals = plannedScenes.some(s => s.spec.hasLipSync);
        await generateMultiShotVideo(
          musicVideoId,
          plannedScenes,
          resolvedRefImage,
          vid.audioUrl,
          aspectRatio,
          hasVocals,
          webhookUrl,
          DEFAULT_DIRECTOR_MODEL,
        );

      }

      // Auto-link to Release Board (non-blocking)
      if (vid.trackId) {
        autoLinkToRelease(vid.trackId, "musicVideo", musicVideoId).catch(() => {});
      }

      console.log(
        `[video-studio] ${mode} — ${plannedScenes.length} scenes submitted for ${musicVideoId} — webhook will stitch`,
      );
      return; // Webhook takes over from here
    }

    // ── Phase 4b (DEV): Polling mode — block until all scenes complete ────────
    let sceneResults: GeneratedSceneOutput[];

    if (mode === "QUICK") {
      // Quick Mode dev: use multi-shot polling
      const hasVocals = plannedScenes.some(s => s.spec.hasLipSync);
      await generateMultiShotVideo(
        musicVideoId,
        plannedScenes,
        resolvedRefImage,
        vid.audioUrl,
        aspectRatio,
        hasVocals,
        undefined,             // no webhook → dev polling mode
        DEFAULT_QUICK_MODEL,
      );

      // Assemble sceneResults from completed FalSceneJob records
      const completedJobs = await db.falSceneJob.findMany({
        where:   { musicVideoId },
        orderBy: { sceneIndex: "asc" },
      });
      const maxShots = VIDEO_MODELS[DEFAULT_QUICK_MODEL].maxShots;
      sceneResults = completedJobs.map((job, i) => {
        const offset    = i * maxShots;
        const segScenes = plannedScenes.slice(offset, offset + maxShots);
        const startTime = segScenes[0]?.startTime ?? 0;
        const endTime   = segScenes[segScenes.length - 1]?.endTime ?? 0;
        const energy    = segScenes.reduce((s, sc) => s + sc.spec.energyLevel, 0)
                          / Math.max(segScenes.length, 1);
        return {
          sceneIndex:      job.sceneIndex,
          videoUrl:        job.videoUrl  ?? "",
          thumbnailUrl:    job.thumbnailUrl ?? null,
          model:           job.model     ?? VIDEO_MODELS[DEFAULT_QUICK_MODEL].id,
          prompt:          segScenes.map(s => s.prompt).join(" · "),
          startTime,
          endTime,
          energyLevel:     Math.round(energy * 100) / 100,
          qaApproved:      null,
          qaReason:        job.status === "FAILED" ? "Generation failed" : null,
          qaRetried:       false,
          originalPrompt:  segScenes.map(s => s.prompt).join(" · "),
          refinedPrompt:   null,
          primaryModel:    job.model ?? VIDEO_MODELS[DEFAULT_QUICK_MODEL].id,
          actualModel:     job.model ?? VIDEO_MODELS[DEFAULT_QUICK_MODEL].id,
          fallbackUsed:    false,
          fallbackAttempts: 0,
        };
      });
    } else {
      // Director Mode dev: same multi-shot path as Quick Mode
      const hasVocals = plannedScenes.some(s => s.spec.hasLipSync);
      await generateMultiShotVideo(
        musicVideoId,
        plannedScenes,
        resolvedRefImage,
        vid.audioUrl,
        aspectRatio,
        hasVocals,
        undefined,             // no webhook → dev polling mode
        DEFAULT_DIRECTOR_MODEL,
      );

      // Assemble sceneResults from completed FalSceneJob records
      const completedJobs = await db.falSceneJob.findMany({
        where:   { musicVideoId },
        orderBy: { sceneIndex: "asc" },
      });
      const maxShots = VIDEO_MODELS[DEFAULT_DIRECTOR_MODEL].maxShots;
      sceneResults = completedJobs.map((job, i) => {
        const offset    = i * maxShots;
        const segScenes = plannedScenes.slice(offset, offset + maxShots);
        const startTime = segScenes[0]?.startTime ?? 0;
        const endTime   = segScenes[segScenes.length - 1]?.endTime ?? 0;
        const energy    = segScenes.reduce((s, sc) => s + sc.spec.energyLevel, 0)
                          / Math.max(segScenes.length, 1);
        return {
          sceneIndex:      job.sceneIndex,
          videoUrl:        job.videoUrl  ?? "",
          thumbnailUrl:    job.thumbnailUrl ?? null,
          model:           job.model     ?? VIDEO_MODELS[DEFAULT_DIRECTOR_MODEL].id,
          prompt:          segScenes.map(s => s.prompt).join(" · "),
          startTime,
          endTime,
          energyLevel:     Math.round(energy * 100) / 100,
          qaApproved:      null,
          qaReason:        job.status === "FAILED" ? "Generation failed" : null,
          qaRetried:       false,
          originalPrompt:  segScenes.map(s => s.prompt).join(" · "),
          refinedPrompt:   null,
          primaryModel:    job.model ?? VIDEO_MODELS[DEFAULT_DIRECTOR_MODEL].id,
          actualModel:     job.model ?? VIDEO_MODELS[DEFAULT_DIRECTOR_MODEL].id,
          fallbackUsed:    false,
          fallbackAttempts: 0,
        };
      });
    }

    // ── Phase 5: Stitch via Remotion Lambda ───────────────────────────────────
    await setProgress(musicVideoId, 75, "Stitching your video…", { status: "STITCHING" });

    const durationMs       = Math.round(vid.trackDuration * 1000);
    // Generate primary ratio + 9:16 (TikTok/Reels) + Spotify Canvas
    const targetAspectRatios = Array.from(new Set([aspectRatio, "9:16"]));

    const finalVideoUrls = await generateMultiFormatVideos(
      musicVideoId,
      sceneResults,
      vid.audioUrl,
      targetAspectRatios,
      durationMs,
      true, // includeSpotifyCanvas
    );

    const finalVideoUrl = finalVideoUrls[aspectRatio] ?? Object.values(finalVideoUrls)[0] ?? null;

    // Thumbnail — highest-energy scene URL
    const thumbScene    = pickThumbnailScene(sceneResults);
    const thumbnailUrl  = thumbScene?.videoUrl ?? vid.thumbnailUrl ?? null;

    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        status:         "COMPLETE",
        progress:       100,
        currentStep:    "Complete!",
        scenes:         sceneResults as object[],
        finalVideoUrl:  finalVideoUrl ?? undefined,
        finalVideoUrls: (Object.keys(finalVideoUrls).length > 0 ? finalVideoUrls : null) as object | undefined,
        thumbnailUrl:   thumbnailUrl ?? undefined,
      },
    });

    // ── Auto-link to Release Board ────────────────────────────────────────────
    if (vid.trackId) {
      autoLinkToRelease(vid.trackId, "musicVideo", musicVideoId).catch(() => {});
    }

    // ── Notification email ────────────────────────────────────────────────────
    try {
      // Look up the owner's email
      const previewUrl = `${appUrl}/video-studio/${musicVideoId}/preview`;

      if (vid.userId) {
        const user = await db.user.findUnique({
          where:  { id: vid.userId },
          select: { email: true, name: true, artistSlug: true },
        });
        if (user?.email) {
          await sendMusicVideoCompleteEmail({
            toEmail:    user.email,
            toName:     user.name ?? "Artist",
            trackTitle: vid.trackTitle,
            previewUrl,
            mode:       mode,
            artistSlug: user.artistSlug ?? undefined,
          });
        }
      } else if (vid.guestEmail) {
        // Guest — send Email 1 of the conversion sequence (includes soft upsell)
        await sendVideoConversionEmail1({
          id:            musicVideoId,
          trackTitle:    vid.trackTitle,
          guestEmail:    vid.guestEmail,
          amount:        vid.amount,
          mode:          vid.mode,
          finalVideoUrl: finalVideoUrl ?? null,
          finalVideoUrls: null,
        });
        // Mark Email 1 sent so the cron picks up from Email 2
        await db.musicVideo.update({
          where: { id: musicVideoId },
          data:  {
            conversionStep:   1,
            conversionNextAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
      }
    } catch (emailErr) {
      // Email failure is non-fatal
      console.warn("[video-studio] notification email failed:", emailErr);
    }

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

// ─── Director Mode: analysis only (no generation) ────────────────────────────────

/**
 * For Director Mode, run song analysis immediately so BPM/key/energy are
 * available in the chat UI. Does NOT proceed to generate scenes.
 */
export async function startAnalysisOnly(musicVideoId: string): Promise<void> {
  try {
    const video = await db.musicVideo.findUnique({ where: { id: musicVideoId } });
    if (!video) return;

    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  { status: "ANALYZING", progress: 5, currentStep: "Analyzing your track…" },
    });

    const { analyzeSong } = await import("@/lib/video-studio/song-analyzer");
    const analysis = await analyzeSong({
      audioUrl: video.audioUrl,
      trackId:  video.trackId ?? undefined,
      duration: video.trackDuration,
    });

    console.log("[analyzeSong] songStructure saved:", JSON.stringify(analysis));

    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        status:          "PENDING",  // Back to PENDING — ready for Director chat
        progress:        0,
        currentStep:     null,
        bpm:             Math.round(analysis.bpm),
        musicalKey:      analysis.key,
        energy:          analysis.energy,
        lyrics:          analysis.lyrics ?? null,
        lyricTimestamps: analysis.lyricTimestamps ? (analysis.lyricTimestamps as object[]) : undefined,
        songStructure:   analysis as object,
      },
    });

    // Generate the Director's opening message as a specific creative proposal
    try {
      const hasCharRef = Array.isArray(video.characterRefs) && video.characterRefs.length > 0;

      // Load style promptBase so Director knows the visual language of the preset
      let stylePromptBase: string | undefined;
      if (video.style) {
        const styleRecord = await db.videoStyle.findFirst({
          where:  { name: video.style },
          select: { promptBase: true },
        }).catch(() => null);
        stylePromptBase = styleRecord?.promptBase ?? undefined;
      }

      const greeting = await generateInitialGreeting(
        video.trackTitle, analysis,
        video.style ?? undefined, undefined, hasCharRef,
        stylePromptBase, video.videoLength ?? undefined, video.aspectRatio ?? undefined,
      );
      if (greeting) {
        const greetingMsg = { role: "assistant", content: greeting, createdAt: new Date().toISOString() };
        await db.musicVideo.update({
          where: { id: musicVideoId },
          data:  { conversationLog: [greetingMsg] },
        });
      }
    } catch (err) {
      console.warn("[video-studio] initial greeting failed — Director will open fresh:", err);
    }

  } catch (err) {
    console.error(`[video-studio] analysis-only failed for ${musicVideoId}:`, err);
  }
}

// ─── Director Mode — server-side opening greeting ───────────────────────────────

/**
 * After analysis completes, generate the Director's first message: a specific
 * creative proposal based on the audio analysis. Stored in conversationLog so
 * the DirectorClient loads it directly rather than triggering a static fallback.
 */
async function generateInitialGreeting(
  trackTitle:     string,
  analysis:       SongAnalysis,
  style?:         string,
  filmLook?:      string,
  hasCharRef?:    boolean,
  stylePromptBase?: string,
  videoLength?:   string,
  aspectRatio?:   string,
): Promise<string | null> {
  // Build full audio intelligence context
  const lines: string[] = [`Track: "${trackTitle}"`];

  if (analysis.bpm)    lines.push(`BPM: ${Math.round(analysis.bpm)}`);
  if (analysis.key)    lines.push(`Key: ${analysis.key}`);
  if (analysis.energy) lines.push(`Energy: ${Math.round(analysis.energy * 10)}/10`);

  if (analysis.genres?.length)
    lines.push(`Genres: ${analysis.genres.slice(0, 5).map(g => `${g.label} (${Math.round(g.score * 100)}%)`).join(", ")}`);
  if (analysis.moods?.length)
    lines.push(`Moods: ${analysis.moods.map(m => `${m.label} (${Math.round(m.score * 100)}%)`).join(", ")}`);
  if (analysis.instruments?.length)
    lines.push(`Instruments: ${analysis.instruments.slice(0, 6).map(i => i.label).join(", ")}`);
  if (analysis.danceability != null)
    lines.push(`Danceability: ${Math.round(analysis.danceability * 100)}%`);
  if (analysis.vocalType)
    lines.push(`Vocals: ${analysis.vocalType}${analysis.voiceGender ? ` (${analysis.voiceGender})` : ""}`);
  if (analysis.isTonal != null)
    lines.push(`Tonality: ${analysis.isTonal ? "tonal" : "atonal"}`);
  if (analysis.sections?.length)
    lines.push(`Structure: ${analysis.sections.map(s => s.type).join(" → ")}`);
  if (analysis.lyrics) {
    const excerpt = analysis.lyrics.replace(/\n/g, " ").trim().slice(0, 120);
    if (excerpt) lines.push(`Lyrics excerpt: "${excerpt}…"`);
  }

  const audioContext = lines.join("\n");

  const styleContext = style
    ? [
        `Visual style selected: "${style}"${aspectRatio ? ` | Format: ${aspectRatio}` : ""}${videoLength ? ` | Length: ${videoLength}` : ""}.`,
        stylePromptBase ? `Style visual language: ${stylePromptBase}` : "",
      ].filter(Boolean).join(" ")
    : `No preset style selected. Format: ${aspectRatio ?? "16:9"} | Length: ${videoLength ?? "STANDARD"}.`;

  const charRefContext = hasCharRef
    ? `The artist uploaded a character reference photo (@Element1). You already know who is in this video — do NOT ask. Ask about location/setting instead.`
    : `No character reference was uploaded. Ask whether this is artist performance, a narrative character, or purely abstract.`;

  const systemPrompt = `You are the IndieThis Director — a world-class music video director. You've just analyzed the artist's track using audio ML classifiers and you know exactly what it sounds like. You also know the visual style they selected.

## Your Opening Message Structure
1. Acknowledge the visual style they selected and the film look preset (if any) — state it directly: "You're working in [style] with a [film look] grade."
2. Present what you hear from the track — genre, BPM, key, mood, instruments, energy, vocal type, tonality. Be specific, cite the actual numbers and labels.
3. Connect the audio data to the visual style: how does this track's energy/mood/genre inform how you'll execute that style?
4. End with the FIRST shot list question: who is in this video — artist performance, a narrative character, or purely abstract/no people?

## Rules
- NEVER say "based on the data", "I was told", "according to the analysis"
- Speak in first person about what you hear: "I'm hearing", "this track is", "the F minor key tells me"
- Be specific — cite actual BPM, key, genre names, mood percentages, instrument names from the data
- The style and film look the artist selected are NON-NEGOTIABLE starting points — work within them
- Keep it conversational but expert — no bullet lists, 4–6 sentences max
- If character reference photos were uploaded (@Element1 exists), skip asking who is in the video — you already know. Ask about location/setting instead.
- If NO character reference was uploaded, ask: is this artist performance, a narrative character, or purely abstract/no people?
- End with exactly ONE question.

## Camera vocabulary
MOVEMENTS: static locked-off, handheld, steadicam, dolly push-in/pull-out, truck, crane, whip pan, orbit
ANGLES: eye-level, low angle, high angle, Dutch angle, bird's-eye, worm's-eye
LIGHTING: Rembrandt, high-key, low-key, rim/backlight, silhouette, chiaroscuro, neon/practical, golden hour, blue hour
MODIFIERS: cinematic grain, 35mm analog warmth, anamorphic lens flares, crushed shadows, bleach bypass, neon noir`;

  try {
    const response = await claude.messages.create({
      model:      SONNET,
      max_tokens: 400,
      system:     systemPrompt,
      messages:   [
        {
          role:    "user",
          content: `${styleContext}\n\n${charRefContext}\n\nAudio intelligence:\n${audioContext}\n\nGive me your opening director's message.`,
        },
      ],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
    if (!text) return null;

    console.log(`[video-studio] Initial greeting generated for ${trackTitle} (${text.length} chars)`);
    return text;
  } catch (err) {
    console.warn("[video-studio] generateInitialGreeting Claude call failed:", err);
    return null;
  }
}

// ─── Scene regeneration (Director Mode — one free redo per video) ──────────────────

/**
 * Re-generates a single scene clip and replaces it in the scenes array,
 * then re-stitches the full video. Used by the "Review + Refine" panel
 * and the Reject & Redirect feature.
 *
 * @param redirectNote  When provided, this is a manual rejection — the note is
 *                      appended to the original scene prompt. Status check is
 *                      relaxed to allow GENERATING state (mid-generation redirects).
 */
export async function regenerateScene(
  musicVideoId: string,
  sceneIndex:   number,
  redirectNote?: string,
): Promise<void> {
  const isManualReject = !!redirectNote;

  const video = await db.musicVideo.findUnique({ where: { id: musicVideoId } });
  if (!video) throw new Error("Video not found");

  // Standard regen requires COMPLETE; manual rejection also allows GENERATING
  if (!isManualReject && video.status !== "COMPLETE") {
    throw new Error("Video is not in COMPLETE state");
  }

  const existingScenes = (video.scenes as GeneratedSceneOutput[] | null) ?? [];
  const sceneToRegen   = existingScenes.find(s => s.sceneIndex === sceneIndex);
  if (!sceneToRegen) throw new Error(`Scene ${sceneIndex} not found`);

  // Prevent double-rejection on the same scene
  if (isManualReject && sceneToRegen.manualRejected) {
    throw new Error("Scene has already been manually rejected once");
  }

  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not configured");
  fal.config({ credentials: falKey });

  // Build the prompt — append redirect note when provided
  const basePrompt   = sceneToRegen.originalPrompt || sceneToRegen.prompt;
  const regenPrompt  = redirectNote
    ? `${basePrompt}. Artist direction: ${redirectNote}`
    : sceneToRegen.prompt;

  // Re-generate just this scene
  const plannedScene: PlannedSceneInput = {
    index:       sceneIndex,
    model:       sceneToRegen.model,
    prompt:      regenPrompt,
    startTime:   sceneToRegen.startTime,
    endTime:     sceneToRegen.endTime,
    duration:    sceneToRegen.endTime - sceneToRegen.startTime,
    aspectRatio: video.aspectRatio,
    spec: {
      type:                  "performance",
      hasLipSync:            false,
      hasFastMotion:         false,
      hasMultipleCharacters: false,
      characterRefs:         [],
      energyLevel:           sceneToRegen.energyLevel ?? 0.5,
      duration:              sceneToRegen.endTime - sceneToRegen.startTime,
    },
  };

  const [regenResult] = await generateAllScenes(
    [plannedScene],
    video.referenceImageUrl ?? video.thumbnailUrl ?? undefined,
    video.audioUrl,
  );

  if (!regenResult.videoUrl) throw new Error("Scene regeneration returned no video URL");

  // Replace scene in array, preserving all tracking fields + adding manual rejection info
  const updatedScenes = existingScenes.map(s =>
    s.sceneIndex === sceneIndex
      ? {
          ...s,
          videoUrl:           regenResult.videoUrl,
          thumbnailUrl:       regenResult.thumbnailUrl,
          prompt:             regenPrompt,
          ...(isManualReject && {
            manualRejected:     true,
            manualRedirectNote: redirectNote,
          }),
        }
      : s
  );

  // Re-stitch (only for standard regens; mid-generation redirects skip stitching
  // because the main generation pipeline will stitch when all scenes complete)
  if (!isManualReject) {
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  { status: "STITCHING", progress: 80, currentStep: "Re-stitching your video…" },
    });

    const durationMs     = Math.round(video.trackDuration * 1000);
    const finalVideoUrls = await generateMultiFormatVideos(
      musicVideoId,
      updatedScenes,
      video.audioUrl,
      [video.aspectRatio],
      durationMs,
    );

    const finalVideoUrl = finalVideoUrls[video.aspectRatio] ?? Object.values(finalVideoUrls)[0] ?? null;

    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  {
        status:         "COMPLETE",
        progress:       100,
        currentStep:    "Complete!",
        scenes:         updatedScenes as object[],
        finalVideoUrl:  finalVideoUrl ?? undefined,
        finalVideoUrls: (Object.keys(finalVideoUrls).length > 0 ? finalVideoUrls : null) as object | undefined,
        sceneRegenUsed: true,
      },
    });
  } else {
    // Manual rejection: persist the updated scenes (with new clip + rejection flag)
    // without changing overall video status — let the main pipeline continue
    await db.musicVideo.update({
      where: { id: musicVideoId },
      data:  { scenes: updatedScenes as object[] },
    });
  }
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
