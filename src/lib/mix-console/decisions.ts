/**
 * decisions.ts — Claude-powered mix intelligence
 *
 * Two calls per job:
 * 1. generateMixRecommendation() — Haiku — short "here's what I'll do" message for artist
 * 2. decideMixParameters()       — Sonnet — full per-stem chain params + delay throw list + section map
 *
 * Both are called inside the analyze webhook after analysis data is ready.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  MixAnalysisResult,
  SongSection,
  DelayThrow,
  InputFile,
} from "@/lib/mix-console/engine";
import { loadReferenceContext } from "@/lib/reference-library/context";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── Tier-aware model selection ──────────────────────────────────────────────
// Standard tier  → Sonnet, no extended thinking (fast + cheap)
// Premium / Pro  → Opus with 8k thinking budget (deep reasoning on every param)
// Costs scale with what the user paid for.
function mixDecisionModel(tier: string): {
  model:    string;
  thinking: { type: "enabled"; budget_tokens: number } | undefined;
} {
  const t = tier?.toUpperCase();
  if (t === "PREMIUM" || t === "PRO") {
    return { model: "claude-opus-4-5", thinking: { type: "enabled", budget_tokens: 8000 } };
  }
  return { model: "claude-sonnet-4-5", thinking: undefined };
}

/**
 * Call Claude with the tier-appropriate model. If the primary call errors
 * (Opus timeout, 529 overload, etc.), fall back to Sonnet without thinking so
 * the user still gets a mix instead of FAILED.
 */
async function callMixDecisionClaude(opts: {
  tier:    string;
  prompt:  string;
  label:   string;  // for logging
}): Promise<string> {
  const { tier, prompt, label } = opts;
  const cfg = mixDecisionModel(tier);
  try {
    const msg = await client.messages.create({
      model:       cfg.model,
      max_tokens:  16000,
      ...(cfg.thinking ? { thinking: cfg.thinking } : {}),
      messages:    [{ role: "user", content: prompt }],
    });
    const textBlock = msg.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
    return textBlock?.text ?? "{}";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[mix-decisions:${label}] ${cfg.model} failed — falling back to Sonnet. error=${msg.slice(0, 200)}`);
    // Fallback: Sonnet without thinking, smaller max_tokens
    const fb = await client.messages.create({
      model:      "claude-sonnet-4-5",
      max_tokens: 8000,
      messages:   [{ role: "user", content: prompt }],
    });
    const fbText = fb.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
    return fbText?.text ?? "{}";
  }
}

// ─── Recommendation (Haiku — cheap, artist-facing) ───────────────────────────

export async function generateMixRecommendation(params: {
  analysis:       MixAnalysisResult;
  genre:          string;
  tier:           string;
  customDirection?: string;
  inputFiles:     InputFile[];
}): Promise<string> {
  const { analysis, genre, tier, customDirection, inputFiles } = params;

  // Pull genre target so the artist-facing recommendation grounds claims
  // in the same numbers the mix-decision Claude is using.
  const refCtx = await loadReferenceContext(genre).catch(() => null);
  const refCtxBlock = refCtx
    ? `\nGenre profile (${refCtx.trackCount} tracks): ${refCtx.promptBlock.split("\n").slice(3, 12).join(" | ")}`
    : "";

  const stemLabels = inputFiles.map(f => f.label).join(", ");
  const rt60       = analysis.roomReverb;
  const reverbState =
    rt60 < 0.15 ? "very dry — no de-reverb needed"
    : rt60 < 0.30 ? "slightly live — mild de-reverb"
    : rt60 < 0.50 ? "roomy — moderate de-reverb"
    : "wet/live — heavy de-reverb";
  const sections   = analysis.sections.map(s => s.name).join(", ");
  const hasLyrics  = analysis.lyrics?.length > 20;

  // Per-stem energy + balance for Haiku to ground recommendations in real numbers
  const stemSummary = analysis.stemAnalysis
    .map(s => `${s.label} (${s.role ?? "?"}): ${s.lufs.toFixed(1)} LUFS, sub/low/mid/high = ${s.balance.sub.toFixed(2)}/${s.balance.low.toFixed(2)}/${s.balance.mid.toFixed(2)}/${s.balance.high.toFixed(2)}`)
    .join("\n");

  const prompt = `You are an AI mix engineer talking to the artist about THIS specific track. 2–3 sentences, confident, no fluff, no greetings.

Ground every claim in the numbers below. Do NOT invent values. If a number is small, do not exaggerate it.
Vary your opening — do NOT start with "Your vocals were recorded in a live room". Different tracks → different openings. Lead with whatever is actually most notable for THIS track (could be loudness imbalance, tonal issue, reverb, pitch drift, or a creative opportunity).

Files: ${stemLabels}
Genre: ${genre || "Auto-detect"} | Tier: ${tier}
BPM ${analysis.bpm.toFixed(1)}, Key ${analysis.key}
Sections: ${sections || "none detected"}
Room reverb RT60: ${rt60.toFixed(2)}s — ${reverbState}
Vocal pitch deviation: ${analysis.pitchDeviation.toFixed(2)} semitones ${analysis.pitchDeviation > 0.3 ? "(tune it)" : "(already in tune)"}
Lyrics: ${hasLyrics ? "available for delay throws" : "not transcribed"}
Vocal roles: ${analysis.vocalClassification.map(v => `stem ${v.stemIndex}=${v.role}`).join(", ") || "single vocal"}

Per-stem analysis:
${stemSummary || "(none)"}
${refCtxBlock}
${customDirection ? `\nArtist direction: "${customDirection}" — address this specifically.` : ""}

Write 2–3 sentences about what's actually going on in THIS mix. Reference at least one concrete measured value. If a genre profile is provided, you may compare the track to those targets (e.g. "your vocal sits 3dB below the genre's typical level"). No examples, no templates — write it fresh.`;

  const msg = await client.messages.create({
    model:       "claude-haiku-4-5",
    max_tokens:  400,
    temperature: 1.0,
    messages:    [{ role: "user", content: prompt }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text ?? "";
  return text.trim();
}

// ─── Full mix parameter decision (Sonnet) ────────────────────────────────────

export interface MixDecision {
  /** Per-stem chain parameters */
  stemParams: Record<string, StemParams>;
  /** Section map with processing overrides */
  sectionMap: SectionOverride[];
  /** Delay throws derived from lyrics */
  delayThrows: DelayThrow[];
  /** Bus processing parameters */
  busParams: BusParams;
  /** Any warnings (e.g., word not found in lyrics) */
  warnings: string[];
  /** Claude's notes on how the reference track influenced the mix (shown to artist) */
  referenceNotes?: string;
}

export interface StemParams {
  role:              string;
  gainDb:            number;
  panLR:             number;    // -1 (L) to 1 (R)
  highpassHz:        number;
  eq:                EQPoint[];
  comp1:             CompParams;    // fast transient
  comp2:             CompParams;    // slow leveling
  deEssThresh:       number;        // dB; 0 = skip
  deReverbStrength?: number;        // 0–0.6; 0 = skip (Claude controls)
  reverbSend:        number;        // 0–1 wet level
  saturation:        number;        // 0–1 drive
  stereoWidth:       number;        // 0–1 per-stem M/S widening
  monoBelow:         number;        // Hz — mono below this frequency
  chorusWet?:        number;        // 0–1 chorus (doubles/harmonies)
  flangerWet?:       number;        // 0–1 flanger (creative use only)
  telephone?:        boolean;       // bandpass lo-fi effect — only set true when creatively intentional
}

export interface EQPoint {
  type:   "peak" | "highshelf" | "lowshelf" | "notch";
  freq:   number;
  gainDb: number;
  q:      number;
}

export interface CompParams {
  thresholdDb: number;
  ratio:       number;
  attackMs:    number;
  releaseMs:   number;
}

export interface SectionOverride {
  sectionName:  string;
  reverbScale:  number;   // multiplier on reverb send (1.0 = no change)
  compScale:    number;   // multiplier on comp ratio
  gainDb:       number;   // additional gain on lead vocal in this section
}

export interface BusParams {
  glueCompThresh:  number;
  glueCompRatio:   number;
  eqLowShelf:      number;   // dB
  eqHighShelf:     number;   // dB
  stereoWidth:     number;   // M/S width multiplier (1.0 = no change, 1.25 = wider)
  peakNormalize:   number;   // target dBFS (e.g. -1)
}

export async function decideMixParameters(params: {
  analysis:          MixAnalysisResult;
  genre:             string;
  tier:              string;
  mixVibe:           string;
  vocalStylePreset:  string;
  reverbStyle:       string;
  delayStyle:        string;
  breathEditing:     string;
  pitchCorrection:   string;
  fadeOut:           string;
  customDirection?:  string;
  inputFiles:        InputFile[];
  referenceAnalysis?: {
    lufs:     number;
    bpm:      number;
    key:      string;
    balance:  { sub: number; low: number; mid: number; high: number };
    fileName: string;
  } | null;
}): Promise<MixDecision> {
  const {
    analysis, genre, tier, mixVibe, vocalStylePreset, reverbStyle,
    delayStyle, customDirection, inputFiles, referenceAnalysis,
  } = params;

  const stemList = inputFiles.map((f, i) => {
    const cls = analysis.vocalClassification.find(v => v.stemIndex === i);
    const st  = analysis.stemAnalysis[i];
    return `[${i}] label="${f.label}" role=${cls?.role ?? "unknown"} rms=${st?.rms?.toFixed(2) ?? "?"} lufs=${st?.lufs?.toFixed(1) ?? "?"}`;
  }).join("\n");

  const lyricsSnippet = analysis.lyrics
    ? analysis.lyrics.slice(0, 500) + (analysis.lyrics.length > 500 ? "..." : "")
    : "(no lyrics)";

  const sectionsStr = analysis.sections.map(s =>
    `${s.name}: ${s.start.toFixed(1)}s – ${s.end.toFixed(1)}s`
  ).join(", ");

  // ─── Reference-library genre target (if we've built one for this genre) ──
  const refCtx = await loadReferenceContext(genre).catch(() => null);
  const refCtxBlock = refCtx
    ? `\n\nREFERENCE-LIBRARY GENRE TARGET (use as quantitative anchor):\n${refCtx.promptBlock}\n\nWhen choosing busParams (peakNormalize, glueComp), per-stem EQ shelves, and stereo width — pull toward the mean of this genre profile. The p25–p75 range is your acceptable corridor; don't drift outside it without a clear reason from the analysis or custom direction.`
    : "";

  const prompt = `You are a professional mix engineer AI. The Python engine is a faithful executor — it applies exactly what you specify in stemParams. You are responsible for every creative decision. Use these professional standards as your benchmark.

MIX TARGETS — use these as your decision benchmarks:

Vocal-to-beat ratio: lead vocal should sit 2-4dB above the beat's mid-range (2-5kHz). Measure by comparing vocal RMS in the 2-5kHz band against beat RMS in the same band. If the difference is less than 2dB, boost vocal presence or cut beat in that range. If more than 5dB, the vocal is too exposed — reduce vocal gain or boost beat.

Frequency carving: always cut the beat 2-3dB in the vocal's dominant frequency range (detected from spectral centroid, typically 2-5kHz). Always high-pass the vocal at 80-100Hz. Always cut 250-400Hz on both vocal and beat by 1-2dB — this is where mud lives.

Compression: set threshold so the compressor only engages on the loudest 30% of the signal. Target 3-4dB of gain reduction on peaks, no more. If the input crest factor (peak-to-RMS) is already below 8dB, the vocal is already compressed — reduce ratio by 1 point or skip compression entirely.

Reverb: never exceed 15% wet. High-pass the reverb return at 500Hz. Pre-delay 25-35ms to preserve consonant clarity. Room RT60 estimate = ${analysis.roomReverb.toFixed(2)}s — if above 0.4s, reduce reverbSend to 0.06–0.08 maximum (the room already has natural reverb, adding more muddies it).
De-reverb: you control this via deReverbStrength in stemParams. Default is 0 (off). Only set it above 0 when RT60 is clearly above 0.4s AND the vocal sounds like it was recorded in a room. Use 0.2–0.35 for moderate room reverb, 0.4–0.6 for heavy room reverb. Never apply de-reverb to a vocal that sounds dry — it will cause smearing artifacts.

Saturation: if the input signal is already clipping or has crest factor below 6dB, skip saturation entirely. Never apply saturation and heavy compression to the same stem — pick one.

Stereo width: lead vocal mono center. Doubles pan L30-40/R30-40 with ±8-15 cents detune. Harmonies pan L45-50/R45-50. Ad-libs alternate L15-25/R15-25 per phrase. Beat stays at its original stereo width unless Beat Polish is active.

Overall mix target: -14 to -12 LUFS integrated. True peak at -1dBFS. Loudness range (LRA) 6-10 LU. If the mix measures outside these ranges after bus processing, adjust the bus gain — do not re-process individual stems.

Beat processing: the beat should lose no more than 2dB of overall energy from frequency carving and side-chain ducking combined. If the beat sounds thinner than the original after processing, the carving is too aggressive — narrow the Q and reduce the cut depth.

De-esser: detect the sibilant peak frequency per vocalist (male 4-7kHz, female 8-12kHz). Only attenuate when sibilance exceeds the surrounding frequency energy by more than 6dB. If you can hear the de-esser working (lisping, dulled S sounds), the threshold is too low.

The golden rule: A/B the processed stem against the raw input. If the raw input sounds better in any way — more natural, more present, more clear — reduce or remove the processing that's hurting it. Less processing done well always beats more processing done poorly.

ANALYSIS:
BPM: ${analysis.bpm.toFixed(1)} | Key: ${analysis.key} | Room reverb RT60: ${analysis.roomReverb.toFixed(2)}s
Sections: ${sectionsStr}
Lyrics (first 500 chars): ${lyricsSnippet}

STEMS:
${stemList}

SETTINGS:
Genre: ${genre || "auto-detect"} | Tier: ${tier} | Vibe: ${mixVibe} | Vocal style: ${vocalStylePreset || "AUTO"} | Reverb: ${reverbStyle} | Delay: ${delayStyle}
${customDirection ? `Custom direction: "${customDirection}"` : "No custom direction."}
${referenceAnalysis ? `
REFERENCE TRACK: "${referenceAnalysis.fileName}"
LUFS: ${referenceAnalysis.lufs.toFixed(1)} | BPM: ${referenceAnalysis.bpm.toFixed(1)} | Key: ${referenceAnalysis.key}
Frequency balance: sub=${referenceAnalysis.balance.sub.toFixed(3)} low=${referenceAnalysis.balance.low.toFixed(3)} mid=${referenceAnalysis.balance.mid.toFixed(3)} high=${referenceAnalysis.balance.high.toFixed(3)}
Use this as your loudness and tonal target. Match the overall LUFS via busParams.peakNormalize and glueCompThresh. Match the frequency balance by adjusting eqLowShelf/eqHighShelf and per-stem EQ. If the reference is brighter (high > 0.05), boost high shelf. If it's bassier (sub > 0.3), boost low shelf. The artist wants their mix to sound like this reference.` : "No reference track provided."}${refCtxBlock}

TASK: Return ONLY valid JSON (no markdown, no explanation):
{
  "genre": "HIP_HOP",
  "vocalStylePreset": "${vocalStylePreset || "AUTO"}",
  "stemParams": {
    "<label>": {
      "role": "lead|adlib|insouts|double|harmony|kick|snare|hihat|bass|synth|pad|other",
      "gainDb": 0.0,
      "panLR": 0.0,
      "highpassHz": 80,
      "eq": [
        {"type":"peak","freq":300,"gainDb":-2.5,"q":0.8},
        {"type":"peak","freq":3500,"gainDb":2.5,"q":1.2}
      ],
      "comp1": {"thresholdDb":-18,"ratio":3.0,"attackMs":10,"releaseMs":120},
      "comp2": {"thresholdDb":-24,"ratio":1.8,"attackMs":30,"releaseMs":250},
      "deEssThresh": -30,
      "deReverbStrength": 0.0,
      "reverbSend": 0.10,
      "saturation": 0.02,
      "stereoWidth": 0.0,
      "monoBelow": 120,
      "chorusWet": 0.0,
      "flangerWet": 0.0,
      "telephone": false
    }
  },
  "sectionMap": [
    {"sectionName":"chorus1","reverbScale":1.5,"compScale":1.0,"gainDb":0.5}
  ],
  "delayThrows": [
    {"word":"tonight","start":42.3,"end":42.8,"type":"dotted_eighth","feedback":3,"section":"chorus1"}
  ],
  "busParams": {
    "glueCompThresh": -13,
    "glueCompRatio": 2.0,
    "eqLowShelf": 1.0,
    "eqHighShelf": 1.0,
    "stereoWidth": 1.25,
    "peakNormalize": -1.0
  },
  "referenceNotes": "",
  "warnings": []
}

Rules:
- "genre" must be one of: HIP_HOP | TRAP | RNB | POP | ROCK | ELECTRONIC | ACOUSTIC | LO_FI | AFROBEATS | LATIN | COUNTRY | GOSPEL | NEO_SOUL
- Map vocal_main → role "lead", vocal_adlibs → "adlib", vocal_insouts → "insouts", vocal_doubles → "double", vocal_harmonies → "harmony"
- Beat MUST have the 350Hz, 3000Hz, 5000Hz cuts in eq. Lead vocal MUST have the 300Hz cut. These are non-negotiable.
- telephone: NEVER set true by default — only use it when you have a specific creative reason (lo-fi aesthetic, intentional phone effect, customDirection requests it). RNB, POP, GOSPEL, COUNTRY, AFROBEATS, LATIN, NEO_SOUL, ACOUSTIC ad-libs should almost never have telephone=true.
- delayThrows: only if delayStyle != "OFF" AND lyrics available; use quantized timestamps; dotted_eighth for chorus, quarter for verse
- sectionMap: chorus gets reverbScale 1.4–1.6; bridge Claude decides; verse stays at 1.0
- bass: monoBelow 80; kick: highpassHz 30, peakEQ boost at 60Hz; beat: set gainDb so beat does not overpower vocal
- deEssThresh: always -28 to -32 for lead vocals; 0 for non-vocal stems
- stereoWidth (stem-level): 0 for lead vocal (mono center), 0.2–0.4 for doubles, 0.3–0.5 for harmonies, 0 for beat
- monoBelow: 120 for all vocal stems; 80 for bass/kick/beat
- chorusWet: 0.25–0.40 for doubles/harmonies if genre calls for thickness; 0 otherwise
- deReverbStrength: 0 unless RT60 is clearly above 0.4s AND vocal sounds roomy; use 0.2–0.35 moderate, 0.4–0.6 heavy
- busParams.stereoWidth: 1.0–1.5 (1.0 = no change, 1.25 = slightly wider, 1.5 = wide)
- referenceNotes: if a reference track was provided, write 1-2 sentences explaining what you took from it (loudness target, tonal changes made). If no reference, leave as empty string.

TOGGLE ENFORCEMENT — these are the artist's explicit creative choices. You MUST honor them.
The Python engine does not second-guess your numbers, so if you contradict the toggles the
artist literally won't get what they asked for. These rules are non-negotiable:

- reverbStyle="DRY"        → every stem reverbSend MUST be ≤ 0.02 (functionally none)
- reverbStyle="ROOM"       → lead reverbSend 0.08–0.12, supporting 0.10–0.18
- reverbStyle="PLATE"      → lead reverbSend 0.10–0.14, supporting 0.15–0.22 (slightly brighter tail; reflect by trimming reverb HP-affected lows in your stem EQ if needed)
- reverbStyle="HALL"       → lead reverbSend 0.14–0.18, supporting 0.20–0.28
- reverbStyle="CATHEDRAL"  → lead reverbSend 0.18–0.22 (CAP at 0.22 — you still must not pour water on the vocal), supporting 0.25–0.32
- delayStyle="OFF"         → delayThrows MUST be an empty array []. Do not include throws even if lyrics are perfect for them.
- delayStyle="SUBTLE"      → ≤ 2 throws max, only on chorus hooks
- delayStyle="STANDARD"    → up to 4 throws across choruses + bridge
- delayStyle="DUB"         → up to 6 throws, can include verse hooks
- mixVibe="CLEAN"          → eqLowShelf 0.0–1.0, eqHighShelf 0.5–1.5, glueCompRatio 1.8–2.2, glueCompThresh -10 to -13
- mixVibe="WARM"           → eqLowShelf 1.5–2.5, eqHighShelf -1.0 to 0.0, glueCompRatio ≤ 2.0, glueCompThresh -10 to -12 (slower glue feel)
- mixVibe="PUNCHY"         → eqLowShelf 0.5–1.5, eqHighShelf 0.5–1.5, glueCompRatio ≥ 2.5, glueCompThresh ≤ -14
- mixVibe="AGGRESSIVE"     → eqLowShelf 1.0–2.0, eqHighShelf 1.0–2.0, glueCompRatio ≥ 3.0, glueCompThresh ≤ -15, peakNormalize -0.5
- mixVibe="AIRY"           → eqLowShelf 0.0–1.0, eqHighShelf 1.5–2.5, glueCompRatio 1.8–2.2, peakNormalize -1.0
- mixVibe="VINTAGE"        → eqLowShelf 1.0–2.0, eqHighShelf -1.5 to -0.5, glueCompRatio ≤ 2.0, glueCompThresh -10 to -12 (rolled highs, soft glue)
- beatPolish=true          → Python adds extra distortion + parallel saturation + harder transient shaping on the beat stem. Compensate by pulling beat stemParams.gainDb down 0.5dB to leave bus headroom for the added harmonic content.
- beatPolish=false         → no compensation needed.
- pitchCorrection="OFF"    → no special handling
- pitchCorrection!="OFF"   → if you observe pitchDeviation > 0.3 semitones in analysis, increase deEssThresh by 1–2dB (tuning surfaces sibilance)

Reference-library anchoring (only when refCtx is provided above): if your busParams.peakNormalize
deviates more than 1.0dB from the genre p50, briefly justify it in referenceNotes (e.g. "pulled
peakNormalize to -1.5 because reference LUFS = -10 vs genre p50 = -13").

- Return ONLY the JSON object, nothing else.`;

  const raw = await callMixDecisionClaude({
    tier:   params.tier,
    prompt,
    label:  "decideMixParameters",
  });

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  let firstPass: MixDecision;
  try {
    firstPass = JSON.parse(cleaned) as MixDecision;
  } catch {
    console.error("decideMixParameters: failed to parse Claude response:", raw.slice(0, 500));
    return {
      stemParams:  {},
      sectionMap:  [],
      delayThrows: [],
      busParams: {
        glueCompThresh: -12,
        glueCompRatio:  2,
        eqLowShelf:     0.5,
        eqHighShelf:    1.0,
        stereoWidth:    1.25,
        peakNormalize:  -1,
      },
      warnings: ["Failed to parse mix parameters from AI — using defaults."],
    };
  }

  // ─── Output validation gate ─────────────────────────────────────────────
  // Programmatic safety net: if Claude contradicts the artist's explicit
  // toggle choices (e.g. delayThrows present while delayStyle=OFF), fix it
  // here BEFORE the critic runs. The critic re-evaluates the cleaned output.
  firstPass = enforceToggles(firstPass, {
    reverbStyle: params.reverbStyle,
    delayStyle:  params.delayStyle,
    mixVibe:     params.mixVibe,
  });

  // ─── Two-pass critic (Premium/Pro only) ────────────────────────────────
  // Second Claude call acts as a senior mix engineer reviewing the first pass.
  // It can overwrite specific params if the first pass made engineering errors
  // (e.g. lead vocal stereoWidth > 0 — should always be mono center, delay throws
  // on wrong words, comp ratios too hot, monoBelow on stems that shouldn't have it).
  const tierUp = String(params.tier || "").toUpperCase();
  if (tierUp === "PREMIUM" || tierUp === "PRO") {
    try {
      const refined = await runMixCritic({
        firstPass,
        analysis:        params.analysis,
        genre:           params.genre,
        tier:            params.tier,
        referenceAnalysis: params.referenceAnalysis,
      });
      if (refined) {
        return enforceToggles(refined, {
          reverbStyle: params.reverbStyle,
          delayStyle:  params.delayStyle,
          mixVibe:     params.mixVibe,
        });
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      console.error(`[mix-decisions:critic] skipped — ${m.slice(0, 160)}`);
    }
  }

  return firstPass;
}

// ─── Output validation gate ─────────────────────────────────────────────────

/**
 * Programmatic safety net that enforces the artist's toggle choices on
 * Claude's output. Runs after firstPass parse and again after the critic.
 *
 * Philosophy: the prompt asks Claude to honor toggles, but LLMs drift.
 * Toggles are explicit user intent — if Claude contradicts them, the
 * artist literally doesn't get what they asked for. We clamp here so
 * the engine can never accidentally play music the user vetoed.
 *
 * Only enforces hard constraints. Soft tonal preferences (mixVibe shelves)
 * are left to Claude — clamping them would defeat the purpose of having
 * an LLM make creative calls.
 */
function enforceToggles(
  decision: MixDecision,
  toggles:  { reverbStyle: string; delayStyle: string; mixVibe: string },
): MixDecision {
  const out = { ...decision };
  const warnings = [...(out.warnings ?? [])];

  // delayStyle=OFF → no delay throws, period.
  if (toggles.delayStyle?.toUpperCase() === "OFF" && (out.delayThrows?.length ?? 0) > 0) {
    warnings.push(`Stripped ${out.delayThrows.length} delay throws — delayStyle=OFF.`);
    out.delayThrows = [];
  }

  // reverbStyle=DRY → cap every reverbSend at 0.02
  if (toggles.reverbStyle?.toUpperCase() === "DRY" && out.stemParams) {
    const fixed: Record<string, StemParams> = {};
    let stripped = 0;
    for (const [label, sp] of Object.entries(out.stemParams)) {
      if ((sp.reverbSend ?? 0) > 0.02) {
        fixed[label] = { ...sp, reverbSend: 0.02 };
        stripped++;
      } else {
        fixed[label] = sp;
      }
    }
    if (stripped > 0) {
      warnings.push(`Capped reverbSend on ${stripped} stem(s) — reverbStyle=DRY.`);
      out.stemParams = fixed;
    }
  }

  // reverbStyle=CATHEDRAL → cap lead vocal at 0.22 (still has to sit clear of vocal)
  if (toggles.reverbStyle?.toUpperCase() === "CATHEDRAL" && out.stemParams) {
    const fixed: Record<string, StemParams> = {};
    let capped = 0;
    for (const [label, sp] of Object.entries(out.stemParams)) {
      const isLead = sp.role === "lead";
      if (isLead && (sp.reverbSend ?? 0) > 0.22) {
        fixed[label] = { ...sp, reverbSend: 0.22 };
        capped++;
      } else {
        fixed[label] = sp;
      }
    }
    if (capped > 0) {
      warnings.push(`Capped lead reverbSend at 0.22 — reverbStyle=CATHEDRAL.`);
      out.stemParams = fixed;
    }
  }

  // delayStyle=SUBTLE → max 2 throws (keep highest-confidence first 2)
  if (toggles.delayStyle?.toUpperCase() === "SUBTLE" && (out.delayThrows?.length ?? 0) > 2) {
    warnings.push(`Trimmed delay throws to 2 — delayStyle=SUBTLE.`);
    out.delayThrows = out.delayThrows.slice(0, 2);
  }

  out.warnings = warnings;
  return out;
}

// ─── Two-pass critic ────────────────────────────────────────────────────────

async function runMixCritic(params: {
  firstPass:  MixDecision;
  analysis:   MixAnalysisResult;
  genre:      string;
  tier:       string;
  referenceAnalysis?: {
    lufs:     number;
    bpm:      number;
    key:      string;
    balance:  { sub: number; low: number; mid: number; high: number };
    fileName: string;
  } | null;
}): Promise<MixDecision | null> {
  const { firstPass, analysis, genre, tier, referenceAnalysis } = params;

  // Critic gets the same genre target the first-pass call had access to,
  // so it can flag any deviation from the genre's p25–p75 corridor.
  const refCtx = await loadReferenceContext(genre).catch(() => null);
  const refCtxBlock = refCtx
    ? `\n\nREFERENCE-LIBRARY GENRE TARGET (use to spot deviations):\n${refCtx.promptBlock}`
    : "";

  const stemSummary = analysis.stemAnalysis
    .map(s => `${s.label} (${s.role ?? "?"}): ${s.lufs.toFixed(1)} LUFS, balance sub/low/mid/high = ${s.balance.sub.toFixed(2)}/${s.balance.low.toFixed(2)}/${s.balance.mid.toFixed(2)}/${s.balance.high.toFixed(2)}`)
    .join("\n");

  const prompt = `You are a senior mix engineer reviewing another engineer's first-pass mix decisions.
Your job: catch mistakes, tighten weak choices, and return a CORRECTED JSON — same schema as input.

DO NOT rewrite everything. Only change params that are objectively wrong or suboptimal. If the first pass is solid, return it unchanged.

Common first-pass mistakes to look for:
- Lead vocal with stereoWidth > 0 (it must be mono-center, width = 0)
- Lead vocal WITHOUT the 300Hz cut (mandatory), OR beat WITHOUT the 350Hz/3kHz/5kHz cuts (mandatory)
- monoBelow set on a stem that doesn't need low-end mono collapse (e.g. a stereo pad, a harmony — only bass/kick/beat get monoBelow below 100Hz; vocals get monoBelow around 120Hz)
- telephone: true on a stem that shouldn't have it (almost nothing should unless creatively intentional)
- deEssThresh = 0 on vocal stems (should be -28 to -32 for lead vocals)
- comp ratios > 6 on anything except limiter (likely too crushing)
- chorusWet > 0 on lead vocal (should almost always be 0 — doubles/harmonies get chorus, not lead)
- deReverbStrength > 0 when RT60 is low (< 0.3s — de-reverb does nothing useful on already-dry sources)
- delayThrows with word timestamps that don't exist in the lyrics
- sectionMap gainDb out of range (verse should be 0, chorus +0.5 to +2, bridge Claude decides)
- busParams.stereoWidth < 1.0 (narrower than input — rarely desired) or > 1.6 (too wide, mono-compatibility risk)
- Reference LUFS not reflected in busParams glueCompRatio + EQ shelves

Context:
Genre: ${genre || "auto"} | Tier: ${tier}
BPM ${analysis.bpm.toFixed(1)}, Key ${analysis.key}
Room RT60: ${analysis.roomReverb.toFixed(2)}s
Pitch deviation: ${analysis.pitchDeviation.toFixed(2)} semitones

Per-stem analysis:
${stemSummary}
${referenceAnalysis ? `\nReference "${referenceAnalysis.fileName}": ${referenceAnalysis.lufs.toFixed(1)} LUFS, balance ${JSON.stringify(referenceAnalysis.balance)}` : ""}${refCtxBlock}

First-pass mix decision to review:
${JSON.stringify(firstPass, null, 2).slice(0, 6000)}

Return ONLY the corrected JSON (same schema). Preserve first-pass choices you agree with. If you fix something, prefer minimal targeted edits over wholesale rewrites. If there are truly no issues, return the first-pass JSON unchanged.`;

  const raw = await callMixDecisionClaude({
    tier,
    prompt,
    label: "critic",
  });
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  try {
    const refined = JSON.parse(cleaned) as MixDecision;
    // Sanity: critic must return a complete object. If shape looks broken, keep first pass.
    if (!refined.stemParams || !refined.busParams) return null;
    return refined;
  } catch {
    console.error("critic: parse failed:", raw.slice(0, 300));
    return null;
  }
}

// ─── Revision parameter adjustment ───────────────────────────────────────────

export async function reviseParameters(params: {
  previousParams: MixDecision;
  feedback:       string;
  analysis:       MixAnalysisResult;
  genre:          string;
  tier:           string;
}): Promise<MixDecision> {
  const { previousParams, feedback, analysis, genre, tier } = params;

  // Pull genre target so revisions stay anchored to the genre instead of
  // drifting freely with each iteration.
  const refCtx = await loadReferenceContext(genre).catch(() => null);
  const refCtxBlock = refCtx
    ? `\n\nREFERENCE-LIBRARY GENRE TARGET (stay inside the corridor unless feedback explicitly asks you to leave it):\n${refCtx.promptBlock}`
    : "";

  const prompt = `You are a professional mix engineer AI. The artist gave revision feedback on a mix.
Adjust the mix parameters to address the feedback. Return ONLY updated JSON, same schema as before.

Previous parameters:
${JSON.stringify(previousParams, null, 2).slice(0, 3000)}

Artist feedback: "${feedback}"

Genre: ${genre}
BPM: ${analysis.bpm.toFixed(1)}, Key: ${analysis.key}${refCtxBlock}

Return ONLY the updated JSON object with the same structure. Make targeted changes to address the feedback.
Do not change things the artist didn't mention.`;

  const raw = await callMixDecisionClaude({
    tier,
    prompt,
    label: "reviseParameters",
  });
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  try {
    return JSON.parse(cleaned) as MixDecision;
  } catch {
    console.error("reviseParameters: parse failed:", raw.slice(0, 300));
    return previousParams; // fall back to previous
  }
}
