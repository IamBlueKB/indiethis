# IndieThis — Reference Analysis & Learning Engine

_For Sonnet — New system. Builds on existing mix console pipeline, mastering pipeline, and admin panel. Does not modify existing mix or mastering processing. Adds a data layer that Claude reads at runtime to make better mix/master decisions._

---

## OVERVIEW

The Reference Analysis & Learning Engine is a three-tier intelligence system that teaches Claude what professional mixes sound like, what IndieThis users want to sound like, and what's working on the platform. It has no user-facing UI except the reference track upload that already exists in Premium/Pro tiers. Everything else is admin-side and backend.

### Three Tiers of Reference Data

| Tier | Source | Purpose | Who controls it |
|------|--------|---------|----------------|
| 1. Commercial Library | Admin uploads batches of professional tracks per genre | Ground truth baseline — what a professional mix sounds like | You (admin panel) |
| 2. User Reference Uploads | Premium/Pro users upload "make it sound like this" tracks | What your actual users aspire to sound like | Automatic with popularity weighting |
| 3. User Mix Outcomes | Every completed mix job on the platform | What's working and what's not — feedback loop | Automatic with quality gating |

Claude checks all three at runtime. Commercial library sets the target. Popular user references adjust toward audience preference. Mix outcomes refine what's working.

---

## TIER 1: COMMERCIAL REFERENCE LIBRARY

### Admin Panel Section

New section in existing admin panel: **Reference Library**

**UI:**
- Drop zone that accepts multiple audio files (WAV, MP3, FLAC)
- Genre dropdown — same 12 genres as chain matrix: Hip-Hop, Trap, R&B, Pop, Rock, Electronic, Acoustic, Lo-Fi, Afrobeats, Latin, Country, Gospel
- Subgenre text field (optional) — for future granularity: "drill", "bedroom pop", "neo-soul"
- Source quality dropdown — where the audio came from (affects analysis weight):

| Source | Quality | Analysis Weight | Notes |
|--------|---------|----------------|-------|
| Lossless (WAV/FLAC/AIFF) | Best | 1.0 | Studio masters, CD rips, purchased lossless |
| Apple Music (ALAC) | Excellent | 1.0 | Apple Lossless — equivalent to WAV for analysis |
| Tidal (FLAC/MQA) | Excellent | 1.0 | HiFi tier is lossless FLAC |
| Spotify (320kbps OGG) | High | 0.9 | Premium tier — reliable for frequency/dynamics analysis |
| Amazon Music HD | Excellent | 1.0 | Ultra HD tier is lossless |
| Deezer (FLAC) | Excellent | 1.0 | HiFi tier is lossless FLAC |
| YouTube (128-256kbps) | Standard | 0.6 | Lossy compression — high-frequency data unreliable above 16kHz |
| SoundCloud (128kbps) | Low | 0.5 | Heavy compression — use only when no better source exists |
| Other / Unknown | Standard | 0.6 | Default for untagged sources |

Lossless and high-quality sources should be prioritized. The stats table shows source quality breakdown per genre so you can see if a genre is over-reliant on low-quality sources.

- "Process Batch" button
- Progress bar — "Processing 14 of 50 tracks..."
- Cancel button — stops processing, keeps completed profiles

**Stats table below the upload:**

| Genre | Tracks | Lossless | High (Spotify) | Standard (YT/SC) | Last Updated | Avg LUFS | Status |
|-------|--------|----------|----------------|-------------------|--------------|----------|--------|
| Hip-Hop | 47 | 22 | 20 | 5 | Apr 20, 2026 | -13.8 | ✅ Ready |
| R&B | 42 | 18 | 19 | 5 | Apr 20, 2026 | -14.2 | ✅ Ready |
| Pop | 38 | 15 | 18 | 5 | Apr 18, 2026 | -13.5 | ✅ Ready |
| Rock | 0 | 0 | 0 | 0 | — | — | ⚠️ No data |

Minimum 20 tracks per genre before the profile is marked "Ready" and Claude starts using it. Below 20, Claude falls back to chain matrix defaults.

**Actions per genre row:**
- View profile details (opens modal with full frequency/dynamics breakdown)
- Reset genre (deletes all profiles, starts fresh)
- Export profile JSON

### Processing Pipeline

New Cog action: `analyze-reference`

Input: audio file URL, genre tag, source quality tag

Processing steps:

1. Load audio at native sample rate
2. Run Demucs separation → vocals, drums, bass, other
3. **Separation quality check (bleed detection):**
   - Sum all separated stems back together, compare to original via cross-correlation
   - Per-stem bleed score: cross-correlate each stem against every other stem. High correlation between vocals and "other" = vocal bleed into other
   - Compute separation_confidence: 0.0-1.0 score based on inter-stem isolation
   - If separation_confidence < 0.6 → flag as "poor separation," weight this profile at 0.3x in genre aggregate
   - If separation_confidence 0.6-0.8 → "acceptable separation," weight at 0.7x
   - If separation_confidence > 0.8 → "clean separation," full weight
   - Store separation_confidence in the profile so admin can see which tracks separated cleanly
4. Analyze each separated stem independently:
   - Integrated LUFS (pyloudnorm)
   - Short-term LUFS per 3-second window (for dynamic range mapping)
   - Frequency band energy distribution (sub: 20-60Hz, low: 60-250Hz, low-mid: 250-500Hz, mid: 500-2kHz, high-mid: 2-6kHz, air: 6-20kHz) via librosa STFT
   - Stereo width per frequency band (M/S energy ratio)
   - Peak level
   - RMS level
   - Crest factor (peak-to-RMS ratio — indicates compression amount)
   - Spectral centroid (brightness)
   - Spectral rolloff
5. Analyze stem relationships:
   - Vocal-to-drums LUFS ratio
   - Vocal-to-bass LUFS ratio
   - Vocal-to-other LUFS ratio
   - Frequency overlap between vocal and drums (2-5kHz competition)
   - Frequency overlap between vocal and other (mid-range competition)
   - Bass-to-kick frequency separation (how cleanly bass and kick are carved)
6. **Section-level analysis (temporal profiling):**
   - Detect song structure via librosa onset/spectral analysis: intro, verse, chorus, bridge, outro
   - For each detected section, compute:
     - Section LUFS (how loud is the chorus vs verse?)
     - Section frequency balance (does the chorus have more high-mid energy?)
     - Section stereo width (does the chorus widen?)
     - Section vocal-to-beat ratio (do vocals push forward in the chorus?)
     - Section compression character (is the chorus more compressed?)
   - Store as a section map with per-section profiles
   - This feeds directly into section-aware processing (Premium/Pro) — Claude knows "in professional hip-hop, choruses are typically 2dB louder than verses with 15% more stereo width"
7. Analyze full mix (pre-separation):
   - Integrated LUFS
   - True peak
   - Loudness range (LRA)
   - Dynamic range
   - Stereo width
   - Frequency balance curve
   - Reverb estimation (RT60 from tail analysis)
   - Compression characteristics (crest factor change over time)
8. Return profile JSON
9. Audio file is NOT stored — only the numerical profile is kept

### Profile JSON Structure

```json
{
  "genre": "HIP_HOP",
  "subgenre": "trap",
  "source": "commercial",
  "analyzed_at": "2026-04-23T...",
  "separation_confidence": 0.87,
  "separation_weight": 1.0,
  "mix": {
    "lufs": -13.8,
    "true_peak": -0.8,
    "loudness_range": 6.2,
    "dynamic_range": 8.4,
    "stereo_width": 0.78,
    "rt60_estimate": 0.4,
    "frequency_balance": {
      "sub": 0.18,
      "low": 0.22,
      "low_mid": 0.15,
      "mid": 0.20,
      "high_mid": 0.14,
      "air": 0.11
    }
  },
  "stems": {
    "vocals": {
      "lufs": -18.2,
      "peak": -3.1,
      "crest_factor": 12.4,
      "spectral_centroid": 2840,
      "frequency_balance": { ... },
      "stereo_width": 0.45
    },
    "drums": {
      "lufs": -15.6,
      "peak": -1.2,
      "crest_factor": 18.1,
      "spectral_centroid": 1200,
      "frequency_balance": { ... },
      "stereo_width": 0.62
    },
    "bass": { ... },
    "other": { ... }
  },
  "relationships": {
    "vocal_to_drums_db": -2.6,
    "vocal_to_bass_db": -1.8,
    "vocal_to_other_db": 1.2,
    "vocal_drum_freq_overlap": 0.35,
    "vocal_other_freq_overlap": 0.42,
    "bass_kick_separation": 0.78
  },
  "sections": {
    "intro": {
      "start_time": 0.0,
      "end_time": 12.5,
      "lufs": -16.2,
      "stereo_width": 0.65,
      "vocal_to_beat_db": null,
      "frequency_balance": { ... }
    },
    "verse_1": {
      "start_time": 12.5,
      "end_time": 45.0,
      "lufs": -14.5,
      "stereo_width": 0.72,
      "vocal_to_beat_db": -3.0,
      "frequency_balance": { ... }
    },
    "chorus_1": {
      "start_time": 45.0,
      "end_time": 72.0,
      "lufs": -12.8,
      "stereo_width": 0.85,
      "vocal_to_beat_db": -1.5,
      "frequency_balance": { ... }
    }
  }
  }
}
```

### Genre Aggregate Profile

After processing a batch, compute the genre aggregate — the statistical target Claude uses at runtime:

```json
{
  "genre": "HIP_HOP",
  "track_count": 47,
  "last_updated": "2026-04-23T...",
  "targets": {
    "mix_lufs": { "mean": -13.8, "std": 1.2, "p25": -14.5, "p75": -13.1 },
    "vocal_to_drums_db": { "mean": -2.6, "std": 0.8, "p25": -3.2, "p75": -2.0 },
    "vocal_to_bass_db": { "mean": -1.8, "std": 0.6, "p25": -2.2, "p75": -1.4 },
    "stereo_width": { "mean": 0.78, "std": 0.05, "p25": 0.74, "p75": 0.82 },
    "vocal_spectral_centroid": { "mean": 2840, "std": 320 },
    "vocal_crest_factor": { "mean": 12.4, "std": 2.1 },
    "frequency_balance": {
      "sub": { "mean": 0.18, "std": 0.03 },
      "low": { "mean": 0.22, "std": 0.02 },
      "low_mid": { "mean": 0.15, "std": 0.02 },
      "mid": { "mean": 0.20, "std": 0.03 },
      "high_mid": { "mean": 0.14, "std": 0.02 },
      "air": { "mean": 0.11, "std": 0.02 }
    }
  }
}
```

Mean is the target. Standard deviation tells Claude how much variance is acceptable. P25/P75 gives the "normal range" — anything outside that range is a red flag.

---

## TIER 2: USER REFERENCE UPLOADS

Premium/Pro users already have a reference track upload field in the mix console configure step. This tier captures and learns from those uploads.

### Per-Job Reference Analysis

When a user uploads a reference track:

1. Run `analyze-reference` on it (same pipeline as commercial)
2. Store the profile linked to the MixJob
3. Claude uses this profile as the PRIMARY target for that specific job — overrides the genre aggregate
4. Claude's direction recommendation says: "Your reference track has vocals sitting 2dB above the drums with bright presence at 4kHz. I'll target that balance for your mix."

### Popularity Tracking

Track which reference artists/tracks get uploaded most per genre:

```sql
-- After analysis, store reference metadata
INSERT INTO user_references (
  mix_job_id,
  genre,
  reference_profile_id,
  fingerprint_hash,  -- audio fingerprint to detect same song across users
  created_at
)
```

Use audio fingerprinting (chromaprint via `pyacoustid`) to detect when multiple users upload the same reference track. **Use fuzzy matching, not exact hash comparison** — different streaming rips, masters, or remixes of the same song will have slightly different fingerprints. Compare fingerprint similarity using chromaprint's built-in comparison:

```python
import chromaprint

def fingerprint_similarity(fp1, fp2):
    """Compare two chromaprint fingerprints. Returns 0.0-1.0 similarity."""
    # Decode fingerprints to bit arrays and compute Hamming distance
    bits1 = chromaprint.decode_fingerprint(fp1)[0]
    bits2 = chromaprint.decode_fingerprint(fp2)[0]
    min_len = min(len(bits1), len(bits2))
    if min_len == 0:
        return 0.0
    matching = sum(bin(a ^ b).count('0') for a, b in zip(bits1[:min_len], bits2[:min_len]))
    total_bits = min_len * 32
    return matching / total_bits

# Similarity > 0.85 = same song (different rip/master)
# Similarity > 0.70 = likely same song (remix or edit)
# Similarity < 0.70 = different song
```

When a new reference is uploaded, compare its fingerprint against all existing fingerprints in the same genre. If similarity > 0.85, group them as the same track. This catches different Spotify rips, Apple Music downloads, and YouTube conversions of the same song.

When a reference is uploaded 5+ times across different users in the same genre (using fuzzy grouping):

1. Flag it as a "popular reference" in admin panel
2. Auto-promote its profile into the genre aggregate with a weight of 0.5x (half the weight of a commercial track)
3. Show in admin panel: "Drake - 'Search & Rescue' uploaded as reference 12 times by Hip-Hop users"

This tells you what your users actually want to sound like without you having to guess.

### Popular References Table (Admin Panel)

New tab in the Reference Library section: **User Trends**

| Track (fingerprint) | Genre | Times Referenced | First Seen | Auto-Promoted |
|---------------------|-------|-----------------|------------|---------------|
| fingerprint_abc123 | Hip-Hop | 12 | Mar 2026 | ✅ Yes |
| fingerprint_def456 | R&B | 8 | Apr 2026 | ✅ Yes |
| fingerprint_ghi789 | Pop | 3 | Apr 2026 | ❌ Not yet (need 5) |

Admin can manually promote or exclude any reference.

---

## TIER 3: USER MIX OUTCOMES

Every completed mix job generates data. This tier collects it passively and uses it to refine the engine.

### What Gets Logged (Automatic)

On every completed MixJob:

```json
{
  "mix_job_id": "...",
  "genre": "HIP_HOP",
  "tier": "STANDARD",
  "input_quality_score": 82,
  "mix_params_used": { ... },  // Claude's actual decisions
  "output_analysis": {
    "lufs": -14.1,
    "true_peak": -0.9,
    "stereo_width": 0.76,
    "vocal_to_beat_db": -2.8,
    "frequency_balance": { ... }
  },
  "outcome": "DOWNLOADED",  // or "REVISED" or "ABANDONED"
  "revision_notes": null,    // or [{ time: 102, note: "too much reverb" }]
  "revision_count": 0,
  "time_to_download": 45,   // seconds from preview to download — fast = liked it
  "variation_selected": "polished"  // which of the 3 they picked
}
```

### Quality Gate for Learning

NOT every mix outcome feeds back into genre profiles. Quality gate:

| Condition | Feeds into learning? | Why |
|-----------|---------------------|-----|
| Input quality ≥ 70 AND downloaded without revision | ✅ Yes — full weight | Good input + satisfied user = valid data point |
| Input quality ≥ 70 AND downloaded after 1 revision | ✅ Yes — 0.7x weight | Good input, needed adjustment but got there |
| Input quality < 70 AND downloaded | ❌ No | Bad input could mean the mix sounds "good" relative to garbage, not actually professional |
| Input quality ≥ 70 AND abandoned (no download) | ❌ No | Something went wrong but we don't know what |
| Any quality AND revised with notes | ✅ Revision notes only | The notes tell us what humans don't like regardless of input quality |

### Output Comparison to Commercial Baseline

After every qualifying mix, compare the output analysis to the genre aggregate:

```python
def compute_deviation(output, genre_target):
    deviations = {}
    for param in ["lufs", "stereo_width", "vocal_to_beat_db"]:
        actual = output[param]
        target_mean = genre_target[param]["mean"]
        target_std = genre_target[param]["std"]
        z_score = (actual - target_mean) / target_std
        deviations[param] = z_score
    return deviations
```

If the output is within 1 standard deviation of the commercial target AND the user downloaded without revision → this reinforces the parameters Claude used.

If the output is within 1 standard deviation AND the user revised → the revision notes identify what the user didn't like despite being "technically correct."

If the output is more than 2 standard deviations away → outlier, exclude from learning, flag for admin review.

### Revision Pattern Analysis

Aggregate revision notes across all jobs to find systematic issues:

```sql
-- Find most common revision complaints per genre
SELECT genre, revision_keyword, COUNT(*) as frequency
FROM mix_revision_notes
GROUP BY genre, revision_keyword
ORDER BY frequency DESC
```

Claude parses revision notes into keywords: "reverb", "vocal level", "bass", "muddy", "thin", "compressed", etc.

If "too much reverb" appears in 30% of hip-hop revisions → the chain matrix hip-hop reverb wet is too high. Surface this in admin panel as an actionable insight.

### Learning Dashboard (Admin Panel)

New tab: **Mix Intelligence**

**Overview cards:**
- Total mixes processed: 1,247
- Mixes feeding learning: 892 (71% qualify)
- Average revision rate: 18%
- Most revised genre: Electronic (24%)
- Least revised genre: Hip-Hop (12%)

**Per-genre health:**

| Genre | Mixes | Qualify | Revision Rate | Top Complaint | Deviation from Baseline |
|-------|-------|---------|---------------|---------------|------------------------|
| Hip-Hop | 423 | 312 | 12% | "vocals too quiet" | 0.3σ (healthy) |
| R&B | 287 | 198 | 16% | "too much reverb" | 0.8σ (watch) |
| Electronic | 89 | 61 | 24% | "muddy low end" | 1.4σ (needs attention) |

**Actionable insights:**
- "R&B reverb wet is consistently 15% higher than commercial reference. Consider reducing chain matrix R&B reverb_wet from 0.20 to 0.17."
- "Hip-Hop users who upload Drake references revise 40% less than average. Drake reference profile may be a better target than genre average."

These insights surface automatically. You decide whether to act on them by adjusting the chain matrix or letting Claude auto-adjust.

---

## CLAUDE INTEGRATION AT RUNTIME

### During mix-full

When Claude generates mix decisions, it receives:

1. **Input analysis** — BPM, key, quality score, frequency data (already exists)
2. **Chain matrix defaults** — genre + role parameters (already exists)
3. **Genre aggregate profile** — from commercial library (new)
4. **User reference profile** — if Premium/Pro uploaded one (new)
5. **Genre learning data** — top revision complaints, deviation trends (new)

### Decision Priority

```
IF user uploaded a reference track:
    PRIMARY target = user reference profile
    SECONDARY target = genre aggregate
    Claude adjusts chain matrix parameters to match user reference
    
ELSE IF genre aggregate has 20+ tracks (Ready status):
    PRIMARY target = genre aggregate
    Claude adjusts chain matrix parameters to match genre target
    Claude avoids known revision complaints for this genre
    
ELSE:
    Fall back to chain matrix defaults (current behavior)
```

### What Claude Does With the Data

Claude compares the input analysis against the target profile and adjusts parameters:

"The input vocal has a spectral centroid of 2200Hz. The genre target is 2840Hz. I'll boost presence at 3-4kHz by 2dB to bring it closer to the target."

"The genre aggregate shows vocal-to-drums ratio of -2.6dB. The current chain matrix blend puts vocals at -4dB relative to drums. I'll boost the vocal gain by 1.5dB."

"R&B revision data shows 'too much reverb' is the top complaint. I'll reduce reverb wet from the chain matrix default of 0.20 to 0.16 for this mix."

"This user uploaded a reference track. The reference has very dry vocals with minimal reverb (RT60 0.2s) and bright presence at 5kHz. I'll override the genre defaults: reverb wet 0.08, presence boost +3dB at 5kHz."

### Prompt Addition to Claude

Add to the Claude system prompt in `decisions.ts`:

```
You have access to genre reference data that shows what professional {genre} mixes sound like.

Genre target profile:
{genre_aggregate_json}

Known issues from user feedback:
{revision_complaints}

{IF reference_track}
The user uploaded a reference track. Their reference profile:
{user_reference_json}
Target this reference's characteristics as your primary goal.
{/IF}

Adjust your mix decisions to move the output toward these targets. Do not deviate more than 1 standard deviation from the genre target unless the user's reference or custom direction specifically asks for it.
```

---

## WEIGHTING: COMMERCIAL VS USER DATA

Commercial weight NEVER drops. Professional engineered music is always the anchor.

Early on (< 100 user mixes per genre):
- Commercial weight: 1.0
- User mix outcome weight: 0.2
- Popular user references: 0.5

After 500+ qualifying user mixes per genre:
- Commercial weight: 1.0
- User mix outcome weight: 0.4
- Popular user references: 0.7

After 2000+ qualifying user mixes per genre:
- Commercial weight: 1.0
- User mix outcome weight: 0.5
- Popular user references: 0.8

The logic: commercial data is the professional standard and always stays at full weight. User data supplements and fine-tunes within that standard — it never overrides it. If user data contradicts commercial targets, commercial wins. User data helps Claude learn things like "IndieThis hip-hop users prefer vocals 1dB louder than the commercial average" — small adjustments within the professional envelope, not departures from it.

Source quality weighting also applies: a commercial reference from a lossless source carries full weight (1.0), while a YouTube rip carries 0.6. This means the genre aggregate naturally favors data from higher-quality sources.

Genre aggregate is recomputed nightly via a cron job that blends all three tiers at the current weights.

---

## SUPABASE SCHEMA

```sql
-- Individual reference track profiles (commercial + user references)
CREATE TABLE reference_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,           -- 'commercial' | 'user_reference' | 'user_mix_outcome'
  source_quality TEXT,            -- 'lossless' | 'apple_music' | 'tidal' | 'spotify' | 'amazon_hd' | 'deezer' | 'youtube' | 'soundcloud' | 'other'
  source_quality_weight FLOAT DEFAULT 1.0,  -- 1.0 for lossless, 0.9 for Spotify, 0.6 for YouTube, 0.5 for SoundCloud
  separation_confidence FLOAT,              -- 0.0-1.0 Demucs separation quality score
  separation_weight FLOAT DEFAULT 1.0,      -- 1.0 if clean, 0.7 if acceptable, 0.3 if poor
  genre TEXT NOT NULL,
  subgenre TEXT,
  fingerprint_hash TEXT,          -- chromaprint for dedup
  mix_job_id TEXT,                -- links to MixJob if source is user_reference or user_mix_outcome
  profile_data JSONB NOT NULL,    -- full analysis JSON
  quality_gate_passed BOOLEAN DEFAULT FALSE,
  weight FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregated genre targets (recomputed nightly)
CREATE TABLE genre_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  genre TEXT NOT NULL UNIQUE,
  track_count INT NOT NULL,
  commercial_count INT NOT NULL,
  user_ref_count INT NOT NULL,
  user_outcome_count INT NOT NULL,
  target_data JSONB NOT NULL,     -- aggregated mean/std/p25/p75
  last_computed TIMESTAMPTZ DEFAULT NOW()
);

-- User reference popularity tracking
CREATE TABLE user_reference_popularity (
  fingerprint_hash TEXT PRIMARY KEY,
  genre TEXT NOT NULL,
  upload_count INT DEFAULT 1,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  auto_promoted BOOLEAN DEFAULT FALSE,
  profile_id UUID REFERENCES reference_profiles(id)
);

-- Mix outcome feedback for learning
CREATE TABLE mix_outcome_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mix_job_id TEXT NOT NULL,
  genre TEXT NOT NULL,
  input_quality_score INT,
  mix_params_used JSONB,
  output_analysis JSONB,
  outcome TEXT NOT NULL,           -- 'downloaded' | 'revised' | 'abandoned'
  revision_notes JSONB,
  revision_keywords TEXT[],
  variation_selected TEXT,
  time_to_download INT,            -- seconds
  deviation_from_target JSONB,     -- z-scores per parameter
  qualifies_for_learning BOOLEAN DEFAULT FALSE,
  learning_weight FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revision pattern aggregation (materialized view, refreshed nightly)
CREATE MATERIALIZED VIEW revision_patterns AS
SELECT 
  genre,
  UNNEST(revision_keywords) as keyword,
  COUNT(*) as frequency,
  COUNT(*)::FLOAT / SUM(COUNT(*)) OVER (PARTITION BY genre) as percentage
FROM mix_outcome_feedback
WHERE revision_notes IS NOT NULL
GROUP BY genre, keyword
ORDER BY genre, frequency DESC;
```

---

## COG CHANGES

### New action: analyze-reference

Add to predict.py:

```python
def _analyze_reference(self, audio_url, genre):
    """Analyze a reference track for the genre profile library."""
    
    # 1. Download audio
    audio, sr = librosa.load(audio_url, sr=44100, mono=False)
    
    # 2. Run Demucs separation
    # Use the same Demucs call as Beat Polish but keep all 4 stems
    vocals, drums, bass, other = run_demucs(audio, sr)
    
    # 3. Analyze each stem
    stems_analysis = {}
    for name, stem in [("vocals", vocals), ("drums", drums), ("bass", bass), ("other", other)]:
        stems_analysis[name] = analyze_stem(stem, sr)
    
    # 4. Analyze relationships
    relationships = compute_relationships(stems_analysis)
    
    # 5. Analyze full mix
    mix_analysis = analyze_full_mix(audio, sr)
    
    # 6. Return profile (audio is not stored)
    return {
        "genre": genre,
        "source": "commercial",
        "mix": mix_analysis,
        "stems": stems_analysis,
        "relationships": relationships
    }
```

### Dependencies

Already in Cog:
- librosa, pyloudnorm, scipy, numpy — for analysis
- Demucs via fal.ai — for separation (or add demucs directly to Cog for offline processing)

New:
- `pyacoustid` + `chromaprint` — for audio fingerprinting (dedup user references)

Add to cog.yaml system packages: `libchromaprint-dev`
Add to requirements: `pyacoustid`

---

## API ROUTES

```
POST /api/admin/reference-library/process    — Start batch processing (admin only)
GET  /api/admin/reference-library/status      — Poll batch progress (admin only)
GET  /api/admin/reference-library/genres       — Get all genre stats (admin only)
GET  /api/admin/reference-library/genre/[id]   — Get genre detail + profile (admin only)
POST /api/admin/reference-library/reset/[genre] — Reset a genre (admin only)
GET  /api/admin/reference-library/trends        — User reference popularity (admin only)
GET  /api/admin/reference-library/intelligence  — Mix intelligence dashboard (admin only)
```

All routes require admin authentication.

---

## RECOMPUTATION: EVENT-DRIVEN + NIGHTLY

### Event-Driven Recomputation

Don't wait until 3 AM to update genre targets. After each qualifying mix outcome is logged, increment a counter per genre. When the counter hits the threshold, trigger an immediate recomputation for that genre only.

Thresholds:
- < 100 total qualifying mixes in genre: recompute every 5 new entries
- 100-500 total: recompute every 20 new entries
- 500+: recompute every 50 new entries

This means on a busy day with 50 hip-hop mixes, the genre target updates multiple times instead of staying stale until midnight.

Implementation: after inserting into `mix_outcome_feedback`, check the pending count. If threshold hit, call the recomputation function inline (or queue it as a background job to avoid blocking the response).

### Nightly Backstop

Still runs at 3:00 AM UTC daily as a safety net:

1. Recompute ALL genre targets (catches anything the event-driven path missed)
2. Refresh `revision_patterns` materialized view
3. Flag any genre where deviation from baseline exceeds 1.5σ → send admin alert
4. Auto-promote user references that crossed the 5-upload threshold
5. Reset per-genre pending counters

Use Vercel Cron or Supabase Edge Function.

---

## A/B VALIDATION (HOLDOUT TESTING)

To measure whether the reference library actually improves mix quality, randomly serve a percentage of mixes without reference data:

- 5% of mixes are "holdout" — Claude uses chain matrix defaults only, no genre target, no reference profiles
- 95% of mixes are "reference-informed" — Claude gets the full reference data
- The holdout flag is stored on the MixJob: `is_holdout: boolean`
- The artist never knows they're in a holdout — they get the same UI, same flow

After 30 days or 500+ mixes (whichever comes first), compare:

| Metric | Holdout (no reference) | Reference-informed |
|--------|----------------------|-------------------|
| Revision rate | ? | ? |
| Time to download | ? | ? |
| Abandon rate | ? | ? |
| Mastering cross-sell rate | ? | ? |

If reference-informed mixes have lower revision rates and faster downloads, the system is working. If not, the reference profiles need tuning.

Surface this comparison in the Mix Intelligence admin dashboard as a card: "Reference Library Impact — revision rate: holdout 24% vs informed 14%"

The holdout percentage can be adjusted or turned off entirely once you have enough data to confirm the system works. Don't run holdouts forever — once proven, give every user the best experience.

Schema addition:
```sql
ALTER TABLE mix_outcome_feedback ADD COLUMN is_holdout BOOLEAN DEFAULT FALSE;
```

---

## IMPLEMENTATION ORDER

1. Supabase schema — create all tables including separation_confidence, source_quality, is_holdout
2. `analyze-reference` Cog action — Demucs + bleed detection + section-level analysis + full pipeline
3. Admin panel Reference Library section — upload, genre tag, source quality tag, process button, progress, stats table with source breakdown
4. Batch processing API — triggers Cog, stores profiles with separation confidence and source quality weights, computes aggregates
5. Genre aggregate computation — mean/std/percentile calculation, weighted by source quality × separation confidence
6. Claude integration — add genre target + section profiles to decisions.ts prompt
7. User reference analysis — analyze on upload during mix job, fuzzy fingerprint matching, store profile
8. Mix outcome logging — after every completed job
9. Quality gate — filter qualifying outcomes
10. Event-driven recomputation — per-genre threshold counter, trigger recomputation when threshold hit
11. Nightly cron backstop — recompute all, refresh patterns, admin alerts
12. User reference popularity — fuzzy fingerprinting, dedup, auto-promotion at 5+ uploads
13. Mix Intelligence dashboard — admin panel stats, insights, revision patterns
14. Weighting system — commercial (always 1.0) vs user data scaling over time, source quality weighting, separation confidence weighting
15. A/B holdout testing — 5% holdout flag, comparison dashboard card
16. Mastering integration — same genre targets available to mastering engine

---

## APPLIES TO MASTERING TOO

The genre aggregate profiles are useful for mastering as well. The full-mix analysis (LUFS, loudness range, frequency balance, stereo width) is exactly what mastering targets. Claude can pull the same genre target during mastering and aim for those numbers.

No separate reference library needed for mastering — the same commercial profiles contain full-mix data that serves as mastering targets.

---

## COST

- Demucs separation: free (open source, runs in Cog)
- Analysis: free (librosa, pyloudnorm, scipy)
- Storage: Supabase rows, negligible
- Cron job: Vercel cron, free tier covers it
- Chromaprint: free (open source)
- Total ongoing cost: $0
