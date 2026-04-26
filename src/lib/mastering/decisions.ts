/**
 * decisions.ts — Claude mix decision engine
 *
 * Claude acts as the invisible mix engineer. It reads audio analysis data,
 * genre context, mood target, and any natural language artist direction,
 * then outputs precise per-stem processing chains and a mastering chain.
 *
 * Claude is never visible on the mix side — no "Claude recommends" copy.
 * On the mastering compare screen only, versions are labeled "AI recommends".
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  AudioAnalysis,
  ClassifiedStem,
  StemProcessingChain,
  MasterParams,
  EQBand,
  MultibandBand,
  MasterVersion,
} from "./engine";
import { db as prisma } from "@/lib/db";
import { loadReferenceContext } from "@/lib/reference-library/context";

const anthropic = new Anthropic();

// ─── Version LUFS targets ──────────────────────────────────────────────────────

const VERSION_LUFS: Record<string, Record<string, number>> = {
  // Clean, Warm, Punch, Loud per genre category
  HIP_HOP:     { Clean: -11, Warm: -12, Punch: -10, Loud: -9  },
  POP:         { Clean: -13, Warm: -14, Punch: -12, Loud: -11 },
  RNB:         { Clean: -13, Warm: -13, Punch: -11, Loud: -10 },
  ELECTRONIC:  { Clean: -9,  Warm: -10, Punch: -8,  Loud: -7  },
  ROCK:        { Clean: -11, Warm: -12, Punch: -10, Loud: -9  },
  INDIE:       { Clean: -14, Warm: -14, Punch: -13, Loud: -12 },
  ACOUSTIC:    { Clean: -16, Warm: -16, Punch: -15, Loud: -14 },
  JAZZ:        { Clean: -18, Warm: -18, Punch: -17, Loud: -16 },
  DEFAULT:     { Clean: -12, Warm: -13, Punch: -11, Loud: -10 },
};

export function getVersionTargets(genre: string): MasterVersion[] {
  const lufs = VERSION_LUFS[genre.toUpperCase()] ?? VERSION_LUFS.DEFAULT;
  return [
    { name: "Clean", targetLufs: lufs.Clean },
    { name: "Warm",  targetLufs: lufs.Warm  },
    { name: "Punch", targetLufs: lufs.Punch },
    { name: "Loud",  targetLufs: lufs.Loud  },
  ];
}

// ─── Platform LUFS targets ─────────────────────────────────────────────────────

export const PLATFORM_TARGETS = {
  spotify:       { lufs: -14, truePeak: -1, format: "OGG_320"   },
  apple_music:   { lufs: -16, truePeak: -1, format: "AAC_256"   },
  youtube:       { lufs: -14, truePeak: -1, format: "MP3_320"   },
  tidal:         { lufs: -14, truePeak: -1, format: "FLAC"      },
  amazon_music:  { lufs: -14, truePeak: -2, format: "MP3_320"   },
  soundcloud:    { lufs: -14, truePeak: -1, format: "MP3_128"   },
  wav_master:    { lufs: -14, truePeak: -0.3, format: "WAV_24"  },
};

// ─── Essentia hint types ─────────────────────────────────────────────────────

export interface EssentiaHints {
  hasBass808:  boolean;
  hasAcoustic: boolean;
  hasSynth:    boolean;
  hasVocals:   boolean;
  isDark:      boolean;
  isBright:    boolean;
}

/** Build Essentia hints from raw Track fields. Returns null if no Essentia data. */
export function buildEssentiaHints(
  instruments: { label: string; score: number }[] | null,
  voice:       string | null,
  timbre:      string | null,
): EssentiaHints | null {
  if (!instruments && !voice && !timbre) return null;
  const labels = instruments?.map(i => i.label.toLowerCase()) ?? [];
  return {
    hasBass808:  labels.some(l => l.includes("bass") || l.includes("808")),
    hasAcoustic: labels.some(l => l.includes("acoustic")),
    hasSynth:    labels.some(l => l.includes("synth")),
    hasVocals:   voice === "vocal",
    isDark:      timbre === "dark",
    isBright:    timbre === "bright",
  };
}

function formatEssentiaHints(hints: EssentiaHints): string {
  const lines: string[] = [];
  if (hints.hasVocals)   lines.push("- Track has vocals — prioritize vocal clarity in high-mids");
  if (hints.hasBass808)  lines.push("- Heavy bass/808s detected — reinforce sub-bass clarity and mono compatibility");
  if (hints.hasSynth)    lines.push("- Synthesizers present — balance high-freq air without harsh resonances");
  if (hints.hasAcoustic) lines.push("- Acoustic elements present — preserve natural transients and warmth");
  if (hints.isDark)      lines.push("- Dark timbre — avoid over-brightening; preserve low-mid weight");
  if (hints.isBright)    lines.push("- Bright timbre — manage high-freq harshness; ensure balanced top end");
  return lines.join("\n");
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildMixPrompt(
  stems:          ClassifiedStem[],
  analysis:       AudioAnalysis,
  genre:          string,
  mood:           string,
  presetProfile:  Record<string, unknown> | null,
  naturalLanguagePrompt: string | null,
  referenceUrl:   string | null,
  essentiaHints:  EssentiaHints | null,
): string {
  return `You are a professional mix engineer with deep expertise in ${genre} production.

SONG ANALYSIS:
- BPM: ${analysis.bpm}
- Key: ${analysis.key}
- Duration: ${analysis.durationSec}s
- Overall LUFS: ${analysis.lufs} dB
- True Peak: ${analysis.truePeak} dBTP
- Dynamic Range: ${analysis.dynamicRange} dB
- Stereo Width: ${analysis.stereoWidth}

SONG SECTIONS:
${analysis.sections.map(s => `- ${s.label} (${s.type}): ${s.startSec}s–${s.endSec}s, energy ${s.energy.toFixed(2)}`).join("\n")}

STEMS (${stems.length} total):
${stems.map(s => `- ${s.detectedType.toUpperCase()} (${s.url.split("/").pop()})
  LUFS: ${s.analysis.lufs} dB | Peak: ${s.analysis.peak} dBTP | RMS: ${s.analysis.rms} dB
  Spectral centroid: ${s.analysis.spectralCentroid} Hz
  Freq balance: ${s.analysis.frequencyBalance.map(b => `${b.band}:${b.energy.toFixed(2)}`).join(", ")}`).join("\n\n")}

TARGET MOOD: ${mood}
${essentiaHints ? `AUDIO INTELLIGENCE (from ML analysis):\n${formatEssentiaHints(essentiaHints)}` : ""}
${presetProfile ? `GENRE PRESET DEFAULTS:\n${JSON.stringify(presetProfile, null, 2)}` : ""}
${naturalLanguagePrompt ? `ARTIST DIRECTION: "${naturalLanguagePrompt}"` : ""}
${referenceUrl ? `REFERENCE TRACK: provided (Matchering will handle spectral matching after your chain)` : ""}

OUTPUT REQUIREMENTS:
Return a JSON object with this exact structure. Every stem must have an entry, even if processing is minimal.

{
  "stems": [
    {
      "stemUrl": "<exact url from input>",
      "stemType": "<detected type>",
      "highpass": <Hz or null>,
      "lowpass": <Hz or null>,
      "eq": [{ "type": "boost|cut|highshelf|lowshelf|presence|air|warmth", "freq": <Hz>, "gain": <dB>, "q": <optional> }],
      "compression": { "threshold": <dB>, "ratio": <x>, "attack": <ms>, "release": <ms>, "knee": <optional dB>, "makeupGain": <optional dB> },
      "saturation": <0–10 or null>,
      "reverb": { "roomSize": <0–1>, "mix": <0–1>, "damping": <0–1>, "predelay": <optional ms> } or null,
      "delay": { "time": <seconds>, "feedback": <0–1>, "mix": <0–1> } or null,
      "gain": <dB>,
      "pan": <-1.0 to 1.0>,
      "monoBelow": <Hz or null>,
      "noiseGate": { "threshold": <dB>, "release": <ms> } or null
    }
  ],
  "reasoning": "<1-2 sentences: key decisions made>"
}

RULES:
1. Bass and kick drum: always monoBelow 200 Hz minimum for club compatibility
2. Vocals: highpass at 90–120 Hz minimum, noiseGate always set
3. Never put reverb or delay on bass or kick/snare — only subtle on toms if present
4. Pan distribution: keep stereo field balanced — if guitar pans right, keys or another element should pan left
5. Honor the artist direction precisely — if they say "more reverb on chorus vocal" you apply it
6. Saturation 0–2 for subtle warmth, 3–5 for character, 6–10 only for intentional distortion/lo-fi effects
7. Compression ratios: 2:1–3:1 for gentle glue, 4:1–6:1 for control, 8:1+ only for limiting/heavy pumping
8. Return ONLY the JSON object — no markdown, no explanation outside the "reasoning" field`;
}

function buildMasterPrompt(
  analysis:  AudioAnalysis,
  genre:     string,
  mood:      string,
  presetProfile: Record<string, unknown> | null,
  naturalLanguagePrompt: string | null,
  essentiaHints: EssentiaHints | null,
  refContextBlock: string = "",
): string {
  return `You are a mastering engineer specializing in ${genre}.

MIX ANALYSIS (post-mixdown):
- LUFS: ${analysis.lufs} dB
- True Peak: ${analysis.truePeak} dBTP
- Dynamic Range: ${analysis.dynamicRange} dB
- Stereo Width: ${analysis.stereoWidth}
- Spectral centroid: ${analysis.spectralCentroid} Hz
- Freq balance: ${analysis.frequencyBalance.map(b => `${b.band}:${b.energy.toFixed(2)}`).join(", ")}

TARGET MOOD: ${mood}
${essentiaHints ? `AUDIO INTELLIGENCE (from ML analysis):\n${formatEssentiaHints(essentiaHints)}` : ""}
${presetProfile ? `GENRE PRESET MASTERING DEFAULTS:\n${JSON.stringify(presetProfile, null, 2)}` : ""}
${naturalLanguagePrompt ? `ARTIST DIRECTION: "${naturalLanguagePrompt}"` : ""}
${refContextBlock ? `\n${refContextBlock}\n\nUse the genre profile above as a quantitative anchor when choosing EQ shelves, stereoWidth, monoBelow, and saturation. Stay inside the p25–p75 corridor unless the mix analysis or artist direction clearly demands otherwise.` : ""}

OUTPUT REQUIREMENTS:
Return a JSON object with this exact structure:

{
  "eq": [{ "type": "boost|cut|highshelf|lowshelf", "freq": <Hz>, "gain": <dB> }],
  "multibandCompression": [
    { "low": <Hz>, "high": <Hz>, "threshold": <dB>, "ratio": <x>, "attack": <ms>, "release": <ms>, "makeupGain": <dB> }
  ],
  "stereoWidth": <0.5–1.5>,
  "monoBelow": <Hz>,
  "saturation": <0–5>,
  "limiterThreshold": <dBTP, typically -0.3 to -1.0>,
  "limiterRelease": <ms>,
  "reasoning": "<1-2 sentences>"
}

RULES:
1. Always include all 4 multiband bands covering 20–20000 Hz with no gaps
2. Limiter true peak must not exceed -0.3 dBTP (streaming platform requirement)
3. monoBelow: 100–200 Hz for most genres, 200–250 Hz for EDM/trap
4. stereoWidth: 1.0 = unchanged, 1.2–1.3 = moderate widening, >1.4 = aggressive (EDM only)
5. Return ONLY the JSON object`;
}

// ─── Natural language section parser ──────────────────────────────────────────

/**
 * Parse a natural language prompt like "more reverb on the chorus vocal"
 * and apply overrides on top of Claude's base decisions.
 * The base decisions are already Claude-generated; this refines them.
 */
export async function applyNaturalLanguageOverrides(
  baseChains:   StemProcessingChain[],
  sections:     AudioAnalysis["sections"],
  prompt:       string,
): Promise<StemProcessingChain[]> {
  if (!prompt.trim()) return baseChains;

  const response = await anthropic.messages.create({
    model:      "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [{
      role:    "user",
      content: `You are a mix engineer applying an artist's last-minute direction.

BASE STEM CHAINS (JSON):
${JSON.stringify(baseChains, null, 2)}

AVAILABLE SECTIONS:
${sections.map(s => `${s.label} (${s.type}, ${s.startSec}s–${s.endSec}s)`).join("\n")}

ARTIST DIRECTION: "${prompt}"

Modify the chains to honor this direction. Return the complete updated chains array as JSON.
Only change what the direction explicitly asks for — leave everything else identical.
Return ONLY the JSON array.`,
    }],
  });

  const text = (response.content[0] as { type: string; text: string }).text.trim();

  try {
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()) as StemProcessingChain[];
    return parsed;
  } catch {
    // If Claude's output can't be parsed, return the original chains unchanged
    console.error("Failed to parse NL override response:", text);
    return baseChains;
  }
}

// ─── Main decision functions ───────────────────────────────────────────────────

export interface MixDecisionResult {
  chains:    StemProcessingChain[];
  reasoning: string;
}

export interface MasterDecisionResult {
  params:    Omit<MasterParams, "audioUrl" | "versions" | "platforms">;
  reasoning: string;
}

/**
 * Generate per-stem processing chains for Mix & Master mode.
 * Claude reads the analysis and outputs precise DSP parameters.
 * Natural language overrides are applied on top.
 */
export async function decideMixParameters(opts: {
  stems:                 ClassifiedStem[];
  analysis:              AudioAnalysis;
  genre:                 string;
  mood:                  string;
  naturalLanguagePrompt: string | null;
  referenceUrl:          string | null;
  presetName?:           string;
  essentiaHints?:        EssentiaHints | null;
}): Promise<MixDecisionResult> {
  const { stems, analysis, genre, mood, naturalLanguagePrompt, referenceUrl, presetName, essentiaHints = null } = opts;

  // Load genre preset profile if available
  let presetProfile: Record<string, unknown> | null = null;
  if (presetName) {
    const preset = await prisma.masteringPreset.findFirst({ where: { name: presetName } });
    presetProfile = (preset?.mixProfile as Record<string, unknown>) ?? null;
  }

  const prompt = buildMixPrompt(stems, analysis, genre, mood, presetProfile, naturalLanguagePrompt, referenceUrl, essentiaHints);

  const response = await anthropic.messages.create({
    model:      "claude-sonnet-4-5",
    max_tokens: 4096,
    messages:   [{ role: "user", content: prompt }],
  });

  const text = (response.content[0] as { type: string; text: string }).text.trim();
  const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()) as { stems: StemProcessingChain[]; reasoning: string };

  let chains = parsed.stems;

  // Apply natural language overrides on top of the base decisions
  if (naturalLanguagePrompt) {
    chains = await applyNaturalLanguageOverrides(chains, analysis.sections, naturalLanguagePrompt);
  }

  return { chains, reasoning: parsed.reasoning };
}

/**
 * Generate mastering chain parameters.
 * Claude reads the post-mix analysis and outputs the full mastering chain.
 */
export async function decideMasterParameters(opts: {
  analysis:              AudioAnalysis;
  genre:                 string;
  mood:                  string;
  naturalLanguagePrompt: string | null;
  presetName?:           string;
  essentiaHints?:        EssentiaHints | null;
}): Promise<MasterDecisionResult> {
  const { analysis, genre, mood, naturalLanguagePrompt, presetName, essentiaHints = null } = opts;

  let presetProfile: Record<string, unknown> | null = null;
  if (presetName) {
    const preset = await prisma.masteringPreset.findFirst({ where: { name: presetName } });
    presetProfile = (preset?.masterProfile as Record<string, unknown>) ?? null;
  }

  const refCtx = await loadReferenceContext(genre).catch(() => null);
  const refContextBlock = refCtx?.promptBlock ?? "";

  const prompt = buildMasterPrompt(analysis, genre, mood, presetProfile, naturalLanguagePrompt, essentiaHints, refContextBlock);

  const response = await anthropic.messages.create({
    model:      "claude-sonnet-4-5",
    max_tokens: 2048,
    messages:   [{ role: "user", content: prompt }],
  });

  const text = (response.content[0] as { type: string; text: string }).text.trim();
  const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()) as {
    eq:                    EQBand[];
    multibandCompression:  MultibandBand[];
    stereoWidth:           number;
    monoBelow:             number;
    saturation:            number;
    limiterThreshold:      number;
    limiterRelease:        number;
    reasoning:             string;
  };

  const { reasoning, ...params } = parsed;
  return { params, reasoning };
}

/**
 * Detect genre from analysis data when no explicit genre is provided.
 * Used when artist hasn't selected a genre preset.
 */
export async function detectGenre(analysis: AudioAnalysis): Promise<string> {
  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5",
    max_tokens: 50,
    messages: [{
      role:    "user",
      content: `Given this audio analysis, what genre is most likely?
BPM: ${analysis.bpm}
Spectral centroid: ${analysis.spectralCentroid} Hz
Freq balance: ${analysis.frequencyBalance.map(b => `${b.band}:${b.energy.toFixed(2)}`).join(", ")}
Dynamic range: ${analysis.dynamicRange} dB

Reply with exactly one of: HIP_HOP, POP, RNB, ELECTRONIC, ROCK, INDIE, ACOUSTIC, JAZZ
No other text.`,
    }],
  });

  const genre = (response.content[0] as { type: string; text: string }).text.trim().toUpperCase();
  const valid  = ["HIP_HOP", "POP", "RNB", "ELECTRONIC", "ROCK", "INDIE", "ACOUSTIC", "JAZZ"];
  return valid.includes(genre) ? genre : "HIP_HOP";
}

// ─── AI Direction Recommendation ──────────────────────────────────────────────

/**
 * generateDirectionRecommendation — Claude Haiku call (~$0.01)
 *
 * Given track analysis data, produces a 1-2 sentence plain-language mastering
 * direction recommendation the artist can Accept / Modify / Skip.
 * Runs AFTER payment — never before.
 */
export async function generateDirectionRecommendation(
  analysis: AudioAnalysis,
  genre:    string,
): Promise<string> {
  const sub  = analysis.frequencyBalance.find(b => b.band === "sub")?.energy  ?? 0;
  const low  = analysis.frequencyBalance.find(b => b.band === "low")?.energy  ?? 0;
  const mid  = analysis.frequencyBalance.find(b => b.band === "mid")?.energy  ?? 0;
  const high = analysis.frequencyBalance.find(b => b.band === "high")?.energy ?? 0;

  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5",
    max_tokens: 100,
    messages: [{
      role:    "user",
      content: `You are a mastering engineer. Based on this track analysis, give a brief, plain-language recommendation for mastering direction. Keep it to 1-2 sentences. Be specific about what you'd adjust.

Analysis:
- BPM: ${analysis.bpm.toFixed(0)}
- Key: ${analysis.key}
- LUFS: ${analysis.lufs.toFixed(1)}
- Frequency balance: sub=${sub.toFixed(2)}, low=${low.toFixed(2)}, mid=${mid.toFixed(2)}, high=${high.toFixed(2)}
- Genre: ${genre}

Respond with just the recommendation, no preamble.`,
    }],
  });

  return (response.content[0] as { type: string; text: string }).text.trim();
}
