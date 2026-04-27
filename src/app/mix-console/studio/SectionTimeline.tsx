/**
 * SectionTimeline — bottom strip showing song sections + playhead.
 *
 * Two jobs:
 *   1. Navigation — click any block to seek transport to that section's start
 *   2. Editing scope — click to select a section as the editing context;
 *      knob changes from then on write to the sections[name] override map
 *      instead of the global per-stem state. Click "Global mix" pill to
 *      reset to global editing.
 *
 * Block widths scale to (end - start) / totalDuration. Names are normalized
 * to plain English ("verse1" → "Verse 1"). The currently-selected section
 * gets a gold border; the section currently under the playhead glows softly
 * regardless of selection.
 *
 * predict.py applies per-section overrides at render time (step 26). In the
 * browser, the audio graph reflects whichever section is currently selected
 * for editing — selecting "Chorus" auto-seeks to its start so the artist
 * hears exactly what they're editing.
 */

"use client";

import { useMemo } from "react";
import type { SongSection } from "./types";

interface SectionTimelineProps {
  sections:        SongSection[];
  duration:        number;     // seconds — usually audio.transport.duration
  currentTime:     number;     // seconds — usually audio.transport.currentTime
  selectedSection: string | null;
  onSelect:        (name: string | null) => void;  // null = global
  onSeek:          (seconds: number) => void;
}

const GOLD = "#D4A843";

function prettyName(raw: string): string {
  // "verse1" → "Verse 1", "chorus" → "Chorus", "intro" → "Intro"
  const m = raw.match(/^([a-z]+)(\d+)?$/i);
  if (!m) return raw;
  const word = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  return m[2] ? `${word} ${m[2]}` : word;
}

export function SectionTimeline(props: SectionTimelineProps) {
  const { sections, duration, currentTime, selectedSection, onSelect, onSeek } = props;

  // Determine which section the playhead is currently inside (for the glow).
  const activeSection = useMemo(() => {
    for (const s of sections) {
      if (currentTime >= s.start && currentTime < s.end) return s.name;
    }
    return null;
  }, [sections, currentTime]);

  // Playhead position 0..1 across the timeline.
  const playheadPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className="flex items-center px-4 py-2 border-t gap-2"
      style={{ backgroundColor: "#141210", borderColor: "#1f1d1a", minHeight: 44 }}
    >
      {/* "Global mix" pill — null selection = edit globals. */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition-colors shrink-0"
        style={{
          backgroundColor: selectedSection === null ? GOLD       : "transparent",
          color:           selectedSection === null ? "#0A0A0A"  : "#888",
          border:          `1px solid ${selectedSection === null ? GOLD : "#2A2824"}`,
        }}
        title="Edit the whole song. Knob changes apply globally."
      >
        Global Mix
      </button>

      {/* Timeline — flex-1 fills the rest of the row. */}
      {sections.length === 0 ? (
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "#444" }}>
          No sections detected
        </span>
      ) : (
        <div className="relative flex-1 flex items-stretch gap-0.5" style={{ height: 28 }}>
          {sections.map((s) => {
            const w        = duration > 0 ? ((s.end - s.start) / duration) * 100 : 0;
            const selected = selectedSection === s.name;
            const playing  = activeSection  === s.name;
            return (
              <button
                key={s.name + s.start}
                type="button"
                onClick={() => {
                  onSelect(s.name);
                  onSeek(s.start);
                }}
                className="text-[10px] font-semibold uppercase tracking-wider rounded transition-all overflow-hidden whitespace-nowrap"
                style={{
                  width:           `${w}%`,
                  minWidth:        24,
                  backgroundColor: selected ? GOLD
                                  : playing  ? "#2A2622"
                                             : "#1A1816",
                  color:           selected ? "#0A0A0A"
                                  : playing  ? "#fff"
                                             : "#888",
                  border:          `1px solid ${selected ? GOLD
                                                : playing ? GOLD
                                                          : "#2A2824"}`,
                  opacity:         selected || playing ? 1 : 0.85,
                  cursor:          "pointer",
                  padding:         "0 6px",
                  textOverflow:    "ellipsis",
                }}
                title={`${prettyName(s.name)} · ${s.start.toFixed(1)}s – ${s.end.toFixed(1)}s`}
              >
                {prettyName(s.name)}
              </button>
            );
          })}

          {/* Playhead — thin vertical line over the section row. */}
          {duration > 0 && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left:            `${playheadPct}%`,
                width:           1,
                backgroundColor: GOLD,
                boxShadow:       `0 0 4px ${GOLD}`,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
