# IndieThis — AI Mix Console Spec
_For Sonnet — New feature. Builds on existing mastering pipeline architecture (webhooks, Replicate Cog, Supabase Storage, Stripe PPU). Do not modify mastering. This is a separate tool._

---

## OVERVIEW

The AI Mix Console is a full mixing engine that takes raw audio inputs and outputs a polished, radio-ready mixed track. Two use cases:

1. **Vocal + Beat** — Artist uploads their vocal recording and an instrumental/beat. The engine separates, cleans, processes, balances, and mixes to a stereo track.
2. **Tracked-out Stems** — Producer uploads 2–16 individual stems (kick, snare, bass, vocals, synths, etc.). The engine classifies, processes each stem with genre-aware chains and creative effects, and mixes to a stereo track.

The mixed output can optionally feed into the mastering pipeline.

---

## PRICING

Pure PPU. No subscriber discount. No subscriber allocations. Every mix is a paid transaction.

| Tier | Price | What they get |
|------|-------|---------------|
| Standard | $59.99 | 3 mix variations (Clean/Polished/Aggressive), full vocal chain, breath editing, pitch correction, de-ess, panning, bus processing, all export formats |
| Premium | $79.99 | AI-recommended mix + 2 revision rounds, delay throws, reverb, de-reverb, section-aware processing, custom direction textarea, reference track matching, all formats |
| Pro | $99.99 | Everything in Premium + Claude identifies delay words from lyrics, 3 revision rounds, per-word custom delay requests in plain English, full section-aware mixing, ad-lib/doubles detection, all formats |

Cost per job: ~$0.08–0.15 (Replicate CPU + Claude calls). 99%+ margin on all tiers.

---

## PIPELINE

### Status Flow

```
PENDING → UPLOADING → ANALYZING → AWAITING_DIRECTION → MIXING → PREVIEWING → COMPLETE
```

If stems need separation (Vocal + Beat mode):
```
PENDING → UPLOADING → SEPARATING → ANALYZING → AWAITING_DIRECTION → MIXING → PREVIEWING → COMPLETE
```

Revision rounds (Premium/Pro):
```
COMPLETE → REVISING → PREVIEWING → COMPLETE
```

### Step-by-Step

**Step 1 — Frontend Wizard**

New page: `/mix-console` (public, gated by email/OAuth like mastering)

Wizard steps: email → mode → upload → configure → payment → processing → direction → preview/compare → export

Mode selection:
- **Vocal + Beat** — upload 2 files: vocal WAV/MP3 + instrumental WAV/MP3
- **Tracked-out Stems** — upload 2–16 WAV files, label each (vocal, kick, snare, hi-hat, bass, synth, pad, guitar, keys, fx, ad-lib, doubles, backing vocal, other)

Configure step collects:

| Field | Type | Options |
|-------|------|---------|
| `genre` | Dropdown | Auto-detect / Hip-Hop / R&B / Pop / Rock / Electronic / Acoustic / Lo-Fi |
| `breathEditing` | Dropdown | Off / Subtle (-6–12dB) / Clean (remove, leave gaps) / Tight (remove, close gaps) |
| `pitchCorrection` | Dropdown | Off / Subtle / Tight / Hard |
| `delayStyle` | Dropdown | Off / Subtle / Standard / Heavy |
| `mixVibe` | Dropdown | Clean & natural / Polished radio-ready / Dark & moody / Bright & airy / Raw & gritty |
| `reverbStyle` | Dropdown | Dry / Room / Plate / Hall / Cathedral |
| `fadeOut` | Dropdown | Auto-detect / Yes (3s) / Yes (5s) / Yes (8s) / No |
| `customDirection` | Textarea | Premium/Pro only — "Put delay on 'tonight' in the chorus, more reverb on verse 2, keep the bridge dry" |
| `referenceTrackUrl` | File upload | Premium/Pro only — reference track for sonic matching |

**Step 2 — Job Creation**

`POST /api/mix-console/job` — creates `MixJob` record with all config fields. Status: PENDING.

Vocal + Beat mode → fires Demucs separation on the beat via fal.ai to isolate drums/bass/other from instrumental, keeps vocal as-is. Status: SEPARATING.

Tracked-out Stems mode → skips separation, goes straight to analysis. Status: ANALYZING.

**Step 3 — Analysis (Replicate: `analyze-mix` action)**

Runs on all input files:

- BPM detection (librosa `beat_track`)
- Key detection (Krumhansl-Schmuckler chroma)
- Per-stem frequency analysis (sub/low/mid/high band energies)
- Per-stem RMS levels
- Song structure detection (verse/chorus/bridge/intro/outro from energy contours + onset detection)
- Vocal transcription via Whisper → lyrics text + word-level timestamps
- Vocal classification: detect which vocal files are lead, doubles, ad-libs, backing vocals (by comparing spectral similarity, timing overlap, and RMS levels between vocal stems)
- Room reverb detection on vocals (RT60 estimation from spectral decay)
- Pitch deviation analysis (how far off-key the vocal is per segment)
- Phase coherence check between stems

Returns analysis JSON to webhook. Claude Sonnet reads analysis + genre + user direction and returns:

- Mix chain parameters per stem
- Delay throw word list with timestamps (from lyrics)
- Section-aware processing map (which settings change per section)
- Direction recommendation text for the artist

Status → AWAITING_DIRECTION.

**Step 4 — Direction Step (Frontend)**

Same pattern as mastering. Artist sees Claude's recommendation, e.g.:

"Your vocals were recorded in a room with moderate reverb — I'll clean that up first. The vocal sits at -12 LUFS against a beat at -8 LUFS, so I'll boost vocal presence and duck the beat during verses. I'm hearing delay throw opportunities on 'tonight' at 0:42 and 'away' at 1:15. The chorus could use a wider reverb tail. Want me to proceed with these settings?"

Artist accepts, modifies, or skips. Premium/Pro can add custom word-level delay requests here.

`POST /api/mix-console/job/[id]/confirm-direction`

Status → MIXING.

**Step 5 — Mix Engine (Replicate: `mix-full` action)**

This is the core processing. Runs the full chain in order:

### 5A. PRE-PROCESSING (CLEANUP)

Runs on vocal stems only, before any creative processing.

**De-reverb:**
- Estimate room reverb via spectral decay analysis
- Apply spectral subtraction to reduce room sound
- Strength based on detected RT60: light rooms get light treatment, heavy rooms get aggressive treatment
- Skip if RT60 < 0.2s (already dry enough)

**Noise gate:**
- Gate silence between vocal phrases
- Threshold: adaptive based on noise floor measurement from first 500ms of vocal file
- Hold time: 50ms, release: 100ms
- Preserves natural room feel, removes hiss/hum between phrases

**Breath editing (based on user selection):**
- Detect breaths: segments with RMS < phrase_avg * 0.3, duration 100–400ms, spectral centroid > 2kHz (breaths are spectrally bright)
- Subtle: reduce breath gain by 8dB
- Clean: replace breath segments with silence, keep gap duration intact
- Tight: replace breath segments with silence, crossfade adjacent words to close gaps (15ms crossfade)

**Mouth click / plosive removal:**
- Detect transient spikes < 10ms duration with energy > 2x surrounding RMS
- Apply 5ms fade over detected clicks
- Detect plosive pops: low-frequency transients (< 200Hz) > 3x surrounding energy in the first 20ms of a phrase
- Apply high-pass filter (80Hz, 12dB/oct) over plosive segments only

**Pitch correction (based on user selection):**
- Detect pitch per 50ms segment using `librosa.pyin`
- Calculate nearest note in detected key
- Off: skip
- Subtle: shift 40% toward correct note using pyrubberband, preserve vibrato
- Tight: shift 70% toward correct note, reduce vibrato depth by 50%
- Hard: shift 95% toward correct note, minimal vibrato (snap to grid)
- Never pitch-correct segments detected as intentional bends, runs, or melisma (detect via pitch rate-of-change > threshold)

### 5B. VOCAL CLASSIFICATION

If multiple vocal files uploaded, classify each:

**Lead vocal detection:**
- Highest average RMS
- Most continuous signal (fewest gaps)
- Centered mono signal (low stereo width)
- Most spectral similarity to typical vocal fundamental range (80Hz–1kHz)

**Doubles detection:**
- High spectral correlation with lead (> 0.85 cosine similarity)
- Similar timing (onset alignment within 50ms of lead)
- Similar pitch contour

**Ad-lib detection:**
- Sparse signal (many gaps, short phrases)
- Often higher pitch or different register than lead
- Low timing correlation with lead

**Backing vocal detection:**
- Different pitch than lead (harmony intervals detected)
- May have multiple voices (wider spectral spread)
- Lower RMS than lead

Classification stored per stem: `{ role: "lead" | "double" | "adlib" | "backing", confidence: 0.92 }`

### 5C. PER-STEM PROCESSING CHAINS

Each stem gets a Pedalboard chain tailored to its classification and genre.

**Lead Vocal Chain:**
1. High-pass filter: 80Hz, 12dB/oct (remove rumble)
2. Subtractive EQ: notch resonant frequencies detected in analysis (typically 300–500Hz muddiness)
3. Compression stage 1 (fast): ratio 4:1, attack 2ms, release 80ms, threshold adaptive (target 4–6dB gain reduction). Catches transient peaks.
4. Compression stage 2 (slow): ratio 2.5:1, attack 15ms, release 200ms, threshold adaptive (target 2–3dB gain reduction). Levels the performance.
5. Vocal level riding: divide vocal into 500ms chunks, calculate RMS per chunk, apply gain adjustment to bring each chunk within 3dB of target RMS. Smoothed with 50ms crossfades. This replaces manual fader riding.
6. De-esser: detect sibilant energy (4–9kHz), reduce gain by 4–8dB on sibilant segments only. Threshold adaptive per vocalist.
7. Additive EQ: presence boost 2–5kHz (+2–4dB wide bell), air boost 10–12kHz (+1.5–3dB shelf). Genre-adjusted:
   - Hip-Hop: more 3kHz presence, less air
   - R&B: gentle 2kHz warmth, silky 12kHz air
   - Pop: bright 4–5kHz presence, wide air shelf
   - Rock: aggressive 3kHz cut-through
8. Saturation: light tube saturation for warmth (Pedalboard distortion at very low drive, < 5%)
9. Parallel compression: duplicate chain with ratio 8:1, fast attack, blend at 20–30% with dry signal

**Double Vocal Chain:**
1. Same cleanup as lead
2. Slight pitch detune: +7 cents on one copy, -7 cents on another (if stereo doubles)
3. Pan: L30/R30 (or wider based on how many doubles)
4. High-pass slightly higher: 120Hz
5. Heavier de-essing than lead (reduce consonant buildup)
6. Compression: ratio 4:1, flatten dynamics more than lead
7. Volume: -3 to -6dB below lead

**Ad-lib Chain:**
1. Cleanup + pitch correction (same as lead settings)
2. More reverb than lead (1.5x send level)
3. Pan: varies per ad-lib, alternate L20/R20/L40/R40
4. Volume: -4 to -8dB below lead, genre-dependent (hip-hop ad-libs louder, pop quieter)
5. Slight delay: 1/16 note, low feedback, adds width

**Backing Vocal Chain:**
1. Heavy de-essing (reduce consonant wash)
2. Heavier compression (ratio 5:1, flatten)
3. High-pass at 150Hz (thin them out, keep them out of lead's space)
4. Pan: wide stereo spread L50–R50 or wider
5. Volume: -6 to -10dB below lead
6. More reverb than lead (2x send level)
7. Chorus effect: subtle, adds width without obvious modulation

**Drum Chain (kick/snare/hi-hat/percussion):**
1. Kick: low shelf boost +3dB at 60Hz, scoop 300Hz, transient shaper (attack +4dB)
2. Snare: presence at 2kHz, body at 200Hz, compression ratio 4:1
3. Hi-hat: high-pass at 300Hz, gentle compression, pan R10–R20
4. Percussion: compress lightly, pan to taste

**Bass Chain:**
1. High-pass at 30Hz (remove sub-sub rumble)
2. Low shelf boost at 80Hz (+2–3dB)
3. Compression: ratio 3:1, slow attack (30ms), medium release
4. Side-chain from kick: duck bass 3–4dB when kick hits (prevents low-end mud)
5. Saturation for harmonic presence on small speakers
6. Mono below 120Hz

**Synth/Keys/Pad Chain:**
1. High-pass at 100Hz (stay out of bass range)
2. Gentle EQ based on frequency analysis
3. Stereo widening (Pedalboard chorus at very low rate, high mix)
4. Pan to taste (keys slightly left, pad slightly right, or per analysis)
5. Light compression

**Other/FX Chain:**
1. Minimal processing — preserve character
2. Level balance only
3. Pan based on arrangement needs

### 5D. FREQUENCY UNMASKING

After per-stem processing, before bus:

- Compare lead vocal frequency spectrum with instrumental sum
- Identify competing frequency bands (where both have strong energy, typically 2–5kHz)
- Apply dynamic EQ cut on the instrumental in those bands: -2 to -4dB, triggered only when vocal is present
- This carves a pocket for the vocal to sit in without permanently cutting the instrumental

### 5E. SIDE-CHAIN COMPRESSION

- Duck the full instrumental bus 2–3dB when lead vocal is active
- Attack: 5ms, release: 100ms
- Detect vocal activity from RMS threshold (not just presence of audio — silence in vocal doesn't trigger duck)
- This is subtle — the listener shouldn't hear pumping, just clarity

### 5F. CREATIVE EFFECTS

**Reverb (per-section):**
- Apply based on user's `reverbStyle` selection
- Section-aware: chorus gets 1.5x the reverb send of the verse, bridge can go either way (Claude decides)
- Reverb tail cut: apply gate or sidechain to reverb return so it doesn't bleed into the next vocal phrase
- Pedalboard Reverb with parameters adjusted per style:
  - Dry: room_size 0.1, wet_level 0.05
  - Room: room_size 0.3, wet_level 0.15
  - Plate: room_size 0.5, wet_level 0.2, damping 0.7
  - Hall: room_size 0.7, wet_level 0.25
  - Cathedral: room_size 0.9, wet_level 0.3

**Delay throws (tempo-synced, word-level):**

Claude provides a delay throw list from lyrics analysis:
```json
[
  { "word": "tonight", "start": 42.3, "end": 42.8, "type": "dotted_eighth", "feedback": 3, "section": "chorus" },
  { "word": "away", "start": 58.1, "end": 58.4, "type": "quarter", "feedback": 2, "section": "verse2" }
]
```

For each delay throw:
- Extract the word's audio segment (start to end timestamp)
- Apply tempo-synced delay (BPM from analysis):
  - Dotted eighth: delay_time = (60/BPM) * 0.75
  - Quarter: delay_time = (60/BPM)
  - Half: delay_time = (60/BPM) * 2
- Feedback: number of repeats (2–5), each repeat -6dB
- Mix the delayed signal back into the vocal at the correct timestamp
- Only apply where there's sufficient silence after the word for the tail

Custom word requests (Pro tier): Claude matches user-specified words to Whisper timestamps and adds them to the throw list. If a word isn't found, store a warning: `"Could not find 'remember' in lyrics — closest match: 'remind' at 1:23"`

**Delay style presets (from user dropdown):**
- Off: no throws
- Subtle: 1–2 throws per section, dotted eighth, 2 feedback
- Standard: end-of-bar throws, mix of dotted eighth and quarter, 3 feedback
- Heavy: multiple throws per section, quarter and half, 4–5 feedback, wider stereo spread on delay returns

**Vocal silence fill (inspired by Cryo Mix "Magic Touch"):**
- Detect gaps > 500ms in lead vocal where instrumental continues
- Add a subtle reverb swell in those gaps (reverb tail from the last word fills the space)
- Prevents dead air feeling — the vocal "breathes" through gaps naturally
- Amount: barely audible, -18dB below vocal level

### 5G. SECTION-AWARE PROCESSING (Premium/Pro)

Claude identifies sections from structure analysis + lyrics:

```json
{
  "sections": [
    { "name": "intro", "start": 0, "end": 8.5 },
    { "name": "verse1", "start": 8.5, "end": 32.0 },
    { "name": "chorus1", "start": 32.0, "end": 48.0 },
    { "name": "verse2", "start": 48.0, "end": 72.0 },
    { "name": "chorus2", "start": 72.0, "end": 88.0 },
    { "name": "bridge", "start": 88.0, "end": 104.0 },
    { "name": "chorus3", "start": 104.0, "end": 120.0 },
    { "name": "outro", "start": 120.0, "end": 135.0 }
  ]
}
```

Processing changes per section:
- **Verse**: tighter reverb, less compression, vocals slightly more intimate
- **Chorus**: wider reverb, more parallel compression, vocals pushed forward, delay throws active, backing vocals louder
- **Bridge**: creative choice (Claude decides based on genre/mood — could go sparse and dry or wide and atmospheric)
- **Intro/Outro**: gradual effect builds, fade out if configured

The engine processes the mix in section chunks, applying different Pedalboard parameters per section, then crossfades between sections (15ms) to prevent audible processing changes.

### 5H. BUS PROCESSING

After all stems are processed and summed to stereo:

1. **Glue compression**: ratio 2:1, attack 30ms, release 200ms, threshold set for 1–2dB gain reduction. Gently bonds all elements together.
2. **Bus EQ**: subtle tilt — slight low shelf boost (+0.5dB at 80Hz), slight high shelf boost (+1dB at 10kHz). Genre-adjusted.
3. **Stereo imaging**: ensure mono compatibility (check for phase issues), widen if needed, collapse low end to mono below 120Hz.
4. **Peak normalize**: to -1dBFS (leaves headroom for mastering).

### 5I. FADE OUT

If `fadeOut` is "Auto-detect":
- Analyze last 10 seconds of the mixed track
- If the track has a natural ending (energy drops to < -40dB RMS naturally), no fade needed
- If the track loops or cuts abruptly (energy stays above -20dB RMS at the end), apply a fade
- Default auto-fade duration: 5 seconds

If user selected a specific fade duration, apply that.

Fade curve: exponential (not linear — linear fades sound unnatural).

### 5J. MIX VARIATIONS (Standard tier)

Generate 3 variations from the same processed stems by adjusting the bus and effect parameters:

| Variation | Character |
|-----------|-----------|
| **Clean** | Minimal effects, transparent, vocals up front, dry reverb, no delay throws, gentle bus compression |
| **Polished** | Industry standard, balanced reverb, delay throws active, full vocal chain, moderate bus compression |
| **Aggressive** | Harder compression across the board, more saturated, vocals pushed, punchier drums, tighter low end |

Each variation gets a 30-second preview from the highest-energy section (same window for all 3, same as mastering preview logic).

### 5K. AI-RECOMMENDED MIX (Premium/Pro)

Instead of variations, Claude picks the single best mix configuration based on:
- Genre conventions
- Input quality analysis
- User direction
- Reference track (if provided via Matchering spectral matching)

One mix generated. Artist previews. If not satisfied, revision rounds:

**Revision flow:**
1. Artist gives feedback in plain English: "vocals too quiet", "too much reverb on chorus", "remove the delay on 'baby'", "make it darker"
2. `POST /api/mix-console/job/[id]/revise` with feedback text
3. Claude reads feedback + previous parameters, outputs adjusted parameters
4. Engine re-runs the mix with new parameters (doesn't re-run cleanup/analysis — only re-runs from step 5C onward)
5. New preview generated

Premium: 2 revision rounds. Pro: 3 revision rounds. After that, à la carte revisions at $9.99 each.

**Step 6 — Preview (Replicate: `preview-mix` action)**

Same preview player as mastering — logo-shaped player, dual waveform (original vocal+beat vs mixed output), A/B toggle with volume matching, version boxes (Standard) or single preview (Premium/Pro).

30-second preview from highest-energy section. All variations/versions use the same 30-second window.

Preview clips stored in Supabase Storage.

**Step 7 — Delivery**

On version selection:
- Full mixed file available for download
- All formats: MP3 320, WAV 16-bit 44.1kHz, WAV 24-bit 44.1kHz, WAV 24-bit 48kHz, FLAC, AIFF
- Email sent with download link (same as mastering — subscribers get dashboard link, guests get tokenized link with 7-day expiry)
- CTA: "Master this track" → links to mastering wizard with the mixed file pre-loaded

**Step 8 — Optional Mastering Handoff**

After download, the compare screen shows: "Ready to master? Take your mix to release-ready for $7.99"

One click → creates a mastering job with the mixed file as input, skips the upload step, pre-fills genre and platform targets from the mix job. Separate payment.

---

## SCHEMA

### MixJob (new Prisma model)

```prisma
model MixJob {
  id                    String   @id @default(cuid())
  userId                String?
  guestEmail            String?
  mode                  String   // VOCAL_BEAT | TRACKED_STEMS
  tier                  String   // STANDARD | PREMIUM | PRO
  status                String   // PENDING | UPLOADING | SEPARATING | ANALYZING | AWAITING_DIRECTION | MIXING | PREVIEWING | COMPLETE | REVISING | FAILED

  // Input files
  inputFiles            Json     // [{ url, label, role }]
  referenceTrackUrl     String?

  // Configuration
  genre                 String?
  breathEditing         String?  // OFF | SUBTLE | CLEAN | TIGHT
  pitchCorrection       String?  // OFF | SUBTLE | TIGHT | HARD
  delayStyle            String?  // OFF | SUBTLE | STANDARD | HEAVY
  mixVibe               String?  // CLEAN | POLISHED | DARK | BRIGHT | RAW
  reverbStyle           String?  // DRY | ROOM | PLATE | HALL | CATHEDRAL
  fadeOut                String?  // AUTO | 3S | 5S | 8S | NO
  customDirection       String?  // Premium/Pro free text
  directionUsed         String?  // Combined direction applied

  // Analysis
  analysisData          Json?    // { bpm, key, sections, vocalClassification, stemAnalysis }
  lyrics                String?  // Whisper transcription
  wordTimestamps        Json?    // [{ word, start, end }]
  directionRecommendation String? // Claude's suggestion text
  delayThrows           Json?    // [{ word, start, end, type, feedback, section }]

  // Mix parameters
  mixParameters         Json?    // Full chain params per stem, set by Claude
  sectionMap            Json?    // Section boundaries and per-section overrides

  // Output files — variations (Standard)
  cleanFilePath         String?
  polishedFilePath      String?
  aggressiveFilePath    String?

  // Output files — single mix (Premium/Pro)
  mixFilePath           String?

  // Preview
  previewWaveformOriginal Json?  // [200 floats]
  previewWaveformMixed    Json?  // [200 floats] per variation or single
  previewFilePaths      Json?    // { clean, polished, aggressive } or { mix }

  // Revision tracking
  revisionCount         Int      @default(0)
  maxRevisions          Int      @default(0)  // 0=Standard, 2=Premium, 3=Pro
  revisionHistory       Json?    // [{ feedback, parametersApplied, timestamp }]

  // Vocal classification results
  vocalClassification   Json?    // [{ stemIndex, role, confidence }]

  // Payment
  stripePaymentId       String?
  amount                Int

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
```

---

## PYTHON ENGINE ADDITIONS (predict.py)

New actions to add to the Replicate Cog:

| Action | What it does |
|--------|-------------|
| `analyze-mix` | BPM, key, per-stem frequency analysis, structure detection, Whisper transcription, vocal classification, room reverb estimation, pitch deviation analysis |
| `mix-full` | Full mixing chain: cleanup → per-stem processing → creative effects → bus processing → output |
| `preview-mix` | Extract 30s highest-energy window, generate preview clips for each variation |
| `revise-mix` | Re-run mix chain from step 5C with adjusted parameters (skip cleanup/analysis) |

### New Python Dependencies

Add to `cog.yaml`:

```
- pyrubberband
- praat-parselmouth
- openai-whisper (or faster-whisper)
- pyloudnorm
- matchering
```

System packages:
```
- rubberband-cli
- ffmpeg
```

### Cog Image Size Impact

Current mastering Cog is ~500MB. Adding Whisper (~1.5GB for base model) is the biggest addition. Use `faster-whisper` with the `base` model (~150MB) to keep it manageable. Total image: ~700MB. Cold start adds ~5 seconds.

---

## WEBHOOK ROUTES

| Route | Trigger |
|-------|---------|
| `POST /api/mix-console/webhook/replicate/analyze` | Analysis complete |
| `POST /api/mix-console/webhook/replicate/mix` | Mix complete |
| `POST /api/mix-console/webhook/replicate/preview` | Preview complete |
| `POST /api/mix-console/webhook/replicate/revise` | Revision complete |

Same webhook pattern as mastering — Replicate calls the URL when processing finishes, webhook route updates DB and fires next action.

---

## API ROUTES

| Route | Method | Description |
|-------|--------|-------------|
| `/api/mix-console/job` | POST | Create job, start processing |
| `/api/mix-console/job/[id]` | GET | Poll job status + data |
| `/api/mix-console/job/[id]/confirm-direction` | POST | Accept/modify/skip direction |
| `/api/mix-console/job/[id]/revise` | POST | Submit revision feedback (Premium/Pro) |
| `/api/mix-console/job/[id]/select` | POST | Select final version |
| `/api/mix-console/job/[id]/download` | GET | Download in chosen format |

---

## FRONTEND PAGES

| Page | Description |
|------|-------------|
| `/mix-console` | Public landing + gate screen (email/OAuth) |
| `/mix-console/wizard` | Upload, configure, pay, processing, direction, compare, export |
| `/mix-console/results` | Guest tokenized results page (same as mastering pattern) |
| `/dashboard/ai/mix-console` | Subscriber access point + job history |

---

## CROSS-SELL INTEGRATION

After mix completes, show on compare screen:
- "Master this track" CTA → pre-loads mixed file into mastering wizard

On mastering landing page:
- "Got raw vocals over a beat? Mix first for the best results." → links to mix console

On dashboard home for users with uploaded tracks:
- Mix Console card in AI Tools section

Post-mastering email:
- "Next time, mix your track with us first — then master. Full pipeline, one platform."

After vocal remover completes:
- "Need to mix these stems into a full track?" → links to mix console

---

## WHAT MAKES THIS DIFFERENT FROM COMPETITORS

| Feature | IndieThis | Cryo Mix | LANDR | RoEx Automix |
|---------|-----------|----------|-------|-------------|
| Section-aware processing | ✅ Claude identifies sections, changes processing per verse/chorus/bridge | ❌ | ❌ | ❌ |
| Lyric-driven delay throws | ✅ Claude reads lyrics, places delays on specific words | ❌ | ❌ | ❌ |
| Custom word delay requests | ✅ Artist tells Claude which words to delay in plain English | ❌ | ❌ | ❌ |
| Vocal classification (lead/double/ad-lib/backing) | ✅ Auto-detect and process differently | ❌ | ❌ | ❌ |
| De-reverb on input | ✅ Spectral subtraction | ✅ | ❌ | ❌ |
| Breath editing (3 levels) | ✅ | ❌ | ❌ | ❌ |
| Pitch correction | ✅ 4 levels | ❌ | ❌ | ❌ |
| Reference track matching | ✅ Matchering | ❌ | ❌ | ❌ |
| Revision rounds with plain English feedback | ✅ 2–3 rounds | ❌ | ❌ | ❌ |
| Feeds into mastering pipeline | ✅ One-click handoff | ❌ | Separate tool | ❌ |
| Up to 16 stems | ✅ | ✅ (32) | ❌ | ✅ |
| Genre-aware chains | ✅ | Partial | ❌ | ✅ |

The intelligence layer is the differentiator. Nobody else has an AI that reads lyrics, understands song structure, and makes creative mixing decisions per section. This is an AI mix engineer, not a preset applier.

---

## IMPLEMENTATION ORDER

1. Schema + API routes + webhook routes (boilerplate from mastering pattern)
2. Frontend wizard (clone mastering wizard, adjust steps)
3. `analyze-mix` action in predict.py (BPM, key, structure, Whisper, vocal classification)
4. `mix-full` action — start with basic per-stem chains (EQ, compression, de-ess), get the pipeline working end-to-end
5. Add cleanup chain (de-reverb, breath editing, pitch correction)
6. Add creative effects (reverb, delay throws, section-aware processing)
7. Add bus processing and mix variations
8. Add revision flow (Premium/Pro)
9. Preview player integration (same component as mastering)
10. Cross-sell CTAs
11. Cog push with all new dependencies

### Cog Push Checklist
- [ ] Add pyrubberband, praat-parselmouth, faster-whisper, matchering to requirements
- [ ] Add rubberband-cli to system packages
- [ ] Add all new actions to predict.py
- [ ] Test locally with sample vocal + beat
- [ ] `cog push` from Codespace
- [ ] Update `REPLICATE_MIX_MODEL_VERSION` in Vercel env vars

---

## COST IMPACT

| Component | Cost per job |
|-----------|-------------|
| Replicate CPU (analysis + mix + preview) | $0.03–0.08 |
| Claude Sonnet (direction + delay analysis) | $0.05–0.10 |
| Claude Haiku (recommendation text) | $0.005 |
| Whisper transcription | $0.01 |
| Supabase Storage (mixed files) | < $0.001 |
| **Total** | **$0.10–0.20** |

At $59.99 minimum price, margin is 99.7%+. At $99.99 Pro price, margin is 99.8%+.

Revision rounds add ~$0.05 per revision (re-run mix chain + Claude call). Still negligible.
