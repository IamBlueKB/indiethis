/**
 * MasterStrip — master bus column on the right of the mixer.
 *
 * Layout (top → bottom):
 *   - Header label "MASTER"
 *   - Master frequency visualizer slot     (step 14)
 *   - 5-band EQ knob row                   (step 13 wires audio; step 12 = visual)
 *   - AI Intensity knob                    (visual until re-render; bakes in step 26)
 *   - Stereo Width slider                  (visual until re-render; bakes in step 26)
 *   - Master volume fader + level meter    (WIRED — drives master.setGainDb)
 *   - Footer label
 *
 * Width: 120px (matches the placeholder it replaces). Border-top in gold to
 * visually separate the master from the per-stem strips.
 *
 * Setters take patch-style updates to MasterState so StudioClient owns the
 * state shape; the strip just renders + dispatches.
 */

"use client";

import { VolumeFader } from "./VolumeFader";
import { EffectKnob } from "./EffectKnob";
import type { MasterState } from "./types";

interface MasterStripProps {
  master:        MasterState;
  onChange:      (patch: Partial<MasterState>) => void;
  /** Live master analyser — drives the level meter on the volume fader. */
  analyser?:     AnalyserNode | null;
  /** Top slot — master frequency visualizer (step 14). */
  topSlot?:      React.ReactNode;
  /** EQ slot — 5-band knob row (step 13 fills in). */
  eqSlot?:       React.ReactNode;
}

const GOLD = "#D4A843";

export function MasterStrip({
  master,
  onChange,
  analyser,
  topSlot,
  eqSlot,
}: MasterStripProps) {
  // Stereo width slider drag handler.
  function onWidthChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ stereoWidth: Number(e.target.value) });
  }
  function onWidthDoubleClick() {
    onChange({ stereoWidth: 100 });
  }

  return (
    <div
      className="flex-shrink-0 flex flex-col items-center py-3 px-2 ml-2 mr-3 my-4 gap-3"
      style={{
        width:           120,
        backgroundColor: "#1a1816",
        border:          "0.5px solid #2A2824",
        borderTopWidth:  3,
        borderTopColor:  GOLD,
        borderRadius:    4,
      }}
    >
      {/* Header */}
      <span
        className="text-[10px] uppercase font-semibold tracking-wider"
        style={{ color: GOLD }}
      >
        Master
      </span>

      {/* Master frequency visualizer slot — step 14 */}
      <div className="w-full" style={{ height: 40 }}>
        {topSlot}
      </div>

      {/* 5-band EQ slot — step 13 */}
      <div className="w-full">
        {eqSlot}
      </div>

      {/* AI Intensity — global multiplier on Claude's effect values. Visual
          only in the browser; multiplier is applied at re-render time
          (predict.py _studio_render in step 26). 50 = 100% (Claude's mix). */}
      <div className="flex flex-col items-center gap-1">
        <EffectKnob
          value={master.aiIntensity}
          onChange={(v) => onChange({ aiIntensity: v })}
          aiOriginal={100}
          color={GOLD}
          label="AI intensity"
          shortLabel="AI"
        />
      </div>

      {/* Stereo Width — 0..150%. 100 = AI's setting (gold tick aligned). */}
      <div className="flex flex-col items-center gap-1 w-full">
        <input
          type="range"
          min={0}
          max={150}
          step={1}
          value={master.stereoWidth}
          onChange={onWidthChange}
          onDoubleClick={onWidthDoubleClick}
          aria-label="Stereo width"
          className="w-full appearance-none cursor-pointer"
          style={{
            height: 4,
            background: `linear-gradient(to right, #2A2824 0%, ${GOLD} ${(master.stereoWidth / 150) * 100}%, #2A2824 ${(master.stereoWidth / 150) * 100}%, #2A2824 100%)`,
            borderRadius: 2,
          }}
        />
        <span className="text-[8px] uppercase tracking-wider" style={{ color: "#888" }}>
          Width {Math.round(master.stereoWidth)}%
        </span>
      </div>

      {/* Master volume fader — WIRED to master.setGainDb. */}
      <div className="flex flex-col items-center gap-1 mt-1">
        <VolumeFader
          valueDb={master.volumeDb}
          onChangeDb={(db) => onChange({ volumeDb: db })}
          analyser={analyser}
          color={GOLD}
          label="Master volume"
        />
        <span className="text-[8px] uppercase tracking-wider" style={{ color: "#888" }}>
          {master.volumeDb >= 0 ? "+" : ""}{master.volumeDb.toFixed(1)} dB
        </span>
      </div>

      {/* Footer label */}
      <span
        className="text-[8px] font-mono uppercase tracking-wider mt-auto"
        style={{ color: "#666" }}
      >
        OUT
      </span>
    </div>
  );
}
