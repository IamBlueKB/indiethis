"use client";

/**
 * PresetPicker — preset selection screen shown before Director Mode chat.
 *
 * Artists tap a preset card to start with a genre-appropriate blueprint,
 * or click "Start from scratch" to skip presets entirely.
 *
 * Presets are loaded from GET /api/video-studio/presets.
 */

import { useEffect, useState } from "react";
import {
  Wand2, ChevronRight, Loader2, ArrowRight, Check,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoPreset {
  id:              string;
  name:            string;
  genre:           string;
  description:     string;
  previewUrl?:     string | null;
  styleName?:      string | null;
  moodArc:         string;
  defaultFilmLook?: string;
  cameraSequence:  Record<string, string>;
  briefTemplate:   {
    logline?:        string;
    tone?:           string;
    colorPalette?:   string[];
    visualThemes?:   string[];
    cinematography?: string;
  };
  sortOrder:       number;
}

// ─── Genre display names ──────────────────────────────────────────────────────

const GENRE_LABELS: Record<string, string> = {
  HIP_HOP:   "Hip-Hop",
  RNB:       "R&B",
  POP:       "Pop",
  EDM:       "EDM",
  ROCK:      "Rock",
  INDIE:     "Indie",
  LATIN:     "Latin",
  ACOUSTIC:  "Acoustic",
  TRAP:      "Trap",
  ABSTRACT:  "Abstract",
  NARRATIVE: "Narrative",
};

// ─── Mood arc display ────────────────────────────────────────────────────────

const MOOD_LABELS: Record<string, string> = {
  intense_throughout: "Intense throughout",
  dark_to_bright:     "Dark → bright",
  building_energy:    "Building energy",
  emotional_journey:  "Emotional journey",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onSelect:       (preset: VideoPreset) => void;
  onScratch:      () => void;
}

export default function PresetPicker({ onSelect, onScratch }: Props) {
  const [presets,  setPresets]  = useState<VideoPreset[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/video-studio/presets")
      .then(r => r.ok ? r.json() : { presets: [] })
      .then(d => setPresets(d.presets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSelect(preset: VideoPreset) {
    setSelected(preset.id);
    // Small delay so the gold selection state is visible before transitioning
    setTimeout(() => onSelect(preset), 300);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-2"
          style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
          <Wand2 size={11} /> Director Mode
        </div>
        <h2 className="text-2xl font-black text-white">Start with a blueprint</h2>
        <p className="text-sm" style={{ color: "#888" }}>
          Choose a preset that matches your sound, then customize with our AI director.
        </p>
      </div>

      {/* Preset grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="animate-spin" style={{ color: "#D4A843" }} />
        </div>
      ) : presets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: "#555" }}>No presets available. Start from scratch below.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {presets.map(preset => {
            const isSelected = selected === preset.id;
            const isHovered  = hoveredId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelect(preset)}
                onMouseEnter={() => setHoveredId(preset.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="text-left rounded-2xl border p-4 transition-all flex flex-col gap-3 group"
                style={{
                  borderColor:     isSelected ? "#D4A843" : isHovered ? "#444" : "#222",
                  backgroundColor: isSelected ? "rgba(212,168,67,0.07)" : "#0F0F0F",
                  boxShadow:       isSelected ? "0 0 0 1px rgba(212,168,67,0.2)" : "none",
                }}
              >
                {/* Name + genre tag */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: isSelected ? "#D4A843" : "#F0F0F0" }}>
                        {preset.name}
                      </p>
                      {isSelected && <Check size={13} style={{ color: "#D4A843" }} />}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "#888" }}>{preset.description}</p>
                  </div>
                  <div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#888" }}
                    >
                      {GENRE_LABELS[preset.genre] ?? preset.genre}
                    </span>
                  </div>
                </div>

                {/* Preview loop (if URL exists) */}
                {preset.previewUrl && (
                  <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9", backgroundColor: "#0A0A0A" }}>
                    <video
                      src={preset.previewUrl}
                      autoPlay={isHovered || isSelected}
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Mood arc + style */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSelected ? "#D4A843" : "#555" }} />
                    <p className="text-[10px] font-semibold" style={{ color: "#666" }}>
                      {MOOD_LABELS[preset.moodArc] ?? preset.moodArc}
                    </p>
                  </div>
                  {preset.styleName && (
                    <p className="text-[10px]" style={{ color: "#555" }}>{preset.styleName}</p>
                  )}
                </div>

                {/* Color palette */}
                {preset.briefTemplate.colorPalette && preset.briefTemplate.colorPalette.length > 0 && (
                  <div className="flex gap-1.5">
                    {preset.briefTemplate.colorPalette.slice(0, 5).map((c, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full border border-white/10 shrink-0"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Start from scratch */}
      <div className="text-center pt-2">
        <button
          onClick={onScratch}
          className="inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
          style={{ color: "#666" }}
        >
          Or start from scratch <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
