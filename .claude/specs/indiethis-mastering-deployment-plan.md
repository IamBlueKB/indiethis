# IndieThis — Mastering Engine Deployment Plan (Corrected)
_For Sonnet — Do not rebuild. Update the existing code with these changes._

---

## SPLIT ARCHITECTURE

| Action | Handled By | Why |
|--------|-----------|-----|
| analyze | Replicate Cog (no torch) | librosa, pyloudnorm — small image |
| separate | fal.ai (hosted Demucs) | No torch in Cog, no push failure |
| classify-stems | Replicate Cog (no torch) | librosa frequency analysis |
| mix | Replicate Cog (no torch) | Pedalboard — no torch dependency |
| master | Replicate Cog (no torch) | Matchering + pyloudnorm + Pedalboard EQ/compression |
| preview | Replicate Cog (no torch) | librosa slicing + fade in/out |

Replicate model stays small (~500MB) and pushes successfully. fal.ai handles the heavy GPU stem separation.

---

## STEP 1 — Update requirements.txt

Remove demucs, torch, fastapi, uvicorn. Final file:

```
librosa==0.10.1
pyloudnorm==0.1.1
pedalboard==0.9.0
matchering==2.1.1
requests==2.31.0
numpy==1.24.3
soundfile==0.12.1
supabase==1.2.0
```

No demucs. No torch. No fastapi. No uvicorn. Cog handles serving.

---

## STEP 2 — Update predict.py

Replace the current predict.py with the corrected version (attached separately as `predict.py`). Key changes from what you have now:

- All methods are **synchronous** (`def`, not `async def`) — Cog does not support async
- Uses `requests.get()` instead of `httpx.AsyncClient`
- No `separate` action — that's handled by fal.ai in engine.ts
- Uses `cog.BasePredictor` and `cog.Input` for proper Cog integration
- Key detection uses Krumhansl-Schmuckler profiles (major + minor) instead of just picking the loudest chroma bin
- Mix uses real per-stem processing chains:
  - Vocals: 3kHz presence boost + compression + limiter
  - Bass: low shelf boost + heavy compression + limiter
  - Drums: kick boost + cymbal presence + fast compression + limiter
  - Other: gentle compression + limiter
- Master produces 4 real variations from a clean baseline:
  - **Clean** — Matchering reference match (if reference provided) or LUFS normalization
  - **Warm** — low shelf +2.5dB, high shelf -1.5dB, gentle compression
  - **Punch** — 2.5kHz mid boost +3dB, sub boost, aggressive compression
  - **Loud** — hard compression (ratio 6), +4dB gain, brick wall limiter
- Preview includes 0.5s fade in/out instead of hard cut
- All temp files cleaned up after every operation

---

## STEP 3 — Push to Replicate

From Blue's Windows machine:

```
cd C:\Users\brian\Documents\indiethis\replicate\mastering
C:\cog.exe push r8.im/indiethis/indiethis-master-engine
```

This will succeed because the image is small (~500MB) with no torch.

After push, copy the version hash and set in Vercel:

```
REPLICATE_MASTERING_MODEL_VERSION=<version hash from push output>
```

Set Supabase env vars on the Replicate model settings page (not Vercel):

```
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=eyJ...
```

---

## STEP 4 — Wire fal.ai for Stem Separation

Add to your fal utility file (wherever fal calls are made):

```typescript
import { fal } from "@fal-ai/client";

export async function separateStems(audioUrl: string): Promise<Record<string, string>> {
  const result = await fal.run("fal-ai/demucs", {
    input: {
      audio_url: audioUrl,
      stems: ["vocals", "drums", "bass", "other"],
    },
  });
  return result.stems;
}
```

Update engine.ts routing — when action is `separate`, call fal.ai. All other actions call Replicate:

```typescript
import { separateStems } from "@/lib/fal";

// In engine.ts:
if (action === 'separate') {
  return separateStems(audioUrl);
}
// All other actions → Replicate as normal
```

---

## STEP 5 — Environment Variables (Vercel)

Already set (no changes needed):
- `REPLICATE_API_TOKEN`
- `FAL_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Update:
- `REPLICATE_MASTERING_MODEL_VERSION` — new hash from Step 3
- `PAYWALL_ENABLED` — set to `true` before launch

---

## STEP 6 — Re-enable Paywall & Test

Set `PAYWALL_ENABLED=true` in Vercel env vars.

Test the full flow in order:

1. Upload audio → **analyze** (Replicate) → verify BPM, key, LUFS return
2. **separate** (fal.ai) → verify 4 stem URLs returned (vocals, drums, bass, other)
3. **mix** (Replicate) → pass stem URLs, verify mixed stereo file uploads to Supabase
4. **master** (Replicate) → verify 4 versions (clean/warm/punch/loud) upload to Supabase
5. **master with reference** → upload a reference track, verify Matchering produces a reference-matched master
6. **preview** (Replicate) → verify 30s clip with fade in/out

Test with Razor's Edge to confirm BPM (~140) and key (F minor) match existing EffNet analysis.

---

## WHAT NOT TO DO

- Do NOT add demucs or torch back to requirements.txt
- Do NOT use async methods in predict.py — Cog doesn't support async
- Do NOT include a `separate` action in predict.py — fal.ai handles it
- Do NOT include fastapi or uvicorn in requirements — Cog handles serving
- Do NOT use the gain-only mastering (just adding dB offsets) — use the real EQ/compression chains in the corrected predict.py
