/**
 * Pro Studio Mixer — Web Audio API graph hook.
 *
 * Builds a per-stem audio graph and a shared master bus. Returns stable
 * handles for the UI to drive in real time.
 *
 * Sync model (rewritten):
 *   We fetch + decodeAudioData each stem URL into an AudioBuffer at
 *   mount time, then play with AudioBufferSourceNode. All stems are
 *   started with ctx.currentTime + small lookahead and the same offset,
 *   so they are sample-accurate-locked to the AudioContext clock and
 *   cannot drift. <audio> + MediaElementAudioSourceNode (the previous
 *   approach) used independent media-element clocks per stem and drifted
 *   noticeably over a few minutes.
 *
 * Per-stem chain (persistent):
 *   stemInput (GainNode, used as source fan-out point)
 *     ├── dryGain    ──────────────────────────────┐
 *     ├── brightness → convolver → reverbWet ──────┤── sumGain → stemGain → panner → analyser → master
 *     └── delay (with feedback) → delayWet ────────┘
 *
 * Per play we create a fresh AudioBufferSourceNode and connect to
 * stemInput. AudioBufferSourceNodes are one-shot per Web Audio spec.
 *
 * Master chain (persistent):
 *   stems → masterGain → 5x biquad EQ (flat) → analyser → destination
 *
 * Later steps (7–13) wire reverb / delay / brightness / dry-wet / master
 * EQ setters onto the persistent nodes — no graph rebuild needed.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  MasterHandle,
  ReverbType,
  StemHandle,
  StemRole,
  TransportHandle,
  UseStudioAudioReturn,
} from "./types";

interface UseStudioAudioOptions {
  /** Map of stem role → fresh signed URL. Order is preserved in the returned roles[]. */
  stems: Record<StemRole, string>;
  /**
   * Optional map of stem role → URL for the raw / unprocessed upload. When
   * provided AND distinct from `stems[role]`, the dry/wet slider will lazy-
   * fetch this buffer the first time the user moves it and route the dry
   * leg from the original source. If absent (or equal to `stems[role]`),
   * the dry leg taps the wet source directly so the slider effectively
   * bypasses the per-stem effect chain.
   */
  originalStems?: Record<StemRole, string>;
  /** Per-stem reverb type (Claude's choice). Stems set to "dry" skip the convolver entirely. */
  reverbTypes?: Record<StemRole, ReverbType>;
  /** Track BPM — drives delay-time sync (1/8 note at this tempo). Defaults to 120. */
  bpm?: number;
}

const MASTER_EQ_FREQS = [60, 250, 1000, 4000, 12000] as const;

interface StemNodes {
  buffer:       AudioBuffer | null;
  stemInput:    GainNode;           // entry point — source.connect(stemInput) per play
  dryGain:      GainNode;
  brightness:   BiquadFilterNode;   // high shelf — step 8
  convolver:    ConvolverNode;      // reverb — step 9
  reverbWet:    GainNode;
  delay:        DelayNode;          // delay — step 10
  delayFb:      GainNode;
  delayWet:     GainNode;
  sumGain:      GainNode;
  compressor:   DynamicsCompressorNode;  // dynamics — step 11
  /** Mix-out gain on the wet (processed) leg. 1.0 = fully processed. */
  wetMixGain:   GainNode;
  /**
   * Dry leg input — sources connect here. Until the original buffer loads
   * we leave this disconnected and re-tap stemInput at the join point so
   * the dry slider bypasses effects against the same source. Once the
   * original buffer is loaded, per-play we create an AudioBufferSourceNode
   * for it and connect into dryStemInput.
   */
  dryStemInput: GainNode;
  /** Mix-out gain on the dry leg. Starts at 0 (slider default = 100 = fully processed). */
  dryDirectGain:GainNode;
  /** Tap on stemInput that feeds dryDirectGain when the original buffer hasn't loaded yet. */
  dryFallbackTap: GainNode;
  stemGain:     GainNode;
  panner:       StereoPannerNode;
  analyser:     AnalyserNode;
  /** Reverb type Claude chose for this stem. "dry" = convolver not wired. */
  reverbType:   ReverbType;
  /** Last gainDb the user requested (so solo logic can restore it). */
  lastGainDb:   number;
  /** Last dry/wet knob value 0..100 — used so solo doesn't clobber the mix. */
  lastDryWet:   number;
  /** Active source for the current playback session. Recreated each play/seek. */
  activeSource: AudioBufferSourceNode | null;
  /** URL of the raw / unprocessed upload (if different from the wet stem URL). */
  originalUrl:  string | null;
  /** Decoded raw upload, fetched lazily on first setDryWet move. */
  originalBuffer: AudioBuffer | null;
  /** "idle" until first setDryWet move triggers fetch; "loading" while in flight; "ready" or "error" after. */
  originalState: "idle" | "loading" | "ready" | "error";
  /** Active dry source mirroring the wet timeline. Null until original buffer is ready or while paused. */
  activeDrySource: AudioBufferSourceNode | null;
}

function dbToLinear(db: number): number {
  if (!Number.isFinite(db) || db < -60) return 0;
  return Math.pow(10, db / 20);
}

/**
 * Build a stereo impulse response algorithmically per reverb character.
 * Each profile tunes (durationSec, decay, predelay smear, brightness) so the
 * convolved tail sounds like the named space. Saves shipping IR WAV files
 * and works at any sample rate.
 *   - plate:     short, dense, bright          (~1.5s, fast decay, no predelay)
 *   - room:      tight, controlled             (~0.8s, faster decay)
 *   - hall:      lush, longer tail             (~3.2s, slow decay, mild predelay smear)
 *   - cathedral: very long, washy              (~5.5s, slow decay, more predelay smear)
 */
const REVERB_PROFILES: Record<Exclude<ReverbType, "dry">, { dur: number; decay: number; predelayMs: number }> = {
  plate:     { dur: 1.5, decay: 3.5, predelayMs: 0  },
  room:      { dur: 0.8, decay: 4.0, predelayMs: 0  },
  hall:      { dur: 3.2, decay: 2.8, predelayMs: 12 },
  cathedral: { dur: 5.5, decay: 2.2, predelayMs: 30 },
};

function buildReverbIR(ctx: AudioContext, type: Exclude<ReverbType, "dry">): AudioBuffer {
  const { dur, decay, predelayMs } = REVERB_PROFILES[type];
  const sr        = ctx.sampleRate;
  const length    = Math.max(1, Math.floor(sr * dur));
  const buf       = ctx.createBuffer(2, length, sr);
  const predelay  = Math.floor((predelayMs / 1000) * sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      if (i < predelay) { data[i] = 0; continue; }
      const t   = (i - predelay) / (length - predelay);
      const env = Math.pow(1 - t, decay);
      // Filtered noise: average two random samples = light low-pass smoothing.
      const noise = (Math.random() * 2 - 1 + Math.random() * 2 - 1) * 0.5;
      data[i] = noise * env;
    }
  }
  return buf;
}

export function useStudioAudio(opts: UseStudioAudioOptions): UseStudioAudioReturn {
  const { stems, originalStems, reverbTypes, bpm } = opts;
  const roles = useMemo(() => Object.keys(stems), [stems]);

  // Cache the bpm-synced 1/8-note delay time so setDelay can read it without
  // re-running the build effect.
  const eighthNoteSecRef = useRef<number>(0.25);
  eighthNoteSecRef.current = (() => {
    const safeBpm = Number.isFinite(bpm) && (bpm as number) > 30 ? (bpm as number) : 120;
    return 60 / safeBpm / 2;
  })();

  // Mutable graph state lives in refs so React rerenders don't rebuild it.
  const ctxRef            = useRef<AudioContext | null>(null);
  const masterGainRef     = useRef<GainNode | null>(null);
  const masterEqRef       = useRef<BiquadFilterNode[]>([]);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const stemNodesRef      = useRef<Record<StemRole, StemNodes>>({});
  // Per-(role, bins) peak-cache. Computing max-abs over a multi-minute buffer
  // is non-trivial; cache the downsampled result so a 60fps redraw doesn't
  // re-scan the buffer every frame.
  const peakCacheRef      = useRef<Record<string, Float32Array>>({});

  // Mute/solo bookkeeping.
  const muteSoloRef = useRef<{ muted: Set<StemRole>; soloed: Set<StemRole> }>({
    muted:  new Set(),
    soloed: new Set(),
  });

  // Transport bookkeeping for AudioContext-based playback.
  // playOffsetRef = where we'll start the next play() (or the paused position).
  // startedAtRef  = ctx.currentTime when the last play() began.
  const playOffsetRef = useRef<number>(0);
  const startedAtRef  = useRef<number>(0);

  const [ready,       setReady]       = useState(false);
  const [errors,      setErrors]      = useState<Record<StemRole, string>>({});
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);

  // ─── Build graph + decode buffers on mount ───────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (roles.length === 0) return;

    let cancelled = false;

    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    ctxRef.current = ctx;

    // Master chain: stems → masterGain → 5x biquad (flat) → analyser → destination
    const masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGainRef.current = masterGain;

    const masterEq = MASTER_EQ_FREQS.map((freq, idx) => {
      const node = ctx.createBiquadFilter();
      node.type      = idx === 0 ? "lowshelf"
                     : idx === MASTER_EQ_FREQS.length - 1 ? "highshelf"
                     : "peaking";
      node.frequency.value = freq;
      node.gain.value      = 0;  // flat — wired in step 13
      node.Q.value         = 1.0;
      return node;
    });
    masterEqRef.current = masterEq;

    const masterAnalyser = ctx.createAnalyser();
    masterAnalyser.fftSize = 2048;
    masterAnalyserRef.current = masterAnalyser;

    masterGain.connect(masterEq[0]);
    for (let i = 0; i < masterEq.length - 1; i++) {
      masterEq[i].connect(masterEq[i + 1]);
    }
    masterEq[masterEq.length - 1].connect(masterAnalyser);
    masterAnalyser.connect(ctx.destination);

    // Pre-build all four reverb IRs once. Each stem's convolver loads the
    // one matching its Claude-chosen reverbType. Dry stems skip the convolver.
    const irs: Record<Exclude<ReverbType, "dry">, AudioBuffer> = {
      plate:     buildReverbIR(ctx, "plate"),
      room:      buildReverbIR(ctx, "room"),
      hall:      buildReverbIR(ctx, "hall"),
      cathedral: buildReverbIR(ctx, "cathedral"),
    };

    // Build per-stem persistent chain (no source yet — added on play).
    for (const role of roles) {
      const stemInput = ctx.createGain();
      stemInput.gain.value = 1.0;

      const dryGain = ctx.createGain();
      dryGain.gain.value = 1.0;

      const brightness = ctx.createBiquadFilter();
      brightness.type            = "highshelf";
      brightness.frequency.value = 6000;
      brightness.gain.value      = 0;

      // Per-stem reverb IR — Claude's choice. "dry" → leave convolver
      // disconnected from the wet bus so it eats no CPU and is silent.
      const stemReverbType: ReverbType = reverbTypes?.[role] ?? "plate";
      const convolver = ctx.createConvolver();
      if (stemReverbType !== "dry") {
        convolver.buffer = irs[stemReverbType];
      }

      const reverbWet = ctx.createGain();
      reverbWet.gain.value = 0;

      const delay = ctx.createDelay(2.0);
      delay.delayTime.value = 0;

      const delayFb = ctx.createGain();
      delayFb.gain.value = 0;

      const delayWet = ctx.createGain();
      delayWet.gain.value = 0;

      const sumGain = ctx.createGain();
      sumGain.gain.value = 1.0;

      // Per-stem compressor — knob 0..100 drives threshold + ratio together.
      // At 0 the compressor is effectively bypassed (ratio=1). Defaults match
      // a transparent vocal/drum bus comp until the user moves the knob.
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = 0;
      compressor.knee.value      = 6;
      compressor.ratio.value     = 1;
      compressor.attack.value    = 0.003;
      compressor.release.value   = 0.1;

      // Wet (processed) mix-out — knob default dryWet=100 → wet at full.
      const wetMixGain = ctx.createGain();
      wetMixGain.gain.value = 1.0;

      // Dry leg: dryStemInput is where a future raw-upload source will be
      // connected once the lazy fetch lands. Until then, dryFallbackTap
      // mirrors stemInput so the slider still bypasses effects.
      const dryStemInput = ctx.createGain();
      dryStemInput.gain.value = 1.0;

      const dryFallbackTap = ctx.createGain();
      dryFallbackTap.gain.value = 1.0;     // active fallback

      const dryDirectGain = ctx.createGain();
      dryDirectGain.gain.value = 0;        // slider default = 100 → dry leg silent

      const stemGain = ctx.createGain();
      stemGain.gain.value = 1.0;

      const panner = ctx.createStereoPanner();
      panner.pan.value = 0;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;

      // stemInput → brightness (in series, always in the path so it's audible
      // even when reverb/delay are at zero). brightness then fans out to:
      //   1. dry path:   brightness → dryGain → sumGain
      //   2. reverb wet: brightness → convolver → reverbWet → sumGain
      //   3. delay wet:  brightness → delay (with feedback) → delayWet → sumGain
      stemInput.connect(brightness);

      brightness.connect(dryGain).connect(sumGain);

      // Reverb fan-out — only wired up if Claude chose a non-dry reverb.
      if (stemReverbType !== "dry") {
        brightness.connect(convolver);
        convolver.connect(reverbWet).connect(sumGain);
      }

      brightness.connect(delay);
      delay.connect(delayFb).connect(delay);  // feedback loop
      delay.connect(delayWet).connect(sumGain);

      sumGain.connect(compressor);
      compressor.connect(wetMixGain);
      wetMixGain.connect(stemGain);

      // Dry leg: until original buffer is ready, fallback tap from stemInput
      // feeds dryDirectGain. Once a raw-upload source is decoded, we connect
      // it into dryStemInput (which also feeds dryDirectGain) and disconnect
      // the fallback tap to avoid double-summing.
      stemInput.connect(dryFallbackTap);
      dryFallbackTap.connect(dryDirectGain);
      dryStemInput.connect(dryDirectGain);
      dryDirectGain.connect(stemGain);

      stemGain.connect(panner);
      panner.connect(analyser);
      analyser.connect(masterGain);

      // Detect whether a separate raw-upload URL is available for this stem.
      // If absent or identical to the wet URL, dry stays a fallback tap.
      const origUrl =
        originalStems && originalStems[role] && originalStems[role] !== stems[role]
          ? originalStems[role]
          : null;

      stemNodesRef.current[role] = {
        buffer:       null,
        stemInput,
        dryGain,
        brightness,
        convolver,
        reverbWet,
        delay,
        delayFb,
        delayWet,
        sumGain,
        compressor,
        wetMixGain,
        dryStemInput,
        dryDirectGain,
        dryFallbackTap,
        stemGain,
        panner,
        analyser,
        reverbType:    stemReverbType,
        lastGainDb:    0,
        lastDryWet:    100,
        activeSource:  null,
        originalUrl:   origUrl,
        originalBuffer:null,
        originalState: "idle",
        activeDrySource: null,
      };
    }

    // Fetch + decode all stems in parallel.
    const errorMap: Record<StemRole, string> = {};
    Promise.all(
      roles.map(async (role) => {
        try {
          const res = await fetch(stems[role], { credentials: "omit" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const ab  = await res.arrayBuffer();
          const buf = await ctx.decodeAudioData(ab);
          if (cancelled) return;
          const n = stemNodesRef.current[role];
          if (n) n.buffer = buf;
          // Use the longest stem as the master duration.
          setDuration((d) => Math.max(d, buf.duration));
        } catch (err) {
          errorMap[role] = (err as Error).message || "Failed to load stem audio.";
          setErrors({ ...errorMap });
        }
      })
    ).then(() => {
      if (!cancelled) setReady(true);
    });

    // rAF tick — drives currentTime while playing.
    let rafId: number | null = null;
    const tick = () => {
      const c = ctxRef.current;
      if (c) {
        // If any active source still exists, we're playing.
        const playing = roles.some((r) => stemNodesRef.current[r]?.activeSource !== null);
        if (playing) {
          const t = playOffsetRef.current + (c.currentTime - startedAtRef.current);
          setCurrentTime(t);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Resume context on focus if it suspended.
    const onVisibility = () => {
      if (document.visibilityState === "visible" && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafId !== null) cancelAnimationFrame(rafId);
      for (const role of roles) {
        const n = stemNodesRef.current[role];
        if (!n) continue;
        try { n.activeSource?.stop(); } catch { /* noop */ }
        try { n.activeSource?.disconnect(); } catch { /* noop */ }
        try { n.activeDrySource?.stop(); } catch { /* noop */ }
        try { n.activeDrySource?.disconnect(); } catch { /* noop */ }
      }
      stemNodesRef.current = {};
      try { ctx.close(); } catch { /* noop */ }
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stems), JSON.stringify(originalStems ?? {}), JSON.stringify(reverbTypes ?? {})]);

  // ─── Mute / solo logic ──────────────────────────────────────────────────
  function applyMuteSolo() {
    const { muted, soloed } = muteSoloRef.current;
    const anySoloed = soloed.size > 0;
    for (const role of roles) {
      const n = stemNodesRef.current[role];
      if (!n) continue;
      const audible = anySoloed ? soloed.has(role) : !muted.has(role);
      const linear  = audible ? dbToLinear(n.lastGainDb) : 0;
      n.stemGain.gain.value = linear;
    }
  }

  // ─── Internal start/stop helpers ────────────────────────────────────────
  function startSourcesAt(offset: number) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const when = ctx.currentTime + 0.05;  // 50ms lookahead so all sources start synchronously
    for (const role of roles) {
      const n = stemNodesRef.current[role];
      if (!n || !n.buffer) continue;
      const src = ctx.createBufferSource();
      src.buffer = n.buffer;
      src.connect(n.stemInput);
      try { src.start(when, Math.min(offset, n.buffer.duration)); } catch { /* noop */ }
      n.activeSource = src;

      // If we already have the raw-upload buffer decoded, fire a parallel
      // dry source synced to the same start time + offset.
      if (n.originalBuffer && n.originalState === "ready") {
        const drySrc = ctx.createBufferSource();
        drySrc.buffer = n.originalBuffer;
        drySrc.connect(n.dryStemInput);
        try { drySrc.start(when, Math.min(offset, n.originalBuffer.duration)); } catch { /* noop */ }
        n.activeDrySource = drySrc;
      }
    }
    startedAtRef.current = when;
    playOffsetRef.current = offset;

    // Detect end via the longest buffer's source.
    const longest = roles.reduce<{ role: StemRole | null; dur: number }>(
      (acc, r) => {
        const buf = stemNodesRef.current[r]?.buffer;
        return buf && buf.duration > acc.dur ? { role: r, dur: buf.duration } : acc;
      },
      { role: null, dur: 0 }
    );
    const longestSrc = longest.role ? stemNodesRef.current[longest.role]?.activeSource : null;
    if (longestSrc) {
      longestSrc.onended = () => {
        // Only treat as natural end if this source is still the active one
        // (i.e. we didn't manually stop/seek).
        const stillActive =
          longest.role && stemNodesRef.current[longest.role]?.activeSource === longestSrc;
        if (stillActive) {
          stopSources();
          playOffsetRef.current = 0;
          setCurrentTime(0);
          setIsPlaying(false);
        }
      };
    }
  }

  function stopSources() {
    for (const role of roles) {
      const n = stemNodesRef.current[role];
      if (!n) continue;
      const src = n.activeSource;
      if (src) {
        try { src.onended = null; } catch { /* noop */ }
        try { src.stop(); } catch { /* noop */ }
        try { src.disconnect(); } catch { /* noop */ }
        n.activeSource = null;
      }
      const drySrc = n.activeDrySource;
      if (drySrc) {
        try { drySrc.stop(); } catch { /* noop */ }
        try { drySrc.disconnect(); } catch { /* noop */ }
        n.activeDrySource = null;
      }
    }
  }

  // ─── Stem handles ───────────────────────────────────────────────────────
  const stemHandles = useMemo<Record<StemRole, StemHandle>>(() => {
    const out: Record<StemRole, StemHandle> = {};
    for (const role of roles) {
      out[role] = {
        setGainDb: (db: number) => {
          const n = stemNodesRef.current[role];
          if (!n) return;
          n.lastGainDb = db;
          applyMuteSolo();
        },
        setPan: (pan: number) => {
          const n = stemNodesRef.current[role];
          if (!n) return;
          n.panner.pan.value = Math.max(-1, Math.min(1, pan));
        },
        setBrightness: (value: number) => {
          const n = stemNodesRef.current[role];
          if (!n) return;
          // 0..100 → -8..+8 dB (50 = 0 dB / flat = AI's setting)
          const v  = Math.max(0, Math.min(100, value));
          const db = ((v - 50) / 50) * 8;
          n.brightness.gain.value = db;
        },
        setReverb: (value: number) => {
          const n = stemNodesRef.current[role];
          if (!n) return;
          // Dry stems have no convolver wired — knob is a no-op.
          if (n.reverbType === "dry") return;
          // Knob value 0..100 maps directly to wet level 0..1 (matches
          // Claude's reverbSend convention so the gold AI tick lines up
          // with the actual % wet baked into the AI mix).
          const v = Math.max(0, Math.min(100, value));
          n.reverbWet.gain.value = v / 100;
        },
        setDelay: (value: number) => {
          const n = stemNodesRef.current[role];
          if (!n) return;
          const v = Math.max(0, Math.min(100, value));
          // Wet level: 0..100 → 0..0.5 (50% max wet — keeps the dry signal
          // dominant; full wet would smear the mix).
          n.delayWet.gain.value = (v / 100) * 0.5;
          // Time: 1/8 note at the track's BPM. Locked to bpm so it always
          // sits in the pocket regardless of song.
          n.delay.delayTime.value = eighthNoteSecRef.current;
          // Feedback: 0..0.5. Light at low knob values, more washy past 50.
          n.delayFb.gain.value = (v / 100) * 0.5;
        },
        setDryWet: (value: number) => {
          const n = stemNodesRef.current[role];
          if (!n) return;
          const v = Math.max(0, Math.min(100, value));
          n.lastDryWet = v;
          // 0 = dry input only, 100 = fully processed.
          n.wetMixGain.gain.value   = v / 100;
          n.dryDirectGain.gain.value = 1 - (v / 100);

          // Lazy-fetch the raw upload buffer the first time the user moves
          // the slider — only if a distinct original URL exists. While idle
          // the fallback tap from stemInput keeps the dry leg sounding like
          // an effects-bypass of the wet source.
          if (n.originalUrl && n.originalState === "idle") {
            n.originalState = "loading";
            const ctx = ctxRef.current;
            if (!ctx) return;
            (async () => {
              try {
                const res = await fetch(n.originalUrl as string, { credentials: "omit" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const ab  = await res.arrayBuffer();
                const buf = await ctx.decodeAudioData(ab);
                if (stemNodesRef.current[role] !== n) return;  // unmounted
                n.originalBuffer = buf;
                n.originalState  = "ready";
                // Swap fallback tap off so the dry leg now feeds from the
                // raw-upload source instead of the wet source.
                try { n.dryFallbackTap.disconnect(); } catch { /* noop */ }
                // If we're currently playing, fire a synced dry source now.
                if (n.activeSource) {
                  const elapsed = ctx.currentTime - startedAtRef.current;
                  const offset  = playOffsetRef.current + Math.max(0, elapsed);
                  const drySrc = ctx.createBufferSource();
                  drySrc.buffer = buf;
                  drySrc.connect(n.dryStemInput);
                  try { drySrc.start(ctx.currentTime + 0.02, Math.min(offset, buf.duration)); } catch { /* noop */ }
                  n.activeDrySource = drySrc;
                }
              } catch {
                n.originalState = "error";
                // Keep the fallback tap wired so the slider still does
                // *something* (effects bypass) on subsequent moves.
              }
            })();
          }
        },
        setComp: (value: number) => {
          const n = stemNodesRef.current[role];
          if (!n) return;
          // 0..100 → threshold 0..-30 dB, ratio 1..8.
          // 0     = pass-through (ratio 1, threshold 0 dB).
          // 100   = aggressive squash (ratio 8, threshold -30 dB).
          const v        = Math.max(0, Math.min(100, value));
          const ratio    = 1 + (v / 100) * 7;
          const threshDb = -(v / 100) * 30;
          n.compressor.ratio.value     = ratio;
          n.compressor.threshold.value = threshDb;
        },
        get analyser(): AnalyserNode {
          const n = stemNodesRef.current[role];
          return n?.analyser ?? (null as unknown as AnalyserNode);
        },
        getPeaks: (bins: number) => {
          const n = stemNodesRef.current[role];
          if (!n?.buffer) return null;
          const key    = `${role}:${bins}`;
          const cached = peakCacheRef.current[key];
          if (cached) return cached;
          const buf    = n.buffer;
          const ch0    = buf.getChannelData(0);
          const ch1    = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;
          const N      = ch0.length;
          const step   = Math.max(1, Math.floor(N / bins));
          const out    = new Float32Array(bins);
          let maxOverall = 0;
          for (let i = 0; i < bins; i++) {
            const start = i * step;
            const end   = Math.min(N, start + step);
            let peak = 0;
            for (let j = start; j < end; j += 8) {  // every 8th sample — fast & visually identical
              const a = Math.abs(ch0[j]);
              const b = Math.abs(ch1[j]);
              if (a > peak) peak = a;
              if (b > peak) peak = b;
            }
            out[i] = peak;
            if (peak > maxOverall) maxOverall = peak;
          }
          // Normalize so each stem fills its own row visually regardless of
          // its absolute level — channel strip already conveys gain.
          if (maxOverall > 0) {
            const inv = 1 / maxOverall;
            for (let i = 0; i < bins; i++) out[i] *= inv;
          }
          peakCacheRef.current[key] = out;
          return out;
        },
        renderToBuffer: async (stemState) => {
          const n = stemNodesRef.current[role];
          if (!n || !n.buffer) return null;

          // Build an offline context that mirrors the live chain. Output is
          // forced stereo; sample rate matches the source buffer.
          const sr  = n.buffer.sampleRate;
          const len = n.buffer.length;
          const oCtx = new OfflineAudioContext({
            numberOfChannels: 2,
            length:           len,
            sampleRate:       sr,
          });

          // Source.
          const src = oCtx.createBufferSource();
          src.buffer = n.buffer;

          // brightness (high-shelf at 6 kHz, ±8 dB across 0..100 knob).
          const v = Math.max(0, Math.min(100, stemState.brightness));
          const brightness = oCtx.createBiquadFilter();
          brightness.type            = "highshelf";
          brightness.frequency.value = 6000;
          brightness.gain.value      = ((v - 50) / 50) * 8;

          // sumGain is where dry / reverb / delay all converge.
          const sumGain = oCtx.createGain();
          sumGain.gain.value = 1.0;

          // Dry leg of the wet chain.
          const dryGain = oCtx.createGain();
          dryGain.gain.value = 1.0;

          // Reverb wet (skip wiring for "dry" reverbType).
          if (n.reverbType !== "dry") {
            const ir = REVERB_PROFILES[n.reverbType];
            const length    = Math.max(1, Math.floor(sr * ir.dur));
            const irBuf     = oCtx.createBuffer(2, length, sr);
            const predelay  = Math.floor((ir.predelayMs / 1000) * sr);
            for (let ch = 0; ch < 2; ch++) {
              const data = irBuf.getChannelData(ch);
              for (let i = 0; i < length; i++) {
                if (i < predelay) { data[i] = 0; continue; }
                const t   = (i - predelay) / (length - predelay);
                const env = Math.pow(1 - t, ir.decay);
                const noise = (Math.random() * 2 - 1 + Math.random() * 2 - 1) * 0.5;
                data[i] = noise * env;
              }
            }
            const conv = oCtx.createConvolver();
            conv.buffer = irBuf;
            const reverbWet = oCtx.createGain();
            reverbWet.gain.value = Math.max(0, Math.min(100, stemState.reverb)) / 100;
            brightness.connect(conv);
            conv.connect(reverbWet).connect(sumGain);
          }

          // Delay (1/8 note at track BPM with feedback).
          const dly = oCtx.createDelay(2.0);
          dly.delayTime.value = eighthNoteSecRef.current;
          const dlyVal = Math.max(0, Math.min(100, stemState.delay));
          const dlyFb = oCtx.createGain();
          dlyFb.gain.value = (dlyVal / 100) * 0.5;
          const dlyWet = oCtx.createGain();
          dlyWet.gain.value = (dlyVal / 100) * 0.5;
          brightness.connect(dly);
          dly.connect(dlyFb).connect(dly);
          dly.connect(dlyWet).connect(sumGain);

          // Brightness → dry → sumGain.
          brightness.connect(dryGain).connect(sumGain);

          // Compressor.
          const compVal = Math.max(0, Math.min(100, stemState.comp));
          const comp = oCtx.createDynamicsCompressor();
          comp.knee.value      = 6;
          comp.attack.value    = 0.003;
          comp.release.value   = 0.1;
          comp.ratio.value     = 1 + (compVal / 100) * 7;
          comp.threshold.value = -(compVal / 100) * 30;

          // Wet mix-out gain.
          const wetMix = oCtx.createGain();
          wetMix.gain.value = Math.max(0, Math.min(100, stemState.dryWet)) / 100;

          // Dry leg (raw upload mix-out). If the original buffer has been
          // lazy-loaded, route a parallel source through it; otherwise fall
          // back to the wet source so the slider still acts as effects-bypass.
          const dryMix = oCtx.createGain();
          dryMix.gain.value = 1 - Math.max(0, Math.min(100, stemState.dryWet)) / 100;
          let drySrc: AudioBufferSourceNode | null = null;
          if (n.originalBuffer && n.originalState === "ready") {
            drySrc = oCtx.createBufferSource();
            drySrc.buffer = n.originalBuffer;
            drySrc.connect(dryMix);
          } else {
            // Fallback dry tap: the same source feeds dryMix bypassing the chain.
            // We add another source on the same buffer (sample-locked) so dryMix
            // gets unprocessed audio.
            const fb = oCtx.createBufferSource();
            fb.buffer = n.buffer;
            fb.connect(dryMix);
            drySrc = fb;
          }

          // Stem gain (dB delta from AI's level).
          const stemGain = oCtx.createGain();
          stemGain.gain.value = dbToLinear(stemState.gainDb);

          // Pan.
          const pan = oCtx.createStereoPanner();
          pan.pan.value = Math.max(-1, Math.min(1, stemState.pan));

          // Chain: src → brightness → (dry + wet busses) → sumGain →
          //        compressor → wetMix → stemGain → pan → destination
          //        (dry leg) drySrc → dryMix → stemGain → pan → destination
          src.connect(brightness);
          sumGain.connect(comp);
          comp.connect(wetMix);
          wetMix.connect(stemGain);
          dryMix.connect(stemGain);
          stemGain.connect(pan);
          pan.connect(oCtx.destination);

          src.start(0);
          if (drySrc) drySrc.start(0);

          try {
            const rendered = await oCtx.startRendering();
            return rendered;
          } catch {
            return null;
          }
        },
      };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, roles.join("|")]);

  const masterHandle = useMemo<MasterHandle>(() => ({
    setGainDb: (db: number) => {
      const g = masterGainRef.current;
      if (!g) return;
      g.gain.value = dbToLinear(db);
    },
    setEqBand: (index, gainDb) => {
      const eq = masterEqRef.current;
      if (!eq[index]) return;
      const clamped = Math.max(-6, Math.min(6, gainDb));
      eq[index].gain.value = clamped;
    },
    get analyser(): AnalyserNode {
      return masterAnalyserRef.current ?? (null as unknown as AnalyserNode);
    },
  }), [ready]);

  // ─── Transport ──────────────────────────────────────────────────────────
  const transport = useMemo<TransportHandle>(() => ({
    play: async () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") await ctx.resume();
      if (!ready) return;
      // Already playing — no-op.
      if (roles.some((r) => stemNodesRef.current[r]?.activeSource)) return;
      startSourcesAt(playOffsetRef.current);
      setIsPlaying(true);
    },
    pause: () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const elapsed = ctx.currentTime - startedAtRef.current;
      const offset  = playOffsetRef.current + Math.max(0, elapsed);
      stopSources();
      playOffsetRef.current = Math.min(offset, duration || offset);
      setCurrentTime(playOffsetRef.current);
      setIsPlaying(false);
    },
    seek: (seconds: number) => {
      const t       = Math.max(0, Math.min(seconds, duration || seconds));
      const wasPlaying = roles.some((r) => stemNodesRef.current[r]?.activeSource);
      stopSources();
      playOffsetRef.current = t;
      setCurrentTime(t);
      if (wasPlaying) {
        startSourcesAt(t);
      }
    },
    isPlaying,
    currentTime,
    duration,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isPlaying, currentTime, duration, ready, roles.join("|")]);

  function setMuted(role: StemRole, muted: boolean) {
    if (muted) muteSoloRef.current.muted.add(role);
    else       muteSoloRef.current.muted.delete(role);
    applyMuteSolo();
  }

  function setSoloed(role: StemRole, soloed: boolean) {
    if (soloed) muteSoloRef.current.soloed.add(role);
    else        muteSoloRef.current.soloed.delete(role);
    applyMuteSolo();
  }

  function getCombinedPeaks(bins: number): Float32Array | null {
    const key    = `__combined__:${bins}`;
    const cached = peakCacheRef.current[key];
    if (cached) return cached;
    let hadAny = false;
    const acc  = new Float32Array(bins);
    let max    = 0;
    for (const role of roles) {
      const handle = stemHandles[role];
      if (!handle) continue;
      const p = handle.getPeaks(bins);
      if (!p) continue;
      hadAny = true;
      for (let i = 0; i < bins; i++) {
        if (p[i] > acc[i]) acc[i] = p[i];
        if (acc[i] > max)  max    = acc[i];
      }
    }
    if (!hadAny) return null;
    if (max > 0) {
      const inv = 1 / max;
      for (let i = 0; i < bins; i++) acc[i] *= inv;
    }
    peakCacheRef.current[key] = acc;
    return acc;
  }

  return {
    ready,
    errors,
    roles,
    stems:    stemHandles,
    master:   masterHandle,
    transport,
    setMuted,
    setSoloed,
    getCombinedPeaks,
  };
}
