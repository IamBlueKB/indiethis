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
import { Pause, Play, Download, RotateCw, Undo2, Redo2 } from "lucide-react";
import { ChannelStrip }   from "./ChannelStrip";
import { EffectKnob }     from "./EffectKnob";
import { MasterStrip }    from "./MasterStrip";
import { MasterEqRow }    from "./MasterEqRow";
import { MiniSpectrum }   from "./MiniSpectrum";
import { SectionTimeline } from "./SectionTimeline";
import { useStudioAudio } from "./useStudioAudio";
import { useStudioHistory } from "./useStudioHistory";
import { SnapshotsMenu }   from "./SnapshotsMenu";
import { useStudioAutosave } from "./useStudioAutosave";
import { colorForRole, labelForRole } from "./stem-colors";
import type { AiOriginal, MasterState, ReverbType, Snapshot, SongSection, StemRole, StemState, StudioState } from "./types";

export interface StudioClientProps {
  jobId:        string;
  trackTitle:   string;
  /** Map of stem role → fresh signed URL. */
  stems:        Record<StemRole, string>;
  /** Claude's per-stem decisions in the studio's knob domain. Used to seed
   *  initial state AND render the gold AI reference tick on each control. */
  aiOriginals?: Record<StemRole, AiOriginal>;
  /** Per-stem Claude reverb-type choice (drives which IR each convolver loads). */
  reverbTypes?: Record<StemRole, ReverbType>;
  /** Existing studio state if the artist is reopening a session (autosave restore). */
  initialState?: StudioState | null;
  /** True if the artist arrived via guest token (changes export/share UX). */
  isGuest?:     boolean;
  /** Reference track URL — enables the Reference comparison toggle in step 22. */
  referenceTrackUrl?: string | null;
  /** BPM — used for delay-time sync in step 10. */
  bpm?:         number;
  /** Detected song sections from analysisData (intro/verse/chorus/etc.). */
  sections?:    SongSection[];
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

function relSavedAt(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diff < 5)     return "just now";
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function StudioClient(props: StudioClientProps) {
  const { jobId: _jobId, trackTitle, stems, aiOriginals, reverbTypes, initialState, referenceTrackUrl: _ref, bpm, sections = [] } = props;

  // Stable role order — first stem wins as transport master clock.
  const roles = useMemo(() => Object.keys(stems), [stems]);

  // ─── Build initial state ───────────────────────────────────────────────
  // Every control opens at Claude's chosen value — the studio sounds
  // identical to the AI mix until the artist moves something. The AI Original
  // snapshot captures these positions (step 17).
  const initialStudioState = useMemo<StudioState>(() => {
    if (initialState) return initialState;
    const global: Record<StemRole, StemState> = {};
    for (const role of roles) {
      const ai = aiOriginals?.[role];
      global[role] = {
        gainDb:     0,                             // delta — AI's gain is the 0 dB reference on the fader
        pan:        ai?.pan        ?? 0,
        reverb:     ai?.reverb     ?? 0,           // 0..100 = 0..100% wet
        delay:      ai?.delay      ?? 0,
        comp:       ai?.comp       ?? 0,
        brightness: ai?.brightness ?? 50,          // 50 = flat shelf
        dryWet:     100,
        muted:      false,
        soloed:     false,
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

  const history = useStudioHistory(initialStudioState);
  const { state, setState, undo, redo, canUndo, canRedo } = history;

  // ─── Snapshots ──────────────────────────────────────────────────────────
  // "AI Original" is auto-seeded from the initial state and protected from
  // deletion. Artists can save additional named snapshots; recall replaces
  // the current state via setState (so it lands on the undo stack and can
  // be backed out).
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => {
    // Restore snapshots persisted alongside studioState (they ride along on
    // the JSON column even though StudioState type doesn't formally include
    // them). If the user saved any earlier, we get them back here.
    const persisted = (initialState as unknown as { snapshots?: Snapshot[] } | null)?.snapshots;
    if (Array.isArray(persisted) && persisted.length > 0) {
      // Make sure AI Original always exists + is protected, even if the
      // persisted blob is missing it (data drift safety net).
      const hasAi = persisted.some((s) => s.protected && s.name === "AI Original");
      if (hasAi) return persisted;
    }
    return [{
      name:       "AI Original",
      protected:  true,
      created_at: new Date().toISOString(),
      state:      {
        global:   initialStudioState.global,
        sections: initialStudioState.sections,
        master:   initialStudioState.master,
      },
    }];
  });

  function saveSnapshot(name: string) {
    setSnapshots((prev) => {
      // De-dupe: replace existing snapshot of the same name (unless protected).
      const filtered = prev.filter((s) => s.name !== name || s.protected);
      // If a protected snapshot has this name, append a numeric suffix.
      const finalName = filtered.some((s) => s.name === name) ? `${name} (2)` : name;
      const next: Snapshot = {
        name:       finalName,
        protected:  false,
        created_at: new Date().toISOString(),
        state: {
          global:   state.global,
          sections: state.sections,
          master:   state.master,
        },
      };
      return [...filtered, next];
    });
  }

  function deleteSnapshot(name: string) {
    setSnapshots((prev) => prev.filter((s) => s.name !== name || s.protected));
  }

  function recallSnapshot(snap: Snapshot) {
    setState((prev) => ({
      ...prev,
      global:   snap.state.global,
      sections: snap.state.sections,
      master:   snap.state.master,
      isDirty:  true,
    }));
    // Push the restored values into the audio graph on the next microtask
    // (after React has applied the new state).
    queueMicrotask(() => {
      if (!audio.ready) return;
      for (const role of roles) {
        const e = (() => {
          const g = snap.state.global[role];
          if (!selectedSection) return g;
          const override = snap.state.sections[selectedSection]?.[role];
          return override ? { ...g, ...override } : g;
        })();
        if (!e) continue;
        audio.stems[role]?.setGainDb(e.gainDb);
        audio.stems[role]?.setPan(e.pan);
        audio.stems[role]?.setBrightness(e.brightness);
        audio.stems[role]?.setReverb(e.reverb);
        audio.stems[role]?.setDelay(e.delay);
        audio.stems[role]?.setComp(e.comp);
        audio.setMuted(role,  e.muted);
        audio.setSoloed(role, e.soloed);
      }
      audio.master?.setGainDb(snap.state.master.volumeDb);
      for (let i = 0; i < 5; i++) {
        audio.master?.setEqBand(i as 0 | 1 | 2 | 3 | 4, snap.state.master.eq[i]);
      }
    });
  }

  // ─── Section-edit context ───────────────────────────────────────────────
  // null = editing the global mix. Otherwise editing the override for the
  // named section. Knob changes merge into state.sections[name][role].
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  // Effective stem state for rendering knobs + driving the audio graph.
  // Section override wins when present; otherwise we fall back to global.
  function effectiveStem(role: StemRole): StemState {
    const g = state.global[role];
    if (!selectedSection) return g;
    const override = state.sections[selectedSection]?.[role];
    return override ? { ...g, ...override } : g;
  }

  // ─── Audio graph ────────────────────────────────────────────────────────
  const audio = useStudioAudio({ stems, reverbTypes, bpm });

  // ─── Autosave ────────────────────────────────────────────────────────────
  // Guests don't autosave (no MixJob persistence rights). Subscribers get
  // debounced saves on every dirty state change + a flush on tab close.
  const autosave = useStudioAutosave({
    jobId:     _jobId,
    state,
    snapshots,
    disabled:  !!props.isGuest,
  });

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
      audio.stems[role]?.setBrightness(s.brightness);
      audio.stems[role]?.setReverb(s.reverb);
      audio.stems[role]?.setDelay(s.delay);
      audio.stems[role]?.setComp(s.comp);
      if (s.muted)  audio.setMuted(role, true);
      if (s.soloed) audio.setSoloed(role, true);
    }
    audio.master.setGainDb(state.master.volumeDb);
    for (let i = 0; i < 5; i++) {
      audio.master.setEqBand(i as 0 | 1 | 2 | 3 | 4, state.master.eq[i]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.ready]);

  // ─── State setters that drive both React state + audio graph ─────────────
  // When a section is selected, knob changes write to the section override
  // map instead of the global mix. predict.py applies the override for that
  // section's time range at render time (step 26).
  function updateStem(role: StemRole, patch: Partial<StemState>) {
    setState((prev) => {
      if (selectedSection) {
        const prevSection = prev.sections[selectedSection] ?? {};
        const prevOverride = prevSection[role] ?? {};
        return {
          ...prev,
          sections: {
            ...prev.sections,
            [selectedSection]: {
              ...prevSection,
              [role]: { ...prevOverride, ...patch },
            },
          },
          isDirty: true,
        };
      }
      return {
        ...prev,
        global:  { ...prev.global, [role]: { ...prev.global[role], ...patch } },
        isDirty: true,
      };
    });
  }

  function setStemGainDb(role: StemRole, db: number) {
    updateStem(role, { gainDb: db });
    audio.stems[role]?.setGainDb(db);
  }
  function setStemPan(role: StemRole, pan: number) {
    updateStem(role, { pan });
    audio.stems[role]?.setPan(pan);
  }
  function setStemReverb(role: StemRole, v: number) {
    updateStem(role, { reverb: v });
    audio.stems[role]?.setReverb(v);
  }
  function setStemDelay(role: StemRole, v: number) {
    updateStem(role, { delay: v });
    audio.stems[role]?.setDelay(v);
  }
  function setStemComp(role: StemRole, v: number) {
    updateStem(role, { comp: v });
    audio.stems[role]?.setComp(v);
  }
  function setStemBrightness(role: StemRole, v: number) {
    updateStem(role, { brightness: v });
    audio.stems[role]?.setBrightness(v);
  }
  function updateMaster(patch: Partial<MasterState>) {
    setState((prev) => ({
      ...prev,
      master:  { ...prev.master, ...patch },
      isDirty: true,
    }));
    // Volume + master EQ are audible in the browser (live biquad chain).
    // AI intensity + stereo width bake in at re-render time (step 26).
    if (typeof patch.volumeDb === "number") {
      audio.master?.setGainDb(patch.volumeDb);
    }
    if (patch.eq) {
      for (let i = 0; i < 5; i++) {
        audio.master?.setEqBand(i as 0 | 1 | 2 | 3 | 4, patch.eq[i]);
      }
    }
  }

  function setMasterEqBand(index: 0 | 1 | 2 | 3 | 4, gainDb: number) {
    const next: MasterState["eq"] = [...state.master.eq] as MasterState["eq"];
    next[index] = gainDb;
    updateMaster({ eq: next });
  }

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

  // ─── Undo/redo plumbing ─────────────────────────────────────────────────
  // After undo/redo replaces `state` wholesale, we need to push every value
  // back through the audio graph so what's playing matches the restored
  // state. We bump a ref-counted version on every undo/redo so the effect
  // below knows to re-sync.
  const restoreVersion = useRef(0);
  function doUndo() { undo(); restoreVersion.current++; reSyncAll(); }
  function doRedo() { redo(); restoreVersion.current++; reSyncAll(); }

  function reSyncAll() {
    // Defer to next microtask so React has applied the new state first.
    queueMicrotask(() => {
      if (!audio.ready) return;
      for (const role of roles) {
        const e = (() => {
          const g = state.global[role];
          if (!selectedSection) return g;
          const override = state.sections[selectedSection]?.[role];
          return override ? { ...g, ...override } : g;
        })();
        if (!e) continue;
        audio.stems[role]?.setGainDb(e.gainDb);
        audio.stems[role]?.setPan(e.pan);
        audio.stems[role]?.setBrightness(e.brightness);
        audio.stems[role]?.setReverb(e.reverb);
        audio.stems[role]?.setDelay(e.delay);
        audio.stems[role]?.setComp(e.comp);
        audio.setMuted(role,  e.muted);
        audio.setSoloed(role, e.soloed);
      }
      audio.master?.setGainDb(state.master.volumeDb);
      for (let i = 0; i < 5; i++) {
        audio.master?.setEqBand(i as 0 | 1 | 2 | 3 | 4, state.master.eq[i]);
      }
    });
  }

  // Keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo.
  // Skip when user is typing in an input/textarea so we don't hijack form
  // editing (no inputs in the studio today, but defensive for later).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag    = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        doRedo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.ready, selectedSection, roles.join("|")]);

  // ─── Section selection ──────────────────────────────────────────────────
  // Selecting a section auto-seeks to its start so the artist hears what
  // they're editing, and snaps the audio graph to that section's effective
  // values. predict.py applies sections at render time; the browser only
  // ever previews one set of values at once.
  function selectSection(name: string | null) {
    setSelectedSection(name);
  }

  // Whenever the editing context changes, push that context's effective
  // values into the audio graph so what plays = what you're editing.
  useEffect(() => {
    if (!audio.ready) return;
    for (const role of roles) {
      const e = (() => {
        const g = state.global[role];
        if (!selectedSection) return g;
        const override = state.sections[selectedSection]?.[role];
        return override ? { ...g, ...override } : g;
      })();
      if (!e) continue;
      audio.stems[role]?.setGainDb(e.gainDb);
      audio.stems[role]?.setPan(e.pan);
      audio.stems[role]?.setBrightness(e.brightness);
      audio.stems[role]?.setReverb(e.reverb);
      audio.stems[role]?.setDelay(e.delay);
      audio.stems[role]?.setComp(e.comp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSection]);

  // ─── Modified detection (lights AI badge dim) ────────────────────────────
  // Compare against Claude's actual values per stem (NOT the DEFAULT_STEM_STATE
  // fallback) so the AI badge only dims when the artist genuinely changed
  // something away from Claude's mix.
  function isStemModified(role: StemRole): boolean {
    const s = state.global[role];
    if (!s) return false;
    const ai = aiOriginals?.[role];
    const ref: StemState = {
      gainDb:     0,
      pan:        ai?.pan        ?? 0,
      reverb:     ai?.reverb     ?? 0,
      delay:      ai?.delay      ?? 0,
      comp:       ai?.comp       ?? 0,
      brightness: ai?.brightness ?? 50,
      dryWet:     100,
      muted:      false,
      soloed:     false,
    };
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
          {/* Undo / Redo */}
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: "1px solid #2A2824" }}
          >
            <button
              type="button"
              onClick={doUndo}
              disabled={!canUndo}
              aria-label="Undo (Ctrl+Z)"
              title="Undo (Ctrl+Z)"
              className="px-2 py-1.5 transition-colors flex items-center"
              style={{
                color:  canUndo ? "#D4A843" : "#444",
                cursor: canUndo ? "pointer" : "default",
              }}
            >
              <Undo2 size={13} />
            </button>
            <div style={{ width: 1, height: 18, backgroundColor: "#2A2824" }} />
            <button
              type="button"
              onClick={doRedo}
              disabled={!canRedo}
              aria-label="Redo (Ctrl+Shift+Z)"
              title="Redo (Ctrl+Shift+Z)"
              className="px-2 py-1.5 transition-colors flex items-center"
              style={{
                color:  canRedo ? "#D4A843" : "#444",
                cursor: canRedo ? "pointer" : "default",
              }}
            >
              <Redo2 size={13} />
            </button>
          </div>

          {/* Autosave status pill — hidden for guests. */}
          {!props.isGuest && (
            <span
              className="text-[10px] uppercase font-semibold tracking-wider px-2 py-1 rounded"
              style={{
                color:           autosave.status === "error"  ? "#E8554A"
                                : autosave.status === "saving" ? "#D4A843"
                                                               : "#666",
                backgroundColor: "transparent",
                border:          `1px solid ${autosave.status === "error" ? "#5a2421" : "#2A2824"}`,
                minWidth:         88,
                textAlign:        "center",
              }}
              title={autosave.status === "error" ? "Save failed — click to retry" : "Autosaved to your account"}
              onClick={() => { if (autosave.status === "error") void autosave.saveNow(); }}
            >
              {autosave.status === "saving" ? "Saving…"
                : autosave.status === "error"  ? "Save failed"
                : autosave.lastSavedAt        ? `Saved ${relSavedAt(autosave.lastSavedAt)}`
                                              : "Saved"}
            </span>
          )}

          {/* Snapshots */}
          <SnapshotsMenu
            snapshots={snapshots}
            onSave={saveSnapshot}
            onDelete={deleteSnapshot}
            onRecall={recallSnapshot}
          />

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
              const s = effectiveStem(role);
              if (!s) return null;
              const stemColor = colorForRole(role);
              const ai        = aiOriginals?.[role];
              const isDry     = (reverbTypes?.[role] ?? "plate") === "dry";

              // 2x2 effect knob grid. Each knob's `aiOriginal` is Claude's
              // actual chosen value — the gold tick lines up with the AI mix.
              // Dry stems have no convolver wired so the REV knob is disabled.
              const effectsSlot = (
                <div className="grid grid-cols-2 gap-1 justify-items-center">
                  <EffectKnob
                    value={s.reverb}
                    onChange={(v) => setStemReverb(role, v)}
                    aiOriginal={ai?.reverb ?? 0}
                    color={stemColor}
                    label={`${labelForRole(role)} reverb`}
                    shortLabel="REV"
                    disabled={isDry}
                  />
                  <EffectKnob
                    value={s.delay}
                    onChange={(v) => setStemDelay(role, v)}
                    aiOriginal={ai?.delay ?? 0}
                    color={stemColor}
                    label={`${labelForRole(role)} delay`}
                    shortLabel="DLY"
                  />
                  <EffectKnob
                    value={s.comp}
                    onChange={(v) => setStemComp(role, v)}
                    aiOriginal={ai?.comp ?? 0}
                    color={stemColor}
                    label={`${labelForRole(role)} compression`}
                    shortLabel="CMP"
                  />
                  <EffectKnob
                    value={s.brightness}
                    onChange={(v) => setStemBrightness(role, v)}
                    aiOriginal={ai?.brightness ?? 50}
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
                  topSlot={
                    <MiniSpectrum
                      analyser={audio.stems[role]?.analyser ?? null}
                      color={stemColor}
                    />
                  }
                />
              );
            })}
          </div>

          {/* Master strip — wired in step 12 (volume audible; AI intensity +
              stereo width visual until re-render bakes them in step 26). */}
          <MasterStrip
            master={state.master}
            onChange={updateMaster}
            analyser={audio.master?.analyser ?? null}
            topSlot={
              <MiniSpectrum
                analyser={audio.master?.analyser ?? null}
                color="#D4A843"
                bars={32}
              />
            }
            eqSlot={
              <MasterEqRow
                values={state.master.eq}
                onChange={setMasterEqBand}
              />
            }
          />
        </div>
      )}

      {/* ─── Section timeline — step 15 ──────────────────────────────────── */}
      {audio.ready && (
        <SectionTimeline
          sections={sections}
          duration={audio.transport.duration}
          currentTime={audio.transport.currentTime}
          selectedSection={selectedSection}
          onSelect={selectSection}
          onSeek={(t) => audio.transport.seek(t)}
        />
      )}

      {/* "Now editing" indicator above the timeline — only when a section is
          picked, so the artist always knows knob changes won't go to global. */}
      {audio.ready && selectedSection && (
        <div
          className="flex items-center justify-center px-4 py-1 border-t text-[10px] font-bold uppercase tracking-wider"
          style={{
            backgroundColor: "#1A1612",
            borderColor:     "#2A2622",
            color:           "#D4A843",
          }}
        >
          Editing: {selectedSection}
          <button
            type="button"
            onClick={() => selectSection(null)}
            className="ml-3 underline normal-case font-normal text-[10px]"
            style={{ color: "#888" }}
          >
            back to global mix
          </button>
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
