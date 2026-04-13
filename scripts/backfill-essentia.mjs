/**
 * scripts/backfill-essentia.mjs
 *
 * Backfills Essentia ML analysis for all existing tracks that haven't been
 * analyzed yet (essentiaAnalyzedAt is null).
 *
 * Processes tracks in batches of 50. Pauses 2 seconds between each track
 * to avoid hammering Replicate.
 *
 * Run with:
 *   node --env-file=.env.local scripts/backfill-essentia.mjs
 *
 * Optional: process a specific number of tracks
 *   node --env-file=.env.local scripts/backfill-essentia.mjs --limit 10
 *
 * This is safe to run multiple times — tracks already analyzed are skipped.
 * Not a launch blocker. Run whenever Replicate credit is available.
 */

import { PrismaClient } from "@prisma/client";
import Replicate        from "replicate";

const prisma    = new PrismaClient();
const replicate = new Replicate();

// Pinned version — same as essentia-analysis.ts
const MODEL = "mtg/music-classifiers:fb1f50036eaaf8918ca419f236b0b48d28bc3ef20b4b3f915cf9ed1a3d3064ab";

// ─── Parse CLI args ────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const batchLimit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 50;

// ─── Markdown parser (same logic as essentia-analysis.ts) ─────────────────────

function parseMarkdownTable(markdown) {
  const classifiers = {};
  const lines = markdown.split("\n");

  for (const line of lines) {
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

    const parts = trimmed.split("|");
    if (parts.length < 3) continue;

    const classifierName = parts[0].trim();
    if (!classifierName) continue;

    const classesRaw = (parts[1] ?? "").trim();
    const scoresRaw  = (parts[2] ?? "").trim();

    const classes = classesRaw.split("<br>").map(s => s.trim()).filter(Boolean);
    const scores  = scoresRaw.split("<br>").map(s =>
      parseFloat(s.replace(/\*\*/g, "").trim())
    ).filter(n => !isNaN(n));

    if (classes.length === 0 || scores.length === 0) continue;

    const classMap = {};
    classes.forEach((cls, i) => { classMap[cls] = scores[i] ?? 0; });
    classifiers[classifierName] = classMap;
  }

  return classifiers;
}

function topPredictions(map, limit) {
  return Object.entries(map)
    .filter(([, score]) => score > 0.05)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([label, score]) => ({ label, score }));
}

function buildResult(classifiers) {
  const genreMap = {};
  for (const [cls, score] of Object.entries(classifiers["genre_rosamerica"] ?? {})) {
    genreMap[cls] = Math.max(genreMap[cls] ?? 0, score);
  }
  for (const [cls, score] of Object.entries(classifiers["genre_tzanetakis"] ?? {})) {
    const label = cls.charAt(0).toUpperCase() + cls.slice(1);
    genreMap[label] = Math.max(genreMap[label] ?? 0, score);
  }
  const genres = topPredictions(genreMap, 5);

  const moodEntries = [
    { label: "aggressive", score: classifiers["mood_aggressive"]?.["aggressive"] ?? 0 },
    { label: "happy",      score: classifiers["mood_happy"]?.["happy"]           ?? 0 },
    { label: "sad",        score: classifiers["mood_sad"]?.["sad"]               ?? 0 },
    { label: "relaxed",    score: classifiers["mood_relaxed"]?.["relaxed"]       ?? 0 },
    { label: "party",      score: classifiers["mood_party"]?.["party"]           ?? 0 },
    { label: "acoustic",   score: classifiers["mood_acoustic"]?.["acoustic"]     ?? 0 },
    { label: "electronic", score: classifiers["mood_electronic"]?.["electronic"] ?? 0 },
  ];
  const moods = moodEntries.filter(m => m.score > 0.1).sort((a, b) => b.score - a.score).slice(0, 5);

  const danceability = classifiers["danceability"]?.["danceable"] ?? 0.5;

  const voiceScore        = classifiers["voice_instrumental"]?.["voice"]        ?? 0;
  const instrumentalScore = classifiers["voice_instrumental"]?.["instrumental"] ?? 0;
  const voice = voiceScore >= instrumentalScore ? "vocal" : "instrumental";

  const maleScore   = classifiers["gender"]?.["male"]   ?? 0;
  const femaleScore = classifiers["gender"]?.["female"] ?? 0;
  let voiceGender = null;
  if (voice === "vocal") {
    if (maleScore > 0.6)   voiceGender = "male";
    if (femaleScore > 0.6) voiceGender = "female";
  }

  const tonalScore  = classifiers["tonal_atonal"]?.["tonal"]  ?? 0;
  const atonalScore = classifiers["tonal_atonal"]?.["atonal"] ?? 0;
  let timbre = null;
  if (tonalScore > 0.6 && tonalScore > atonalScore)   timbre = "bright";
  if (atonalScore > 0.6 && atonalScore > tonalScore)  timbre = "dark";

  const allTags = [];
  for (const [classifierName, classes] of Object.entries(classifiers)) {
    for (const [cls, score] of Object.entries(classes)) {
      if (score > 0.1 && !cls.startsWith("not ")) {
        allTags.push({ label: `${classifierName}:${cls}`, score });
      }
    }
  }
  allTags.sort((a, b) => b.score - a.score);
  const autoTags = allTags.slice(0, 50);

  return { genres, moods, instruments: [], danceability, voice, voiceGender, timbre, autoTags };
}

async function analyzeTrack(audioUrl) {
  const output = await replicate.run(MODEL, {
    input: { audio: audioUrl, model_type: "musicnn-msd" },
  });

  const fileUrl = output?.[0]?.file;
  if (!fileUrl) return null;

  const resp = await fetch(fileUrl);
  if (!resp.ok) return null;
  const markdown = await resp.text();

  return buildResult(parseMarkdownTable(markdown));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function backfill() {
  console.log(`[backfill-essentia] Starting — batch limit: ${batchLimit}`);

  const tracks = await prisma.track.findMany({
    where: {
      essentiaAnalyzedAt: null,
      fileUrl:            { not: "" },
    },
    select: { id: true, fileUrl: true, title: true },
    take:   batchLimit,
    orderBy: { createdAt: "desc" },
  });

  console.log(`[backfill-essentia] Found ${tracks.length} unanalyzed tracks`);
  if (tracks.length === 0) {
    console.log("[backfill-essentia] Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  let success = 0;
  let failed  = 0;

  for (const track of tracks) {
    if (!track.fileUrl) { failed++; continue; }

    process.stdout.write(`  Analyzing: "${track.title}" (${track.id})… `);

    try {
      const result = await analyzeTrack(track.fileUrl);

      if (result) {
        await prisma.track.update({
          where: { id: track.id },
          data: {
            essentiaGenres:       result.genres,
            essentiaMoods:        result.moods,
            essentiaInstruments:  result.instruments,
            essentiaDanceability: result.danceability,
            essentiaVoice:        result.voice,
            essentiaVoiceGender:  result.voiceGender,
            essentiaTimbre:       result.timbre,
            essentiaAutoTags:     result.autoTags,
            essentiaAnalyzedAt:   new Date(),
          },
        });
        console.log("✅");
        success++;
      } else {
        console.log("⚠️  no output");
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }

    // Rate limit — 2s between tracks
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n[backfill-essentia] Done — ${success} succeeded, ${failed} failed`);
  await prisma.$disconnect();
}

backfill().catch(err => {
  console.error("[backfill-essentia] Fatal:", err);
  prisma.$disconnect();
  process.exit(1);
});
