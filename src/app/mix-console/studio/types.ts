/**
 * Shared types for the Pro Studio Mixer.
 *
 * Knob values are stored as 0–100 where 50 = "AI's setting" (the original
 * value baked into the mix). predict.py is responsible for converting
 * those positions into multipliers/deltas applied on top of Claude's
 * stemParams + busParams. See _studio_render in predict.py.
 */

// Stem roles that can appear in a job. Pulled from the existing pipeline —
// labels like "vocal_main", "vocal_doubles", etc. come from inputFiles[].label.
// When Beat Polish is on, the beat is split into kick/bass/drums_other/melodics.
export type StemRole = string;

// Per-stem controllable parameters. All values normalized to a single shape
// regardless of whether they're stored as global or section overrides.
export interface StemState {
  gainDb:       number;   // -inf to +6 dB (delta from AI's gain)
  pan:          number;   // -1 (full L) to +1 (full R), absolute
  reverb:       number;   // 0–100, 50 = AI's setting
  delay:        number;   // 0–100, 50 = AI's setting
  comp:         number;   // 0–100, 50 = AI's setting (visual only in browser)
  brightness:   number;   // 0–100, 50 = AI's setting (high-shelf tilt)
  dryWet:       number;   // 0–100 — 0 = dry input only, 100 = fully processed
  muted:        boolean;
  soloed:       boolean;
}

export interface MasterState {
  volumeDb:     number;   // -inf to +6 dB
  stereoWidth:  number;   // 0–150 (% of normal width)
  eq:           [number, number, number, number, number]; // ±6dB each: sub, low, mid, high-mid, air
  aiIntensity:  number;   // 0–100 — global multiplier on AI's effect values
}

export interface SectionOverride {
  // Only fields that differ from global are stored. Everything else inherits.
  [stemRole: string]: Partial<StemState> | undefined;
}

export interface StudioState {
  global:    Record<StemRole, StemState>;
  sections:  Record<string, SectionOverride>;  // sectionName -> overrides
  master:    MasterState;
  isDirty:   boolean;
  lastSavedAt: string | null;
}

export interface Snapshot {
  name:       string;
  protected:  boolean;     // "AI Original" snapshot is protected
  created_at: string;
  state:      Pick<StudioState, "global" | "sections" | "master">;
}

// ── Web Audio hook contract ────────────────────────────────────────────────
//
// useStudioAudio builds the audio graph and returns stable handles.
// The graph shape is fixed: per-stem [Source → DryGain ↘
//                                              ↘ Brightness → ConvolverWet → DelayWet → SumGain]
//                          → StemGain → StemPanner → MasterGain → MasterEQ ×5 → MasterAnalyser → Destination
//
// Steps 7–13 will expose more setters. Step 2 only covers gain/pan/mute/solo.

export interface StemHandle {
  /** Set gain in dB. -Infinity is treated as full mute (gain=0). */
  setGainDb(db: number): void;
  /** Set pan from -1 (full left) to +1 (full right). */
  setPan(pan: number): void;
  /** Per-stem AnalyserNode for the mini frequency visualizer. */
  analyser: AnalyserNode;
}

export interface MasterHandle {
  /** Set master gain in dB. */
  setGainDb(db: number): void;
  /** Master AnalyserNode for the master visualizer. */
  analyser: AnalyserNode;
}

export interface TransportHandle {
  play():  Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  isPlaying:    boolean;
  currentTime:  number;
  duration:     number;
}

export interface UseStudioAudioReturn {
  /** True once all stems are loaded and decoding/buffering is ready. */
  ready:    boolean;
  /** Loading errors per stem, keyed by role. Empty on success. */
  errors:   Record<StemRole, string>;
  /** Roles in the order they were provided. */
  roles:    StemRole[];
  /** Per-stem handles. */
  stems:    Record<StemRole, StemHandle>;
  /** Master bus handle. */
  master:   MasterHandle;
  /** Transport controls (play / pause / seek). */
  transport: TransportHandle;
  /** Toggle mute on a stem (respects solo logic). */
  setMuted(role: StemRole, muted: boolean): void;
  /** Toggle solo on a stem (respects solo logic). */
  setSoloed(role: StemRole, soloed: boolean): void;
}
