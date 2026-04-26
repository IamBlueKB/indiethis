# IndieThis — EffNet-Discogs Audio Intelligence

_For Claude Code (Sonnet). This replaces ALL previous audio ML classification attempts (VGGish, rule-based inference, Claude guessing from spectral math). One model, one approach, no external APIs, no cost. Build in order. Commit after each step._

---

## WHAT THIS IS

EffNet-Discogs is a pre-trained ML model from Essentia/MTG that classifies music into 400 styles from the Discogs taxonomy. It was trained on over 2 million tracks. It's 18MB — small enough to bundle directly in a Vercel TypeScript function alongside your existing code.

On top of the base EffNet-Discogs embedding model, there are small transfer learning classifier models (2-5MB each) for specific tasks: genre, mood, instruments, danceability, voice detection. They all run on the same embeddings — compute once, classify many.

Total size: ~43MB (essentia.js WASM + TensorFlow.js + all models). Well under Vercel's 250MB function bundle limit.

Cost: $0. Runs locally in the Vercel function. No API calls, no Replicate, no external service.

---

## WHAT THIS REPLACES

Remove or disable ALL of the following:
- `essentia-vggish.ts` — delete this file entirely, VGGish models are 404 and will never work
- Any rule-based genre/mood inference that uses spectral centroid, ZCR, or RMS to guess classifications
- Any Replicate calls to `mtg/music-classifiers` or `mtg/effnet-discogs`
- Any Claude prompt that asks Claude to infer genre/mood from BPM/key/energy numbers
- The `extractLocalFeatures()` function in `essentia-local.ts` if it only does spectral math for classification (keep the BPM/key/energy detection parts — those work and stay)

Do NOT remove:
- BPM detection via RhythmExtractor2013 — this works and stays
- Key detection via KeyExtractor — this works and stays
- Energy detection via RMS — this works and stays
- Song structure analysis via Claude — this works and stays
- Lyrics/transcription via Whisper — this works and stays
- Stem separation via Demucs — this works and stays

---

## RULES

- This runs in TypeScript on Vercel using essentia.js WASM + TensorFlow.js
- No Python functions
- No external API calls
- No Replicate
- No model files downloaded at runtime — they are bundled in the deployment
- The model files live in the project repo (they're small enough)
- Analysis runs ONCE per track, results stored permanently in the database
- If model loading or inference fails, fall back gracefully — the track still processes with BPM/key/energy

---

## STEP 1: Download and Store Model Files

### Get the model files

The EffNet-Discogs models are hosted at `essentia.upf.edu`. The directory listings work even though some individual file downloads have been unreliable. Download these files and commit them to the repo:

**Base embedding model (required):**
```
https://essentia.upf.edu/models/feature-extractors/discogs-effnet/discogs-effnet-bs64-1.pb
https://essentia.upf.edu/models/feature-extractors/discogs-effnet/discogs-effnet-bs64-1.json
```

**Transfer learning classifiers (each ~2-5MB):**
```
# Genre — 400 Discogs styles
https://essentia.upf.edu/models/music-style-classification/discogs-effnet/discogs-effnet-bs64-1.pb
https://essentia.upf.edu/models/music-style-classification/discogs-effnet/discogs-effnet-bs64-1.json

# Mood/Theme — MTG-Jamendo mood and theme tags
https://essentia.upf.edu/models/classification-heads/mtg_jamendo_moodtheme/mtg_jamendo_moodtheme-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/mtg_jamendo_moodtheme/mtg_jamendo_moodtheme-discogs-effnet-1.json

# Instruments — 40 instrument classes
https://essentia.upf.edu/models/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.json

# Danceability
https://essentia.upf.edu/models/classification-heads/danceability/danceability-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/danceability/danceability-discogs-effnet-1.json

# Voice/Instrumental
https://essentia.upf.edu/models/classification-heads/voice_instrumental/voice_instrumental-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/voice_instrumental/voice_instrumental-discogs-effnet-1.json

# Mood Aggressive
https://essentia.upf.edu/models/classification-heads/mood_aggressive/mood_aggressive-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/mood_aggressive/mood_aggressive-discogs-effnet-1.json

# Mood Happy
https://essentia.upf.edu/models/classification-heads/mood_happy/mood_happy-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/mood_happy/mood_happy-discogs-effnet-1.json

# Mood Sad
https://essentia.upf.edu/models/classification-heads/mood_sad/mood_sad-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/mood_sad/mood_sad-discogs-effnet-1.json

# Mood Relaxed
https://essentia.upf.edu/models/classification-heads/mood_relaxed/mood_relaxed-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/mood_relaxed/mood_relaxed-discogs-effnet-1.json

# Tonal/Atonal
https://essentia.upf.edu/models/classification-heads/tonal_atonal/tonal_atonal-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/tonal_atonal/tonal_atonal-discogs-effnet-1.json

# Voice Gender — male/female vocal detection
https://essentia.upf.edu/models/classification-heads/gender/gender-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/gender/gender-discogs-effnet-1.json

# Mood Electronic — electronic vs acoustic mood
https://essentia.upf.edu/models/classification-heads/mood_electronic/mood_electronic-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/mood_electronic/mood_electronic-discogs-effnet-1.json

# Timbre — bright vs dark (Nsynth)
https://essentia.upf.edu/models/classification-heads/nsynth_bright_dark/nsynth_bright_dark-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/nsynth_bright_dark/nsynth_bright_dark-discogs-effnet-1.json

# Acoustic/Electronic (Nsynth)
https://essentia.upf.edu/models/classification-heads/nsynth_acoustic_electronic/nsynth_acoustic_electronic-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/nsynth_acoustic_electronic/nsynth_acoustic_electronic-discogs-effnet-1.json

# Approachability — how accessible the track is
https://essentia.upf.edu/models/classification-heads/approachability/approachability_regression-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/approachability/approachability_regression-discogs-effnet-1.json

# Engagement — how engaging/captivating the track is
https://essentia.upf.edu/models/classification-heads/engagement/engagement_regression-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/engagement/engagement_regression-discogs-effnet-1.json

# Arousal/Valence — emotional intensity and positivity (continuous scale)
https://essentia.upf.edu/models/classification-heads/deam/deam-discogs-effnet-1.pb
https://essentia.upf.edu/models/classification-heads/deam/deam-discogs-effnet-1.json
```

**NOTE:** The exact URL paths for some classifiers may differ. If a URL returns 404, check the parent directory listing at `https://essentia.upf.edu/models/classification-heads/` to find the correct filename. Some models use slightly different naming conventions (e.g., `_regression` suffix for continuous-scale models).

### IMPORTANT: If any download returns a 404 or HTML instead of a binary file, try these alternatives:

1. Check the Replicate demo repo for cached copies: `https://github.com/MTG/essentia-replicate-demos`
2. Check the EssentiaAI-Music-Analyzer repo: `https://github.com/YiZhang5643/EssentiaAI-Music-Analyzer`
3. Use the ONNX format (`.onnx`) instead of `.pb` if available — TensorFlow.js can convert ONNX models

### Store location

Create a directory in the project:
```
models/
  effnet-discogs/
    discogs-effnet-bs64-1.pb          (base embedding model ~18MB)
    discogs-effnet-bs64-1.json        (400 style labels)
    mtg_jamendo_moodtheme-discogs-effnet-1.pb
    mtg_jamendo_moodtheme-discogs-effnet-1.json
    mtg_jamendo_instrument-discogs-effnet-1.pb
    mtg_jamendo_instrument-discogs-effnet-1.json
    danceability-discogs-effnet-1.pb
    danceability-discogs-effnet-1.json
    voice_instrumental-discogs-effnet-1.pb
    voice_instrumental-discogs-effnet-1.json
    mood_aggressive-discogs-effnet-1.pb
    mood_aggressive-discogs-effnet-1.json
    mood_happy-discogs-effnet-1.pb
    mood_happy-discogs-effnet-1.json
    mood_sad-discogs-effnet-1.pb
    mood_sad-discogs-effnet-1.json
    mood_relaxed-discogs-effnet-1.pb
    mood_relaxed-discogs-effnet-1.json
    tonal_atonal-discogs-effnet-1.pb
    tonal_atonal-discogs-effnet-1.json
    gender-discogs-effnet-1.pb
    gender-discogs-effnet-1.json
    mood_electronic-discogs-effnet-1.pb
    mood_electronic-discogs-effnet-1.json
    nsynth_bright_dark-discogs-effnet-1.pb
    nsynth_bright_dark-discogs-effnet-1.json
    nsynth_acoustic_electronic-discogs-effnet-1.pb
    nsynth_acoustic_electronic-discogs-effnet-1.json
    approachability_regression-discogs-effnet-1.pb
    approachability_regression-discogs-effnet-1.json
    engagement_regression-discogs-effnet-1.pb
    engagement_regression-discogs-effnet-1.json
    deam-discogs-effnet-1.pb
    deam-discogs-effnet-1.json
```

### CRITICAL: Converting .pb to TensorFlow.js format

The `.pb` files are frozen TensorFlow 1.x graphs. TensorFlow.js cannot load `.pb` files directly — they must be converted to the TensorFlow.js format (`model.json` + `.bin` weight shards).

To convert, use the `tensorflowjs_converter` tool:

```bash
pip install tensorflowjs

# For each .pb model:
tensorflowjs_converter \
  --input_format=tf_frozen_model \
  --output_format=tfjs_graph_model \
  --output_node_names='PartitionedCall' \
  ./discogs-effnet-bs64-1.pb \
  ./discogs-effnet-bs64-tfjs/
```

The `--output_node_names` value varies per model — check the `.json` metadata file for each model. Look for the `schema.outputs[0].name` field.

After conversion, each model becomes a folder containing `model.json` and one or more `.bin` weight shard files. Store these converted folders in the `models/effnet-discogs/` directory.

See the essentia.js wiki for detailed conversion instructions: `https://github.com/MTG/essentia.js/wiki/Converting-Essentia-TensorFlow-Models`

Commit all model files.

---

## STEP 2: Create the EffNet-Discogs Analysis Module

Create `src/lib/audio/effnet-discogs.ts`:

```typescript
import * as tf from "@tensorflow/tfjs-node";
import { Essentia, EssentiaWASM } from "essentia.js";
import { EssentiaModel } from "essentia.js/dist/essentia.js-model";
import path from "path";

// Model paths — bundled in the deployment
const MODELS_DIR = path.join(process.cwd(), "models", "effnet-discogs");

// Cache loaded models so they persist across requests (warm function)
let embeddingModel: any = null;
let classifiers: Record<string, any> = {};
let essentia: any = null;
let extractor: any = null;

export interface EffnetAnalysisResult {
  genres: { label: string; score: number }[];       // top Discogs styles (400 classes)
  moods: { label: string; score: number }[];         // aggressive, happy, sad, relaxed, electronic + themes (56 classes)
  instruments: { label: string; score: number }[];   // 40 instrument classes
  danceability: number;                               // 0-1
  isVocal: boolean;                                   // true if vocals detected
  voiceGender: "male" | "female" | null;              // male/female vocal detection
  isTonal: boolean;                                   // true if tonal (vs atonal)
  timbre: "bright" | "dark" | null;                   // Nsynth bright/dark
  isAcoustic: boolean;                                // true if acoustic, false if electronic
  isElectronicMood: boolean;                           // electronic mood feel
  arousal: number;                                     // 0-1 emotional intensity
  valence: number;                                     // 0-1 positivity (1=positive, 0=negative)
  approachability: number;                             // 0-1 how accessible the track is
  engagement: number;                                  // 0-1 how captivating the track is
}

async function initializeModels(): Promise<void> {
  if (embeddingModel) return; // already loaded

  // Initialize essentia.js WASM
  const wasmModule = await EssentiaWASM();
  essentia = new Essentia(wasmModule);
  
  // Create feature extractor for EffNet input format
  extractor = new EssentiaModel.EssentiaTFInputExtractor(wasmModule, "musicnn");
  // NOTE: EffNet uses the same mel-spectrogram input as MusiCNN
  // If this doesn't work, try "vggish" extractor type instead
  // The correct extractor type may need verification — check essentia.js docs
  
  // Load embedding model
  const embeddingModelPath = path.join(MODELS_DIR, "discogs-effnet-bs64-tfjs", "model.json");
  embeddingModel = await tf.loadGraphModel(`file://${embeddingModelPath}`);
  
  // Load classifier models
  const classifierNames = [
    "mtg_jamendo_moodtheme",
    "mtg_jamendo_instrument", 
    "danceability",
    "voice_instrumental",
    "mood_aggressive",
    "mood_happy",
    "mood_sad",
    "mood_relaxed",
    "mood_electronic",
    "tonal_atonal",
    "gender",
    "nsynth_bright_dark",
    "nsynth_acoustic_electronic",
    "approachability_regression",
    "engagement_regression",
    "deam",
  ];
  
  for (const name of classifierNames) {
    const modelPath = path.join(MODELS_DIR, `${name}-discogs-effnet-tfjs`, "model.json");
    try {
      classifiers[name] = await tf.loadGraphModel(`file://${modelPath}`);
    } catch (err) {
      console.warn(`[effnet] Failed to load classifier: ${name}`, err);
    }
  }
  
  console.log(`[effnet] Models loaded. Classifiers: ${Object.keys(classifiers).join(", ")}`);
}

export async function analyzeWithEffnet(audioBuffer: Float32Array, sampleRate: number = 16000): Promise<EffnetAnalysisResult | null> {
  try {
    await initializeModels();

    // Step 1: Extract mel-spectrogram features using essentia.js
    const features = extractor.computeFrameWise(audioBuffer, 256);

    // Step 2: Get embeddings from the base EffNet model
    const inputTensor = tf.tensor(features).expandDims(0);
    const embeddings = embeddingModel.predict(inputTensor);
    
    // Step 3: Run each classifier on the embeddings
    const result: EffnetAnalysisResult = {
      genres: [],
      moods: [],
      instruments: [],
      danceability: 0.5,
      isVocal: true,
      voiceGender: null,
      isTonal: true,
      timbre: null,
      isAcoustic: false,
      isElectronicMood: false,
      arousal: 0.5,
      valence: 0.5,
      approachability: 0.5,
      engagement: 0.5,
    };

    // Genre — 400 Discogs styles
    // The genre classifier may be the embedding model itself (discogs-effnet outputs style predictions directly)
    // Read the JSON metadata file to get the 400 style labels
    const genreLabelsPath = path.join(MODELS_DIR, "discogs-effnet-bs64-1.json");
    const genreMetadata = JSON.parse(require("fs").readFileSync(genreLabelsPath, "utf-8"));
    const genreLabels: string[] = genreMetadata.classes || [];
    
    // Average predictions across time frames
    const genrePredictions = embeddings.mean(0);
    const genreScores = await genrePredictions.data();
    
    result.genres = genreLabels
      .map((label: string, i: number) => ({ label, score: genreScores[i] }))
      .filter((g: any) => g.score > 0.05)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 10);

    // Mood/Theme
    if (classifiers["mtg_jamendo_moodtheme"]) {
      const moodPred = classifiers["mtg_jamendo_moodtheme"].predict(embeddings);
      const moodScores = await moodPred.mean(0).data();
      const moodMetadata = JSON.parse(
        require("fs").readFileSync(
          path.join(MODELS_DIR, "mtg_jamendo_moodtheme-discogs-effnet-1.json"), "utf-8"
        )
      );
      const moodLabels: string[] = moodMetadata.classes || [];
      const moodResults = moodLabels
        .map((label: string, i: number) => ({ label, score: moodScores[i] }))
        .filter((m: any) => m.score > 0.1)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 5);
      result.moods.push(...moodResults);
    }

    // Individual mood classifiers (aggressive, happy, sad, relaxed)
    for (const moodType of ["mood_aggressive", "mood_happy", "mood_sad", "mood_relaxed"]) {
      if (classifiers[moodType]) {
        const pred = classifiers[moodType].predict(embeddings);
        const scores = await pred.mean(0).data();
        const label = moodType.replace("mood_", "");
        if (scores[0] > 0.3 || scores[1] > 0.3) {
          // Binary classifier — index 0 is typically the positive class
          // Check the metadata JSON to confirm which index is which
          result.moods.push({ label, score: Math.max(scores[0], scores[1]) });
        }
      }
    }

    // Deduplicate and sort moods
    const seenMoods = new Set<string>();
    result.moods = result.moods.filter((m) => {
      if (seenMoods.has(m.label)) return false;
      seenMoods.add(m.label);
      return true;
    }).sort((a, b) => b.score - a.score).slice(0, 5);

    // Instruments — 40 classes
    if (classifiers["mtg_jamendo_instrument"]) {
      const instrPred = classifiers["mtg_jamendo_instrument"].predict(embeddings);
      const instrScores = await instrPred.mean(0).data();
      const instrMetadata = JSON.parse(
        require("fs").readFileSync(
          path.join(MODELS_DIR, "mtg_jamendo_instrument-discogs-effnet-1.json"), "utf-8"
        )
      );
      const instrLabels: string[] = instrMetadata.classes || [];
      result.instruments = instrLabels
        .map((label: string, i: number) => ({ label, score: instrScores[i] }))
        .filter((inst: any) => inst.score > 0.1)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);
    }

    // Danceability
    if (classifiers["danceability"]) {
      const dancePred = classifiers["danceability"].predict(embeddings);
      const danceScores = await dancePred.mean(0).data();
      result.danceability = danceScores[0]; // check metadata for correct index
    }

    // Voice/Instrumental
    if (classifiers["voice_instrumental"]) {
      const voicePred = classifiers["voice_instrumental"].predict(embeddings);
      const voiceScores = await voicePred.mean(0).data();
      // Check metadata — typically index 0 = instrumental, index 1 = vocal (or vice versa)
      result.isVocal = voiceScores[1] > voiceScores[0]; // verify with metadata
    }

    // Tonal/Atonal
    if (classifiers["tonal_atonal"]) {
      const tonalPred = classifiers["tonal_atonal"].predict(embeddings);
      const tonalScores = await tonalPred.mean(0).data();
      result.isTonal = tonalScores[0] > tonalScores[1]; // verify with metadata
    }

    // Voice Gender — male/female
    if (classifiers["gender"]) {
      const genderPred = classifiers["gender"].predict(embeddings);
      const genderScores = await genderPred.mean(0).data();
      // Check metadata for class order — typically [female, male] or [male, female]
      const genderMetadata = JSON.parse(
        require("fs").readFileSync(
          path.join(MODELS_DIR, "gender-discogs-effnet-1.json"), "utf-8"
        )
      );
      const genderLabels: string[] = genderMetadata.classes || ["female", "male"];
      const maleIdx = genderLabels.indexOf("male");
      const femaleIdx = genderLabels.indexOf("female");
      if (result.isVocal && Math.max(genderScores[maleIdx], genderScores[femaleIdx]) > 0.6) {
        result.voiceGender = genderScores[maleIdx] > genderScores[femaleIdx] ? "male" : "female";
      }
    }

    // Mood Electronic
    if (classifiers["mood_electronic"]) {
      const elecPred = classifiers["mood_electronic"].predict(embeddings);
      const elecScores = await elecPred.mean(0).data();
      result.isElectronicMood = elecScores[0] > 0.5; // verify index with metadata
      if (elecScores[0] > 0.3) {
        result.moods.push({ label: "electronic", score: elecScores[0] });
      }
    }

    // Timbre — bright/dark (Nsynth)
    if (classifiers["nsynth_bright_dark"]) {
      const timbrePred = classifiers["nsynth_bright_dark"].predict(embeddings);
      const timbreScores = await timbrePred.mean(0).data();
      // Check metadata for class order
      const bright = timbreScores[0]; // verify with metadata
      const dark = timbreScores[1];   // verify with metadata
      if (Math.abs(bright - dark) > 0.2) {
        result.timbre = bright > dark ? "bright" : "dark";
      }
    }

    // Acoustic/Electronic (Nsynth)
    if (classifiers["nsynth_acoustic_electronic"]) {
      const acPred = classifiers["nsynth_acoustic_electronic"].predict(embeddings);
      const acScores = await acPred.mean(0).data();
      result.isAcoustic = acScores[0] > acScores[1]; // verify with metadata
    }

    // Approachability (regression — continuous 0-1)
    if (classifiers["approachability_regression"]) {
      const apprPred = classifiers["approachability_regression"].predict(embeddings);
      const apprScores = await apprPred.mean(0).data();
      result.approachability = Math.max(0, Math.min(1, apprScores[0]));
    }

    // Engagement (regression — continuous 0-1)
    if (classifiers["engagement_regression"]) {
      const engPred = classifiers["engagement_regression"].predict(embeddings);
      const engScores = await engPred.mean(0).data();
      result.engagement = Math.max(0, Math.min(1, engScores[0]));
    }

    // Arousal/Valence (DEAM — continuous scale)
    if (classifiers["deam"]) {
      const deamPred = classifiers["deam"].predict(embeddings);
      const deamScores = await deamPred.mean(0).data();
      // DEAM typically returns [valence, arousal] in range [1, 9]
      // Normalize to 0-1
      result.valence = Math.max(0, Math.min(1, (deamScores[0] - 1) / 8));
      result.arousal = Math.max(0, Math.min(1, (deamScores[1] - 1) / 8));
    }

    // Clean up tensors
    inputTensor.dispose();
    if (embeddings.dispose) embeddings.dispose();

    console.log("[effnet] Analysis complete:", {
      topGenre: result.genres[0]?.label,
      topMood: result.moods[0]?.label,
      topInstrument: result.instruments[0]?.label,
      danceability: result.danceability,
      isVocal: result.isVocal,
      voiceGender: result.voiceGender,
      timbre: result.timbre,
      isAcoustic: result.isAcoustic,
      arousal: result.arousal,
      valence: result.valence,
      approachability: result.approachability,
      engagement: result.engagement,
    });

    return result;
  } catch (error) {
    console.error("[effnet] Analysis failed:", error);
    return null;
  }
}
```

### CRITICAL NOTES:

1. **Verify the extractor type.** EffNet may use a different mel-spectrogram configuration than MusiCNN. Check the essentia.js docs and the model metadata JSON files. If `"musicnn"` extractor doesn't produce correct results, try `"vggish"` or implement custom mel-spectrogram extraction matching the parameters in the model's training config.

2. **Verify classifier output indices.** Binary classifiers (mood_aggressive, voice_instrumental, etc.) have two outputs. Which index corresponds to which class varies per model. Read each model's `.json` metadata file — it lists the class names and their order.

3. **The embedding model may output style predictions directly.** The `discogs-effnet-bs64-1.pb` model's output may already be the 400 style activations, not raw embeddings. In that case you don't need a separate genre classifier — the base model IS the genre classifier. Check by inspecting the output tensor shape: if it's [batch, 400], it's direct style predictions.

4. **Test with the Razor's Edge audio file.** The expected output should include: genre tags related to trap/hip-hop/electronic, mood tags like aggressive/dark, instruments like synthesizer/drums/bass. If you get unrelated results (classical, happy, acoustic guitar), the feature extraction is wrong — recheck the mel-spectrogram parameters.

Commit.

---

## STEP 3: Wire into Song Analysis Pipeline

Open `src/lib/video-studio/song-analyzer.ts`. Find the `analyzeSong` function.

### Add EffNet analysis to the pipeline

After the existing BPM/key/energy detection runs, add the EffNet analysis:

```typescript
import { analyzeWithEffnet, EffnetAnalysisResult } from "@/lib/audio/effnet-discogs";

// Inside analyzeSong(), after BPM/key/energy are detected:

let effnetResult: EffnetAnalysisResult | null = null;

try {
  // The audio should already be decoded at this point for BPM detection
  // Reuse the same decoded audio buffer
  // EffNet expects 16kHz mono audio — resample if needed
  effnetResult = await analyzeWithEffnet(audioBuffer, 16000);
} catch (err) {
  console.error("[analyzeSong] EffNet analysis failed, continuing without it:", err);
}
```

### Store EffNet results in the SongAnalysis object

Add the EffNet data to the `SongAnalysis` return object:

```typescript
const analysis: SongAnalysis = {
  bpm,
  key,
  energy,
  duration,
  lyrics,
  lyricTimestamps,
  sections,
  beats,
  dropPoints,
  
  // EffNet ML classifications
  genres: effnetResult?.genres ?? null,
  moods: effnetResult?.moods ?? null,
  instruments: effnetResult?.instruments ?? null,
  danceability: effnetResult?.danceability ?? null,
  vocalType: effnetResult?.isVocal ? "vocal" : "instrumental",
  voiceGender: effnetResult?.voiceGender ?? null,
  isTonal: effnetResult?.isTonal ?? null,
  timbre: effnetResult?.timbre ?? null,
  isAcoustic: effnetResult?.isAcoustic ?? null,
  arousal: effnetResult?.arousal ?? null,
  valence: effnetResult?.valence ?? null,
  approachability: effnetResult?.approachability ?? null,
  engagement: effnetResult?.engagement ?? null,
};
```

### Update the SongAnalysis type

Make sure the `SongAnalysis` interface includes these fields:

```typescript
interface SongAnalysis {
  // ... existing fields ...
  
  genres: { label: string; score: number }[] | null;
  moods: { label: string; score: number }[] | null;
  instruments: { label: string; score: number }[] | null;
  danceability: number | null;
  vocalType: "vocal" | "instrumental" | null;
  voiceGender: "male" | "female" | null;
  isTonal: boolean | null;
  timbre: "bright" | "dark" | null;
  isAcoustic: boolean | null;
  arousal: number | null;          // 0-1 emotional intensity
  valence: number | null;          // 0-1 positivity
  approachability: number | null;  // 0-1 accessibility
  engagement: number | null;       // 0-1 captivation
}
```

This data gets stored in the `songStructure` JSON field on the MusicVideo record, which the Director chat route already reads and passes to Claude.

Commit.

---

## STEP 4: Update Claude's Context Formatting

Open the Director chat route (wherever Claude's system prompt is constructed). Find the `buildEssentiaContext` or `formatEssentiaContext` function (created in earlier specs).

Make sure it reads the new field names from the `songStructure` object:

```typescript
function formatAudioIntelligence(songStructure: any): string {
  const parts: string[] = [];

  if (songStructure.genres?.length) {
    const genreStr = songStructure.genres
      .slice(0, 5)
      .map((g: any) => `${g.label} (${Math.round(g.score * 100)}%)`)
      .join(", ");
    parts.push(`Genre: ${genreStr}`);
  }

  if (songStructure.moods?.length) {
    const moodStr = songStructure.moods
      .slice(0, 5)
      .map((m: any) => `${m.label} (${Math.round(m.score * 100)}%)`)
      .join(", ");
    parts.push(`Mood: ${moodStr}`);
  }

  if (songStructure.instruments?.length) {
    const instrStr = songStructure.instruments
      .slice(0, 8)
      .map((i: any) => i.label)
      .join(", ");
    parts.push(`Instruments: ${instrStr}`);
  }

  if (songStructure.danceability != null) {
    parts.push(`Danceability: ${(songStructure.danceability * 100).toFixed(0)}%`);
  }

  if (songStructure.vocalType) {
    const vocalStr = songStructure.voiceGender 
      ? `${songStructure.vocalType} (${songStructure.voiceGender})`
      : songStructure.vocalType;
    parts.push(`Vocals: ${vocalStr}`);
  }

  if (songStructure.timbre) {
    parts.push(`Timbre: ${songStructure.timbre}`);
  }

  if (songStructure.isAcoustic != null) {
    parts.push(`Sound: ${songStructure.isAcoustic ? "acoustic" : "electronic production"}`);
  }

  if (songStructure.isTonal != null) {
    parts.push(`Tonality: ${songStructure.isTonal ? "tonal" : "atonal"}`);
  }

  if (songStructure.arousal != null && songStructure.valence != null) {
    const arousalDesc = songStructure.arousal > 0.7 ? "high intensity" 
      : songStructure.arousal > 0.4 ? "moderate intensity" : "low intensity";
    const valenceDesc = songStructure.valence > 0.6 ? "positive" 
      : songStructure.valence > 0.4 ? "neutral" : "negative/dark";
    parts.push(`Emotional character: ${arousalDesc}, ${valenceDesc}`);
  }

  if (songStructure.approachability != null) {
    parts.push(`Approachability: ${(songStructure.approachability * 100).toFixed(0)}%`);
  }

  if (songStructure.engagement != null) {
    parts.push(`Engagement: ${(songStructure.engagement * 100).toFixed(0)}%`);
  }

  if (parts.length === 0) return "";
  
  return `\nAudio Intelligence:\n${parts.join("\n")}`;
}
```

Claude now receives something like:

```
You have analyzed "Razor's Edge" and determined:
BPM: 140, Key: F minor, Energy: 0.71

Audio Intelligence:
Genre: Trap (89%), Hip-Hop (76%), Electronic (52%), Dark Ambient (31%)
Mood: aggressive (92%), dark (85%), energetic (61%)
Instruments: synthesizer, drums, bass, hi-hats, percussion, pad
Danceability: 41%
Vocals: instrumental
Timbre: dark
Sound: electronic production
Tonality: tonal
Emotional character: high intensity, negative/dark
Approachability: 35%
Engagement: 78%
```

Commit.

---

## STEP 5: Wire into Track Upload Pipeline (Platform-Wide)

The EffNet analysis should also run when tracks are uploaded through the regular Track upload flow (not just the Video Studio). This powers the Audio Features radar, Sync Ready, Cover Art, and Lyric Video tools.

Search the codebase for where tracks are uploaded and processed (where Demucs/Whisper are called). Add the EffNet analysis in parallel:

```typescript
import { analyzeWithEffnet } from "@/lib/audio/effnet-discogs";

// Run alongside Demucs and Whisper:
const [demucsResult, whisperResult, effnetResult] = await Promise.allSettled([
  runDemucs(audioUrl),
  runWhisper(audioUrl),
  analyzeTrackWithEffnet(audioUrl), // new
]);

// Store results on the Track record
if (effnetResult.status === "fulfilled" && effnetResult.value) {
  const effnet = effnetResult.value;
  await prisma.track.update({
    where: { id: trackId },
    data: {
      essentiaGenres: effnet.genres,
      essentiaMoods: effnet.moods,
      essentiaInstruments: effnet.instruments,
      essentiaDanceability: effnet.danceability,
      essentiaVoice: effnet.isVocal ? "vocal" : "instrumental",
      essentiaTimbre: null, // EffNet doesn't have a timbre classifier — remove or keep null
      essentiaAnalyzedAt: new Date(),
    },
  });
}
```

### Helper function to download and decode audio for EffNet:

```typescript
async function analyzeTrackWithEffnet(audioUrl: string): Promise<EffnetAnalysisResult | null> {
  // Download audio
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  
  // Decode to 16kHz mono Float32Array
  // Use the same audio decoding approach as detectAudioFeatures
  // Search for how audio is decoded in audio-analysis.ts and reuse that pattern
  const audioBuffer = await decodeAndResample(arrayBuffer, 16000);
  
  return analyzeWithEffnet(audioBuffer, 16000);
}
```

If EffNet fails, the track still processes normally. EffNet data is bonus intelligence, never a blocker.

Commit.

---

## STEP 6: Update Audio Features Calculation

Open `src/lib/audio-features.ts`. Update the genre/mood/vocal classification to prefer EffNet ML data over math heuristics:

```typescript
// Genre: prefer EffNet classification
let genre: string;
if (track.essentiaGenres && Array.isArray(track.essentiaGenres) && (track.essentiaGenres as any[]).length > 0) {
  genre = (track.essentiaGenres as any[])[0].label;
} else {
  genre = /* existing math-based fallback */;
}

// Mood: prefer EffNet classification
let mood: string;
if (track.essentiaMoods && Array.isArray(track.essentiaMoods) && (track.essentiaMoods as any[]).length > 0) {
  mood = (track.essentiaMoods as any[])[0].label;
} else {
  mood = /* existing math-based fallback */;
}

// Vocal: prefer EffNet classification
let isVocal: boolean;
if (track.essentiaVoice) {
  isVocal = track.essentiaVoice === "vocal";
} else {
  isVocal = /* existing math-based fallback */;
}

// Danceability: prefer EffNet
let danceability: number;
if (track.essentiaDanceability != null) {
  danceability = track.essentiaDanceability;
} else {
  danceability = /* existing math-based fallback */;
}
```

Tracks analyzed before EffNet still work with the old math-based features. New tracks get real ML classifications.

Commit.

---

## STEP 7: Clean Up Dead Code

Remove all code that is no longer used:

1. **Delete `src/lib/audio/essentia-vggish.ts`** — VGGish is dead, models are 404
2. **Delete any VGGish model download URLs** — they will never work
3. **Remove the rule-based genre/mood classifier** if one was created as a temporary fallback
4. **Remove any `extractLocalFeatures()` code** that uses spectral centroid, ZCR, or RMS to guess genre/mood (keep the BPM/key/energy detection functions — those are separate and work)
5. **Remove any Replicate calls** to `mtg/music-classifiers` or `mtg/effnet-discogs` from the audio analysis pipeline
6. **Remove the VGGish test route** (`/api/test/essentia-local` or similar) if one was created

Search the codebase for any remaining references to "vggish", "spectral centroid for genre", "rule-based classifier", or "replicate.*music-classifiers" and clean them up.

Do NOT remove:
- The Replicate integration for Demucs and Whisper — those are separate and stay
- BPM detection (RhythmExtractor2013)
- Key detection (KeyExtractor)
- Energy detection (RMS)
- Any database schema fields (essentiaGenres, essentiaMoods, etc.) — those stay

Commit.

---

## STEP 8: Test with Razor's Edge

This is not optional. Before marking this done, verify the full pipeline works:

1. Start a new Video Studio Director Mode session with Razor's Edge
2. Wait for analysis to complete (the loading gate should show "Analyzing your track...")
3. When the chat loads, Claude's first message should reference specific genre, mood, and instrument data from EffNet — NOT generic "120 BPM, C major" defaults
4. The genre should include trap/hip-hop related styles
5. The mood should include aggressive/dark
6. The instruments should include synthesizer, drums, bass, or similar electronic production elements

If Claude still shows generic data or says "I don't know what this track sounds like":
- Check Vercel function logs for `[effnet]` log messages
- Check if the model files were bundled in the deployment (check deployment size)
- Check if `songStructure` in the database contains the EffNet fields
- Check if the chat route is reading and formatting those fields

Do not move on until this test passes.

---

## VERIFICATION CHECKLIST

1. ✅ EffNet-Discogs base model + ALL classifier models downloaded and converted to TensorFlow.js format
2. ✅ Model files committed to repo in `models/effnet-discogs/`
3. ✅ `effnet-discogs.ts` module loads all 16 models (1 base + 15 classifiers) and runs inference
4. ✅ Models are cached in memory across requests (no reload per request)
5. ✅ `analyzeSong` in song-analyzer.ts calls EffNet and stores results in songStructure
6. ✅ Director chat route formats ALL EffNet data for Claude's system prompt — genre, mood, instruments, danceability, vocals, voice gender, timbre, acoustic/electronic, arousal/valence, approachability, engagement
7. ✅ Claude's first message references real genre/mood/instrument data
8. ✅ Track upload pipeline runs EffNet in parallel with Demucs/Whisper
9. ✅ Audio Features calculation prefers EffNet data over math heuristics
10. ✅ All VGGish code removed
11. ✅ All rule-based classification code removed
12. ✅ No Replicate calls in the audio analysis pipeline
13. ✅ Graceful fallback if EffNet fails — track still processes normally
14. ✅ Razor's Edge test passes — Claude knows it's dark trap with 808s
15. ✅ Voice gender detection works for vocal tracks
16. ✅ Timbre (bright/dark) detection works
17. ✅ Arousal/valence emotional mapping works
18. ✅ Approachability and engagement scores populate
19. ✅ Acoustic/electronic classification works
20. ✅ Deployment size under 250MB
21. ✅ Dev server runs clean

## DO NOT CHANGE
- BPM detection (RhythmExtractor2013)
- Key detection (KeyExtractor)
- Energy detection (RMS)
- Song structure analysis (Claude)
- Lyrics/transcription (Whisper via Replicate)
- Stem separation (Demucs via Replicate)
- Any UI components
- Any pricing or payment logic
- The Director Agent system prompt content (camera vocabulary, style modifiers, etc.)
- Database schema fields for Essentia data

---

## CRITICAL IMPLEMENTATION NOTES — READ BEFORE CODING

These are things that WILL break the build if not handled. Sonnet must address every one.

### 1. DO NOT convert .pb files manually — use pre-converted tfjs models

The essentia.js GitHub repo already has a working Discogs EffNet demo with pre-converted TensorFlow.js model files at:
```
https://github.com/MTG/essentia.js/tree/master/examples/demos/discogs-autotagging
```

Clone that demo's model files. They are already in tfjs format (`model.json` + `.bin` shards). This eliminates any need for Python, `tensorflowjs_converter`, or `.pb` file downloads from the broken `essentia.upf.edu` server.

If the demo only has the base Discogs model (400 styles), the transfer learning classifier `.pb` files may still need conversion. In that case, check if the classifier models have `.onnx` versions available (many do from the directory listings). ONNX can be converted to tfjs using `@xenova/transformers` or `onnxruntime-node` as an alternative runtime.

### 2. EffNet input pipeline is NOT the same as MusiCNN or VGGish

Do NOT use `EssentiaTFInputExtractor(wasmModule, "musicnn")` for EffNet models. EffNet-Discogs uses a different mel-spectrogram configuration:
- Sample rate: 16000 Hz
- Frame size: 400 samples (25ms)
- Hop size: 160 samples (10ms)  
- Number of mel bands: 96
- Frequency range: 0 - 8000 Hz

Check the Discogs demo source code for the exact parameters. If the input features don't match what the model was trained on, every prediction will be garbage. The demo code IS the reference implementation — follow it exactly.

### 3. Verify essentia.js model add-on is installed

The base `essentia.js` npm package and the model add-on may be separate. Check if `essentia.js` includes the model classes (`TensorflowMusiCNN`, `TensorflowVGGish`, `EssentiaTFInputExtractor`) or if a separate package is needed. Run:
```bash
ls node_modules/essentia.js/dist/
```
Look for `essentia.js-model.js` or similar. If it's not there, check if it needs to be imported differently or installed separately.

### 4. Audio resampling to 16kHz mono

EffNet requires 16kHz mono Float32Array input. The existing audio decoding in the codebase uses 44.1kHz or 48kHz. You MUST resample before feeding to EffNet.

Use essentia.js's built-in `Resample` algorithm:
```typescript
const resampled = essentia.Resample(audioVector, 44100, 16000);
```
Or use the existing audio decoding approach in `audio-analysis.ts` — search for how it handles sample rate. The `node-web-audio-api` AudioContext can decode at a target sample rate.

If resampling is wrong (feeding 44.1kHz data to a 16kHz model), predictions will be completely off — the mel-spectrogram frequencies will be mapped incorrectly.

### 5. Next.js outputFileTracingIncludes for model files

Model files in a `models/` directory at the project root will NOT automatically be included in the Vercel serverless function bundle. Next.js traces imports to determine what files to include — static model files aren't imported via `require()` or `import`.

Add to `next.config.js`:
```javascript
module.exports = {
  // ... existing config ...
  outputFileTracingIncludes: {
    '/api/*': ['./models/**/*'],
    '/video-studio/*': ['./models/**/*'],
  },
  // OR for all serverless functions:
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./models/**/*'],
    },
  },
};
```

Search the existing `next.config.js` for how other static files are included. Without this config, the models deploy to Vercel but the function can't find them at runtime — you'll get `ENOENT: no such file or directory` errors.

### 6. Total bundle size calculation

Before deploying, calculate the actual total:
- essentia.js WASM module: ~5MB
- @tensorflow/tfjs-node: ~20MB (or tfjs for browser — check which is installed)
- Base EffNet model (tfjs format): ~18MB
- 16 classifier models × ~2-5MB each: ~48-80MB
- **Estimated total model + deps: ~91-123MB**

This is under the 250MB limit but Sonnet should verify by checking the actual deployment size after the first push. Add `VERCEL_ANALYZE_BUILD_OUTPUT=1` to environment variables temporarily to see function sizes in the build log.

### 7. Cold start performance

Loading 17 models (1 base + 16 classifiers) on cold start will take time. Mitigations:
- Cache all models at module scope (outside the handler function) so they persist across warm requests
- Load models in parallel using `Promise.all()`, not sequentially
- Log the total model loading time so you can monitor it
- Consider loading only the most critical models first (genre, mood, instruments) and lazy-loading the rest

Expected cold start: 5-15 seconds for model loading + 3-5 seconds for inference on a 3-minute track. The analysis wait gate UI covers this for the user.

### 8. TensorFlow.js backend for Node.js

On Vercel (Node.js), TensorFlow.js needs the `@tensorflow/tfjs-node` backend, NOT the browser WebGL backend. Verify the correct package is installed:
```bash
npm ls @tensorflow/tfjs-node
```
If only `@tensorflow/tfjs` (browser version) is installed, predictions will either fail or run extremely slowly on CPU without native bindings.

However, `@tensorflow/tfjs-node` has native C++ bindings that may not compile on Vercel's build environment. If this is an issue, fall back to `@tensorflow/tfjs` with the CPU backend — it's slower but works everywhere:
```typescript
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
await tf.setBackend("cpu");
await tf.ready();
```

### 9. Memory cleanup

Each inference run creates TensorFlow tensors. These MUST be disposed after use or memory will leak and the Vercel function will eventually crash:
```typescript
// Wrap inference in tf.tidy() to auto-dispose intermediate tensors
const predictions = tf.tidy(() => {
  const input = tf.tensor(features).expandDims(0);
  return model.predict(input);
});

// After extracting data from predictions:
const data = await predictions.data();
predictions.dispose();
```

### 10. Dynamic complexity and fade detection

These are not ML models — they're essentia.js WASM algorithms that run directly on the audio signal. Add them to the analysis alongside the ML classifiers:

```typescript
// Dynamic complexity
const dynamicResult = essentia.DynamicComplexity(audioVector);
const dynamicComplexity = dynamicResult.dynamicComplexity; // 0-10+ scale

// Fade detection
const fadeResult = essentia.FadeDetection(audioVector, sampleRate);
const hasFadeIn = fadeResult.fade_in?.length > 0;
const hasFadeOut = fadeResult.fade_out?.length > 0;
```

Add these to the `EffnetAnalysisResult` interface:
```typescript
dynamicComplexity: number;  // how much the volume changes
hasFadeIn: boolean;         // track fades in
hasFadeOut: boolean;        // track fades out
```

These are free, instant, and useful for Video Studio (match fade in/out with visual fades) and Mix & Master (compression decisions).
