/**
 * src/lib/video-studio/song-analyzer.ts
 *
 * Music Video Studio — Song Analysis Engine
 *
 * Turns a raw audio file into a structured scene map:
 *   - Song sections (intro / verse / chorus / bridge / outro / drop / breakdown)
 *   - Energy levels, mood, and lyric alignment per section
 *   - Beat grid (timestamps) for cut-sync editing
 *   - Drop points where energy spikes dramatically
 *
 * Data priority order:
 *   1. Existing AudioFeatures record on the Track (already analyzed on upload)
 *   2. Existing Whisper transcription from a completed LYRIC_VIDEO AIJob
 *   3. Live audio analysis via detectAudioFeatures() (for fresh / guest uploads)
 *   4. Claude-estimated section structure from whatever data we have
 */

import { db }         from "@/lib/db";
import { claude, SONNET } from "@/lib/claude";
import { detectAudioFeatures } from "@/lib/audio-analysis";
// NOTE: analyzeUrlWithEffnet is imported dynamically below to prevent onnxruntime-node
// load failures (missing libonnxruntime.so on some envs) from crashing the entire module.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LyricWord {
  word:  string;
  start: number; // seconds
  end:   number;
}

export interface SongSection {
  type:      string;   // intro | verse | chorus | bridge | outro | drop | breakdown
  startTime: number;   // seconds
  endTime:   number;
  duration:  number;
  energy:    number;   // 0–1
  lyrics:    string | null;
  mood:      string;   // atmospheric | intense | melancholic | euphoric | aggressive | dreamy | triumphant
}

export interface SongAnalysis {
  bpm:             number;
  key:             string;
  energy:          number;
  duration:        number;  // seconds
  lyrics:          string | null;
  lyricTimestamps: LyricWord[] | null;
  sections:        SongSection[];
  beats:           number[]; // timestamps of every beat
  dropPoints:      number[]; // timestamps of energy spikes

  // EffNet-Discogs ML analysis — null if track was not yet analyzed or has no trackId
  genres:      { label: string; score: number }[] | null;
  moods:       { label: string; score: number }[] | null;
  instruments: { label: string; score: number }[] | null;
  danceability: number | null;
  vocalType:   "vocal" | "instrumental" | null;
  voiceGender: "male" | "female" | null;
  timbre:      "bright" | "dark" | null;
  isTonal:     boolean | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a uniform beat grid from BPM and duration. */
function buildBeatGrid(bpm: number, duration: number): number[] {
  const beatInterval = 60 / bpm;
  const beats: number[] = [];
  for (let t = beatInterval; t < duration; t += beatInterval) {
    beats.push(Math.round(t * 1000) / 1000);
  }
  return beats;
}

/** Slice the full lyric string down to the words in [start, end). */
function lyricsInWindow(
  words: LyricWord[],
  start: number,
  end:   number,
): string | null {
  const slice = words
    .filter(w => w.start >= start && w.end <= end)
    .map(w => w.word)
    .join(" ")
    .trim();
  return slice.length > 0 ? slice : null;
}

/** Build a text description of lyric+timestamp data for Claude's prompt. */
function formatLyricsForPrompt(
  fullText:   string | null,
  timestamps: LyricWord[] | null,
  duration:   number,
): string {
  if (!fullText && !timestamps) {
    return "No lyrics available — purely instrumental or transcription pending.";
  }
  if (timestamps && timestamps.length > 0) {
    // Provide sampled timestamps (every ~5th word) so the prompt isn't enormous
    const sampled = timestamps.filter((_, i) => i % 5 === 0);
    const lines   = sampled.map(w => `${w.start.toFixed(1)}s: "${w.word}"`).join(", ");
    return `Lyrics with timestamps (sampled): ${lines}\n\nFull text: ${fullText ?? ""}`.trim();
  }
  return `Lyrics (no timestamps): ${fullText}`;
}

// ─── Pull existing data from the DB for a known Track ─────────────────────────

interface ExistingTrackData {
  bpm:             number | null;
  key:             string | null;
  energy:          number | null;
  lyrics:          string | null;
  lyricTimestamps: LyricWord[] | null;
  // Essentia ML fields
  essentiaGenres:       { label: string; score: number }[] | null;
  essentiaMoods:        { label: string; score: number }[] | null;
  essentiaInstruments:  { label: string; score: number }[] | null;
  essentiaDanceability: number | null;
  essentiaVoice:        string | null;
  essentiaVoiceGender:  string | null;
  essentiaTimbre:       string | null;
}

async function fetchTrackData(trackId: string): Promise<ExistingTrackData> {
  const result: ExistingTrackData = {
    bpm: null, key: null, energy: null, lyrics: null, lyricTimestamps: null,
    essentiaGenres: null, essentiaMoods: null, essentiaInstruments: null,
    essentiaDanceability: null, essentiaVoice: null, essentiaVoiceGender: null,
    essentiaTimbre: null,
  };

  const [track, lyricJob] = await Promise.all([
    db.track.findUnique({
      where:  { id: trackId },
      select: {
        bpm:                  true,
        musicalKey:           true,
        essentiaGenres:       true,
        essentiaMoods:        true,
        essentiaInstruments:  true,
        essentiaDanceability: true,
        essentiaVoice:        true,
        essentiaVoiceGender:  true,
        essentiaTimbre:       true,
        audioFeatures: {
          select: { energy: true },
        },
      },
    }),
    // Most recent completed LYRIC_VIDEO job for this track
    db.aIJob.findFirst({
      where: {
        type:    "LYRIC_VIDEO",
        status:  "COMPLETE",
        inputData: { path: ["trackId"], equals: trackId },
      },
      orderBy: { completedAt: "desc" },
      select:  { outputData: true },
    }),
  ]);

  if (track) {
    if (track.bpm)                           result.bpm    = track.bpm;
    if (track.musicalKey)                    result.key    = track.musicalKey;
    if (track.audioFeatures?.energy != null) result.energy = track.audioFeatures.energy;
    // Essentia ML fields
    if (track.essentiaGenres)
      result.essentiaGenres = track.essentiaGenres as { label: string; score: number }[];
    if (track.essentiaMoods)
      result.essentiaMoods = track.essentiaMoods as { label: string; score: number }[];
    if (track.essentiaInstruments)
      result.essentiaInstruments = track.essentiaInstruments as { label: string; score: number }[];
    if (track.essentiaDanceability != null)
      result.essentiaDanceability = track.essentiaDanceability;
    if (track.essentiaVoice)        result.essentiaVoice       = track.essentiaVoice;
    if (track.essentiaVoiceGender)  result.essentiaVoiceGender = track.essentiaVoiceGender;
    if (track.essentiaTimbre)       result.essentiaTimbre      = track.essentiaTimbre;
  }
  // Note: essentiaTonal is stored in songStructure JSON (not a separate DB column)
  // It will be carried over when songStructure is set on a new analysis

  if (lyricJob?.outputData) {
    const output = lyricJob.outputData as Record<string, unknown>;

    if (typeof output.transcription === "string") {
      result.lyrics = output.transcription;
    }
    if (Array.isArray(output.words)) {
      result.lyricTimestamps = (output.words as Array<{ word: string; start: number; end: number }>)
        .filter(w => typeof w.word === "string" && typeof w.start === "number")
        .map(w => ({ word: w.word, start: w.start, end: w.end }));
    }
  }

  return result;
}

// ─── Claude: section analysis ─────────────────────────────────────────────────

const SECTION_ANALYSIS_SYSTEM = `You are a music analyst. Given song metadata and lyrics, you break the song into structural sections and identify emotional/energy characteristics for each section. You always return valid JSON and nothing else.`;

interface ClaudeSection {
  type:      string;
  startTime: number;
  endTime:   number;
  energy:    number;
  mood:      string;
}

interface ClaudeAnalysisResponse {
  sections:   ClaudeSection[];
  dropPoints: number[];
}

async function analyzeStructureWithClaude(
  bpm:      number,
  key:      string,
  energy:   number,
  duration: number,
  lyricsDescription: string,
): Promise<ClaudeAnalysisResponse | null> {

  const schema = JSON.stringify({
    sections: [
      {
        type:      "string — one of: intro, verse, chorus, bridge, outro, drop, breakdown",
        startTime: "number (seconds)",
        endTime:   "number (seconds)",
        energy:    "number 0-1",
        mood:      "string — one of: atmospheric, intense, melancholic, euphoric, aggressive, dreamy, triumphant",
      },
    ],
    dropPoints: ["number (seconds) — timestamps where energy spikes dramatically"],
  });

  const prompt = `Analyze this song and break it into structural sections.

Song data:
- BPM: ${bpm}
- Musical Key: ${key}
- Overall Energy: ${energy.toFixed(2)} (0=quiet, 1=very energetic)
- Duration: ${duration} seconds (${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, "0")})
- ${lyricsDescription}

Instructions:
1. Divide the song into its natural sections based on BPM, energy level, and lyric cues.
2. Assign a type to each section: intro, verse, chorus, bridge, outro, drop, breakdown.
3. Assign an energy level 0-1 to each section (intros/verses usually lower than choruses/drops).
4. Assign a mood to each section.
5. Identify drop points — moments where energy jumps up dramatically (usually chorus entries and drops).
6. Sections must be contiguous and cover the full duration from 0 to ${duration.toFixed(1)}.
7. Aim for ${Math.max(4, Math.round(duration / 30))}–${Math.max(6, Math.round(duration / 20))} sections.

Return ONLY this JSON structure:
${schema}`;

  try {
    const response = await claude.messages.create({
      model:      SONNET,
      max_tokens: 1800,
      system:     SECTION_ANALYSIS_SYSTEM,
      messages:   [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed  = JSON.parse(cleaned) as ClaudeAnalysisResponse;

    // Validate structure
    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) return null;

    return parsed;
  } catch (err) {
    console.error("[song-analyzer] Claude analysis failed:", err);
    return null;
  }
}

// ─── Fallback: rule-based section structure ───────────────────────────────────

/**
 * When Claude is unavailable or produces invalid output, generate a reasonable
 * rule-based section structure based on duration alone.
 */
function buildFallbackStructure(duration: number, energy: number): ClaudeAnalysisResponse {
  const sections: ClaudeSection[] = [];

  if (duration <= 90) {
    // Very short — intro + verse + chorus + outro
    sections.push(
      { type: "intro",   startTime: 0,                     endTime: duration * 0.1,  energy: energy * 0.6, mood: "atmospheric" },
      { type: "verse",   startTime: duration * 0.1,         endTime: duration * 0.45, energy: energy * 0.75, mood: "melancholic" },
      { type: "chorus",  startTime: duration * 0.45,         endTime: duration * 0.85, energy: Math.min(energy * 1.2, 1), mood: "euphoric" },
      { type: "outro",   startTime: duration * 0.85,         endTime: duration,         energy: energy * 0.5, mood: "atmospheric" },
    );
  } else if (duration <= 210) {
    // Standard song — intro + V1 + C1 + V2 + C2 + bridge + outro
    sections.push(
      { type: "intro",   startTime: 0,                     endTime: duration * 0.08,  energy: energy * 0.5, mood: "atmospheric" },
      { type: "verse",   startTime: duration * 0.08,         endTime: duration * 0.28,  energy: energy * 0.7, mood: "melancholic" },
      { type: "chorus",  startTime: duration * 0.28,         endTime: duration * 0.45,  energy: Math.min(energy * 1.2, 1), mood: "euphoric" },
      { type: "verse",   startTime: duration * 0.45,         endTime: duration * 0.60,  energy: energy * 0.7, mood: "intense" },
      { type: "chorus",  startTime: duration * 0.60,         endTime: duration * 0.75,  energy: Math.min(energy * 1.2, 1), mood: "euphoric" },
      { type: "bridge",  startTime: duration * 0.75,         endTime: duration * 0.87,  energy: energy * 0.8, mood: "dreamy" },
      { type: "outro",   startTime: duration * 0.87,         endTime: duration,         energy: energy * 0.4, mood: "atmospheric" },
    );
  } else {
    // Long track — intro + V1 + C1 + V2 + C2 + drop + bridge + C3 + outro
    sections.push(
      { type: "intro",     startTime: 0,                    endTime: duration * 0.07,  energy: energy * 0.5, mood: "atmospheric" },
      { type: "verse",     startTime: duration * 0.07,       endTime: duration * 0.22,  energy: energy * 0.65, mood: "melancholic" },
      { type: "chorus",    startTime: duration * 0.22,       endTime: duration * 0.36,  energy: Math.min(energy * 1.2, 1), mood: "euphoric" },
      { type: "verse",     startTime: duration * 0.36,       endTime: duration * 0.50,  energy: energy * 0.7, mood: "intense" },
      { type: "chorus",    startTime: duration * 0.50,       endTime: duration * 0.63,  energy: Math.min(energy * 1.2, 1), mood: "euphoric" },
      { type: "drop",      startTime: duration * 0.63,       endTime: duration * 0.72,  energy: Math.min(energy * 1.35, 1), mood: "aggressive" },
      { type: "bridge",    startTime: duration * 0.72,       endTime: duration * 0.82,  energy: energy * 0.75, mood: "dreamy" },
      { type: "chorus",    startTime: duration * 0.82,       endTime: duration * 0.93,  energy: Math.min(energy * 1.2, 1), mood: "triumphant" },
      { type: "outro",     startTime: duration * 0.93,       endTime: duration,         energy: energy * 0.4, mood: "atmospheric" },
    );
  }

  // Drop points are the start of each chorus or drop
  const dropPoints = sections
    .filter(s => s.type === "chorus" || s.type === "drop")
    .map(s => s.startTime);

  return { sections, dropPoints };
}

// ─── Main exported function ───────────────────────────────────────────────────

export interface AnalyzeOptions {
  audioUrl:    string;
  duration:    number;        // seconds — required; caller must know this before calling
  trackId?:    string;        // if linked to an IndieThis Track
  // Override values (e.g. already fetched upstream)
  existingBpm?:      number;
  existingKey?:      string;
  existingEnergy?:   number;
  existingLyrics?:   string;
  existingTimestamps?: LyricWord[];
}

export async function analyzeSong(opts: AnalyzeOptions): Promise<SongAnalysis> {
  const { audioUrl, duration, trackId } = opts;

  // ── 1. Gather metadata ────────────────────────────────────────────────────

  let bpm:             number        | null = opts.existingBpm        ?? null;
  let key:             string        | null = opts.existingKey        ?? null;
  let energy:          number        | null = opts.existingEnergy     ?? null;
  let lyrics:          string        | null = opts.existingLyrics     ?? null;
  let lyricTimestamps: LyricWord[]   | null = opts.existingTimestamps ?? null;

  // Essentia ML fields — populated from DB if a linked Track exists
  let essentiaGenres:       { label: string; score: number }[] | null = null;
  let essentiaMoods:        { label: string; score: number }[] | null = null;
  let essentiaInstruments:  { label: string; score: number }[] | null = null;
  let essentiaDanceability: number | null = null;
  let essentiaVoice:        string | null = null;
  let essentiaVoiceGender:  string | null = null;
  let essentiaTimbre:       string | null = null;
  let essentiaTonal:        boolean | null = null;

  // Pull from DB if we have a linked Track
  if (trackId && (bpm === null || energy === null)) {
    try {
      const dbData = await fetchTrackData(trackId);
      if (bpm    === null && dbData.bpm    !== null) bpm    = dbData.bpm;
      if (key    === null && dbData.key    !== null) key    = dbData.key;
      if (energy === null && dbData.energy !== null) energy = dbData.energy;
      if (lyrics === null && dbData.lyrics !== null) lyrics = dbData.lyrics;
      if (lyricTimestamps === null && dbData.lyricTimestamps !== null) {
        lyricTimestamps = dbData.lyricTimestamps;
      }
      // Essentia ML data
      essentiaGenres       = dbData.essentiaGenres;
      essentiaMoods        = dbData.essentiaMoods;
      essentiaInstruments  = dbData.essentiaInstruments;
      essentiaDanceability = dbData.essentiaDanceability;
      essentiaVoice        = dbData.essentiaVoice;
      essentiaVoiceGender  = dbData.essentiaVoiceGender;
      essentiaTimbre       = dbData.essentiaTimbre;
    } catch (err) {
      console.warn("[song-analyzer] DB lookup failed:", err);
    }
  }

  // Run live audio analysis if still missing BPM/energy (fresh uploads)
  if (bpm === null || energy === null) {
    try {
      console.log("[song-analyzer] Running live audio analysis for", audioUrl.slice(0, 60));
      const detected = await detectAudioFeatures(audioUrl);
      if (bpm    === null && detected.bpm    !== null) bpm    = detected.bpm;
      if (key    === null && detected.musicalKey !== null) key = detected.musicalKey;
      if (energy === null && detected.energy !== null) energy = detected.energy;
    } catch (err) {
      console.warn("[song-analyzer] Live audio analysis failed:", err);
    }
  }

  // Defaults when analysis still unavailable
  const finalBpm    = bpm    ?? 120;
  const finalKey    = key    ?? "C major";
  const finalEnergy = energy ?? 0.65;

  // ── 1.5. Run EffNet-Discogs ML classification if no pre-computed data ────────
  // Fires when the track has no pre-computed Essentia data in the DB.
  // EffNet-Discogs: 400 Discogs style genres + mood + instrument detection.

  const needsEffnetAnalysis = essentiaGenres === null && essentiaMoods === null;

  if (needsEffnetAnalysis) {
    try {
      console.log("[song-analyzer] Running EffNet-Discogs ML classification…");
      const { analyzeUrlWithEffnet } = await import("@/lib/audio/effnet-discogs");
      const effnetResult = await analyzeUrlWithEffnet(audioUrl);
      if (effnetResult) {
        if (!essentiaGenres      && effnetResult.genres.length)      essentiaGenres       = effnetResult.genres;
        if (!essentiaMoods       && effnetResult.moods.length)       essentiaMoods        = effnetResult.moods;
        if (!essentiaInstruments && effnetResult.instruments.length) essentiaInstruments  = effnetResult.instruments;
        if (essentiaDanceability === null)                           essentiaDanceability = effnetResult.danceability;
        if (!essentiaVoice)                                          essentiaVoice        = effnetResult.isVocal ? "vocal" : "instrumental";
        if (essentiaTonal === null)                                   essentiaTonal        = effnetResult.isTonal;
        console.log(
          "[song-analyzer] EffNet — genre:", essentiaGenres?.slice(0, 2).map(g => g.label).join(", "),
          "| mood:", essentiaMoods?.slice(0, 2).map(m => m.label).join(", "),
          "| voice:", essentiaVoice,
          "| danceability:", essentiaDanceability?.toFixed(2),
        );
      }
    } catch (err) {
      console.warn("[song-analyzer] EffNet analysis failed, continuing without ML data:", err);
    }
  }

  // ── 2. Build lyric context for Claude ─────────────────────────────────────

  const lyricsDescription = formatLyricsForPrompt(lyrics, lyricTimestamps, duration);

  // ── 3. Get section structure + genre/mood inferences from Claude ──────────

  let structureResult = await analyzeStructureWithClaude(
    finalBpm, finalKey, finalEnergy, duration, lyricsDescription,
  );

  // Fall back to rule-based if Claude fails
  if (!structureResult) {
    console.warn("[song-analyzer] Falling back to rule-based section structure");
    structureResult = buildFallbackStructure(duration, finalEnergy);
  }

  // ── 4. Enrich sections with lyric content ─────────────────────────────────

  const sections: SongSection[] = structureResult.sections.map(s => ({
    type:      s.type,
    startTime: Math.max(0, s.startTime),
    endTime:   Math.min(duration, s.endTime),
    duration:  Math.min(duration, s.endTime) - Math.max(0, s.startTime),
    energy:    Math.max(0, Math.min(1, s.energy)),
    mood:      s.mood,
    lyrics:    lyricTimestamps
      ? lyricsInWindow(lyricTimestamps, s.startTime, s.endTime)
      : null,
  }));

  // ── 5. Build beat grid ────────────────────────────────────────────────────

  const beats = buildBeatGrid(finalBpm, duration);

  // ── 6. Validate and sanitize drop points ─────────────────────────────────

  const dropPoints = (structureResult.dropPoints ?? [])
    .filter(t => typeof t === "number" && t >= 0 && t < duration)
    .sort((a, b) => a - b);

  return {
    bpm:             finalBpm,
    key:             finalKey,
    energy:          finalEnergy,
    duration,
    lyrics,
    lyricTimestamps,
    sections,
    beats,
    dropPoints,
    // EffNet-Discogs ML data — from DB or fresh analysis
    genres:       essentiaGenres,
    moods:        essentiaMoods,
    instruments:  essentiaInstruments,
    danceability: essentiaDanceability,
    vocalType:    essentiaVoice as "vocal" | "instrumental" | null,
    voiceGender:  essentiaVoiceGender as "male" | "female" | null,
    timbre:       essentiaTimbre as "bright" | "dark" | null,
    isTonal:      essentiaTonal,
  };
}

// ─── Convenience: estimate scene count from video length ─────────────────────

export const SCENE_COUNTS: Record<string, { min: number; max: number }> = {
  SHORT:    { min: 4,  max: 6  },
  STANDARD: { min: 8,  max: 12 },
  EXTENDED: { min: 12, max: 18 },
};

/**
 * Returns the recommended number of scenes for a given video length tier,
 * biased toward the song's structural complexity.
 */
export function recommendSceneCount(
  videoLength: string,
  songAnalysis: SongAnalysis,
): number {
  const range = SCENE_COUNTS[videoLength] ?? SCENE_COUNTS.STANDARD;
  const sectionCount = songAnalysis.sections.length;

  // Try to align scene count to section count (natural scene boundaries)
  const aligned = Math.max(range.min, Math.min(range.max, sectionCount));
  return aligned;
}
