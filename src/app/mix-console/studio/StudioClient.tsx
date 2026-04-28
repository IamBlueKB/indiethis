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
import { Pause, Play, Download, RotateCw, Undo2, Redo2, Sparkles, Link2 } from "lucide-react";
import { ChannelStrip }   from "./ChannelStrip";
import { EffectKnob }     from "./EffectKnob";
import { MasterStrip }    from "./MasterStrip";
import { MasterEqRow }    from "./MasterEqRow";
import { MixNotesPanel }  from "./MixNotesPanel";
import { MiniSpectrum }   from "./MiniSpectrum";
import { StemWaveform }   from "./StemWaveform";
import { TrackWaveform }  from "./TrackWaveform";
import { DryWetSlider }   from "./DryWetSlider";
import { audioBufferToWavBlob } from "./wav";
import { SectionTimeline } from "./SectionTimeline";
import { useStudioAudio } from "./useStudioAudio";
import { useStudioHistory } from "./useStudioHistory";
import { SnapshotsMenu }   from "./SnapshotsMenu";
import { LinkStemsMenu }   from "./LinkStemsMenu";
import { useStudioAutosave } from "./useStudioAutosave";
import { colorForRole, labelForRole } from "./stem-colors";
import { RenderDiffCard } from "./RenderDiffCard";
import { coerceAnalysis } from "./summarizeDiff";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { ShortcutHelpOverlay } from "./ShortcutHelpOverlay";
import { A11yLiveRegion } from "./A11yLiveRegion";
import { announce } from "./useA11yAnnounce";
import type { AiOriginal, MasterState, ReverbType, Snapshot, SongSection, StemRole, StemState, StudioState } from "./types";

export interface StudioClientProps {
  jobId:        string;
  trackTitle:   string;
  /** Map of stem role → fresh signed URL. */
  stems:        Record<StemRole, string>;
  /**
   * Optional map of stem role → URL for the raw / unprocessed upload. When
   * different from `stems`, the dry/wet slider lazy-loads this as the dry
   * source. Today (pre-Step 26) `stems` IS the raw upload, so this is
   * usually the same map and the dry leg falls back to effects-bypass.
   */
  originalStems?: Record<StemRole, string>;
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
  /** Number of studio re-renders already used on this job. */
  studioRenderCount?:        number;
  /** Paid extra-render credits ($1.99 each) the artist has purchased. */
  studioRenderExtraCredits?: number;
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

/* ─── Lane ordering + height hierarchy (Pro Studio Mixer Visual Restructure) ─
   Main Vocal first (tallest). Doubles → Harmonies → Ad-libs → Ins & Outs.
   Beat (or beat sub-stems if Demucs split it) last; second-tallest.
   Anything unrecognized falls in between in original order. */
function laneOrderRank(role: string): number {
  const r = role.toLowerCase();
  if (r === "vocal_main"   || r === "main_vocal" || r === "lead")     return 0;
  if (r === "vocal_doubles" || r === "doubles"   || r === "double")   return 1;
  if (r === "vocal_harmonies" || r === "harmonies" || r === "harmony" || r === "backing") return 2;
  if (r === "vocal_adlibs"  || r === "adlibs"    || r === "adlib")    return 3;
  if (r === "vocal_insouts" || r === "insouts")                       return 4;
  if (r === "melodics")                                                return 5;
  if (r === "drums_other"   || r === "drums" || r === "other")        return 6;
  if (r === "bass")                                                    return 7;
  if (r === "kick")                                                    return 8;
  if (r === "beat")                                                    return 9;
  return 5; // unknown roles sit mid-pack
}

function laneHeightFor(role: string): number {
  const r = role.toLowerCase();
  // Main vocal — tallest. The eye hits it first.
  if (r === "vocal_main" || r === "main_vocal" || r === "lead") return 92;
  // Beat (or beat sub-stems) — second tallest.
  if (r === "beat" || r === "kick" || r === "bass" || r === "drums_other" || r === "drums" || r === "melodics" || r === "other") return 80;
  // Supporting stems.
  return 68;
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
  const { jobId: _jobId, trackTitle, stems, originalStems, aiOriginals, reverbTypes: reverbTypesProp, initialState, referenceTrackUrl, bpm, sections = [] } = props;

  // Reverb types are local state so the artist can opt-in stems Claude marked
  // "dry" (e.g. beats / instruments). Clicking "Add reverb" on a dry lane
  // swaps the type to "plate" and re-arms the reverb send in useStudioAudio.
  const [reverbTypes, setReverbTypes] = useState<typeof reverbTypesProp>(reverbTypesProp);
  function enableReverb(role: StemRole) {
    setReverbTypes((prev) => ({ ...(prev ?? {} as Record<StemRole, ReverbType>), [role]: "plate" }));
  }

  // Stable role order — first stem wins as transport master clock.
  // Visual ordering for the lane stack is computed separately via laneOrderRank
  // so audio/transport semantics aren't affected.
  const roles      = useMemo(() => Object.keys(stems), [stems]);
  const lanesOrder = useMemo(
    () => [...roles].sort((a, b) => laneOrderRank(a) - laneOrderRank(b)),
    [roles],
  );

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
      linkedGroups: {},
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
        audio.stems[role]?.setDryWet(e.dryWet);
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
  const audio = useStudioAudio({ stems, originalStems, reverbTypes, bpm });

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
      // Only push dry/wet when the artist has it parked off the default 100;
      // calling setDryWet at default is a no-op but harmless. Restoring a
      // saved session where they had it < 100 will lazy-fetch the raw upload.
      if (s.dryWet !== 100) audio.stems[role]?.setDryWet(s.dryWet);
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

  // ─── Linked-group helpers (step 23) ─────────────────────────────────────
  // A role belongs to at most one group. groupForRole returns the group's
  // member array or null. linkedPartners excludes the role itself.
  function groupForRole(role: StemRole): StemRole[] | null {
    const groups = state.linkedGroups ?? {};
    for (const name of Object.keys(groups)) {
      if (groups[name].includes(role)) return groups[name];
    }
    return null;
  }
  function linkedPartners(role: StemRole): StemRole[] {
    const g = groupForRole(role);
    if (!g) return [];
    return g.filter((r) => r !== role);
  }

  function createLinkGroup(name: string, members: StemRole[]) {
    setState((prev) => {
      const groups = { ...(prev.linkedGroups ?? {}) };
      // Strip these members from any group they're already in (defensive —
      // the menu disables already-linked rows, but make sure).
      for (const k of Object.keys(groups)) {
        groups[k] = groups[k].filter((r) => !members.includes(r));
        if (groups[k].length < 2) delete groups[k];
      }
      groups[name] = [...members];
      return { ...prev, linkedGroups: groups, isDirty: true };
    });
  }
  function deleteLinkGroup(name: string) {
    setState((prev) => {
      const groups = { ...(prev.linkedGroups ?? {}) };
      delete groups[name];
      return { ...prev, linkedGroups: groups, isDirty: true };
    });
  }

  function setStemGainDb(role: StemRole, db: number) {
    // Compute the dB delta first so we can apply the same delta to every
    // linked partner — preserving the relative balance the artist set.
    const cur   = effectiveStem(role)?.gainDb ?? 0;
    const delta = db - cur;
    updateStem(role, { gainDb: db });
    audio.stems[role]?.setGainDb(db);

    if (delta !== 0) {
      for (const partner of linkedPartners(role)) {
        const pCur  = effectiveStem(partner)?.gainDb ?? 0;
        const pNext = Math.max(-12, Math.min(6, pCur + delta));
        updateStem(partner, { gainDb: pNext });
        audio.stems[partner]?.setGainDb(pNext);
      }
    }
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
  function setStemDryWet(role: StemRole, v: number) {
    updateStem(role, { dryWet: v });
    audio.stems[role]?.setDryWet(v);
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
        audio.stems[role]?.setDryWet(e.dryWet);
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
      audio.stems[role]?.setDryWet(e.dryWet);
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

  // ─── AI Assist (per-stem Haiku nudge) ───────────────────────────────────
  // Sparkle button on each ChannelStrip POSTs the stem's current settings +
  // AI Original to /studio/ai-assist. Claude returns a small patch (1-3
  // fields). We apply it through the normal updateStem path so it lands on
  // the undo stack — backable out with Ctrl+Z if the artist hates it.
  // Per-role busy + last-note state powers the sparkle UI.
  const [aiAssistBusy, setAiAssistBusy] = useState<Record<StemRole, boolean>>({});
  const [aiAssistNote, setAiAssistNote] = useState<{ role: StemRole; note: string } | null>(null);
  const aiAssistNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function runAiAssist(role: StemRole) {
    if (aiAssistBusy[role]) return;
    if (props.isGuest)      return;  // guests don't have a job to call against
    setAiAssistBusy((m) => ({ ...m, [role]: true }));
    try {
      const cur = effectiveStem(role);
      const res = await fetch(`/api/mix-console/job/${_jobId}/studio/ai-assist`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          role,
          currentStem: cur,
          aiOriginal:  aiOriginals?.[role] ?? null,
          sectionName: selectedSection,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { patch?: Partial<StemState>; note?: string };
      const patch = data.patch ?? {};
      // Apply patch through updateStem — lands on undo stack and triggers autosave.
      if (Object.keys(patch).length > 0) {
        updateStem(role, patch);
        // Push directly into the audio graph for the fields we know about.
        const a = audio.stems[role];
        if (a) {
          if (typeof patch.gainDb     === "number") a.setGainDb(patch.gainDb);
          if (typeof patch.pan        === "number") a.setPan(patch.pan);
          if (typeof patch.reverb     === "number") a.setReverb(patch.reverb);
          if (typeof patch.delay      === "number") a.setDelay(patch.delay);
          if (typeof patch.comp       === "number") a.setComp(patch.comp);
          if (typeof patch.brightness === "number") a.setBrightness(patch.brightness);
          if (typeof patch.dryWet     === "number") a.setDryWet(patch.dryWet);
        }
      }
      if (data.note) {
        setAiAssistNote({ role, note: data.note });
        if (aiAssistNoteTimerRef.current) clearTimeout(aiAssistNoteTimerRef.current);
        aiAssistNoteTimerRef.current = setTimeout(() => setAiAssistNote(null), 4500);
      }
    } catch (err) {
      console.error("[ai-assist]", err);
      setAiAssistNote({ role, note: "AI Assist hit a snag — try again." });
      if (aiAssistNoteTimerRef.current) clearTimeout(aiAssistNoteTimerRef.current);
      aiAssistNoteTimerRef.current = setTimeout(() => setAiAssistNote(null), 3500);
    } finally {
      setAiAssistBusy((m) => ({ ...m, [role]: false }));
    }
  }

  useEffect(() => {
    return () => {
      if (aiAssistNoteTimerRef.current) clearTimeout(aiAssistNoteTimerRef.current);
    };
  }, []);

  // ─── AI Polish (Opus full-mix pass) ─────────────────────────────────────
  // One round-trip to /studio/ai-polish: Claude looks at every stem + master
  // together and returns a coordinated patch (e.g. duck the bass when the
  // kick is forward, lift the vocal if the master is dense). Applied through
  // setState atomically so a single Ctrl+Z reverts the whole polish — and
  // through the audio graph so the change is audible immediately.
  const [aiPolishBusy, setAiPolishBusy] = useState(false);
  const [aiPolishNote, setAiPolishNote] = useState<string | null>(null);
  const aiPolishNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function runAiPolish() {
    if (aiPolishBusy)  return;
    if (props.isGuest) return;
    setAiPolishBusy(true);
    try {
      const res = await fetch(`/api/mix-console/job/${_jobId}/studio/ai-polish`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          global:       state.global,
          master:       state.master,
          aiOriginals:  aiOriginals ?? null,
          sectionName:  selectedSection,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        stemPatches?: Record<StemRole, Partial<StemState>>;
        masterPatch?: Partial<MasterState>;
        note?:        string;
      };
      const stemPatches = data.stemPatches ?? {};
      const masterPatch = data.masterPatch ?? {};

      // Atomic state update — single undo entry covers the whole polish.
      setState((prev) => {
        const nextGlobal: typeof prev.global   = { ...prev.global };
        const nextSects:  typeof prev.sections = { ...prev.sections };
        if (selectedSection) {
          // Section-scoped polish: write into sections override map.
          const prevSection: { [stemRole: string]: Partial<StemState> | undefined } = { ...(prev.sections[selectedSection] ?? {}) };
          for (const role of Object.keys(stemPatches)) {
            const patch = stemPatches[role];
            if (!patch) continue;
            prevSection[role] = { ...(prevSection[role] ?? {}), ...patch };
          }
          nextSects[selectedSection] = prevSection;
        } else {
          // Global polish.
          for (const role of Object.keys(stemPatches)) {
            const patch = stemPatches[role];
            if (!patch || !prev.global[role]) continue;
            nextGlobal[role] = { ...prev.global[role], ...patch };
          }
        }
        return {
          ...prev,
          global:   nextGlobal,
          sections: nextSects,
          master:   { ...prev.master, ...masterPatch },
          isDirty:  true,
        };
      });

      // Mirror into the audio graph for instant audible feedback.
      queueMicrotask(() => {
        for (const role of Object.keys(stemPatches)) {
          const patch = stemPatches[role];
          const a     = audio.stems[role];
          if (!patch || !a) continue;
          if (typeof patch.gainDb     === "number") a.setGainDb(patch.gainDb);
          if (typeof patch.pan        === "number") a.setPan(patch.pan);
          if (typeof patch.reverb     === "number") a.setReverb(patch.reverb);
          if (typeof patch.delay      === "number") a.setDelay(patch.delay);
          if (typeof patch.comp       === "number") a.setComp(patch.comp);
          if (typeof patch.brightness === "number") a.setBrightness(patch.brightness);
        }
        if (typeof masterPatch.volumeDb === "number") audio.master?.setGainDb(masterPatch.volumeDb);
        if (Array.isArray(masterPatch.eq) && masterPatch.eq.length === 5) {
          for (let i = 0; i < 5; i++) {
            audio.master?.setEqBand(i as 0|1|2|3|4, masterPatch.eq[i]);
          }
        }
      });

      const noteText = data.note?.trim()
        || `Polished ${Object.keys(stemPatches).length} stem${Object.keys(stemPatches).length === 1 ? "" : "s"} + master.`;
      setAiPolishNote(noteText);
      if (aiPolishNoteTimerRef.current) clearTimeout(aiPolishNoteTimerRef.current);
      aiPolishNoteTimerRef.current = setTimeout(() => setAiPolishNote(null), 6000);
    } catch (err) {
      console.error("[ai-polish]", err);
      setAiPolishNote("AI Polish hit a snag — try again.");
      if (aiPolishNoteTimerRef.current) clearTimeout(aiPolishNoteTimerRef.current);
      aiPolishNoteTimerRef.current = setTimeout(() => setAiPolishNote(null), 4000);
    } finally {
      setAiPolishBusy(false);
    }
  }

  useEffect(() => {
    return () => {
      if (aiPolishNoteTimerRef.current) clearTimeout(aiPolishNoteTimerRef.current);
    };
  }, []);

  // ─── Stem export (step 24) ──────────────────────────────────────────────
  // Renders the stem's effect chain offline using the live state values,
  // encodes the resulting AudioBuffer as a 16-bit PCM WAV, and triggers a
  // browser download. The output reflects whatever the artist is hearing
  // RIGHT NOW — same chain, same knob positions, including section
  // overrides if a section is selected.
  const [exportBusy, setExportBusy] = useState<Record<StemRole, boolean>>({});

  function safeFilename(s: string): string {
    return s.replace(/[^a-z0-9_.-]+/gi, "_").slice(0, 60) || "stem";
  }

  async function exportStem(role: StemRole) {
    if (exportBusy[role]) return;
    const handle = audio.stems[role];
    if (!handle?.renderToBuffer) return;
    setExportBusy((m) => ({ ...m, [role]: true }));
    try {
      const cur = effectiveStem(role);
      const buf = await handle.renderToBuffer({
        gainDb:     cur.gainDb,
        pan:        cur.pan,
        reverb:     cur.reverb,
        delay:      cur.delay,
        comp:       cur.comp,
        brightness: cur.brightness,
        dryWet:     cur.dryWet,
      });
      if (!buf) throw new Error("render failed");
      const blob = audioBufferToWavBlob(buf);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      const stamp = selectedSection ? `_${safeFilename(selectedSection)}` : "";
      a.download = `${safeFilename(trackTitle)}_${safeFilename(role)}${stamp}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Free the URL after the click is dispatched.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("[stem-export]", err);
    } finally {
      setExportBusy((m) => ({ ...m, [role]: false }));
    }
  }

  // ─── Reference A/B toggle ───────────────────────────────────────────────
  // The artist uploaded a reference track during the wizard. The studio
  // exposes a one-click A/B toggle that swaps between THE MIX and THE
  // REFERENCE so they can hear what they're chasing in context.
  //
  // Implementation: a hidden HTMLAudioElement plays the reference URL
  // independently of the Web Audio graph. When toggled to reference:
  //   1. Capture the studio playhead.
  //   2. Pause the studio transport (stops all stem sources).
  //   3. Seek the audio element to the same position (best effort — if
  //      the ref is shorter we cap at its duration).
  //   4. audio.play().
  // When toggled back:
  //   1. Pause the audio element + capture its currentTime.
  //   2. Seek the studio transport back to that position.
  //   3. Resume studio if it was playing before the swap.
  const [referenceMode, setReferenceMode] = useState(false);
  // Track whether the studio was playing at the moment we entered reference
  // mode, so toggling back resumes playback if appropriate.
  const refWasPlayingRef = useRef(false);
  const refAudioElRef    = useRef<HTMLAudioElement | null>(null);

  async function toggleReferenceMode() {
    if (!referenceTrackUrl) return;
    const audioEl = refAudioElRef.current;
    if (!audioEl)      return;

    if (!referenceMode) {
      // ENTERING reference mode.
      const wasPlaying = audio.transport.isPlaying;
      const at         = audio.transport.currentTime;
      refWasPlayingRef.current = wasPlaying;
      if (wasPlaying) audio.transport.pause();
      try {
        const dur = Number.isFinite(audioEl.duration) ? audioEl.duration : Infinity;
        audioEl.currentTime = Math.min(at, Math.max(0, dur - 0.05));
      } catch { /* metadata may not be ready — best effort */ }
      setReferenceMode(true);
      try { await audioEl.play(); } catch { /* user-gesture or CORS — leave paused */ }
    } else {
      // LEAVING reference mode — return to the studio mix.
      const at = audioEl.currentTime;
      try { audioEl.pause(); } catch { /* noop */ }
      audio.transport.seek(Math.max(0, at));
      setReferenceMode(false);
      if (refWasPlayingRef.current) {
        try { await audio.transport.play(); } catch { /* noop */ }
      }
    }
  }

  // Belt-and-suspenders: if the audio element ever ends naturally while in
  // reference mode, fall back to the studio so the UI doesn't get stuck.
  useEffect(() => {
    const el = refAudioElRef.current;
    if (!el) return;
    const onEnded = () => {
      if (referenceMode) setReferenceMode(false);
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [referenceMode]);

  // If the studio transport is paused externally (user hits space), make sure
  // the reference audio element is paused too — and vice-versa for the inverse.
  useEffect(() => {
    if (!referenceMode) return;
    const el = refAudioElRef.current;
    if (!el) return;
    if (audio.transport.isPlaying) {
      // User hit play while in ref mode — bounce them back to studio.
      try { el.pause(); } catch { /* noop */ }
      setReferenceMode(false);
    }
  }, [audio.transport.isPlaying, referenceMode]);

  // ─── Transport ──────────────────────────────────────────────────────────
  async function togglePlay() {
    if (audio.transport.isPlaying) audio.transport.pause();
    else                            await audio.transport.play();
  }

  // ─── Re-render trigger (steps 26 + 27) ──────────────────────────────────
  // Posts the current studio state to the render route, flips into
  // "rendering" mode, captures a snapshot of state-at-render-time (so the
  // diff card can compare against it when the render completes), and starts
  // polling the job endpoint until studioStatus flips to STUDIO_COMPLETE.
  const FREE_RENDER_LIMIT = 5;
  const [renderCount,    setRenderCount]    = useState<number>(props.studioRenderCount        ?? 0);
  const [extraCredits,   setExtraCredits]   = useState<number>(props.studioRenderExtraCredits ?? 0);
  const allowedRenders   = FREE_RENDER_LIMIT + extraCredits;
  const renderQuotaUsed  = renderCount >= allowedRenders;
  const rendersRemaining = Math.max(0, allowedRenders - renderCount);
  const [isRendering,        setIsRendering]        = useState(false);
  const [diffOpen,           setDiffOpen]           = useState(false);
  const [helpOpen,           setHelpOpen]           = useState(false);
  // beforeState = AI Original (always available because we auto-seed it).
  // afterState  = whatever the user had at the moment they hit Re-render.
  const [diffBeforeState, setDiffBeforeState] = useState<Pick<StudioState, "global" | "master"> | null>(null);
  const [diffAfterState,  setDiffAfterState]  = useState<Pick<StudioState, "global" | "master"> | null>(null);
  const [diffBeforeUrl,   setDiffBeforeUrl]   = useState<string | null>(null);
  const [diffAfterUrl,    setDiffAfterUrl]    = useState<string | null>(null);
  // analysisData on the job is the BEFORE analysis. We don't currently store
  // an after-analysis (webhook stub) — pass null so the summary falls back
  // to state-only deltas. Future: webhook stores post-render analysis.
  const beforeAnalysis = useMemo(
    () => coerceAnalysis((props as unknown as { analysisData?: unknown }).analysisData ?? null),
    [],
  );
  const renderPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopRenderPolling() {
    if (renderPollRef.current) {
      clearInterval(renderPollRef.current);
      renderPollRef.current = null;
    }
  }

  async function fetchSignedUrl(version: string): Promise<string | null> {
    try {
      const r = await fetch(`/api/mix-console/job/${_jobId}/preview-url?version=${encodeURIComponent(version)}&kind=full`);
      if (!r.ok) return null;
      const j = await r.json() as { url?: string };
      return j.url ?? null;
    } catch { return null; }
  }

  // Redirect to Stripe Checkout for an extra $1.99 re-render credit.
  async function purchaseExtraRender() {
    if (props.isGuest) return;
    try {
      const r = await fetch(`/api/mix-console/job/${_jobId}/studio/extra-render-checkout`, {
        method: "POST",
      });
      if (!r.ok) {
        console.error("[extra-render-checkout] HTTP", r.status);
        return;
      }
      const j = await r.json() as { url?: string };
      if (j.url) window.location.href = j.url;
    } catch (err) {
      console.error("[extra-render-checkout]", err);
    }
  }

  async function onRerender() {
    if (props.isGuest)  return;        // guests can't render against a job
    if (isRendering)    return;
    // Quota gate — out of renders → send to Stripe instead of firing the render.
    if (renderQuotaUsed) {
      void purchaseExtraRender();
      return;
    }
    // Capture the AI Original snapshot as the "before" reference.
    const aiOriginalSnap = snapshots.find((s) => s.protected && s.name === "AI Original");
    const before = aiOriginalSnap
      ? { global: aiOriginalSnap.state.global, master: aiOriginalSnap.state.master }
      : { global: initialStudioState.global,    master: initialStudioState.master };
    const after  = { global: state.global, master: state.master };
    setDiffBeforeState(before);
    setDiffAfterState(after);
    try {
      const res = await fetch(`/api/mix-console/job/${_jobId}/studio/render`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          global:       state.global,
          sections:     state.sections,
          master:       state.master,
          linkedGroups: state.linkedGroups ?? {},
        }),
      });
      if (res.status === 402) {
        // Server says payment required — bounce to Stripe.
        void purchaseExtraRender();
        return;
      }
      if (!res.ok) {
        console.error("[studio-render] HTTP", res.status);
        return;
      }
      setIsRendering(true);
      announce("Studio re-render started");
      // Pre-fetch the BEFORE audio URL while the render runs.
      void fetchSignedUrl("mix").then((u) => setDiffBeforeUrl(u ?? null));
      // Start polling.
      stopRenderPolling();
      renderPollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/mix-console/job/${_jobId}`);
          if (!r.ok) return;
          const j = await r.json() as {
            studioStatus?:             string;
            studioRenderCount?:        number;
            studioRenderExtraCredits?: number;
          };
          if (j.studioStatus === "STUDIO_COMPLETE") {
            stopRenderPolling();
            setIsRendering(false);
            if (typeof j.studioRenderCount        === "number") setRenderCount(j.studioRenderCount);
            if (typeof j.studioRenderExtraCredits === "number") setExtraCredits(j.studioRenderExtraCredits);
            const url = await fetchSignedUrl("studio");
            setDiffAfterUrl(url);
            setDiffOpen(true);
            announce("Studio re-render complete");
          } else if (j.studioStatus === "STUDIO_FAILED") {
            stopRenderPolling();
            setIsRendering(false);
            announce("Studio re-render failed");
          }
        } catch { /* keep polling on transient errors */ }
      }, 3000);
    } catch (err) {
      console.error("[studio-render]", err);
      setIsRendering(false);
    }
  }

  // Stop polling on unmount.
  useEffect(() => () => stopRenderPolling(), []);

  // Auto-trigger after Stripe Checkout success (`?extra_render_paid=1`).
  // We poll the job once to refresh extraCredits, strip the param, then fire
  // the render. Guarded with a ref so React strict-mode double-invocation
  // doesn't fire twice.
  const extraPaidHandledRef = useRef(false);
  useEffect(() => {
    if (props.isGuest) return;
    if (typeof window === "undefined") return;
    if (extraPaidHandledRef.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("extra_render_paid") !== "1") return;
    extraPaidHandledRef.current = true;
    // Strip the query param from the address bar.
    url.searchParams.delete("extra_render_paid");
    window.history.replaceState({}, "", url.toString());
    // Pull fresh credit counts, then kick off the render.
    void (async () => {
      try {
        const r = await fetch(`/api/mix-console/job/${_jobId}`);
        if (r.ok) {
          const j = await r.json() as {
            studioRenderCount?:        number;
            studioRenderExtraCredits?: number;
          };
          if (typeof j.studioRenderCount        === "number") setRenderCount(j.studioRenderCount);
          if (typeof j.studioRenderExtraCredits === "number") setExtraCredits(j.studioRenderExtraCredits);
        }
      } catch { /* ignore */ }
      // Small delay so the credit-state update commits before onRerender's gate runs.
      setTimeout(() => { void onRerender(); }, 100);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Simple / Advanced view toggle ───────────────────────────────────────
  // Simple view hides the per-stem 2x2 effect knobs + dry/wet + visualizer.
  const [advanced, setAdvanced] = useState(false);

  // ─── Keyboard shortcut callbacks (step 29) ──────────────────────────────
  // These reference existing handlers — we don't modify any of them. The hook
  // only invokes; it never mutates audio or state directly.
  function kbToggleMuteAt(idx: number) {
    const role = lanesOrder[idx];
    if (role) toggleMute(role);
  }
  function kbToggleSoloAt(idx: number) {
    const role = lanesOrder[idx];
    if (role) toggleSolo(role);
  }
  function kbSeekDelta(delta: number) {
    if (!audio.ready) return;
    const next = Math.max(0, Math.min(audio.transport.duration || 0, audio.transport.currentTime + delta));
    audio.transport.seek(next);
  }
  function kbMasterDelta(deltaDb: number) {
    const next = Math.max(-24, Math.min(6, state.master.volumeDb + deltaDb));
    updateMaster({ volumeDb: next });
  }
  function kbSaveSnapshot() {
    const name = window.prompt("Snapshot name");
    if (name && name.trim()) saveSnapshot(name.trim());
  }
  function kbDeselectSection() {
    if (selectedSection) selectSection(null);
  }

  useKeyboardShortcuts({
    onTogglePlay:        () => { void togglePlay(); },
    onUndo:              doUndo,
    onRedo:              doRedo,
    onToggleMuteAt:      kbToggleMuteAt,
    onToggleSoloAt:      kbToggleSoloAt,
    onToggleReference:   () => { void toggleReferenceMode(); },
    onSaveSnapshot:      kbSaveSnapshot,
    onRerender:          () => { void onRerender(); },
    onSeekDelta:         kbSeekDelta,
    onMasterVolumeDelta: kbMasterDelta,
    onDeselectSection:   kbDeselectSection,
    onOpenHelp:          () => setHelpOpen(true),
    stemRoles:           lanesOrder,
  });

  // ─── A11y announcements (step 31) ───────────────────────────────────────
  // Watch existing state slices and broadcast change descriptions to the live
  // region. We subscribe to state — not the handlers — so we never modify the
  // existing setters.
  useEffect(() => {
    if (selectedSection) announce(`Section ${selectedSection} selected`);
    else                 announce("Editing global mix");
  }, [selectedSection]);

  // Mute / solo announcements — diff against previous snapshot.
  const prevMuteRef = useRef<Record<StemRole, boolean>>({});
  const prevSoloRef = useRef<Record<StemRole, boolean>>({});
  useEffect(() => {
    for (const role of roles) {
      const m = !!state.global[role]?.muted;
      const s = !!state.global[role]?.soloed;
      if (prevMuteRef.current[role] !== m) {
        prevMuteRef.current[role] = m;
        announce(`${labelForRole(role)} ${m ? "muted" : "unmuted"}`);
      }
      if (prevSoloRef.current[role] !== s) {
        prevSoloRef.current[role] = s;
        announce(`${labelForRole(role)} ${s ? "soloed" : "unsoloed"}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.global, roles.join("|")]);

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
          <a
            href={`/dashboard/ai/mix-console/${_jobId}`}
            className="inline-block mt-4 text-xs underline"
            style={{ color: "#D4A843" }}
          >
            Go to standard results page
          </a>
        </div>
      </div>
    );
  }
  // Tablet (768–1024px) restyling deferred — would require layout edits the
  // user explicitly disallowed for this batch. Desktop layout renders as-is.

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        // Warm dark base with a faint top vignette to match the rest of the
        // IndieThis dashboard surfaces (#0D0B09 + 4% gold haze).
        background: "radial-gradient(circle at 50% -10%, rgba(212,168,67,0.06), transparent 50%), #0D0B09",
        color:      "#fff",
      }}
    >
      {/* ─── Top bar ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-6 py-3 border-b"
        style={{
          backgroundColor: "rgba(20,18,16,0.92)",
          borderColor:     "rgba(212,168,67,0.10)",
          backdropFilter:  "blur(10px)",
          boxShadow:       "0 1px 0 rgba(212,168,67,0.04), 0 6px 18px rgba(0,0,0,0.35)",
        }}
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
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
            style={{
              backgroundColor: audio.ready ? "#E8735A" : "#3A3631",
              color:           "#0A0A0A",
              opacity:         audio.ready ? 1 : 0.5,
              boxShadow:       audio.ready
                ? (audio.transport.isPlaying
                    ? "0 0 16px rgba(232,115,90,0.55), inset 0 1px 0 rgba(255,255,255,0.2)"
                    : "0 4px 12px rgba(232,115,90,0.35), inset 0 1px 0 rgba(255,255,255,0.2)")
                : "none",
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
                width:            128,           // fixed so siblings don't shift
                textAlign:        "center",
                whiteSpace:       "nowrap",
                overflow:         "hidden",
                textOverflow:     "ellipsis",
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

          {/* Linked-stem groups (step 23) */}
          <LinkStemsMenu
            roles={roles}
            groups={state.linkedGroups ?? {}}
            onCreate={createLinkGroup}
            onDelete={deleteLinkGroup}
          />

          {/* Reference A/B toggle — only when a reference track was uploaded. */}
          {referenceTrackUrl && (
            <button
              type="button"
              onClick={toggleReferenceMode}
              aria-pressed={referenceMode}
              aria-label={referenceMode ? "Switch back to your mix" : "Switch to reference track"}
              title={referenceMode ? "Playing REFERENCE — click to return to your mix" : "A/B with your reference track"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors"
              style={{
                backgroundColor: referenceMode ? "#D4A843" : "transparent",
                color:           referenceMode ? "#0A0A0A" : "#888",
                border:          `1px solid ${referenceMode ? "#D4A843" : "#2A2824"}`,
              }}
            >
              {referenceMode ? "Reference ON" : "A/B Reference"}
            </button>
          )}

          {/* AI Polish — Opus full-mix pass. Hidden for guests. */}
          {!props.isGuest && (
            <button
              type="button"
              onClick={runAiPolish}
              disabled={aiPolishBusy || !audio.ready}
              aria-label="AI Polish — full-mix coordinated nudge"
              title="AI Polish — Opus reasons across the whole mix and nudges everything together"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors"
              style={{
                backgroundColor: aiPolishBusy ? "#D4A843" : "transparent",
                color:           aiPolishBusy ? "#0A0A0A" : "#D4A843",
                border:          "1px solid #D4A843",
                cursor:          aiPolishBusy || !audio.ready ? "default" : "pointer",
                opacity:         !audio.ready ? 0.4 : 1,
              }}
            >
              <Sparkles
                size={11}
                style={{
                  animation: aiPolishBusy ? "pulse 1.1s ease-in-out infinite" : undefined,
                }}
              />
              {aiPolishBusy ? "Polishing…" : "AI Polish"}
            </button>
          )}

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
          <div className="relative">
            <button
              type="button"
              onClick={onRerender}
              disabled={!renderQuotaUsed && !state.isDirty}
              title={
                renderQuotaUsed
                  ? "Out of free re-renders — purchase an extra credit ($1.99) to render again."
                  : `${rendersRemaining} of ${allowedRenders} re-renders remaining`
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                backgroundColor: renderQuotaUsed
                  ? "transparent"
                  : (state.isDirty ? "#D4A843" : "transparent"),
                color: renderQuotaUsed
                  ? "#D4A843"
                  : (state.isDirty ? "#0A0A0A" : "#666"),
                border: `1px solid ${
                  renderQuotaUsed
                    ? "#D4A843"
                    : (state.isDirty ? "#D4A843" : "#2A2824")
                }`,
                cursor: (renderQuotaUsed || state.isDirty) ? "pointer" : "default",
              }}
            >
              <RotateCw size={11} />
              {renderQuotaUsed ? "Additional re-renders $1.99 each" : "Re-render"}
            </button>
            {!props.isGuest && (
              <span
                className="absolute left-0 right-0 text-[9px] font-medium leading-none text-center whitespace-nowrap pointer-events-none"
                style={{
                  top:   "calc(100% + 3px)",
                  color: rendersRemaining === 0 ? "#D4A843" : "#666",
                }}
              >
                {`${renderCount} of ${allowedRenders} re-renders used`}
              </span>
            )}
          </div>
          <a
            href={`/api/mix-console/job/${_jobId}/download?version=studio&format=wav_24_44`}
            aria-label="Export full mix as 24-bit WAV (studio re-render if available, AI mix otherwise)"
            title="Download full mix (studio re-render if available, AI mix otherwise)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ backgroundColor: "transparent", color: "#888", border: "1px solid #2A2824" }}
            onClick={() => announce("Export started")}
          >
            <Download size={11} />
            Export
          </a>
        </div>
      </div>

      {/* ─── Loading state ──────────────────────────────────────────────── */}
      {!audio.ready && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "#666" }}>Loading stems…</p>
        </div>
      )}

      {/* ─── Top scrub bar — master waveform + section markers + playhead ──
          Moved up here from the bottom of the page per the visual restructure
          spec. The same SectionTimeline component drives both navigation and
          editing-scope selection. */}
      {audio.ready && (
        <SectionTimeline
          sections={sections}
          duration={audio.transport.duration}
          currentTime={audio.transport.currentTime}
          selectedSection={selectedSection}
          onSelect={selectSection}
          onSeek={(t) => audio.transport.seek(t)}
          getPeaks={(bins) => audio.getCombinedPeaks(bins)}
        />
      )}

      {/* ─── Main mixer area ─────────────────────────────────────────────── */}
      {audio.ready && (
        <div className="flex-1 flex overflow-hidden">
          {/* Stem lanes — vertical stack of horizontal lanes */}
          <div
            className="flex-1 flex flex-col overflow-y-auto"
            style={{
              background: "linear-gradient(180deg, rgba(20,18,16,0.0) 0%, rgba(212,168,67,0.025) 100%)",
            }}
          >
            {lanesOrder.map((role) => {
              const s = effectiveStem(role);
              if (!s) return null;
              const stemColor = colorForRole(role);
              const ai        = aiOriginals?.[role];
              const isDry     = (reverbTypes?.[role] ?? "plate") === "dry";

              // 2x2 effect knob grid. Each knob's `aiOriginal` is Claude's
              // actual chosen value — the gold tick lines up with the AI mix.
              // Dry stems have no convolver wired so the REV knob is disabled.
              const effectsSlot = (
                <div
                  className="grid grid-cols-4 justify-items-center w-full"
                  style={{
                    columnGap: 4,
                    padding: "2px 0",
                  }}
                >
                  {isDry ? (
                    <button
                      type="button"
                      onClick={() => enableReverb(role)}
                      title={`Add reverb to ${labelForRole(role)} (Claude set this stem dry)`}
                      className="flex flex-col items-center justify-center select-none transition-colors"
                      style={{
                        width:  26,
                        height: 26 + 8 + 2 + 8,
                        marginTop: 8,        // align body with knob bodies (skip the readout strip)
                        opacity: 0.78,
                      }}
                    >
                      <span
                        className="rounded-full flex items-center justify-center"
                        style={{
                          width:  22,
                          height: 22,
                          border: `1px dashed ${stemColor}`,
                          color:  stemColor,
                          fontSize: 14,
                          lineHeight: 1,
                          fontWeight: 700,
                          backgroundColor: "rgba(0,0,0,0.25)",
                        }}
                      >
                        +
                      </span>
                      <span
                        className="text-[8px] uppercase tracking-wider mt-0.5 leading-none"
                        style={{ color: "#888" }}
                      >
                        REV
                      </span>
                    </button>
                  ) : (
                    <EffectKnob
                      value={s.reverb}
                      onChange={(v) => setStemReverb(role, v)}
                      aiOriginal={ai?.reverb ?? 0}
                      color={stemColor}
                      label={`${labelForRole(role)} reverb`}
                      shortLabel="REV"
                      size={26}
                    />
                  )}
                  <EffectKnob
                    value={s.delay}
                    onChange={(v) => setStemDelay(role, v)}
                    aiOriginal={ai?.delay ?? 0}
                    color={stemColor}
                    label={`${labelForRole(role)} delay`}
                    shortLabel="DLY"
                    size={26}
                  />
                  <EffectKnob
                    value={s.comp}
                    onChange={(v) => setStemComp(role, v)}
                    aiOriginal={ai?.comp ?? 0}
                    color={stemColor}
                    label={`${labelForRole(role)} compression`}
                    shortLabel="CMP"
                    size={26}
                  />
                  <EffectKnob
                    value={s.brightness}
                    onChange={(v) => setStemBrightness(role, v)}
                    aiOriginal={ai?.brightness ?? 50}
                    color={stemColor}
                    label={`${labelForRole(role)} brightness`}
                    shortLabel="BRT"
                    size={26}
                  />
                </div>
              );

              const anySoloed = roles.some((r) => effectiveStem(r)?.soloed);
              const isFaded   = anySoloed && !s.soloed && !s.muted;
              const laneH     = laneHeightFor(role);

              return (
                <ChannelStrip
                  key={role}
                  role={role}
                  layout="horizontal"
                  height={laneH}
                  faded={isFaded}
                  linkBadge={(() => {
                    const groupName = (() => {
                      const groups = state.linkedGroups ?? {};
                      for (const n of Object.keys(groups)) {
                        if (groups[n].includes(role)) return n;
                      }
                      return null;
                    })();
                    if (!groupName) return null;
                    return (
                      <div
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: "#1A1612",
                          color:           "#D4A843",
                          border:          "1px solid #D4A843",
                          maxWidth:        72,
                        }}
                        title={`Linked: ${groupName}`}
                      >
                        <Link2 size={8} />
                        <span className="truncate">{groupName}</span>
                      </div>
                    );
                  })()}
                  gainDb={s.gainDb}
                  onGainDbChange={(db) => setStemGainDb(role, db)}
                  analyser={audio.stems[role]?.analyser ?? null}
                  gainAiOriginal={aiOriginals?.[role]?.gainDb ?? 0}
                  pan={s.pan}
                  onPanChange={(p) => setStemPan(role, p)}
                  panAiOriginal={aiOriginals?.[role]?.pan ?? 0}
                  muted={s.muted}
                  soloed={s.soloed}
                  onMuteToggle={() => toggleMute(role)}
                  onSoloToggle={() => toggleSolo(role)}
                  onAiAssist={props.isGuest ? undefined : () => runAiAssist(role)}
                  aiAssistBusy={!!aiAssistBusy[role]}
                  onExport={() => exportStem(role)}
                  exportBusy={!!exportBusy[role]}
                  modified={isStemModified(role)}
                  advanced={advanced}
                  effectsSlot={effectsSlot}
                  dryWetSlot={
                    <DryWetSlider
                      value={s.dryWet}
                      onChange={(v) => setStemDryWet(role, v)}
                      color={stemColor}
                      label={`${labelForRole(role)} dry/wet`}
                    />
                  }
                  waveformSlot={
                    <TrackWaveform
                      getPeaks={(bins) => audio.stems[role]?.getPeaks(bins) ?? null}
                      currentTime={audio.transport.currentTime}
                      duration={audio.transport.duration}
                      color={stemColor}
                      onSeek={(t) => audio.transport.seek(t)}
                      dim={s.muted}
                      bright={s.soloed}
                      faded={isFaded}
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
            notesSlot={
              <MixNotesPanel
                roles={roles}
                aiOriginals={aiOriginals}
                reverbTypes={reverbTypes}
              />
            }
          />
        </div>
      )}

      {/* (Section timeline moved to the top scrub bar — see above) */}

      {/* "Now editing" indicator — only when a section is
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

      {/* ─── Hidden reference audio element (step 22) ───────────────────── */}
      {referenceTrackUrl && (
        <audio
          ref={refAudioElRef}
          src={referenceTrackUrl}
          preload="metadata"
          crossOrigin="anonymous"
          style={{ display: "none" }}
        />
      )}

      {/* ─── Reference-mode banner ─────────────────────────────────────── */}
      {referenceMode && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-2"
          style={{
            backgroundColor: "#D4A843",
            color:           "#0A0A0A",
            boxShadow:       "0 4px 14px rgba(212, 168, 67, 0.35)",
          }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: "#0A0A0A", animation: "pulse 1.2s ease-in-out infinite" }}
          />
          Playing reference track
        </div>
      )}

      {/* ─── AI Polish note toast ───────────────────────────────────────── */}
      {aiPolishNote && (
        <div
          className="absolute bottom-32 left-1/2 -translate-x-1/2 px-5 py-3 rounded-lg text-xs flex items-start gap-2.5 max-w-lg"
          style={{
            backgroundColor: "#1A1612",
            border:          "1px solid #D4A843",
            color:           "#F0D88E",
            boxShadow:       "0 8px 24px rgba(0,0,0,0.55)",
          }}
        >
          <Sparkles size={13} style={{ color: "#D4A843", marginTop: 1 }} />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold uppercase tracking-wider text-[10px]" style={{ color: "#D4A843" }}>
              AI Polish
            </span>
            <span className="leading-snug">{aiPolishNote}</span>
          </div>
        </div>
      )}

      {/* ─── AI Assist note toast ───────────────────────────────────────── */}
      {aiAssistNote && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-xs flex items-start gap-2 max-w-md"
          style={{
            backgroundColor: "#1A1612",
            border:          "1px solid #D4A843",
            color:           "#E8C97A",
            boxShadow:       "0 6px 20px rgba(0,0,0,0.45)",
          }}
        >
          <span className="font-bold uppercase tracking-wider text-[10px]" style={{ color: "#D4A843" }}>
            {labelForRole(aiAssistNote.role)}
          </span>
          <span className="leading-snug">{aiAssistNote.note}</span>
        </div>
      )}

      {/* ─── Error toasts ───────────────────────────────────────────────── */}
      {Object.keys(audio.errors).length > 0 && (
        <div className="absolute top-20 right-4 px-4 py-2 rounded-lg text-xs"
             style={{ backgroundColor: "#2A1818", border: "1px solid #E8554A", color: "#E8554A" }}>
          Failed to load: {Object.keys(audio.errors).map(labelForRole).join(", ")}
        </div>
      )}

      {/* ─── Render-diff card (step 27) — modal overlay shown when a
            studio re-render completes. Independent <audio> elements; never
            touches useStudioAudio. */}
      {diffBeforeState && diffAfterState && (
        <RenderDiffCard
          open={diffOpen}
          onClose={() => setDiffOpen(false)}
          beforeState={diffBeforeState}
          afterState={diffAfterState}
          beforeAnalysis={beforeAnalysis}
          afterAnalysis={null}
          beforeAudioUrl={diffBeforeUrl}
          afterAudioUrl={diffAfterUrl}
          labelForRole={labelForRole}
        />
      )}

      {/* ─── Shortcut help overlay (step 29) ─────────────────────────────── */}
      <ShortcutHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* ─── A11y live region (step 31) ──────────────────────────────────── */}
      <A11yLiveRegion />

      {/* ─── Subtle "rendering…" indicator while studio render is in flight. */}
      {isRendering && (
        <div
          className="absolute bottom-4 right-4 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2"
          style={{
            backgroundColor: "#1A1612",
            border: "1px solid #D4A843",
            color: "#D4A843",
          }}
          aria-live="polite"
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: "#D4A843", animation: "pulse 1.2s ease-in-out infinite" }}
          />
          Rendering studio mix…
        </div>
      )}
    </div>
  );
}

/* unused import guard so future steps don't lint-warn */
void colorForRole;
