/**
 * StudioClient — Pro Studio Mixer shell.
 *
 * Step 5 scope:
 *   - Top bar (track title, PRO STUDIO badge, transport)
 *   - Horizontal row of ChannelStrips driven by useStudioAudio
 *   - Master strip placeholder (step 12 fills in)
 *   - Section timeline placeholder (step 15 fills in)
 *   - Below 768px viewport guard
 *   - Re-render / Export buttons (step 25/26 wires actions)
 *
 * State model:
 *   - `state` is the full StudioState (global per-stem + sections + master)
 *   - Every control change pushes through a setter that updates state
 *     AND drives the audio graph in real time
 *
 * Initial state seeding:
 *   - Each stem starts at gainDb=0 (= AI's level), pan=AI's pan,
 *     knobs=50 (= AI's setting), dryWet=100, muted/soloed=false
 *   - Master starts at volumeDb=0, stereoWidth=100, eq=flat, aiIntensity=100
 *   - If `initialState` is passed, it overrides the defaults (autosave restore)
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Download, RotateCw } from "lucide-react";
import { ChannelStrip }   from "./ChannelStrip";
import { EffectKnob }     from "./EffectKnob";
import { useStudioAudio } from "./useStudioAudio";
import { colorForRole, labelForRole } from "./stem-colors";
import type { MasterState, StemRole, StemState, StudioState } from "./types";

interface AiOriginal {
  /** AI's original pan position per stem (-1..+1). Defaults to 0 if missing. */
  pan: number;
}

export interface StudioClientProps {
  jobId:        string;
  trackTitle:   string;
  /** Map of stem role → fresh signed URL. */
  stems:        Record<StemRole, string>;
  /** AI's original per-stem settings — used for the AI reference dot + modified detection. */
  aiOriginals?: Record<StemRole, AiOriginal>;
  /** Existing studio state if the artist is reopening a session (autosave restore). */
  initialState?: StudioState | null;
  /** True if the artist arrived via guest token (changes export/share UX). */
  isGuest?:     boolean;
  /** Reference track URL — enables the Reference comparison toggle in step 22. */
  referenceTrackUrl?: string | null;
  /** BPM — used for delay-time sync in step 10. */
  bpm?:         number;
}

const DEFAULT_STEM_STATE: StemState = {
  gainDb:     0,
  pan:        0,
  reverb:     50,
  delay:      50,
  comp:       50,
  brightness: 50,
  dryWet:     100,
  muted:      false,
  soloed:     false,
};

const DEFAULT_MASTER_STATE: MasterState = {
  volumeDb:    0,
  stereoWidth: 100,
  eq:          [0, 0, 0, 0, 0],
  aiIntensity: 100,
};

function mmss(t: number): string {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StudioClient(props: StudioClientProps) {
  const { jobId: _jobId, trackTitle, stems, aiOriginals, initialState, referenceTrackUrl: _ref, bpm: _bpm } = props;

  // Stable role order — first stem wins as transport master clock.
  const roles = useMemo(() => Object.keys(stems), [stems]);

  // ─── Build initial state ───────────────────────────────────────────────
  const initialStudioState = useMemo<StudioState>(() => {
    if (initialState) return initialState;
    const global: Record<StemRole, StemState> = {};
    for (const role of roles) {
      global[role] = {
        ...DEFAULT_STEM_STATE,
        pan: aiOriginals?.[role]?.pan ?? 0,
      };
    }
    return {
      global,
      sections:    {},
      master:      { ...DEFAULT_MASTER_STATE },
      isDirty:     false,
      lastSavedAt: null,
    };
  }, [initialState, roles, aiOriginals]);

  const [state, setState] = useState<StudioState>(initialStudioState);

  // ─── Audio graph ────────────────────────────────────────────────────────
  const audio = useStudioAudio({ stems });

  // Push initial state into the audio graph once it's ready.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!audio.ready || seededRef.current) return;
    seededRef.current = true;
    for (const role of roles) {
      const s = state.global[role];
      if (!s) continue;
      audio.stems[role]?.setGainDb(s.gainDb);
      audio.stems[role]?.setPan(s.pan);
      if (s.muted)  audio.setMuted(role, true);
      if (s.soloed) audio.setSoloed(role, true);
    }
    audio.master.setGainDb(state.master.volumeDb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.ready]);

  // ─── State setters that drive both React state + audio graph ─────────────
  function updateStem(role: StemRole, patch: Partial<StemState>) {
    setState((prev) => ({
      ...prev,
      global:  { ...prev.global, [role]: { ...prev.global[role], ...patch } },
      isDirty: true,
    }));
  }

  function setStemGainDb(role: StemRole, db: number) {
    updateStem(role, { gainDb: db });
    audio.stems[role]?.setGainDb(db);
  }
  function setStemPan(role: StemRole, pan: number) {
    updateStem(role, { pan });
    audio.stems[role]?.setPan(pan);
  }
  function setStemReverb(role: StemRole, v: number)     { updateStem(role, { reverb: v }); }
  function setStemDelay(role: StemRole, v: number)      { updateStem(role, { delay: v }); }
  function setStemComp(role: StemRole, v: number)       { updateStem(role, { comp: v }); }
  function setStemBrightness(role: StemRole, v: number) { updateStem(role, { brightness: v }); }
  function toggleMute(role: StemRole) {
    const next = !state.global[role]?.muted;
    updateStem(role, { muted: next });
    audio.setMuted(role, next);
  }
  function toggleSolo(role: StemRole) {
    const next = !state.global[role]?.soloed;
    updateStem(role, { soloed: next });
    audio.setSoloed(role, next);
  }

  // ─── Modified detection (lights AI badge dim) ────────────────────────────
  function isStemModified(role: StemRole): boolean {
    const s   = state.global[role];
    const ref = { ...DEFAULT_STEM_STATE, pan: aiOriginals?.[role]?.pan ?? 0 };
    if (!s) return false;
    return (
      s.gainDb     !== ref.gainDb     ||
      s.pan        !== ref.pan        ||
      s.reverb     !== ref.reverb     ||
      s.delay      !== ref.delay      ||
      s.comp       !== ref.comp       ||
      s.brightness !== ref.brightness ||
      s.dryWet     !== ref.dryWet     ||
      s.muted      !== ref.muted      ||
      s.soloed     !== ref.soloed
    );
  }

  // ─── Transport ──────────────────────────────────────────────────────────
  async function togglePlay() {
    if (audio.transport.isPlaying) audio.transport.pause();
    else                            await audio.transport.play();
  }

  // ─── Re-render trigger (step 26 wires the API call) ──────────────────────
  function onRerender() {
    /* TODO step 26 — POST /api/mix-console/job/[id]/studio/render */
    console.log("Re-render requested with state:", state);
  }

  // ─── Simple / Advanced view toggle ───────────────────────────────────────
  // Simple view hides the per-stem 2x2 effect knobs + dry/wet + visualizer.
  const [advanced, setAdvanced] = useState(false);

  // ─── Below-768 viewport guard ────────────────────────────────────────────
  const [tooSmall, setTooSmall] = useState(false);
  useEffect(() => {
    const onResize = () => setTooSmall(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (tooSmall) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6"
           style={{ backgroundColor: "#0D0B09", color: "#fff" }}>
        <div className="max-w-md text-center">
          <p className="text-3xl mb-4">🎛</p>
          <h1 className="text-lg font-bold mb-2">Pro Studio Mixer</h1>
          <p className="text-sm" style={{ color: "#888" }}>
            The Pro Studio Mixer is designed for larger screens. Open this page on your
            desktop or tablet for the full mixing experience.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0D0B09", color: "#fff" }}>
      {/* ─── Top bar ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-6 py-3 border-b"
        style={{ backgroundColor: "#141210", borderColor: "#1f1d1a" }}
      >
        {/* Title + PRO STUDIO badge */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-bold truncate" style={{ maxWidth: 320 }}>{trackTitle}</span>
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            PRO Studio
          </span>
        </div>

        {/* Transport */}
        <div className="flex-1 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!audio.ready}
            aria-label={audio.transport.isPlaying ? "Pause" : "Play"}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{
              backgroundColor: audio.ready ? "#E8735A" : "#3A3631",
              color:           "#0A0A0A",
              opacity:         audio.ready ? 1 : 0.5,
            }}
          >
            {audio.transport.isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>
          <span className="text-xs font-mono" style={{ color: "#888" }}>
            {mmss(audio.transport.currentTime)} / {mmss(audio.transport.duration)}
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Simple / Advanced view toggle */}
          <div
            className="flex items-center text-[10px] font-bold uppercase tracking-wider rounded-lg overflow-hidden"
            style={{ border: "1px solid #2A2824" }}
          >
            <button
              type="button"
              onClick={() => setAdvanced(false)}
              className="px-2.5 py-1.5 transition-colors"
              style={{
                backgroundColor: !advanced ? "#D4A843" : "transparent",
                color:           !advanced ? "#0A0A0A" : "#888",
              }}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setAdvanced(true)}
              className="px-2.5 py-1.5 transition-colors"
              style={{
                backgroundColor: advanced ? "#D4A843" : "transparent",
                color:           advanced ? "#0A0A0A" : "#888",
              }}
            >
              Advanced
            </button>
          </div>
          <button
            type="button"
            onClick={onRerender}
            disabled={!state.isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              backgroundColor: state.isDirty ? "#D4A843" : "transparent",
              color:           state.isDirty ? "#0A0A0A" : "#666",
              border:          `1px solid ${state.isDirty ? "#D4A843" : "#2A2824"}`,
              cursor:          state.isDirty ? "pointer" : "default",
            }}
          >
            <RotateCw size={11} />
            Re-render
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ backgroundColor: "transparent", color: "#888", border: "1px solid #2A2824" }}
          >
            <Download size={11} />
            Export
          </button>
        </div>
      </div>

      {/* ─── Loading state ──────────────────────────────────────────────── */}
      {!audio.ready && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "#666" }}>Loading stems…</p>
        </div>
      )}

      {/* ─── Main mixer area ─────────────────────────────────────────────── */}
      {audio.ready && (
        <div className="flex-1 flex overflow-hidden">
          {/* Channel strips — horizontal scroll on overflow */}
          <div className="flex-1 flex items-stretch gap-1.5 px-4 py-4 overflow-x-auto">
            {roles.map((role) => {
              const s = state.global[role];
              if (!s) return null;
              const stemColor = colorForRole(role);

              // 2x2 effect knob grid — wired in steps 8–11 to the audio graph.
              const effectsSlot = (
                <div className="grid grid-cols-2 gap-1 justify-items-center">
                  <EffectKnob
                    value={s.reverb}
                    onChange={(v) => setStemReverb(role, v)}
                    color={stemColor}
                    label={`${labelForRole(role)} reverb`}
                    shortLabel="REV"
                  />
                  <EffectKnob
                    value={s.delay}
                    onChange={(v) => setStemDelay(role, v)}
                    color={stemColor}
                    label={`${labelForRole(role)} delay`}
                    shortLabel="DLY"
                  />
                  <EffectKnob
                    value={s.comp}
                    onChange={(v) => setStemComp(role, v)}
                    color={stemColor}
                    label={`${labelForRole(role)} compression`}
                    shortLabel="CMP"
                  />
                  <EffectKnob
                    value={s.brightness}
                    onChange={(v) => setStemBrightness(role, v)}
                    color={stemColor}
                    label={`${labelForRole(role)} brightness`}
                    shortLabel="BRT"
                  />
                </div>
              );

              return (
                <ChannelStrip
                  key={role}
                  role={role}
                  gainDb={s.gainDb}
                  onGainDbChange={(db) => setStemGainDb(role, db)}
                  analyser={audio.stems[role]?.analyser ?? null}
                  pan={s.pan}
                  onPanChange={(p) => setStemPan(role, p)}
                  panAiOriginal={aiOriginals?.[role]?.pan ?? 0}
                  muted={s.muted}
                  soloed={s.soloed}
                  onMuteToggle={() => toggleMute(role)}
                  onSoloToggle={() => toggleSolo(role)}
                  modified={isStemModified(role)}
                  advanced={advanced}
                  effectsSlot={effectsSlot}
                />
              );
            })}
          </div>

          {/* Master strip placeholder — step 12 fills in */}
          <div
            className="flex-shrink-0 flex flex-col items-center py-4 px-3 ml-2 mr-3 my-4 gap-2"
            style={{
              width:           120,
              backgroundColor: "#1a1816",
              border:          "0.5px solid #2A2824",
              borderRadius:    4,
            }}
          >
            <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: "#888" }}>
              Master
            </span>
            <p className="text-[10px] text-center mt-2" style={{ color: "#444" }}>
              Master strip<br />(step 12)
            </p>
          </div>
        </div>
      )}

      {/* ─── Section timeline placeholder — step 15 fills in ──────────────── */}
      {audio.ready && (
        <div
          className="flex items-center px-6 py-2 border-t gap-1"
          style={{ backgroundColor: "#141210", borderColor: "#1f1d1a", minHeight: 36 }}
        >
          <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: "#444" }}>
            Sections — step 15
          </span>
        </div>
      )}

      {/* ─── Error toasts ───────────────────────────────────────────────── */}
      {Object.keys(audio.errors).length > 0 && (
        <div className="absolute top-20 right-4 px-4 py-2 rounded-lg text-xs"
             style={{ backgroundColor: "#2A1818", border: "1px solid #E8554A", color: "#E8554A" }}>
          Failed to load: {Object.keys(audio.errors).map(labelForRole).join(", ")}
        </div>
      )}
    </div>
  );
}

/* unused import guard so future steps don't lint-warn */
void colorForRole;
