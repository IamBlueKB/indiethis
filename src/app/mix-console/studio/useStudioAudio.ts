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
  buffer:       AudioBuffer | null;
  stemInput:    GainNode;           // entry point — source.connect(stemInput) per play
  dryGain:      GainNode;
  brightness:   BiquadFilterNode;   // high shelf — wired in step 8
  convolver:    ConvolverNode;      // reverb — wired in step 9
  reverbWet:    GainNode;
  delay:        DelayNode;          // delay — wired in step 10
  delayFb:      GainNode;
  delayWet:     GainNode;
  sumGain:      GainNode;
  stemGain:     GainNode;
  panner:       StereoPannerNode;
  analyser:     AnalyserNode;
  /** Last gainDb the user requested (so solo logic can restore it). */
  lastGainDb:   number;
  /** Active source for the current playback session. Recreated each play/seek. */
  activeSource: AudioBufferSourceNode | null;
}

function dbToLinear(db: number): number {
  if (!Number.isFinite(db) || db < -60) return 0;
  return Math.pow(10, db / 20);
}

export function useStudioAudio(opts: UseStudioAudioOptions): UseStudioAudioReturn {
  const { stems } = opts;
  const roles = useMemo(() => Object.keys(stems), [stems]);

  // Mutable graph state lives in refs so React rerenders don't rebuild it.
  const ctxRef            = useRef<AudioContext | null>(null);
  const masterGainRef     = useRef<GainNode | null>(null);
  const masterEqRef       = useRef<BiquadFilterNode[]>([]);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const stemNodesRef      = useRef<Record<StemRole, StemNodes>>({});

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

      const convolver = ctx.createConvolver();

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
      stemGain.gain.value = 1.0;

      const panner = ctx.createStereoPanner();
      panner.pan.value = 0;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;

      // stemInput fans out to dry, wet (brightness→convolver→reverbWet), and delay (with feedback).
      stemInput.connect(dryGain).connect(sumGain);

      stemInput.connect(brightness);
      brightness.connect(convolver);
      convolver.connect(reverbWet).connect(sumGain);

      stemInput.connect(delay);
      delay.connect(delayFb).connect(delay);  // feedback loop
      delay.connect(delayWet).connect(sumGain);

      sumGain.connect(stemGain);
      stemGain.connect(panner);
      panner.connect(analyser);
      analyser.connect(masterGain);

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
        stemGain,
        panner,
        analyser,
        lastGainDb:   0,
        activeSource: null,
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
      }
      stemNodesRef.current = {};
      try { ctx.close(); } catch { /* noop */ }
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stems)]);

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
        get analyser(): AnalyserNode {
          const n = stemNodesRef.current[role];
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
