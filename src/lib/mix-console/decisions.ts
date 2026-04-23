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

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── Recommendation (Haiku — cheap, artist-facing) ───────────────────────────

export async function generateMixRecommendation(params: {
  analysis:       MixAnalysisResult;
  genre:          string;
  tier:           string;
  customDirection?: string;
  inputFiles:     InputFile[];
}): Promise<string> {
  const { analysis, genre, tier, customDirection, inputFiles } = params;

  const stemLabels = inputFiles.map(f => f.label).join(", ");
  const hasReverb  = analysis.roomReverb > 0.2;
  const sections   = analysis.sections.map(s => s.name).join(", ");
  const hasLyrics  = analysis.lyrics?.length > 20;

  const prompt = `You are an AI mix engineer. Summarize in 2–3 sentences what you'll do for this mix.
Be specific and confident. Mention concrete issues you detected and what you'll fix.
No fluff. No "Great!" or "Sure!". Start with the most important thing you detected.

Artist's files: ${stemLabels}
Genre: ${genre || "Auto-detect"}
Tier: ${tier}
Room reverb RT60: ${analysis.roomReverb.toFixed(2)}s (${hasReverb ? "needs de-reverb" : "already dry"})
BPM: ${analysis.bpm.toFixed(1)}, Key: ${analysis.key}
Song sections detected: ${sections || "none"}
Vocal pitch deviation: ${analysis.pitchDeviation.toFixed(2)} semitones
Lyrics available: ${hasLyrics ? "yes" : "no"}
Vocal classification: ${analysis.vocalClassification.map(v => `stem ${v.stemIndex}: ${v.role}`).join(", ") || "single vocal"}
${customDirection ? `Artist direction: "${customDirection}"` : ""}

Respond in 2–3 sentences. Example tone: "Your vocals were recorded in a live room — I'll apply spectral de-reverb first. The vocal sits 6dB quieter than the beat during verses, so I'll carve a pocket with dynamic EQ on the instrumental. I spotted delay throw opportunities on 'tonight' and 'away' in the chorus."`;

  const msg = await client.messages.create({
    model:      "claude-haiku-4-5",
    max_tokens: 200,
    messages:   [{ role: "user", content: prompt }],
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
}

export interface StemParams {
  role:           string;
  gainDb:         number;
  panLR:          number;   // -1 (L) to 1 (R)
  highpassHz:     number;
  eq:             EQPoint[];
  comp1:          CompParams;   // fast transient
  comp2:          CompParams;   // slow leveling
  deEssThresh:    number;       // dB; 0 = skip
  reverbSend:     number;       // 0–1 wet level
  delaySend:      number;       // 0–1 mix
  saturation:     number;       // 0–1 drive
  stereoWidth:    number;       // 0–1
  monoBelow:      number;       // Hz
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
  stereoWidenHz:   number;   // mono below this Hz
  peakNormalize:   number;   // target dBFS (e.g. -1)
}

export async function decideMixParameters(params: {
  analysis:         MixAnalysisResult;
  genre:            string;
  tier:             string;
  mixVibe:          string;
  vocalStylePreset: string;
  reverbStyle:      string;
  delayStyle:       string;
  breathEditing:    string;
  pitchCorrection:  string;
  fadeOut:          string;
  customDirection?: string;
  inputFiles:       InputFile[];
}): Promise<MixDecision> {
  const {
    analysis, genre, tier, mixVibe, vocalStylePreset, reverbStyle,
    delayStyle, customDirection, inputFiles,
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

  const prompt = `You are a professional mix engineer AI. You have access to a genre + role chain matrix that handles per-stem DSP (the Python engine will apply it). Your job is to:
1. Identify the correct genre and confirm/override the role of each stem
2. Decide section-aware processing adjustments
3. Pick delay throw words from lyrics (Pro/Premium)
4. Flag any unusual conditions (heavy room reverb, clipping, loud ad-libs, etc.)
5. Pass genre + vocalStylePreset so the engine looks up the right chain

The Python engine applies these genre-aware chains automatically per role:
- lead: full vocal chain, de-esser, two-stage comp, presence EQ
- adlib: TELEPHONE bandpass (300-3000Hz), aggressive comp, gritty sat, slapback — classic hip-hop lo-fi
- insouts: lighter telephone tilt, short pre-delay, blend -6dB
- double: pitch detune ±N cents (genre-dependent), hard pan L/R, blend -4dB
- harmony: wide pan, lush reverb, detune ±N cents, blend -6 to -8dB

ANALYSIS:
BPM: ${analysis.bpm.toFixed(1)} | Key: ${analysis.key} | Room reverb RT60: ${analysis.roomReverb.toFixed(2)}s
Sections: ${sectionsStr}
Lyrics (first 500 chars): ${lyricsSnippet}

STEMS:
${stemList}

SETTINGS:
Genre: ${genre || "auto-detect"} | Tier: ${tier} | Vibe: ${mixVibe} | Vocal style: ${vocalStylePreset || "AUTO"} | Reverb: ${reverbStyle} | Delay: ${delayStyle}
${customDirection ? `Custom direction: "${customDirection}"` : "No custom direction."}

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
      "eq": [{"type":"peak","freq":3000,"gainDb":2.5,"q":1.0}],
      "comp1": {"thresholdDb":-18,"ratio":4,"attackMs":2,"releaseMs":80},
      "comp2": {"thresholdDb":-24,"ratio":2.5,"attackMs":15,"releaseMs":200},
      "deEssThresh": -30,
      "reverbSend": 0.15,
      "delaySend": 0.0,
      "saturation": 0.02,
      "stereoWidth": 0.0,
      "monoBelow": 120
    }
  },
  "sectionMap": [
    {"sectionName":"chorus1","reverbScale":1.5,"compScale":1.2,"gainDb":0.5}
  ],
  "delayThrows": [
    {"word":"tonight","start":42.3,"end":42.8,"type":"dotted_eighth","feedback":3,"section":"chorus1"}
  ],
  "busParams": {
    "glueCompThresh": -12,
    "glueCompRatio": 2.0,
    "eqLowShelf": 0.5,
    "eqHighShelf": 1.0,
    "stereoWidenHz": 120,
    "peakNormalize": -1.0
  },
  "warnings": []
}

Rules:
- "genre" must be one of: HIP_HOP | TRAP | RNB | POP | ROCK | ELECTRONIC | ACOUSTIC | LO_FI | AFROBEATS | LATIN | COUNTRY | GOSPEL | NEO_SOUL
- Map vocal_main → role "lead", vocal_adlibs → "adlib", vocal_insouts → "insouts", vocal_doubles → "double", vocal_harmonies → "harmony"
- delayThrows: only if delayStyle != "OFF" AND lyrics available; use quantized timestamps; dotted_eighth for chorus, quarter for verse
- sectionMap: chorus gets reverbScale 1.4–1.6; bridge Claude decides; verse stays at 1.0
- If customDirection says "keep ad-libs clean" — set adlib role params to no telephone (the engine checks direction)
- bass: monoBelow 120Hz; kick: highpassHz 30, peakEQ at 60Hz; beat: gainDb -2
- Return ONLY the JSON object, nothing else.`;

  const msg = await client.messages.create({
    model:      "claude-sonnet-4-5",
    max_tokens: 4000,
    messages:   [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text ?? "{}";

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  try {
    return JSON.parse(cleaned) as MixDecision;
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
        stereoWidenHz:  120,
        peakNormalize:  -1,
      },
      warnings: ["Failed to parse mix parameters from AI — using defaults."],
    };
  }
}

// ─── Revision parameter adjustment ───────────────────────────────────────────

export async function reviseParameters(params: {
  previousParams: MixDecision;
  feedback:       string;
  analysis:       MixAnalysisResult;
  genre:          string;
}): Promise<MixDecision> {
  const { previousParams, feedback, analysis, genre } = params;

  const prompt = `You are a professional mix engineer AI. The artist gave revision feedback on a mix.
Adjust the mix parameters to address the feedback. Return ONLY updated JSON, same schema as before.

Previous parameters:
${JSON.stringify(previousParams, null, 2).slice(0, 3000)}

Artist feedback: "${feedback}"

Genre: ${genre}
BPM: ${analysis.bpm.toFixed(1)}, Key: ${analysis.key}

Return ONLY the updated JSON object with the same structure. Make targeted changes to address the feedback.
Do not change things the artist didn't mention.`;

  const msg = await client.messages.create({
    model:      "claude-sonnet-4-5",
    max_tokens: 4000,
    messages:   [{ role: "user", content: prompt }],
  });

  const raw     = (msg.content[0] as { type: string; text: string }).text ?? "{}";
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  try {
    return JSON.parse(cleaned) as MixDecision;
  } catch {
    console.error("reviseParameters: parse failed:", raw.slice(0, 300));
    return previousParams; // fall back to previous
  }
}
