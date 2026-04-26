# IndieThis — EffNet Background Analysis (v3)

_For Claude Code (Sonnet). This supersedes all previous EffNet specs. The analysis pipeline now runs in the background on track upload, not at Director Mode load time._

---

## WHY THIS CHANGE

EffNet analysis via `onnxruntime-web` WASM works but is too slow to run at request time. 10 ONNX models running sequentially on a serverless function takes 50-60 seconds — far too long for Director Mode to wait. The solution: run analysis in the background when the track is uploaded, store results in the database, and read them instantly when Director Mode loads.

---

## ARCHITECTURE

```
Track Upload → 201 Response (instant) → waitUntil → EffNet Analysis (background, 50-60s) → DB Store
                                                                                              ↓
Director Mode Load → Read from DB (instant) → Pass to Claude system prompt
```

The user NEVER waits for analysis. Upload returns in 2 seconds. Analysis runs silently in the background. By the time they open Director Mode, results are already in the database.

---

## STEP 1: Add Analysis Fields to Existing Track Model

**IMPORTANT: ADD these fields to the EXISTING Track model. Do NOT replace the model. The schema has 128+ models — only add what's new.**

Add to `prisma/schema.prisma` inside the existing `model Track { }`:

```prisma
  // EffNet analysis status
  analysisStatus   String?   @default("pending") // pending | analyzing | completed | failed
  analysisError    String?
  analyzedAt       DateTime?

  // EffNet classification results (nullable until analysis completes)
  effnetGenre        Json?    // top Discogs styles with scores
  effnetMood         Json?    // mood/theme classifications
  effnetInstruments  Json?    // detected instruments with scores
  effnetDanceability Float?   // 0-1
  effnetVoice        Json?    // vocal/instrumental + gender
  effnetMoodAggressive Float? // 0-1
  effnetMoodHappy    Float?   // 0-1
  effnetMoodSad      Float?   // 0-1
  effnetMoodRelaxed  Float?   // 0-1
  effnetTonal        Boolean? // tonal vs atonal
```

Then run:
```bash
npx prisma migrate dev --name add_effnet_analysis_fields
```

**Check if `analysisStatus` or similar fields already exist on the Track model before adding duplicates.** The existing codebase may already have audio feature fields from the previous essentia.js implementation — reuse those column names if they match, or add new ones with the `effnet` prefix to avoid conflicts.

---

## STEP 2: Feature Flag

Add to `.env` and Vercel environment variables:

```
ENABLE_EFFNET_ANALYSIS=false
```

Set to `false` initially. The site deploys and works without EffNet. Flip to `true` after testing.

---

## STEP 3: Background Analysis on Track Upload

Modify the existing track upload route (`src/app/api/dashboard/tracks/route.ts` or wherever tracks are created). Do NOT rewrite the route — add the `waitUntil` call after the existing response logic.

```typescript
import { waitUntil } from '@vercel/functions';

// Inside the existing POST handler, AFTER the track is saved to DB
// and BEFORE returning the response:

const track = await prisma.track.create({ ... }); // existing code

// Add this: fire background analysis
if (process.env.ENABLE_EFFNET_ANALYSIS === 'true' && track.audioUrl) {
  waitUntil(runEffNetBackground(track.id, track.audioUrl));
}

return NextResponse.json(track, { status: 201 }); // existing response
```

---

## STEP 4: Background Analysis Function

Create `src/lib/audio/effnet-background.ts`:

```typescript
import { prisma } from '@/lib/prisma';

export async function runEffNetBackground(trackId: string, audioUrl: string) {
  try {
    // Mark as analyzing
    await prisma.track.update({
      where: { id: trackId },
      data: { analysisStatus: 'analyzing' },
    });

    // Dynamic import — keeps EffNet out of other function bundles
    const { analyzeWithEffnet } = await import('./effnet-discogs');

    // Download audio
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = new Float32Array(arrayBuffer);

    // Run all 10 models (sequentially, ~50-60 seconds total)
    // The analyzeWithEffnet function already handles:
    // - Loading models with Promise.all() (I/O, parallelizable)
    // - Running inference sequentially (CPU-bound)
    // - Returning the full EffnetAnalysisResult
    const result = await analyzeWithEffnet(audioBuffer, 16000);

    if (!result) {
      throw new Error('EffNet analysis returned null');
    }

    // Store results
    await prisma.track.update({
      where: { id: trackId },
      data: {
        analysisStatus: 'completed',
        analyzedAt: new Date(),
        effnetGenre: result.genres,
        effnetMood: result.moods,
        effnetInstruments: result.instruments,
        effnetDanceability: result.danceability,
        effnetVoice: { isVocal: result.isVocal, gender: result.voiceGender },
        effnetMoodAggressive: result.moods?.find(m => m.label === 'aggressive')?.score ?? null,
        effnetMoodHappy: result.moods?.find(m => m.label === 'happy')?.score ?? null,
        effnetMoodSad: result.moods?.find(m => m.label === 'sad')?.score ?? null,
        effnetMoodRelaxed: result.moods?.find(m => m.label === 'relaxed')?.score ?? null,
        effnetTonal: result.isTonal,
      },
    });

    console.log(`[effnet] Analysis completed for track ${trackId}`);
  } catch (error) {
    console.error(`[effnet] Analysis failed for track ${trackId}:`, error);
    await prisma.track.update({
      where: { id: trackId },
      data: {
        analysisStatus: 'failed',
        analysisError: String(error),
      },
    });
  }
}
```

---

## STEP 5: Director Mode Reads from Database

Modify the Director Mode session creation (wherever the system prompt is built for Claude). Instead of running `analyzeSong()` live, read the stored results:

```typescript
// When building Claude's system prompt for Director Mode:
const track = await prisma.track.findUnique({
  where: { id: trackId },
  select: {
    analysisStatus: true,
    effnetGenre: true,
    effnetMood: true,
    effnetInstruments: true,
    effnetDanceability: true,
    effnetVoice: true,
    effnetTonal: true,
    // ... plus existing BPM, key, energy fields
    bpm: true,
    musicalKey: true,
    energy: true,
  },
});

if (track.analysisStatus === 'completed') {
  // Full data available — pass everything to Claude
  systemPrompt += formatAnalysisForClaude(track);
} else if (track.analysisStatus === 'analyzing') {
  // Analysis in progress — tell Claude what's available
  systemPrompt += `Analysis is still processing. Available data: BPM ${track.bpm}, Key ${track.musicalKey}, Energy ${track.energy}. Full genre/mood/instrument classification will be available shortly.`;
} else {
  // Not analyzed yet — use BPM/key/energy only
  systemPrompt += `Available data: BPM ${track.bpm}, Key ${track.musicalKey}, Energy ${track.energy}.`;
}
```

**Do NOT remove the existing `analyzeSong()` / `startAnalysisOnly()` logic for BPM/key/energy.** That essentia.js WASM analysis is fast and should still run at Director Mode load if BPM/key/energy aren't already stored. EffNet classification is the only part that moves to background.

---

## STEP 6: Also Trigger on Video Studio Create

The `/api/video-studio/create` route also triggers analysis. Apply the same pattern — if EffNet results are already in the DB, read them. If not, the existing fast analysis (BPM/key/energy) still runs, and EffNet data will be available on subsequent Director Mode loads.

---

## MODEL LOADING OPTIMIZATION

In `effnet-discogs.ts`, ensure models load in parallel:

```typescript
// Load ALL model sessions at once (I/O, not CPU-bound — can parallelize)
const [baseModel, moodModel, instrModel, voiceModel, ...rest] = await Promise.all([
  InferenceSession.create(modelPath('effnet-style.onnx')),
  InferenceSession.create(modelPath('moodtheme.onnx')),
  InferenceSession.create(modelPath('instrument.onnx')),
  InferenceSession.create(modelPath('voice.onnx')),
  InferenceSession.create(modelPath('mood_aggressive.onnx')),
  InferenceSession.create(modelPath('mood_happy.onnx')),
  InferenceSession.create(modelPath('mood_sad.onnx')),
  InferenceSession.create(modelPath('mood_relaxed.onnx')),
  InferenceSession.create(modelPath('danceability.onnx')),
  InferenceSession.create(modelPath('tonal_atonal.onnx')),
]);
```

Cache at module scope so warm function invocations reuse loaded models.

---

## DEPLOYMENT ROLLOUT

### Phase 1 — Deploy with flag off
- Set `ENABLE_EFFNET_ANALYSIS=false` in Vercel env vars
- Deploy the code
- Site works, Director Mode uses BPM/key/energy only
- Verify no deployment size issues

### Phase 2 — Test
- Set `ENABLE_EFFNET_ANALYSIS=true` in Vercel env vars
- Upload a test track
- Check Vercel function logs for `[effnet]` messages
- Verify results appear in database
- Open Director Mode — confirm Claude receives genre/mood/instrument data

### Phase 3 — Production
- Leave `ENABLE_EFFNET_ANALYSIS=true`
- All new uploads get full EffNet analysis
- Monitor for timeout or memory issues in logs

---

## TIMING EXPECTATIONS

| Step | Duration |
|------|----------|
| Track upload response to user | ~2 seconds |
| Audio download from storage | 2-5 seconds |
| Model loading (first request, cold) | 5-10 seconds |
| Model loading (warm function) | 0 seconds (cached) |
| Feature extraction (mel-spectrogram) | 2-3 seconds |
| 10 model inference (sequential) | 40-60 seconds |
| DB write | <1 second |
| **Total background time** | **~50-80 seconds** |
| **Vercel waitUntil limit (Pro + Fluid)** | **800 seconds** |

Well within limits. All 10 models, no compromises.

---

## WHAT NOT TO TOUCH

- BPM detection (RhythmExtractor2013) — working, keep as-is
- Key detection (KeyExtractor) — working, keep as-is  
- Energy detection (RMS) — working, keep as-is
- Song structure analysis (Claude) — working, keep as-is
- Lyrics/transcription (Whisper) — working, keep as-is
- Stem separation (Demucs) — working, keep as-is
- The existing `effnet-discogs.ts` inference code — it works, just needs to be called from background instead of from request handler
- Any UI components, pricing, payment logic
- Database schema for any other models (128+ Prisma models — only modify Track)

---

## WHAT TO REMOVE OR DISABLE

- Any code that calls `analyzeWithEffnet()` directly from a request handler (Director Mode route, video-studio/create route). Replace with DB reads.
- The `startAnalysisOnly()` call should NOT trigger EffNet — only BPM/key/energy. EffNet runs from `waitUntil` on upload only.
- Remove `ENABLE_EFFNET_ANALYSIS` from the feature flag once Phase 3 is confirmed stable.
