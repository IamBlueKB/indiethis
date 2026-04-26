# IndieThis — AI Mix Console Spec (v2)
_For Sonnet — New feature. Builds on existing mastering pipeline architecture (webhooks, Replicate Cog, Supabase Storage, Stripe PPU). Do not modify mastering. This is a separate tool._

_Includes all 8 review fixes from external AI audit (marked with [REVIEW FIX])._

---

## OVERVIEW

The AI Mix Console is a full mixing engine that takes raw audio inputs and outputs a polished, radio-ready mixed track. Two modes:

1. **Vocal + Beat** — Artist uploads labeled vocal layers (main, ad-libs, ins & outs, doubles, harmonies) plus a stereo beat/instrumental. The engine cleans, processes each vocal role with genre-aware chains, balances against the beat, and outputs a mixed stereo track. The beat is NOT stem-separated by default — it stays as a 2-track.
2. **Tracked-out Stems** — Producer uploads 2–16 individual stems (kick, snare, bass, vocals, synths, etc.). The engine classifies, processes each stem with genre-aware chains and creative effects, and mixes to a stereo track.

The mixed output can optionally feed into the mastering pipeline.

### PRIORITY: THE SIMPLEST USE CASE MUST BE FLAWLESS

80% of artists will upload ONE main vocal and ONE beat. Nothing else. No ad-libs, no doubles. That basic path — single vocal + single beat = polished mixed track — must sound incredible before any other feature matters. Build this path first, test it exhaustively, then layer on the multi-role complexity.

---

## PRICING

Pure PPU. No subscriber discount. No subscriber allocations. Every mix is a paid transaction.

| Tier | Price | What they get |
|------|-------|---------------|
| Standard | $59.99 | 3 mix variations (Clean/Polished/Aggressive), full vocal chain, breath editing, pitch correction, de-ess, panning, bus processing, all export formats |
| Premium | $79.99 | AI-recommended mix + 2 revision rounds, delay throws, reverb, de-reverb, section-aware processing, custom direction textarea, reference track matching, all formats |
| Pro | $99.99 | Everything in Premium + Claude identifies delay words from lyrics, 3 revision rounds, per-word custom delay requests in plain English, full section-aware mixing, all formats |

### Beat Polish Add-on: +$19.99 (any tier)

Available as a checkbox on the configure step: "Polish your beat around your vocals (+$19.99)"

Description: "We'll separate your instrumental into drums, bass, and melodics, then optimize each element to sit perfectly with your vocals."

What it does:
- Runs Demucs on the beat via fal.ai to separate into drums/bass/other
- Applies per-stem processing on beat elements (tighten kick, punch snare, widen synths)
- Re-balances beat elements around the vocals
- Then mixes everything together

Without Beat Polish (default): beat stays as stereo 2-track. Engine applies side-chain ducking and frequency unmasking on the beat when vocals are present, but does not separate or reprocess beat stems.

Cost per job: ~$0.08-0.15 standard, ~$0.12-0.20 with Beat Polish. 99%+ margin on all tiers.

---

## PIPELINE

### Status Flow

```
PENDING -> UPLOADING -> ANALYZING -> AWAITING_DIRECTION -> MIXING -> PREVIEWING -> QA_CHECK -> COMPLETE
```

With Beat Polish:
```
PENDING -> UPLOADING -> SEPARATING -> ANALYZING -> AWAITING_DIRECTION -> MIXING -> PREVIEWING -> QA_CHECK -> COMPLETE
```

Revision rounds (Premium/Pro):
```
COMPLETE -> REVISING -> PREVIEWING -> QA_CHECK -> COMPLETE
```

### Step-by-Step

**Step 1 — Frontend Wizard**

New page: `/mix-console` (public, gated by email/OAuth like mastering)

Wizard steps: email -> mode -> upload -> configure -> payment -> processing -> direction -> preview/compare -> export

Mode selection:
- **Vocal + Beat** — labeled vocal layer fields + beat upload
- **Tracked-out Stems** — upload 2-16 WAV files with labels

### VOCAL + BEAT UPLOAD FIELDS

Each vocal layer field accepts MULTIPLE files. When an artist drops 3 ad-lib takes into the ad-libs field, show them stacked with individual remove buttons. All files in a field get the same role chain.

Fields:
- Main Vocal [REQUIRED] — accepts multiple files
- Ad-libs — optional, accepts multiple files
- Ins & Outs — optional, accepts multiple files
- Doubles — optional, accepts multiple files
- Harmonies — optional, accepts multiple files
- Beat / Instrumental [REQUIRED] — single file, WAV or MP3, max 500MB

### MULTIPLE MAIN VOCAL OVERLAP HANDLING

When multiple files are dropped in the Main Vocal field, detect overlap:

**[REVIEW FIX] SILENCE STRIPPING:** Before calculating overlap, run `librosa.effects.split(y, top_db=30)` on each file to strip leading/trailing silence. Without this, two files with long silent intros register as 100% overlapping and get incorrectly treated as doubles.

1. Strip silence from each file via librosa.effects.split
2. Scan each file for signal presence (RMS above -40dB) per 50ms window
3. Compare timestamps where multiple files have signal simultaneously
4. Calculate overlap percentage based on SIGNAL-PRESENT regions only

| Overlap % | Interpretation | Action |
|-----------|---------------|--------|
| < 20% | Vocal comp — artist wants best parts of each take | Crossfade at overlap points (50ms [REVIEW FIX: was 15ms]), use whichever file has higher RMS in overlap region |
| 20-50% | Ambiguous | Claude analyzes pitch/spectral content of overlapping regions and decides: comp or intentional stacking |
| > 50% | Intentional stacking — artist wants both for thickness | Treat second file as double, apply doubles chain, pan and detune accordingly |

### Configure step collects:

| Field | Type | Options |
|-------|------|---------|
| genre | Dropdown | Auto-detect / Hip-Hop / Trap / R&B / Pop / Rock / Electronic / Acoustic / Lo-Fi / Afrobeats / Latin / Country / Gospel |
| breathEditing | Dropdown | Off / Subtle (-6-12dB) / Clean (remove, leave gaps) / Tight (remove, close gaps) |
| pitchCorrection | Dropdown | Off / Subtle / Tight / Hard |
| delayStyle | Dropdown | Off / Subtle / Standard / Heavy |
| vocalStylePreset | Dropdown | Auto (genre-based) / Clean and natural / Lo-fi and gritty / Airy and spacious / Raw and upfront |
| reverbStyle | Dropdown | Dry / Room / Plate / Hall / Cathedral |
| fadeOut | Dropdown | Auto-detect / Yes (3s) / Yes (5s) / Yes (8s) / No |
| beatPolish | Checkbox | "Polish your beat around your vocals (+$19.99)" — unchecked by default |
| customDirection | Textarea | Premium/Pro only |
| referenceTrackUrl | File upload | Premium/Pro only |

**Step 2 — Job Creation**

POST /api/mix-console/job — creates MixJob record. Status: PENDING.

Vocal + Beat WITHOUT Beat Polish -> straight to analysis. Status: ANALYZING.
Vocal + Beat WITH Beat Polish -> Demucs on beat via fal.ai. Status: SEPARATING.
Tracked-out Stems -> straight to analysis. Status: ANALYZING.

**Step 3 — Input Quality Analysis (Replicate: analyze-mix action)**

Runs on all input files:

- BPM detection (librosa beat_track)
- Key detection (Krumhansl-Schmuckler chroma)
- Per-stem frequency analysis (sub/low/mid/high band energies)
- Per-stem RMS levels
- Song structure detection (verse/chorus/bridge/intro/outro)
- Vocal transcription via Whisper -> lyrics text + word-level timestamps
- Room reverb detection (RT60 estimation)
- Pitch deviation analysis
- Phase coherence check between stems
- Input quality scoring
- Beat vocal detection (EffNet voice model)

### INPUT QUALITY SCORING

Generate a quality score per vocal file:

| Check | Weight | What it detects |
|-------|--------|----------------|
| Room reverb (RT60) | 25% | Heavy reverb from untreated rooms |
| Noise floor | 25% | Background hiss, hum, fan noise |
| Clipping | 20% | Digital distortion from recording too hot |
| Pitch consistency | 15% | How far off-key the performance is |
| Dynamic range | 15% | Extremely inconsistent levels |

Score: 0-100. Thresholds:

| Score | Rating | What the artist sees |
|-------|--------|---------------------|
| 80-100 | Great | Nothing — proceed normally |
| 60-79 | Acceptable | "Your vocal has some room sound — we'll clean it up but results will be best with a drier recording." |
| 40-59 | Low | "Your vocal quality is low. We'll do our best but the mix may not sound as polished as it could with a cleaner recording." |
| 0-39 | Poor | "Your vocal has significant quality issues. We strongly recommend re-recording. Do you want to proceed anyway?" — must confirm |

### BEAT VOCAL DETECTION

If beat file contains vocals (EffNet voice confidence > 0.6):

Warning: "Your instrumental appears to contain vocals. For best results, upload a clean instrumental without vocals. Do you want to proceed anyway?"

### VOCAL BLEED DETECTION

Cross-correlate vocal and beat files. If correlation > 0.3:

Warning: "We detected your beat playing in the background of your vocal recording. This can affect mix quality. For best results, re-record with headphones."

Engine reduces aggressive EQ/compression on the vocal to avoid amplifying bleed.

### MISMATCHED BPM

If vocal BPM differs from beat BPM by > 5 BPM:

Warning: "Your vocal tempo doesn't match your beat. The mix may have timing issues."

Do NOT time-stretch. Just warn and proceed.

### EMPTY FILES

If any file has RMS < -60dB across entire duration:

Error: "This file appears to be silent. Please re-upload." Block processing.

### DURATION LIMIT [REVIEW FIX]

If any file exceeds 8 minutes:

Warning: "This track is over 8 minutes. Processing very long tracks may time out. Are you sure you want to proceed?"

If any file exceeds 15 minutes:

Error: "This track exceeds our 15-minute processing limit. Please trim your audio and re-upload." Block processing.

Reason: Replicate workers have a 15-minute execution limit. An 8-minute track with Beat Polish + full chain matrix + 3 variations needs processing headroom.

**Step 4 — Direction Step (Frontend)**

Artist sees Claude's recommendation including quality score, detected roles, and suggested processing. Accepts, modifies, or skips. Premium/Pro can add custom per-role overrides.

Status -> MIXING.

**Step 5 — Mix Engine (Replicate: mix-full action)**

### PROCESSING ORDER SUMMARY

1. Input gain staging (normalize all to -23 LUFS)
2. Pre-processing cleanup (de-reverb, noise gate, breath editing, plosive removal, pitch correction, de-esser)
3. Multi-file handling (overlap detection, panning spread, level normalization per role)
4. Per-stem processing (genre + role chain matrix with parallel saturation)
5. Beat processing (side-chain + unmasking default, or Demucs + per-stem with Beat Polish)
6. Creative effects (reverb, delay throws, ad-lib timing, vocal silence fill)
7. Section-aware processing (Premium/Pro — verse/chorus/bridge get different settings)
8. Bus processing (glue compression, bus EQ, stereo imaging, peak normalize -1dBFS)
9. Fade out (auto-detect or user-selected)
10. Mix variations (Standard) or AI-recommended mix (Premium/Pro)
11. Quality gate (clipping, vocal audibility, stereo balance, frequency balance, phase, silent gaps)

### 5A. INPUT GAIN STAGING [REVIEW FIX]

Before ANY processing, normalize all input stems to -23 LUFS via pyloudnorm. This prevents hot recordings from clipping through compression and quiet recordings from sitting below the noise floor. Without this, the chain matrix parameters are meaningless — a -10 LUFS vocal and a -30 LUFS vocal hitting the same 4:1 compressor produce completely different results.

```python
import pyloudnorm as pyln

meter = pyln.Meter(sr)
loudness = meter.integrated_loudness(audio)
audio = pyln.normalize.loudness(audio, loudness, -23.0)
```

Run on: all vocal stems, beat file, and beat stems (if Beat Polish). Do NOT normalize after processing — only at input.

### 5B. PRE-PROCESSING (CLEANUP)

Runs on vocal stems only:

De-reverb:
- Spectral subtraction, strength based on RT60
- Skip if RT60 < 0.2s

Noise gate:
- Adaptive threshold from first 500ms noise floor
- Hold 50ms, release 100ms

Breath editing (user selection):
- Subtle: reduce breath gain by 8dB
- Clean: replace with silence, keep gap duration
- Tight: replace with silence, crossfade to close gaps (50ms [REVIEW FIX: was 15ms])

Mouth click / plosive removal:
- Detect transient spikes < 10ms, apply 5ms fade
- Detect low-freq plosives, apply HP filter on plosive segments only

Pitch correction (user selection):
- Subtle: shift 40% toward correct note, preserve vibrato
- Tight: shift 70%, reduce vibrato 50%
- Hard: shift 95%, minimal vibrato
- Never correct intentional bends/runs/melisma

De-esser [REVIEW FIX]:
- Do NOT hardcode 4-8kHz — detect sibilance frequency per vocalist dynamically
- Female vocals: sibilance typically at 8-12kHz
- Male vocals: sibilance typically at 4-7kHz
- Use high-frequency RMS detector to find the dominant sibilant band per file
- Apply de-esser at detected frequency with genre-appropriate strength (from chain matrix)

### 5C. MULTI-FILE HANDLING PER ROLE

Multiple ad-libs: pan spread across stereo field — file 1 at L15, file 2 at R25, file 3 at L35. Alternate sides, widen with count. Formula: pan = alternate_sign * (15 + (index * 8)), capped at +/-50.

Multiple doubles: detune one +N cents, one -N cents per genre matrix. Pan L/R. If > 2, distribute evenly.

Multiple harmonies: detect pitch of each relative to lead. Pan based on pitch — lowest slightly left, highest slightly right, middle near center.

Multiple main vocals: apply overlap detection logic. Comp mode, stack mode, or Claude decides.

Level normalization: calculate average RMS per role, normalize all to consistent baseline, THEN apply relative blend offsets from chain matrix. Prevents loud ad-libs from sitting too high.

### 5D. PER-STEM PROCESSING CHAINS

USE THE GENRE + ROLE CHAIN MATRIX from indiethis-mix-vocal-chain-matrix.md. The matrix provides specific DSP parameters for every combination of genre (12 genres) and role (lead, ad-libs, ins & outs, doubles, harmonies, chants).

**PARALLEL SATURATION MIX CONTROL [REVIEW FIX]:** All saturation and heavy compression must be applied as parallel (wet/dry) blend, NOT inline. Process a dry copy and a saturated copy, then blend at the percentage specified in the chain matrix. This prevents over-processing and preserves transient clarity. Same applies to any stage with > 6% drive or > 5:1 compression ratio.

```python
# Parallel saturation
dry = audio.copy()
saturated = apply_saturation(audio, drive=chain["saturation"])
output = dry * (1 - chain["saturation"]) + saturated * chain["saturation"]

# Parallel heavy compression (ratio > 5:1)
if chain["comp_ratio"] > 5:
    dry = audio.copy()
    compressed = apply_compression(audio, ratio=chain["comp_ratio"], ...)
    output = dry * 0.5 + compressed * 0.5
```

Vocal style preset overrides modify the genre matrix globally.
Custom direction per-role overrides (Premium/Pro) modify individual roles.

### 5E. BEAT PROCESSING

Without Beat Polish (default):
- Beat stays as stereo 2-track
- Frequency unmasking: dynamic EQ cut on beat in competing bands (2-5kHz), -2 to -4dB, triggered when vocal present
- Side-chain compression: duck beat 2-3dB when lead vocal active, attack 5ms, release 100ms
- No other processing

With Beat Polish (+$19.99):
- Demucs separates into drums/bass/other
- **DEMUCS ARTIFACT KILL SWITCH [REVIEW FIX]:** After separation, sum all stems back together and compare to original via cross-correlation. If correlation < 0.85, Demucs introduced artifacts — abort separation, fall back to standard 2-track processing, show amber warning to artist: "Beat separation introduced artifacts. We're processing your beat as a whole track for best quality." Do NOT charge the Beat Polish add-on if kill switch triggers.
- Per-stem processing on beat elements
- Re-balance around vocals
- Per-stem frequency unmasking for surgical carving
- Sum to stereo

### 5F. CREATIVE EFFECTS

Reverb: per-section, from reverbStyle selection. Chorus gets 1.5x verse. Parameters from chain matrix.

Delay throws: tempo-synced, word-level. Claude picks words based on phrase endings, silence after words, emotional emphasis, hook repetition. Custom word requests for Pro tier.

**WHISPER TIMESTAMP QUANTIZATION [REVIEW FIX]:** Raw Whisper word timestamps drift 100-200ms from the beat grid and will sound off-beat. After Whisper transcription, quantize all word timestamps to nearest 1/16 note grid position based on detected BPM. Formula: `quantized_time = round(raw_time * bpm / 60 * 4) / (bpm / 60 * 4)`. This is CRITICAL for delay throws — an un-quantized delay throw will land between beats and sound amateur.

Ad-lib timing tightening (genre-dependent):
- Trap/Hip-Hop: leave loose
- Pop: quantize to nearest beat grid within 30ms
- R&B: slight tightening
- Afrobeats: tighten to call-and-response pattern

Vocal silence fill: detect gaps > 500ms, add subtle reverb swell from last word, -18dB below vocal level.

### 5G. SECTION-AWARE PROCESSING (Premium/Pro)

Claude identifies sections. Processing changes per section:
- Verse: tighter reverb, less compression, more intimate
- Chorus: wider reverb, more compression, vocals forward, delay throws active, harmonies louder
- Bridge: Claude decides based on genre/mood
- Intro/Outro: gradual builds, fade if configured

50ms crossfades between section chunks. [REVIEW FIX: was 15ms]

### 5H. BUS PROCESSING

1. Glue compression: ratio 2:1, attack 30ms, release 200ms, 1-2dB gain reduction
2. Bus EQ: genre-adjusted tilt
3. Stereo imaging: mono compatibility, widen if needed, mono below 120Hz
4. Peak normalize: -1dBFS

### 5I. FADE OUT

Auto-detect: natural ending = no fade, abrupt ending = 5s exponential fade.

### 5J. MIX VARIATIONS (Standard)

3 variations: Clean, Polished, Aggressive. 30-second preview from highest-energy section, same window for all 3.

### 5K. AI-RECOMMENDED MIX (Premium/Pro)

Claude picks best config. One mix. Revision rounds: Premium 2, Pro 3. Additional revisions $9.99 each.

---

## QUALITY GATE

After mix generated, before artist hears it:

| Check | What it detects | Action if failed |
|-------|----------------|------------------|
| Clipping | Any sample at 0dBFS+ | Re-normalize, reduce gain 1dB, re-render |
| Vocal audibility | Lead vocal RMS < beat RMS - 3dB | Boost vocal 2dB, re-render |
| Stereo balance | L/R RMS difference > 3dB | Flag for Claude review |
| Frequency imbalance | Any band > 2x adjacent band energy | Adjust bus EQ, re-render |
| Phase issues | Mono sum loses > 3dB vs stereo | Flag phase cancellation, check doubles |
| Silent gaps | Unintended silence > 2s mid-track | Check crossfades, re-check file alignment |

Auto-correct and re-render. If fails twice, proceed with best version + note to artist.

Status: PREVIEWING -> QA_CHECK -> COMPLETE

---

## SCHEMA

### MixJob (Prisma model)

model MixJob {
  id                    String   @id @default(cuid())
  userId                String?
  guestEmail            String?
  mode                  String   // VOCAL_BEAT | TRACKED_STEMS
  tier                  String   // STANDARD | PREMIUM | PRO
  status                String   // PENDING | UPLOADING | SEPARATING | ANALYZING | AWAITING_DIRECTION | MIXING | PREVIEWING | QA_CHECK | COMPLETE | REVISING | FAILED

  // Input files — labeled per role
  mainVocalFiles        Json?    // [{ url, filename }]
  adlibFiles            Json?    // [{ url, filename }]
  insOutFiles           Json?    // [{ url, filename }]
  doubleFiles           Json?    // [{ url, filename }]
  harmonyFiles          Json?    // [{ url, filename }]
  beatFile              String?  // single URL
  trackedStems          Json?    // [{ url, filename, label }] for TRACKED_STEMS mode
  referenceTrackUrl     String?

  // Configuration
  genre                 String?
  breathEditing         String?
  pitchCorrection       String?
  delayStyle            String?
  vocalStylePreset      String?
  reverbStyle           String?
  fadeOut                String?
  beatPolish            Boolean  @default(false)
  customDirection       String?
  directionUsed         String?

  // Analysis
  analysisData          Json?
  inputQualityScore     Int?
  inputQualityNotes     String?
  lyrics                String?
  wordTimestamps        Json?
  directionRecommendation String?
  delayThrows           Json?
  mainVocalOverlap      Json?    // { overlapPercent, mode }

  // Mix parameters
  mixParameters         Json?
  sectionMap            Json?

  // Output files
  cleanFilePath         String?
  polishedFilePath      String?
  aggressiveFilePath    String?
  mixFilePath           String?

  // Preview
  previewWaveformOriginal Json?
  previewWaveformMixed    Json?
  previewFilePaths      Json?

  // Quality gate
  qaCheckResults        Json?
  qaPassedAt            DateTime?

  // Revision tracking
  revisionCount         Int      @default(0)
  maxRevisions          Int      @default(0)
  revisionHistory       Json?

  // Payment
  stripePaymentId       String?
  amount                Int
  beatPolishAmount      Int?

  // Access
  accessToken           MixAccessToken?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  user                  User?    @relation(fields: [userId], references: [id])
}

model MixAccessToken {
  id        String   @id @default(cuid())
  jobId     String   @unique
  token     String   @unique @default(cuid())
  email     String
  expiresAt DateTime
  createdAt DateTime @default(now())
  job       MixJob   @relation(fields: [jobId], references: [id])
}

---

## PYTHON ENGINE

New actions: analyze-mix, mix-full, preview-mix, revise-mix, qa-check

Dependencies: pyrubberband, praat-parselmouth, faster-whisper, pyloudnorm, matchering
System packages: rubberband-cli, ffmpeg

---

## WEBHOOK ROUTES

POST /api/mix-console/webhook/replicate/analyze
POST /api/mix-console/webhook/replicate/mix
POST /api/mix-console/webhook/replicate/preview
POST /api/mix-console/webhook/replicate/qa
POST /api/mix-console/webhook/replicate/revise

---

## API ROUTES

POST /api/mix-console/job — Create job
GET /api/mix-console/job/[id] — Poll status
POST /api/mix-console/job/[id]/confirm-direction — Accept direction
POST /api/mix-console/job/[id]/revise — Submit revision feedback
POST /api/mix-console/job/[id]/select — Select final version
GET /api/mix-console/job/[id]/download — Download in format

---

## FRONTEND PAGES

/mix-console — Landing + gate
/mix-console/wizard — Full wizard flow
/mix-console/results — Guest tokenized results
/dashboard/ai/mix-console — Subscriber access + history

---

## CROSS-SELL

After mix: "Master this track" CTA -> mastering wizard with mixed file pre-loaded
On mastering page: "Got raw vocals over a beat? Mix first."
After vocal remover: "Need to mix these stems?"
Post-mastering email: "Next time, mix first — then master."

---

## COMPANION DOCUMENTS

- indiethis-mix-vocal-chain-matrix.md — Genre + role chain matrix with DSP parameters
- indiethis-mastering-preview-player-spec.md — Preview player design (shared)

---

## REVIEW FIXES INCORPORATED

All 8 fixes from external AI review are now baked into this spec:

| # | Fix | Location in spec |
|---|-----|-----------------|
| 1 | Input gain staging — normalize to -23 LUFS before chain matrix | Section 5A |
| 2 | Parallel saturation mix control — wet/dry blend on all saturation/heavy compression | Section 5D |
| 3 | Silence-stripped overlap detection — librosa.effects.split before overlap calc | Multiple Main Vocal Overlap Handling |
| 4 | Demucs artifact kill switch — correlation check, abort if < 0.85 | Section 5E, Beat Polish |
| 5 | De-esser frequency detection per vocalist — not hardcoded | Section 5B |
| 6 | Whisper timestamp quantization to beat grid (1/16 note) | Section 5F |
| 7 | Duration limit on uploads (warn > 8min, reject > 15min) | Duration Limit (after Empty Files) |
| 8 | Crossfade length 50ms not 15ms | Overlap handling, breath editing, section crossfades |

---

## IMPLEMENTATION ORDER

1. Schema + API routes + webhook routes
2. Frontend wizard with labeled upload fields (multiple files per field)
3. analyze-mix action (BPM, key, structure, Whisper, quality scoring, beat vocal detection)
4. mix-full action — SINGLE VOCAL + SINGLE BEAT FIRST. Get this flawless.
5. Add multi-file handling (overlap detection, panning spread, level normalization)
6. Integrate genre + role chain matrix
7. Add cleanup chain (de-reverb, breath editing, pitch correction)
8. Add creative effects (reverb, delay throws, section-aware processing)
9. Add bus processing and mix variations
10. Add quality gate
11. Add Beat Polish add-on (Demucs + beat stem processing)
12. Add revision flow (Premium/Pro)
13. Preview player integration
14. Cross-sell CTAs
15. Cog push

---

## COST IMPACT

| Component | Cost |
|-----------|------|
| Replicate CPU (analysis + mix + preview + QA) | $0.03-0.08 |
| Beat Polish add-on (Demucs + stem processing) | +$0.02-0.04 |
| Claude Sonnet (direction + delay + QA) | $0.05-0.10 |
| Claude Haiku (recommendation) | $0.005 |
| Whisper transcription | $0.01 |
| Supabase Storage | < $0.001 |
| Total (standard) | $0.10-0.20 |
| Total (with Beat Polish) | $0.12-0.24 |

99.7%+ margin at $59.99. 99.8%+ at $99.99. Beat Polish at +$19.99 is 99.8%+ on its own.
