# IndieThis — EffNet-Discogs Audio Intelligence (v2 — ONNX WASM)

_For Claude Code (Sonnet). This spec supersedes the previous EffNet-Discogs spec. The critical change: switch from `onnxruntime-node` to `onnxruntime-web` to fix the Vercel deployment failure._

---

## WHY THIS UPDATE EXISTS

The previous build used `onnxruntime-node` which ships **512MB of native binaries** (`libonnxruntime.so` for Linux, macOS, Windows, ARM — every platform). Vercel's hard limit is 250MB per serverless function. The `outputFileTracingIncludes` config forced those 512MB into EVERY function — not just the audio analysis routes. Build failed with 453 functions over the limit.

**The fix:** Replace `onnxruntime-node` with `onnxruntime-web`. Uses a WASM runtime (~8-10MB) instead of native binaries (512MB). Same models, same inference API, same results. Fits within Vercel limits.

---

## WHAT THIS IS

EffNet-Discogs is a pre-trained ML model from Essentia/MTG that classifies music into 400 styles from the Discogs taxonomy. Trained on over 2 million tracks.

The base model (`effnet-style.onnx`, 17MB) produces embeddings. Nine small classifier head models (0.5-2.7MB each) run on those embeddings to detect genre, mood, instruments, danceability, voice, etc.

**Runtime:** `onnxruntime-web` (WASM backend) — runs ONNX models in Node.js via WebAssembly  
**Mel-spectrogram extraction:** `essentia.js` WASM + `EssentiaTFInputExtractor`  
**Total bundle:** ~35-45MB (models + WASM runtimes). Well under Vercel's 250MB limit.  
**Cost:** $0. Runs locally in the Vercel function. No API calls, no Replicate, no external service.

---

## WHAT THIS REPLACES

Remove or disable ALL of the following:
- `essentia-vggish.ts` — delete entirely, VGGish models are 404 and will never work
- Any rule-based genre/mood inference that uses spectral centroid, ZCR, or RMS to guess classifications
- Any Replicate calls to `mtg/music-classifiers` or `mtg/effnet-discogs`
- Any Claude prompt that asks Claude to infer genre/mood from BPM/key/energy numbers

Do NOT remove:
- BPM detection via RhythmExtractor2013 — this works and stays
- Key detection via KeyExtractor — this works and stays
- Energy detection via RMS — this works and stays
- Song structure analysis via Claude — this works and stays
- Lyrics/transcription via Whisper — this works and stays
- Stem separation via Demucs — this works and stays

---

## RULES

- This runs in TypeScript on Vercel using essentia.js WASM + `onnxruntime-web`
- **DO NOT use `onnxruntime-node`** — it ships 512MB of native binaries that exceed Vercel's 250MB limit
- No Python functions
- No external API calls
- No Replicate
- No model files downloaded at runtime — they are bundled in the deployment
- The model files live in the project repo (they're small enough)
- Analysis runs ONCE per track, results stored permanently in the database
- If model loading or inference fails, fall back gracefully — the track still processes with BPM/key/energy

---

## MIGRATION FROM onnxruntime-node (DO THIS FIRST)

### Step 0: Package swap

```bash
npm uninstall onnxruntime-node
npm install onnxruntime-web
```

### Step 1: Update imports

In every file that imports onnxruntime:

```diff
- import { InferenceSession } from 'onnxruntime-node';
+ import { InferenceSession } from 'onnxruntime-web';
```

The `InferenceSession.create()` and `session.run()` API is identical. No other code changes needed for basic inference.

### Step 2: WASM backend setup

`onnxruntime-web` needs to use the WASM backend explicitly (not WebGPU). At the top of your EffNet module, before creating any sessions:

```typescript
import * as ort from 'onnxruntime-web';

// Force WASM backend (not WebGPU)
ort.env.wasm.numThreads = 1; // single-threaded for serverless
// If needed, point to the WASM files location:
// ort.env.wasm.wasmPaths = '/path/to/wasm/files/';
```

### Step 3: Model file loading

The current code loads models from disk with `fs.readFileSync`. With `onnxruntime-web` in Node.js, you have two options:

**Option A — File path (preferred if it works):**
```typescript
const session = await InferenceSession.create(modelFilePath);
```

**Option B — ArrayBuffer (fallback):**
```typescript
import fs from 'fs';
const modelBuffer = fs.readFileSync(modelFilePath);
const session = await InferenceSession.create(modelBuffer.buffer);
```

Test Option A first. If `onnxruntime-web` can't resolve file paths in Node.js, use Option B.

### Step 4: Fix outputFileTracingIncludes

The previous config included `onnxruntime-node/bin/**` which was pulling in 512MB. Remove that entry. Keep only the model files:

```typescript
// next.config.ts
outputFileTracingIncludes: {
  '/api/*': ['./models/effnet-discogs/**'],
  '/video-studio/*': ['./models/effnet-discogs/**'],
},
```

**DO NOT include `onnxruntime-web` or `onnxruntime-node` binary paths.** The WASM files from `onnxruntime-web` should be traced automatically by Next.js since they're imported via `require()`/`import`.

If the `.wasm` files from `onnxruntime-web` are not found at runtime, add them explicitly:
```typescript
outputFileTracingIncludes: {
  '/api/*': ['./models/effnet-discogs/**', './node_modules/onnxruntime-web/dist/*.wasm'],
},
```

### Step 5: Remove dynamic import workaround

The previous build had a dynamic `await import('onnxruntime-node')` workaround in `song-analyzer.ts` and `tracks/route.ts` to prevent crashes when the `.so` file was missing. With `onnxruntime-web`, this workaround is no longer needed — but keeping the dynamic import as a safety net is fine too. The key point: if ONNX loads, great; if it fails, the route still returns 201 and only EffNet analysis skips.

### Step 6: Verify deployment

After making these changes, deploy and check:
1. Build log should NOT show `onnxruntime-node/bin` in any function's dependencies
2. No function should exceed 250MB
3. Model files should appear in the functions that need them (~26MB total for all `.onnx` files)
4. Set `VERCEL_ANALYZE_BUILD_OUTPUT=1` env var temporarily to see detailed function sizes

---

## CURRENT STATE (What Sonnet Already Built)

Sonnet has already built the EffNet-Discogs pipeline with ONNX. The architecture is:

1. `EssentiaTFInputExtractor('musicnn')` extracts 96-band mel-spectrograms from 16kHz mono audio
2. Mel-spectrogram frames stacked into 128-frame patches → `[N, 128, 96]` ONNX tensor
3. `effnet-style.onnx` (17.2MB) runs on all patches → activations [N, 400] + embeddings [N, 1280]
4. 9 classifier head ONNX files (0.5–2.7MB each) run on mean embeddings
5. All models cached at module scope for warm reuse

**Model files already in repo** (`models/effnet-discogs/`):
- `effnet-style.onnx` — 17.2MB base embedding model
- `moodtheme.onnx` — 2.6MB mood/theme classifier
- `instrument.onnx` — 2.6MB instrument classifier
- `voice.onnx` — 502KB voice/instrumental classifier
- `mood_aggressive.onnx` — 502KB
- `mood_happy.onnx` — 502KB
- `mood_sad.onnx` — 502KB
- `mood_relaxed.onnx` — 502KB
- `danceability.onnx` — 502KB
- `tonal_atonal.onnx` — 502KB

**Total model size:** ~26MB

The dead code (`essentia-vggish.ts`, Replicate `analyzeWithEssentia` call) has already been removed.

**What needs to change:** ONLY the runtime package — from `onnxruntime-node` to `onnxruntime-web`. The model files, inference logic, mel-spectrogram extraction, and result formatting all stay the same.

---

## 16 CLASSIFIERS (Full List)

The current build has 10 classifiers. The remaining 6 can be added later when the base pipeline is verified working:

**Already built (10):**
1. Genre — 400 Discogs styles (from base model activations)
2. Mood/Theme — 56 classes
3. Instruments — 40 classes
4. Danceability — 0-1 scale
5. Voice/Instrumental — binary
6. Mood Aggressive — binary
7. Mood Happy — binary
8. Mood Sad — binary
9. Mood Relaxed — binary
10. Tonal/Atonal — binary

**Not yet built (6 — add after pipeline verified):**
11. Voice Gender (male/female)
12. Timbre (bright/dark via Nsynth)
13. Acoustic/Electronic (Nsynth)
14. Approachability (regression)
15. Engagement (regression)
16. Arousal/Valence (DEAM — emotional intensity and positivity)

Plus Dynamic Complexity and Fade Detection from essentia.js WASM (not ML models — direct signal analysis).

---

## BUNDLE SIZE CALCULATION (CORRECTED)

Previous estimate was wrong. Here's the actual math:

| Component | Size |
|-----------|------|
| EffNet ONNX models (all 10) | ~26MB |
| essentia.js WASM module | ~5MB |
| onnxruntime-web (WASM runtime) | ~8-10MB |
| node-web-audio-api (audio decoding) | ~5-7MB per platform binary |
| Prisma client | ~17MB |
| @prisma/client | ~7MB |
| next/dist | ~1.2MB |
| **Estimated total per function** | **~70-80MB** |

This is well under the 250MB limit. The previous `onnxruntime-node` was adding 512MB on top of everything — that's what broke it.

**Note on node-web-audio-api:** This package also ships platform-specific binaries (macOS, Windows, Linux ARM, etc.) totaling ~45MB. Vercel only needs the Linux x64 binary (~6.5MB). If this causes size issues in the future, it can be addressed with `serverExternalPackages` or by switching to a lighter audio decoder. Not a problem right now since 80MB total is nowhere near 250MB.

---

## PERFORMANCE EXPECTATIONS WITH WASM

| Metric | onnxruntime-node (native) | onnxruntime-web (WASM) |
|--------|--------------------------|----------------------|
| Single model inference | 200-400ms | 500-1200ms |
| All 10 classifiers | 2-4s | 5-12s |
| Cold start (model loading) | 1-2s | 2-4s |
| Memory usage | Lower (native heap) | Higher (WASM in JS heap) |

**This doesn't matter for user experience.** Analysis runs in the background after track upload. The user sees a progress indicator and the analysis wait gate. Adding a few seconds to a background process is invisible.

Vercel Pro with Fluid Compute keeps functions warm, so cold starts only hit the first request after idle.

---

## VERIFICATION CHECKLIST

After Sonnet makes the migration:

1. ☐ `npm ls onnxruntime-node` returns "empty" (fully removed)
2. ☐ `npm ls onnxruntime-web` returns installed version
3. ☐ Build log shows NO function with `onnxruntime-node/bin` in dependencies
4. ☐ All functions under 250MB in build output
5. ☐ Deploy succeeds (no size limit errors)
6. ☐ Upload a track → analysis runs → genre/mood/instruments stored in DB
7. ☐ Director Mode session → Claude receives EffNet analysis data in system prompt
8. ☐ Claude says "Here's what I know about [track]" with accurate genre classification
9. ☐ Razor's Edge test: genre should be trap/hip-hop, mood aggressive/dark, BPM ~140, key F minor
10. ☐ Order page loads without "Unexpected token '<'" error (the `/api/video-studio/create` 500 was caused by missing ONNX runtime)

---

## CRITICAL IMPLEMENTATION NOTES

### 1. WASM backend, NOT WebGPU
`onnxruntime-web` supports both WASM and WebGPU backends. On Vercel (Node.js serverless), there is no GPU. Use WASM explicitly. If `onnxruntime-web` tries to initialize WebGPU by default, it will fail silently or crash.

### 2. WASM file inclusion on Vercel
Vercel's file tracer follows `import`/`require` chains but may not follow the internal WASM file loading that `onnxruntime-web` does. If you get runtime errors like "failed to load wasm" or "wasm file not found", you need to add the `.wasm` files to `outputFileTracingIncludes` explicitly (see Step 4 above).

### 3. Single-threaded execution
Set `ort.env.wasm.numThreads = 1`. Vercel serverless functions don't support multi-threaded WASM workers. Trying to use multiple threads will either fail or cause undefined behavior.

### 4. Memory management
ONNX sessions and tensors consume memory within the Node.js heap. With 10 models loaded, expect ~200-400MB memory usage. Vercel Pro allows 4GB, so this is fine. But dispose of input/output tensors after each inference run to prevent leaks across warm invocations.

### 5. Model files stay exactly the same
The `.onnx` model files are format-agnostic — they work with any ONNX runtime (native, WASM, WebGPU, Python, C++). No model conversion, no re-download, no format changes. Only the runtime that loads and executes them changes.

### 6. Audio resampling to 16kHz mono
This requirement hasn't changed. EffNet requires 16kHz mono Float32Array input. The existing audio decoding pipeline handles this. Don't change it.

### 7. Cold start optimization
Load models in parallel with `Promise.all()`, not sequentially. Cache at module scope so they persist across warm requests. This hasn't changed from the previous approach.

### 8. Graceful fallback
If `onnxruntime-web` fails to load or any model inference throws, catch the error and continue. The track should still process with BPM/key/energy from essentia.js WASM. EffNet classification is additive — its absence shouldn't break anything.

### 9. DO NOT touch these
- BPM detection (RhythmExtractor2013) — working, keep as-is
- Key detection (KeyExtractor) — working, keep as-is
- Energy detection (RMS) — working, keep as-is
- Song structure analysis (Claude) — working, keep as-is
- Lyrics/transcription (Whisper via Replicate) — working, keep as-is
- Stem separation (Demucs via Replicate) — working, keep as-is
- Any UI components
- Any pricing or payment logic
- The Director Agent system prompt content
- Database schema fields for Essentia data

### 10. Dynamic complexity and fade detection
These are essentia.js WASM algorithms, not ONNX models. They run directly on the audio signal and are unaffected by the runtime change:

```typescript
// Dynamic complexity
const dynamicResult = essentia.DynamicComplexity(audioVector);
const dynamicComplexity = dynamicResult.dynamicComplexity;

// Fade detection
const fadeResult = essentia.FadeDetection(audioVector, sampleRate);
const hasFadeIn = fadeResult.fade_in?.length > 0;
const hasFadeOut = fadeResult.fade_out?.length > 0;
```

---

## SUMMARY

One package swap. `onnxruntime-node` → `onnxruntime-web`. Same models, same API, same results. 512MB → 8-10MB. Deploys to Vercel. Done.
