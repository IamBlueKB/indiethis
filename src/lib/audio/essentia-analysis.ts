/**
 * src/lib/audio/essentia-analysis.ts
 *
 * Runs Essentia ML classifiers via Replicate mtg/music-classifiers.
 *
 * Verified output format (from live model test against default example):
 *   - replicate.run() returns: [{ file: "https://...out.md" }]
 *   - The .md file is a Markdown table: | model | class | activation |
 *   - Each row: model_name | class1<br>class2<br>... | 0.02<br>0.87<br>...
 *   - Bold scores (**0.90**) mark the predicted class but all scores are returned
 *
 * Verified classifiers in musicnn-msd output:
 *   genre_dortmund, genre_rosamerica, genre_tzanetakis, genre_electronic,
 *   mood_acoustic, mood_electronic, mood_aggressive, mood_relaxed,
 *   mood_happy, mood_sad, mood_party,
 *   danceability, gender, tonal_atonal, voice_instrumental
 *
 * NOTE: Replicate account must have credit for this to run in production.
 * If the call fails, analyzeWithEssentia() returns null and the track
 * continues to process normally using the existing math-based features.
 */

import Replicate from "replicate";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EssentiaAnalysisResult {
  genres:       { label: string; score: number }[];
  moods:        { label: string; score: number }[];
  instruments:  { label: string; score: number }[]; // empty — not in musicnn-msd
  danceability: number;
  voice:        "vocal" | "instrumental";
  voiceGender:  "male" | "female" | null;
  timbre:       "bright" | "dark" | null;
  autoTags:     { label: string; score: number }[];
}

// Parsed table row: classifier name → { class: score } map
type ClassifierMap = Record<string, Record<string, number>>;

// ─── Replicate client ─────────────────────────────────────────────────────────

const replicate = new Replicate();

// Pinned version — verified 2026-04-13
const MODEL = "mtg/music-classifiers:fb1f50036eaaf8918ca419f236b0b48d28bc3ef20b4b3f915cf9ed1a3d3064ab";

// ─── Main export ──────────────────────────────────────────────────────────────

export async function analyzeWithEssentia(
  audioUrl: string
): Promise<EssentiaAnalysisResult | null> {
  try {
    console.log("[essentia] Starting analysis via Replicate...");

    const output = await replicate.run(MODEL, {
      input: {
        audio:      audioUrl,
        model_type: "musicnn-msd", // gives genre, mood, danceability, voice, gender, timbre
      },
    }) as Array<{ file: string }>;

    console.log("[essentia] Analysis complete, parsing output...");

    // output is [{ file: "https://...out.md" }]
    const fileUrl = output?.[0]?.file;
    if (!fileUrl) {
      console.error("[essentia] No file URL in output:", JSON.stringify(output));
      return null;
    }

    // Fetch the Markdown table
    const resp = await fetch(fileUrl);
    if (!resp.ok) {
      console.error("[essentia] Failed to fetch output file:", resp.status);
      return null;
    }
    const markdown = await resp.text();

    // Parse the Markdown table into a classifier map
    const classifiers = parseMarkdownTable(markdown);

    return buildResult(classifiers);
  } catch (error) {
    console.error("[essentia] Analysis failed:", error);
    return null; // Graceful fallback — track continues processing normally
  }
}

// ─── Markdown parser ──────────────────────────────────────────────────────────

/**
 * Parses the Markdown table returned by mtg/music-classifiers into a map of
 * { classifierName → { className → score } }.
 *
 * Table format (verified from live model output):
 *   | model | class | activation |
 *   |---|---|---|
 *   genre_dortmund | alternative<br>blues<br>... | 0.02<br>0.00<br>...
 *   ||<hr>|<hr>|
 *   genre_rosamerica | classic<br>dance<br>... | 0.03<br>0.00<br>...
 */
function parseMarkdownTable(markdown: string): ClassifierMap {
  const classifiers: ClassifierMap = {};
  const lines = markdown.split("\n");

  for (const line of lines) {
    // Skip header, separator, and empty lines
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("| model") ||
      trimmed.startsWith("|---|") ||
      trimmed === "||<hr>|<hr>|" ||
      trimmed.startsWith("#")
    ) {
      continue;
    }

    // Data row: classifierName | class1<br>class2... | score1<br>score2...
    const parts = trimmed.split("|");
    if (parts.length < 3) continue;

    const classifierName = parts[0].trim();
    if (!classifierName) continue;

    const classesRaw  = (parts[1] ?? "").trim();
    const scoresRaw   = (parts[2] ?? "").trim();

    const classes = classesRaw.split("<br>").map(s => s.trim()).filter(Boolean);
    const scores  = scoresRaw.split("<br>").map(s =>
      parseFloat(s.replace(/\*\*/g, "").trim())
    ).filter(n => !isNaN(n));

    if (classes.length === 0 || scores.length === 0) continue;

    const classMap: Record<string, number> = {};
    classes.forEach((cls, i) => {
      classMap[cls] = scores[i] ?? 0;
    });

    classifiers[classifierName] = classMap;
  }

  return classifiers;
}

// ─── Result builder ───────────────────────────────────────────────────────────

function buildResult(classifiers: ClassifierMap): EssentiaAnalysisResult {
  // ── Genres ──────────────────────────────────────────────────────────────────
  // Merge genre_rosamerica (8-class) + genre_tzanetakis (10-class), pick top 5
  const genreMap: Record<string, number> = {};
  for (const [cls, score] of Object.entries(classifiers["genre_rosamerica"] ?? {})) {
    genreMap[cls] = Math.max(genreMap[cls] ?? 0, score);
  }
  for (const [cls, score] of Object.entries(classifiers["genre_tzanetakis"] ?? {})) {
    // Normalize label to title case for consistency
    const label = cls.charAt(0).toUpperCase() + cls.slice(1);
    genreMap[label] = Math.max(genreMap[label] ?? 0, score);
  }
  const genres = topPredictions(genreMap, 5);

  // ── Moods ────────────────────────────────────────────────────────────────────
  // Each mood classifier is binary — take the positive class score
  const moodEntries: { label: string; score: number }[] = [
    { label: "aggressive", score: classifiers["mood_aggressive"]?.["aggressive"] ?? 0 },
    { label: "happy",      score: classifiers["mood_happy"]?.["happy"]           ?? 0 },
    { label: "sad",        score: classifiers["mood_sad"]?.["sad"]               ?? 0 },
    { label: "relaxed",    score: classifiers["mood_relaxed"]?.["relaxed"]       ?? 0 },
    { label: "party",      score: classifiers["mood_party"]?.["party"]           ?? 0 },
    { label: "acoustic",   score: classifiers["mood_acoustic"]?.["acoustic"]     ?? 0 },
    { label: "electronic", score: classifiers["mood_electronic"]?.["electronic"] ?? 0 },
  ];
  const moods = moodEntries
    .filter(m => m.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // ── Danceability ─────────────────────────────────────────────────────────────
  const danceability = classifiers["danceability"]?.["danceable"] ?? 0.5;

  // ── Voice / Vocals ───────────────────────────────────────────────────────────
  const voiceScore        = classifiers["voice_instrumental"]?.["voice"]        ?? 0;
  const instrumentalScore = classifiers["voice_instrumental"]?.["instrumental"] ?? 0;
  const voice: "vocal" | "instrumental" = voiceScore >= instrumentalScore ? "vocal" : "instrumental";

  // ── Voice gender ─────────────────────────────────────────────────────────────
  const maleScore   = classifiers["gender"]?.["male"]   ?? 0;
  const femaleScore = classifiers["gender"]?.["female"] ?? 0;
  let voiceGender: "male" | "female" | null = null;
  if (voice === "vocal") {
    if (maleScore > 0.6)   voiceGender = "male";
    if (femaleScore > 0.6) voiceGender = "female";
  }

  // ── Timbre ───────────────────────────────────────────────────────────────────
  // tonal_atonal: tonal → bright timbre, atonal → dark timbre
  const tonalScore  = classifiers["tonal_atonal"]?.["tonal"]  ?? 0;
  const atonalScore = classifiers["tonal_atonal"]?.["atonal"] ?? 0;
  let timbre: "bright" | "dark" | null = null;
  if (tonalScore > 0.6 && tonalScore > atonalScore)   timbre = "bright";
  if (atonalScore > 0.6 && atonalScore > tonalScore)  timbre = "dark";

  // ── Auto-tags ─────────────────────────────────────────────────────────────────
  // Flatten all classifier predictions as auto-tags for search/discovery
  const allTags: { label: string; score: number }[] = [];
  for (const [classifierName, classes] of Object.entries(classifiers)) {
    for (const [cls, score] of Object.entries(classes)) {
      if (score > 0.1 && !cls.startsWith("not ")) {
        allTags.push({ label: `${classifierName}:${cls}`, score });
      }
    }
  }
  allTags.sort((a, b) => b.score - a.score);
  const autoTags = allTags.slice(0, 50);

  // ── Instruments ───────────────────────────────────────────────────────────────
  // musicnn-msd does not have an instrument classifier — return empty.
  // A future upgrade can add vggish-audioset or a dedicated instrument model.
  const instruments: { label: string; score: number }[] = [];

  return {
    genres,
    moods,
    instruments,
    danceability,
    voice,
    voiceGender,
    timbre,
    autoTags,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function topPredictions(
  map: Record<string, number>,
  limit: number
): { label: string; score: number }[] {
  return Object.entries(map)
    .filter(([, score]) => score > 0.05)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([label, score]) => ({ label, score }));
}
