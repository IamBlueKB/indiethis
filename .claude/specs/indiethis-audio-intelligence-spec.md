# IndieThis — Platform-Wide Audio Intelligence Service

_For Claude Code (Sonnet). This spec adds deep audio analysis using Essentia's ML models via Replicate alongside the existing Demucs and Whisper calls. The analysis runs ONCE per track upload and stores results on the Track record. Every tool reads from the same data. Build in order. Commit after each step._

---

## WHY THIS MATTERS

Current state: Audio analysis uses math formulas (RMS, spectral flatness, frequency band ratios) to approximate genre, mood, and classifications. The Video Studio's Claude Director gets BPM, key, and energy — three numbers — and has to ask the artist "what does your song sound like?"

New state: Essentia's trained ML models (running on Replicate) analyze the actual audio and return real genre/subgenre classification, mood detection, instrument identification, danceability, vocal detection, and more. Every tool on the platform gets accurate data. Claude never needs to ask what the song sounds like — it already knows.

Cost: ~$0.007 per track via Replicate (T4 GPU, ~30 seconds inference). Analysis runs once per track, results stored permanently. At 1,000 tracks/month = $7/month. Compared to Cyanite at €290/month for the same data.

---

## RULES
- Do NOT remove the existing BPM, key, or energy detection — those work fine and stay
- Do NOT change any UI components in this spec — this is data pipeline only
- The Replicate call runs IN PARALLEL with existing Demucs and Whisper calls during track upload processing — not sequentially
- Results are stored on the Track model in the database
- Every tool reads from the stored results — no tool triggers its own analysis
- If the Replicate call fails, the track still processes normally with the existing math-based features as fallback

---

## STEP 1: Add Essentia Fields to Track Model

Search the Prisma schema for the `Track` model. Add these fields:

```prisma
// ── Essentia ML Analysis (populated by Replicate mtg/music-classifiers) ──
essentiaGenres        Json?     // e.g. [{ "label": "electronic", "score": 0.87 }, { "label": "hip-hop", "score": 0.65 }]
essentiaMoods         Json?     // e.g. [{ "label": "aggressive", "score": 0.92 }, { "label": "dark", "score": 0.78 }]
essentiaInstruments   Json?     // e.g. [{ "label": "synthesizer", "score": 0.95 }, { "label": "drums", "score": 0.91 }]
essentiaDanceability  Float?    // 0-1
essentiaVoice         String?   // "vocal" | "instrumental"
essentiaVoiceGender   String?   // "male" | "female" | null
essentiaTimbre        String?   // "bright" | "dark" | null
essentiaAutoTags      Json?     // top 50 MSD tags with scores
essentiaAnalyzedAt    DateTime? // when the analysis was performed
```

Run `npx prisma migrate dev --name add-essentia-audio-intelligence` to create the migration.

Commit.

---

## STEP 2: Create the Essentia Analysis Function

Create `src/lib/audio/essentia-analysis.ts`:

```typescript
import Replicate from "replicate";

const replicate = new Replicate();

export interface EssentiaAnalysisResult {
  genres: { label: string; score: number }[];
  moods: { label: string; score: number }[];
  instruments: { label: string; score: number }[];
  danceability: number;
  voice: "vocal" | "instrumental";
  voiceGender: "male" | "female" | null;
  timbre: "bright" | "dark" | null;
  autoTags: { label: string; score: number }[];
}

export async function analyzeWithEssentia(
  audioUrl: string
): Promise<EssentiaAnalysisResult | null> {
  try {
    console.log("[essentia] Starting analysis via Replicate...");

    const output = await replicate.run("mtg/music-classifiers", {
      input: {
        audio: audioUrl,
      },
    });

    console.log("[essentia] Analysis complete");

    // Parse the Replicate output into our standard format
    // The exact output structure depends on the model — search Replicate docs
    // or inspect the raw output to determine the field names
    return parseEssentiaOutput(output);
  } catch (error) {
    console.error("[essentia] Analysis failed:", error);
    return null; // Graceful fallback — other analysis continues without Essentia
  }
}

function parseEssentiaOutput(output: any): EssentiaAnalysisResult {
  // IMPORTANT: The exact parsing logic depends on what mtg/music-classifiers returns.
  // Search the Replicate model page for output examples.
  // The model returns predictions for multiple classifiers — genre, mood, instrument, etc.
  // Each classifier returns an array of { label, score } pairs.
  //
  // Inspect the raw output by logging it:
  // console.log("[essentia] Raw output:", JSON.stringify(output, null, 2));
  //
  // Then write the parsing logic based on the actual structure.
  // The structure below is a best guess — verify and adjust.

  const result: EssentiaAnalysisResult = {
    genres: extractTopPredictions(output?.genre_rosamerica || output?.genre || {}, 5),
    moods: [
      ...extractTopPredictions(output?.mood_aggressive || {}, 3),
      ...extractTopPredictions(output?.mood_happy || {}, 3),
      ...extractTopPredictions(output?.mood_sad || {}, 3),
      ...extractTopPredictions(output?.mood_relaxed || {}, 3),
      ...extractTopPredictions(output?.mood_electronic || {}, 3),
    ].sort((a, b) => b.score - a.score).slice(0, 5),
    instruments: extractTopPredictions(output?.instrument || {}, 10),
    danceability: output?.danceability?.danceable ?? output?.danceability ?? 0.5,
    voice: (output?.voice_instrumental?.instrumental ?? 0) > 0.5 ? "instrumental" : "vocal",
    voiceGender: parseVoiceGender(output?.voice_gender || output?.gender || {}),
    timbre: parseTimbre(output?.timbre || {}),
    autoTags: extractTopPredictions(output?.autotagging || output?.msd || {}, 20),
  };

  return result;
}

function extractTopPredictions(
  predictions: Record<string, number> | any,
  limit: number
): { label: string; score: number }[] {
  if (!predictions || typeof predictions !== "object") return [];
  
  return Object.entries(predictions)
    .map(([label, score]) => ({ label, score: Number(score) }))
    .filter((p) => p.score > 0.1) // filter out noise
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function parseVoiceGender(genderOutput: any): "male" | "female" | null {
  if (!genderOutput) return null;
  const male = genderOutput.male ?? 0;
  const female = genderOutput.female ?? 0;
  if (male > 0.6) return "male";
  if (female > 0.6) return "female";
  return null;
}

function parseTimbre(timbreOutput: any): "bright" | "dark" | null {
  if (!timbreOutput) return null;
  const bright = timbreOutput.bright ?? 0;
  const dark = timbreOutput.dark ?? 0;
  if (bright > dark && bright > 0.5) return "bright";
  if (dark > bright && dark > 0.5) return "dark";
  return null;
}
```

### CRITICAL: Verify the Output Format

Before committing, run a test call to `mtg/music-classifiers` with any audio file and log the raw output. The parsing logic above is a best guess. The actual field names in the output may differ. Adjust `parseEssentiaOutput()` to match reality.

You can test with:
```bash
npx ts-node -e "
const Replicate = require('replicate');
const replicate = new Replicate();
replicate.run('mtg/music-classifiers', {
  input: { audio: 'https://your-test-audio-url.wav' }
}).then(output => console.log(JSON.stringify(output, null, 2)));
"
```

Or use the Replicate playground at https://replicate.com/mtg/music-classifiers to test with a sample audio file and see the exact output format.

Commit.

---

## STEP 3: Wire Essentia into Track Upload Pipeline

Search the codebase for where tracks are uploaded and processed. This is where Demucs and Whisper are triggered. It might be in:
- An API route like `/api/tracks/upload` or `/api/tracks/[id]/process`
- A background job or queue processor
- A function called after file upload completes

### Add Essentia as a Parallel Call

Find where Demucs and Whisper are called. Add the Essentia call to run IN PARALLEL — not after them. All three can run simultaneously since they're independent:

```typescript
import { analyzeWithEssentia } from "@/lib/audio/essentia-analysis";

// Existing pattern (search for the actual code):
const [demucsResult, whisperResult, essentiaResult] = await Promise.allSettled([
  runDemucs(audioUrl),        // existing
  runWhisper(audioUrl),       // existing
  analyzeWithEssentia(audioUrl), // NEW — runs in parallel
]);

// Store Essentia results on the Track record
if (essentiaResult.status === "fulfilled" && essentiaResult.value) {
  const essentia = essentiaResult.value;
  await prisma.track.update({
    where: { id: trackId },
    data: {
      essentiaGenres: essentia.genres,
      essentiaMoods: essentia.moods,
      essentiaInstruments: essentia.instruments,
      essentiaDanceability: essentia.danceability,
      essentiaVoice: essentia.voice,
      essentiaVoiceGender: essentia.voiceGender,
      essentiaTimbre: essentia.timbre,
      essentiaAutoTags: essentia.autoTags,
      essentiaAnalyzedAt: new Date(),
    },
  });
}
// If Essentia fails, the track still processes normally — no error thrown
```

### IMPORTANT: Do NOT block track upload on Essentia

If Essentia fails or times out, the track should still be fully usable. The existing math-based features remain as fallback. Essentia data is bonus intelligence — never a blocker.

Commit.

---

## STEP 4: Update Audio Features Calculation

Search for `src/lib/audio-features.ts` — this is where the math-based genre, mood, and other classifications are calculated.

### Upgrade the Classification Logic

When calculating audio features for display (radar chart, badges), prefer Essentia ML data over math-based heuristics:

```typescript
export function calculateAudioFeatures(track: Track): AudioFeatureScores {
  // ... existing axis calculations (energy, dance, valence, etc.) stay ...

  // Genre: prefer Essentia ML classification over math heuristic
  let genre: string;
  if (track.essentiaGenres && Array.isArray(track.essentiaGenres) && track.essentiaGenres.length > 0) {
    genre = (track.essentiaGenres as any[])[0].label;
  } else {
    genre = detectGenreFromSpectral(/* existing math-based logic */);
  }

  // Mood: prefer Essentia ML classification over math heuristic
  let mood: string;
  if (track.essentiaMoods && Array.isArray(track.essentiaMoods) && track.essentiaMoods.length > 0) {
    mood = (track.essentiaMoods as any[])[0].label;
  } else {
    mood = detectMoodFromFeatures(/* existing math-based logic */);
  }

  // Vocal detection: prefer Essentia ML over frequency band ratio
  let isVocal: boolean;
  if (track.essentiaVoice) {
    isVocal = track.essentiaVoice === "vocal";
  } else {
    isVocal = detectVocalFromBands(/* existing math-based logic */);
  }

  // Danceability: prefer Essentia ML over onset density
  let danceability: number;
  if (track.essentiaDanceability != null) {
    danceability = track.essentiaDanceability;
  } else {
    danceability = calculateDanceFromOnsets(/* existing math-based logic */);
  }

  return {
    energy,
    dance: danceability,
    valence,
    loudness,
    acoustic,
    instrumental: isVocal ? 0 : 1,
    speech,
    live,
    genre,
    mood,
    isVocal,
  };
}
```

This means tracks analyzed before the Essentia upgrade still work with math-based features, while new tracks get ML-powered classifications. Gradual migration, no breaking changes.

Commit.

---

## STEP 5: Feed Essentia Data to Video Studio

Search for the `analyzeSong` function in `src/lib/video-studio/song-analyzer.ts`. This is where the Video Studio gathers data before Claude builds the shot list.

### Add Essentia Data to SongAnalysis

Update the `SongAnalysis` type to include Essentia fields:

```typescript
interface SongAnalysis {
  // ... existing fields stay ...
  bpm: number;
  key: string;
  energy: number;
  duration: number;
  lyrics: string | null;
  lyricTimestamps: LyricWord[] | null;
  sections: SongSection[];
  beats: number[];
  dropPoints: number[];

  // NEW — from Essentia ML analysis
  genres: { label: string; score: number }[] | null;
  moods: { label: string; score: number }[] | null;
  instruments: { label: string; score: number }[] | null;
  danceability: number | null;
  vocalType: "vocal" | "instrumental" | null;
  voiceGender: "male" | "female" | null;
  timbre: "bright" | "dark" | null;
}
```

In the `analyzeSong` function, after loading the Track record from the database, read the Essentia fields:

```typescript
const track = await prisma.track.findUnique({ where: { id: trackId } });

const analysis: SongAnalysis = {
  // ... existing field population ...
  
  // Essentia data (may be null if track wasn't analyzed yet)
  genres: track?.essentiaGenres as any[] ?? null,
  moods: track?.essentiaMoods as any[] ?? null,
  instruments: track?.essentiaInstruments as any[] ?? null,
  danceability: track?.essentiaDanceability ?? null,
  vocalType: track?.essentiaVoice as any ?? null,
  voiceGender: track?.essentiaVoiceGender as any ?? null,
  timbre: track?.essentiaTimbre as any ?? null,
};
```

Commit.

---

## STEP 6: Update Claude Director Agent Context

Search for where the Director Agent's Claude API call is constructed — specifically where the audio analysis data is formatted into the system prompt or user message.

### Expand the Audio Context Block

Currently Claude probably receives something like:
```
BPM: 140, Key: F minor, Energy: 0.7
Sections: intro (0-15s), verse (15-45s), chorus (45-75s)...
```

Add the Essentia data so Claude receives:
```
BPM: 140
Key: F minor
Energy: 0.7
Genre: dark trap (87%), hip-hop (65%), electronic (42%)
Mood: aggressive (92%), dark (78%), intense (61%)
Instruments: synthesizer (95%), drums (91%), 808 bass (88%), hi-hats (76%)
Danceability: 0.4
Vocals: instrumental (no vocals detected)
Timbre: dark
Sections: intro (0-15s, atmospheric), verse (15-45s, building), chorus (45-75s, peak energy)...
```

Claude now knows exactly what the song sounds like. It writes prompts that match — dark, aggressive, synth-heavy visuals with 808-driven pacing. No more asking the artist to describe their own music.

### Format the Essentia Data for Claude

```typescript
function formatEssentiaContext(analysis: SongAnalysis): string {
  const parts: string[] = [];

  if (analysis.genres?.length) {
    const genreStr = analysis.genres
      .slice(0, 3)
      .map(g => `${g.label} (${Math.round(g.score * 100)}%)`)
      .join(", ");
    parts.push(`Genre: ${genreStr}`);
  }

  if (analysis.moods?.length) {
    const moodStr = analysis.moods
      .slice(0, 3)
      .map(m => `${m.label} (${Math.round(m.score * 100)}%)`)
      .join(", ");
    parts.push(`Mood: ${moodStr}`);
  }

  if (analysis.instruments?.length) {
    const instrStr = analysis.instruments
      .slice(0, 5)
      .map(i => `${i.label} (${Math.round(i.score * 100)}%)`)
      .join(", ");
    parts.push(`Instruments: ${instrStr}`);
  }

  if (analysis.danceability != null) {
    parts.push(`Danceability: ${analysis.danceability.toFixed(2)}`);
  }

  if (analysis.vocalType) {
    parts.push(`Vocals: ${analysis.vocalType}${analysis.voiceGender ? ` (${analysis.voiceGender})` : ""}`);
  }

  if (analysis.timbre) {
    parts.push(`Timbre: ${analysis.timbre}`);
  }

  return parts.join("\n");
}
```

Insert this into the Claude prompt construction alongside the existing BPM/key/sections data.

Commit.

---

## STEP 7: Feed Essentia Data to Sync Ready

Search the codebase for where Sync Ready metadata is populated — the sync toggle, the sync profile, or wherever sync-related fields are written.

When an artist enables the Sync Ready toggle, auto-populate sync metadata fields from Essentia data:

```typescript
// When sync toggle is turned on, read from stored Essentia data:
const track = await prisma.track.findUnique({ where: { id: trackId } });

const syncMetadata = {
  genre: track.essentiaGenres?.[0]?.label ?? null,
  subgenre: track.essentiaGenres?.[1]?.label ?? null,
  mood: track.essentiaMoods?.slice(0, 3).map(m => m.label) ?? [],
  instruments: track.essentiaInstruments?.map(i => i.label) ?? [],
  bpm: track.bpm,
  key: track.musicalKey,
  isVocal: track.essentiaVoice === "vocal",
  voiceGender: track.essentiaVoiceGender,
  danceability: track.essentiaDanceability,
  energy: track.audioFeatures?.energy,
  timbre: track.essentiaTimbre,
};
```

The artist sees pre-populated tags when they enable sync — they can edit or add to them, but they don't start from scratch. Music supervisors get accurate, ML-powered metadata instead of artist self-reported guesses.

This replaces the need for Cyanite entirely for the auto-tagging use case. Claude still generates the editorial descriptions (usage scenarios, similar artists, lyric themes) from this data.

Commit.

---

## STEP 8: Feed Essentia Data to Cover Art Studio

Search the codebase for where the Cover Art Studio constructs its prompt for image generation.

Add Essentia data to the prompt context so the generated cover art matches the music:

```typescript
// When generating cover art, include audio intelligence:
const track = await prisma.track.findUnique({ where: { id: trackId } });

const musicContext = [];
if (track.essentiaGenres?.length) {
  musicContext.push(`Genre: ${track.essentiaGenres[0].label}`);
}
if (track.essentiaMoods?.length) {
  musicContext.push(`Mood: ${track.essentiaMoods.slice(0, 2).map(m => m.label).join(", ")}`);
}
if (track.essentiaTimbre) {
  musicContext.push(`Timbre: ${track.essentiaTimbre}`);
}

// Append to the cover art generation prompt:
// "This track is [genre], with a [mood] mood and [bright/dark] timbre.
//  The cover art should visually reflect these qualities."
```

A dark aggressive trap track gets cover art with dark tones, hard edges, and intense imagery. A bright pop track gets vibrant colors and clean design. The cover art matches the music automatically.

Commit.

---

## STEP 9: Feed Essentia Data to Mix & Master

Search for where the Mix & Master tool analyzes input audio or constructs processing instructions.

Essentia's instrument detection tells the mastering pipeline what's in the mix:

```typescript
// If Essentia detected heavy 808s and synths → emphasize sub-bass clarity
// If Essentia detected acoustic guitar and vocals → emphasize mid-range warmth
// If Essentia detected drums and bass → emphasize punch and transient clarity

const instruments = track.essentiaInstruments?.map(i => i.label) ?? [];
const timbre = track.essentiaTimbre;

const masteringHints = {
  hasBass808: instruments.some(i => i.includes("bass") || i.includes("808")),
  hasAcoustic: instruments.some(i => i.includes("acoustic")),
  hasSynth: instruments.some(i => i.includes("synth")),
  hasVocals: track.essentiaVoice === "vocal",
  isDark: timbre === "dark",
  isBright: timbre === "bright",
};
```

Pass these hints to Claude when it constructs the mastering chain. Claude can make smarter EQ, compression, and limiting decisions when it knows what instruments are in the mix.

Commit.

---

## STEP 10: Feed Essentia Data to Lyric Video

Search for where the Lyric Video tool constructs its visual parameters.

Essentia data drives the visual treatment:

```typescript
// Mood → color palette
// "aggressive" / "dark" → dark backgrounds, red/orange accents, bold fonts
// "happy" / "bright" → light backgrounds, pastel colors, rounded fonts
// "melancholic" / "sad" → muted blue/purple tones, thin elegant fonts
// "relaxed" / "chill" → soft gradients, gentle animations

// Energy arc → animation intensity
// High energy sections → faster text animations, bigger font size, more movement
// Low energy sections → slower reveals, smaller text, subtle fades

// Genre → typography style
// "hip-hop" / "trap" → bold, all-caps, urban fonts
// "classical" / "jazz" → serif, elegant, minimal
// "electronic" / "edm" → futuristic, neon, geometric
// "pop" → clean, modern, sans-serif
```

This logic can be implemented as a style mapper that takes Essentia data and returns visual parameters for the Lyric Video composition.

Commit.

---

## STEP 11: Backfill Existing Tracks

For tracks uploaded before this feature was added, create a backfill script that processes them through Essentia:

### File: `scripts/backfill-essentia.ts`

```typescript
import { prisma } from "@/lib/prisma";
import { analyzeWithEssentia } from "@/lib/audio/essentia-analysis";

async function backfill() {
  // Find tracks that haven't been analyzed by Essentia yet
  const tracks = await prisma.track.findMany({
    where: {
      essentiaAnalyzedAt: null,
      audioUrl: { not: null },
    },
    select: { id: true, audioUrl: true, title: true },
    take: 50, // process in batches
  });

  console.log(`Found ${tracks.length} tracks to analyze`);

  for (const track of tracks) {
    if (!track.audioUrl) continue;

    console.log(`Analyzing: ${track.title} (${track.id})`);

    const result = await analyzeWithEssentia(track.audioUrl);

    if (result) {
      await prisma.track.update({
        where: { id: track.id },
        data: {
          essentiaGenres: result.genres,
          essentiaMoods: result.moods,
          essentiaInstruments: result.instruments,
          essentiaDanceability: result.danceability,
          essentiaVoice: result.voice,
          essentiaVoiceGender: result.voiceGender,
          essentiaTimbre: result.timbre,
          essentiaAutoTags: result.autoTags,
          essentiaAnalyzedAt: new Date(),
        },
      });
      console.log(`  ✅ Done`);
    } else {
      console.log(`  ❌ Failed`);
    }

    // Rate limit — don't hammer Replicate
    await new Promise((r) => setTimeout(r, 2000));
  }
}

backfill().then(() => process.exit(0));
```

Run with: `npx ts-node scripts/backfill-essentia.ts`

This is optional and can run any time. Not a launch blocker.

Commit.

---

## VERIFICATION CHECKLIST

After all steps:
1. ✅ Essentia fields added to Track model in Prisma schema
2. ✅ Migration applied to database
3. ✅ `analyzeWithEssentia()` function calls Replicate `mtg/music-classifiers`
4. ✅ Essentia runs IN PARALLEL with Demucs and Whisper during track upload
5. ✅ If Essentia fails, track processing continues normally — never blocks
6. ✅ Audio Features calculation prefers Essentia ML data over math heuristics
7. ✅ Video Studio Director Agent receives genre, mood, instruments, timbre in context
8. ✅ Quick Mode receives the same Essentia context for auto-generated shot lists
9. ✅ Sync Ready auto-populates from Essentia data when toggle is enabled
10. ✅ Cover Art Studio receives mood/genre context for matching visuals
11. ✅ Mix & Master receives instrument/timbre hints for smarter processing
12. ✅ Lyric Video receives mood/genre for visual style matching
13. ✅ Backfill script exists for processing existing tracks
14. ✅ Dev server runs clean
15. ✅ No UI changes in this spec (UI updates are separate)

## DO NOT CHANGE
- The existing BPM, key, energy detection (keep as is)
- Any UI components (radar chart, badges — those are a separate spec)
- Pricing or payment logic
- The Replicate integration patterns for Demucs/Whisper (use the same patterns)
- Any other tool's core logic beyond adding Essentia context

## COST ANALYSIS

| Volume | Monthly Cost | Compared to Cyanite (€290/mo) |
|--------|-------------|-------------------------------|
| 100 tracks | $0.70 | 99.8% cheaper |
| 500 tracks | $3.50 | 98.8% cheaper |
| 1,000 tracks | $7.00 | 97.6% cheaper |
| 5,000 tracks | $35.00 | 87.9% cheaper |
| 10,000 tracks | $70.00 | 75.9% cheaper |

At any volume IndieThis would realistically hit in the first 1-2 years, Replicate + Essentia is dramatically cheaper than Cyanite. If volume exceeds 10,000 tracks/month, consider migrating to self-hosted Essentia on a Railway worker ($5/month flat) for $0/track.

## WHAT THIS ENABLES (NO ADDITIONAL COST)

| Tool | Before | After |
|------|--------|-------|
| Video Studio | Claude asks "what does your song sound like?" | Claude knows genre, mood, instruments — writes matching prompts automatically |
| Audio Features | Math-based guesses at genre/mood | Real ML classifications from trained models |
| Sync Ready | Empty fields artist fills manually | Pre-populated with accurate auto-tags |
| Cover Art | Generated from track title | Mood and genre drive visual style |
| Mix & Master | Generic processing | Instrument-aware mastering decisions |
| Lyric Video | Generic animation | Mood-driven colors, genre-matched typography |
| Explore / Discovery | Basic genre filter | Future: filter by mood, instruments, danceability |
