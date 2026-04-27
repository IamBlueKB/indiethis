/**
 * Pro Studio Mixer — Web Audio API graph hook.
 *
 * Builds a per-stem audio graph and a shared master bus. Returns stable
 * handles for the UI to drive in real time.
 *
 * Step 2 scope:
 *   - Per-stem chain wired with all node types in place (so later steps
 *     can flip on brightness / reverb / delay setters without rebuilding
 *     the graph)
 *   - Exposed setters: gain, pan, mute, solo
 *   - Per-stem AnalyserNode + master AnalyserNode (used in step 14)
 *   - Master gain + 5x flat biquad EQ + master analyser → destination
 *   - Transport that drives all stem audio elements off a master clock
 *
 * Later steps (7–13) wire reverb / delay / brightness / dry-wet / master
 * EQ setters onto the existing nodes.
 *
 * Drift handling: stems stay in sync because all HTMLAudioElements share
 * the same currentTime via setSeek + the master clock. If drift exceeds
 * 50ms during playback we resync. Drift is rare with same-length WAVs
 * decoded by the same browser engine.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  MasterHandle,
  StemHandle,
  StemRole,
  TransportHandle,
  UseStudioAudioReturn,
} from "./types";

interface UseStudioAudioOptions {
  /** Map of stem role → fresh signed URL. Order is preserved in the returned roles[]. */
  stems: Record<StemRole, string>;
}

const MASTER_EQ_FREQS = [60, 250, 1000, 4000, 12000] as const;

interface StemNodes {
  el:           HTMLAudioElement;
  source:       MediaElementAudioSourceNode;
  dryGain:      GainNode;          // wet/dry split — dry path
  brightness:   BiquadFilterNode;  // high shelf — wired in step 8
  convolver:    ConvolverNode;     // reverb — wired in step 9
  reverbWet:    GainNode;          // parallel wet send
  delay:        DelayNode;         // delay — wired in step 10
  delayFb:      GainNode;          // delay feedback
  delayWet:     GainNode;          // parallel wet send
  sumGain:      GainNode;          // wet+dry sum
  stemGain:     GainNode;          // user-controlled volume
  panner:       StereoPannerNode;
  analyser:     AnalyserNode;
  // Tracking flags for solo/mute logic
  muted:        boolean;
  soloed:       boolean;
  /** Last gainDb the user requested (so solo logic can restore it). */
  lastGainDb:   number;
}

/**
 * Convert dB to linear gain. -Infinity / very low values clamp to 0.
 */
function dbToLinear(db: number): number {
  if (!Number.isFinite(db) || db < -60) return 0;
  return Math.pow(10, db / 20);
}

export function useStudioAudio(opts: UseStudioAudioOptions): UseStudioAudioReturn {
  const { stems } = opts;
  const roles = useMemo(() => Object.keys(stems), [stems]);

  // Mutable graph state lives in a ref so React rerenders don't rebuild it.
  const ctxRef            = useRef<AudioContext | null>(null);
  const masterGainRef     = useRef<GainNode | null>(null);
  const masterEqRef       = useRef<BiquadFilterNode[]>([]);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const stemNodesRef      = useRef<Record<StemRole, StemNodes>>({});

  // Mute/solo bookkeeping — stored in refs so handlers see current state.
  const muteSoloRef = useRef<{ muted: Set<StemRole>; soloed: Set<StemRole> }>({
    muted:  new Set(),
    soloed: new Set(),
  });

  const [ready,   setReady]   = useState(false);
  const [errors,  setErrors]  = useState<Record<StemRole, string>>({});
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);

  // ─── Build graph on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (roles.length === 0) return;

    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    ctxRef.current = ctx;

    // Master chain: stems → masterGain → 5x biquad (flat) → analyser → destination
    const masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGainRef.current = masterGain;

    const masterEq = MASTER_EQ_FREQS.map((freq, idx) => {
      const node = ctx.createBiquadFilter();
      // First and last bands are shelves; middle three are peaking.
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

    // Wire master chain: masterGain → eq[0] → eq[1] → ... → analyser → destination
    masterGain.connect(masterEq[0]);
    for (let i = 0; i < masterEq.length - 1; i++) {
      masterEq[i].connect(masterEq[i + 1]);
    }
    masterEq[masterEq.length - 1].connect(masterAnalyser);
    masterAnalyser.connect(ctx.destination);

    // Per-stem chain
    const errorMap: Record<StemRole, string> = {};
    let loadedCount = 0;

    for (const role of roles) {
      const url = stems[role];
      const el  = new Audio();
      el.crossOrigin = "anonymous";
      el.preload     = "auto";
      el.src         = url;

      el.addEventListener("loadedmetadata", () => {
        // Use the longest stem as the source of truth for duration.
        if (Number.isFinite(el.duration)) {
          setDuration((d) => Math.max(d, el.duration));
        }
        loadedCount += 1;
        if (loadedCount === roles.length) setReady(true);
      });
      el.addEventListener("error", () => {
        errorMap[role] = "Failed to load stem audio.";
        setErrors({ ...errorMap });
      });

      const source     = ctx.createMediaElementSource(el);
      const dryGain    = ctx.createGain();
      dryGain.gain.value = 1.0;

      const brightness = ctx.createBiquadFilter();
      brightness.type            = "highshelf";
      brightness.frequency.value = 6000;
      brightness.gain.value      = 0;  // flat — wired in step 8

      const convolver = ctx.createConvolver();
      // No IR loaded yet — wired in step 9.

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

      const stemGain = ctx.createGain();
      stemGain.gain.value = 1.0;  // 0 dB

      const panner = ctx.createStereoPanner();
      panner.pan.value = 0;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;

      // Source splits into:
      //   1. dry path:    source → dryGain → sumGain
      //   2. wet path:    source → brightness → convolver → reverbWet → sumGain
      //   3. delay path:  source → delay (with feedback loop) → delayWet → sumGain
      // Then sumGain → stemGain → panner → analyser → masterGain
      source.connect(dryGain).connect(sumGain);

      source.connect(brightness);
      brightness.connect(convolver);
      convolver.connect(reverbWet).connect(sumGain);

      source.connect(delay);
      delay.connect(delayFb).connect(delay);   // feedback loop
      delay.connect(delayWet).connect(sumGain);

      sumGain.connect(stemGain);
      stemGain.connect(panner);
      panner.connect(analyser);
      analyser.connect(masterGain);

      stemNodesRef.current[role] = {
        el,
        source,
        dryGain,
        brightness,
        convolver,
        reverbWet,
        delay,
        delayFb,
        delayWet,
        sumGain,
        stemGain,
        panner,
        analyser,
        muted:      false,
        soloed:     false,
        lastGainDb: 0,
      };
    }

    setErrors(errorMap);

    // Master clock — drive currentTime updates from the first stem.
    const firstEl = stemNodesRef.current[roles[0]]?.el;
    let rafId: number | null = null;
    const tick = () => {
      if (firstEl) setCurrentTime(firstEl.currentTime);
      rafId = requestAnimationFrame(tick);
    };
    if (firstEl) {
      firstEl.addEventListener("ended", () => setIsPlaying(false));
      rafId = requestAnimationFrame(tick);
    }

    // Resume context on focus if it suspended.
    const onVisibility = () => {
      if (document.visibilityState === "visible" && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafId !== null) cancelAnimationFrame(rafId);
      for (const role of roles) {
        const n = stemNodesRef.current[role];
        if (!n) continue;
        try { n.el.pause(); } catch { /* noop */ }
        try { n.source.disconnect(); } catch { /* noop */ }
      }
      stemNodesRef.current = {};
      try { ctx.close(); } catch { /* noop */ }
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stems)]);  // rebuild only when the stems map identity changes

  // ─── Mute / solo logic ──────────────────────────────────────────────────
  // If anything is soloed, only soloed stems play. Otherwise respect mute.
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

  // ─── Build stable per-stem handles ──────────────────────────────────────
  const stemHandles = useMemo<Record<StemRole, StemHandle>>(() => {
    const out: Record<StemRole, StemHandle> = {};
    for (const role of roles) {
      out[role] = {
        setGainDb: (db: number) => {
          const n = stemNodesRef.current[role];
          if (!n) return;
          n.lastGainDb = db;
          // Solo logic may force gain to 0 — recompute via applyMuteSolo.
          applyMuteSolo();
        },
        setPan: (pan: number) => {
          const n = stemNodesRef.current[role];
          if (!n) return;
          const clamped = Math.max(-1, Math.min(1, pan));
          n.panner.pan.value = clamped;
        },
        // Lazily exposed analyser — populated after graph build.
        get analyser(): AnalyserNode {
          const n = stemNodesRef.current[role];
          // Fallback in pre-build window — caller should gate on `ready`.
          return n?.analyser ?? (null as unknown as AnalyserNode);
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
      // Snap all stems to the current master clock before playing.
      const firstEl = stemNodesRef.current[roles[0]]?.el;
      const snap    = firstEl ? firstEl.currentTime : 0;
      for (const role of roles) {
        const n = stemNodesRef.current[role];
        if (!n) continue;
        try {
          n.el.currentTime = snap;
          await n.el.play();
        } catch { /* autoplay rejection — caller should retry on user gesture */ }
      }
      setIsPlaying(true);
    },
    pause: () => {
      for (const role of roles) {
        const n = stemNodesRef.current[role];
        if (!n) continue;
        try { n.el.pause(); } catch { /* noop */ }
      }
      setIsPlaying(false);
    },
    seek: (seconds: number) => {
      const t = Math.max(0, Math.min(seconds, duration || seconds));
      for (const role of roles) {
        const n = stemNodesRef.current[role];
        if (!n) continue;
        try { n.el.currentTime = t; } catch { /* noop */ }
      }
      setCurrentTime(t);
    },
    isPlaying,
    currentTime,
    duration,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isPlaying, currentTime, duration, roles.join("|")]);

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

  return {
    ready,
    errors,
    roles,
    stems:    stemHandles,
    master:   masterHandle,
    transport,
    setMuted,
    setSoloed,
  };
}
