"use client";

/**
 * WorkflowBoard — visual node-based production map for Director Mode.
 *
 * Horizontal flow (desktop): Track → Analysis → Brief → Scenes + Clips → Final Video
 * Vertical stacked flow (mobile): nodes stacked top to bottom
 *
 * Nodes are read-only for structure. Tap a scene node to open the edit panel.
 * Connection lines animate with a gold pulse dot during generation.
 */

import { useState, useRef, useEffect } from "react";
import {
  Music2, Activity, Star, Film, Download, Check,
  X, Loader2, Play, ChevronRight, Edit2, Camera,
  Zap, AlertCircle, CornerDownRight,
} from "lucide-react";
import { CameraDirectionPicker, CAMERA_DIRECTION_MAP, type CameraDirectionKey } from "./CameraDirectionPicker";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface WorkflowScene {
  index:           number;
  title:           string;
  description:     string;
  cameraDirection?: string;
  type:            string;
  energyLevel:     number;
  startTime:       number;
  endTime:         number;
  hasLipSync:      boolean;
  modelDisplay?:   string;
}

export interface WorkflowClip {
  sceneIndex:      number;
  videoUrl?:       string;
  thumbnailUrl?:   string;
  status:          "pending" | "generating" | "complete" | "failed";
  manualRejected?: boolean;
}

interface WorkflowBoardProps {
  // Track
  trackTitle:    string;
  trackDuration: number;
  bpm?:          number | null;
  musicalKey?:   string | null;
  audioUrl?:     string;

  // Analysis
  songSections?: Array<{ type: string; startTime: number; endTime: number; energy: number }>;
  hasLyrics?:    boolean;

  // Brief
  brief?: {
    title:          string;
    logline:        string;
    tone:           string;
    cinematography?: string;
    colorPalette?:  string[];
  } | null;
  onEditBrief?: () => void;

  // Shot list
  shotList:     WorkflowScene[];
  clips?:       WorkflowClip[];

  // Video state
  videoStatus:    string;
  finalVideoUrl?: string | null;
  thumbnailUrl?:  string | null;
  videoId?:       string;

  // Callbacks
  onEditScene?:    (index: number, updates: Partial<WorkflowScene>) => void;
  onRegenClip?:    (index: number) => void;
  onManualReject?: (index: number, note: string) => void;
}

// ─── Energy color ─────────────────────────────────────────────────────────────

function energyColor(level: number): string {
  if (level >= 0.7) return "#E85D4A"; // high — coral
  if (level >= 0.35) return "#D4A843"; // med — gold
  return "#60A5FA"; // low — blue
}

function energyLabel(level: number): string {
  if (level >= 0.7) return "High";
  if (level >= 0.35) return "Mid";
  return "Low";
}

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// ─── Connector arrow between single nodes ─────────────────────────────────────

function Arrow({ active, generating }: { active?: boolean; generating?: boolean }) {
  return (
    <div className="flex items-center justify-center shrink-0 relative" style={{ width: 36, height: 40 }}>
      <div
        className="absolute inset-x-0"
        style={{
          height: 2,
          top: "50%",
          transform: "translateY(-50%)",
          backgroundColor: active ? "#D4A843" : "#2A2A2A",
          transition: "background-color 0.4s",
        }}
      />
      <svg width="10" height="10" style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)" }}>
        <polygon points="0,0 10,5 0,10" fill={active ? "#D4A843" : "#2A2A2A"} />
      </svg>
      {generating && (
        <div
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: "#D4A843",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            animation: "pulse-dot 1.2s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
}

// ─── FanOut: single input → multiple outputs (Brief → Scenes) ─────────────────

function FanOut({ count, active, generating }: { count: number; active?: boolean; generating?: boolean }) {
  if (count === 0) return <Arrow active={active} generating={generating} />;
  if (count === 1) return <Arrow active={active} generating={generating} />;

  const rowH = 104; // approximate scene row height + gap
  const totalH = count * rowH;
  const midY = totalH / 2;

  return (
    <div className="shrink-0 relative" style={{ width: 36, height: totalH }}>
      <svg width="36" height={totalH} style={{ position: "absolute", inset: 0 }}>
        {/* Vertical bar at center-left */}
        <line x1="4" y1="0" x2="4" y2={totalH} stroke={active ? "#D4A843" : "#2A2A2A"} strokeWidth="2" />
        {/* Horizontal branches */}
        {Array.from({ length: count }).map((_, i) => {
          const y = i * rowH + rowH / 2;
          return (
            <g key={i}>
              <line x1="4" y1={y} x2="32" y2={y} stroke={active ? "#D4A843" : "#2A2A2A"} strokeWidth="2" />
              <polygon points={`26,${y - 4} 36,${y} 26,${y + 4}`} fill={active ? "#D4A843" : "#2A2A2A"} />
            </g>
          );
        })}
        {/* Incoming horizontal line at midpoint */}
        <line x1="0" y1={midY} x2="4" y2={midY} stroke={active ? "#D4A843" : "#2A2A2A"} strokeWidth="2" />
        {generating && (
          <circle r="4" fill="#D4A843" opacity="0.9">
            <animateMotion dur="1.4s" repeatCount="indefinite"
              path={`M 0 ${midY} L 4 ${midY} L 4 0 L 4 ${totalH} L 4 0`} />
          </circle>
        )}
      </svg>
    </div>
  );
}

// ─── FanIn: multiple inputs → single output (Clips → Final) ──────────────────

function FanIn({ count, active, generating }: { count: number; active?: boolean; generating?: boolean }) {
  if (count === 0) return <Arrow active={active} generating={generating} />;
  if (count === 1) return <Arrow active={active} generating={generating} />;

  const rowH = 104;
  const totalH = count * rowH;
  const midY = totalH / 2;

  return (
    <div className="shrink-0 relative" style={{ width: 36, height: totalH }}>
      <svg width="36" height={totalH} style={{ position: "absolute", inset: 0 }}>
        <line x1="32" y1="0" x2="32" y2={totalH} stroke={active ? "#D4A843" : "#2A2A2A"} strokeWidth="2" />
        {Array.from({ length: count }).map((_, i) => {
          const y = i * rowH + rowH / 2;
          return (
            <line key={i} x1="0" y1={y} x2="32" y2={y} stroke={active ? "#D4A843" : "#2A2A2A"} strokeWidth="2" />
          );
        })}
        <line x1="32" y1={midY} x2="36" y2={midY} stroke={active ? "#D4A843" : "#2A2A2A"} strokeWidth="2" />
        <polygon points={`28,${midY - 4} 36,${midY} 28,${midY + 4}`} fill={active ? "#D4A843" : "#2A2A2A"} />
        {generating && (
          <circle r="4" fill="#D4A843" opacity="0.9">
            <animateMotion dur="1.4s" repeatCount="indefinite"
              path={`M 0 ${midY} L 32 ${midY} L 32 0 L 32 ${totalH}`} />
          </circle>
        )}
      </svg>
    </div>
  );
}

// ─── Track Node ───────────────────────────────────────────────────────────────

function TrackNode({
  title, duration, bpm, musicalKey,
}: {
  title: string; duration: number; bpm?: number | null; musicalKey?: string | null;
}) {
  // Mini waveform: 10 bars of pseudo-random heights
  const bars = [40, 65, 80, 55, 90, 70, 45, 85, 60, 50];

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3 shrink-0"
      style={{
        width: 192, minHeight: 120,
        backgroundColor: "#111",
        borderColor: "#D4A843",
        boxShadow: "0 0 0 1px rgba(212,168,67,0.15)",
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
          <Music2 size={13} style={{ color: "#D4A843" }} />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#D4A843" }}>Track</p>
      </div>
      <p className="text-sm font-bold text-white leading-snug line-clamp-2">{title}</p>
      <div className="flex items-end gap-0.5 h-6">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, backgroundColor: "#D4A843", opacity: 0.6 }} />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold" style={{ color: "#888" }}>{fmtTime(duration)}</span>
        {bpm && <span className="text-[10px] font-semibold" style={{ color: "#888" }}>{bpm} BPM</span>}
        {musicalKey && <span className="text-[10px] font-semibold" style={{ color: "#888" }}>{musicalKey}</span>}
      </div>
    </div>
  );
}

// ─── Analysis Node ────────────────────────────────────────────────────────────

function AnalysisNode({
  sections, hasLyrics,
}: {
  sections?: Array<{ type: string; energy: number }>;
  hasLyrics?: boolean;
}) {
  const energyBars = sections?.slice(0, 10).map(s => s.energy) ?? [];

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3 shrink-0"
      style={{ width: 176, minHeight: 120, backgroundColor: "#111", borderColor: sections?.length ? "#2A2A2A" : "#1A1A1A" }}
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(96,165,250,0.12)" }}>
          <Activity size={13} style={{ color: "#60A5FA" }} />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#60A5FA" }}>Analysis</p>
      </div>

      {sections?.length ? (
        <>
          <div className="flex flex-wrap gap-1">
            {Array.from(new Set(sections.map(s => s.type))).slice(0, 5).map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                style={{ backgroundColor: "#1A1A1A", color: "#888" }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </span>
            ))}
          </div>
          {energyBars.length > 0 && (
            <div className="flex items-end gap-0.5 h-5">
              {energyBars.map((e, i) => (
                <div key={i} className="flex-1 rounded-sm"
                  style={{ height: `${Math.max(10, e * 100)}%`, backgroundColor: energyColor(e), opacity: 0.7 }} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hasLyrics ? "#34C759" : "#555" }} />
            <p className="text-[10px]" style={{ color: "#666" }}>
              {hasLyrics ? "Lyrics detected" : "Instrumental"}
            </p>
          </div>
        </>
      ) : (
        <p className="text-xs" style={{ color: "#555" }}>Waiting for analysis…</p>
      )}
    </div>
  );
}

// ─── Brief Node ───────────────────────────────────────────────────────────────

function BriefNode({
  brief, onEditBrief,
}: {
  brief?: { title: string; logline: string; tone: string; colorPalette?: string[] } | null;
  onEditBrief?: () => void;
}) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3 shrink-0 cursor-pointer hover:border-[#D4A843] transition-colors"
      style={{ width: 204, minHeight: 120, backgroundColor: "#111", borderColor: brief ? "#2A2A2A" : "#1A1A1A" }}
      onClick={onEditBrief}
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
          <Star size={13} style={{ color: "#D4A843" }} />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#D4A843" }}>Brief</p>
      </div>

      {brief ? (
        <>
          <p className="text-sm font-bold text-white leading-snug line-clamp-1">{brief.title}</p>
          <p className="text-[11px] italic leading-snug line-clamp-2" style={{ color: "#AAA" }}>{brief.logline}</p>
          {brief.colorPalette && brief.colorPalette.length > 0 && (
            <div className="flex gap-1">
              {brief.colorPalette.slice(0, 4).map((c, i) => (
                <div key={i} className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: c }} />
              ))}
            </div>
          )}
          <p className="text-[10px] font-semibold" style={{ color: "#888" }}>{brief.tone}</p>
        </>
      ) : (
        <p className="text-xs" style={{ color: "#555" }}>Brief not yet generated.</p>
      )}

      {onEditBrief && brief && (
        <div className="flex items-center gap-1 text-[10px] mt-auto" style={{ color: "#D4A843" }}>
          <Edit2 size={9} /> Edit via chat
        </div>
      )}
    </div>
  );
}

// ─── Scene Node ───────────────────────────────────────────────────────────────

function SceneNode({
  scene, isSelected, onClick,
}: {
  scene: WorkflowScene;
  isSelected: boolean;
  onClick: () => void;
}) {
  const cam = scene.cameraDirection as CameraDirectionKey | undefined;
  const camInfo = cam ? CAMERA_DIRECTION_MAP[cam] : null;

  return (
    <div
      className="rounded-xl border p-3 cursor-pointer transition-all hover:border-[#D4A843] flex flex-col gap-2 shrink-0"
      style={{
        width: 216,
        minHeight: 88,
        backgroundColor: isSelected ? "rgba(212,168,67,0.06)" : "#111",
        borderColor: isSelected ? "#D4A843" : "#2A2A2A",
        boxShadow: isSelected ? "0 0 0 1px rgba(212,168,67,0.2)" : "none",
      }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
            style={{
              backgroundColor: "rgba(212,168,67,0.15)",
              color: "#D4A843",
            }}
          >
            {scene.index + 1}
          </div>
          <p className="text-xs font-bold text-white truncate">{scene.title}</p>
        </div>
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: energyColor(scene.energyLevel) }}
          title={`${energyLabel(scene.energyLevel)} energy`}
        />
      </div>

      <p className="text-[11px] line-clamp-2" style={{ color: "#888", lineHeight: 1.4 }}>
        {scene.description}
      </p>

      <div className="flex items-center justify-between mt-auto">
        {camInfo && (
          <div className="flex items-center gap-1">
            <Camera size={9} style={{ color: "#555" }} />
            <p className="text-[10px]" style={{ color: "#666" }}>{camInfo.label}</p>
          </div>
        )}
        <p className="text-[10px]" style={{ color: "#555" }}>
          {fmtTime(scene.startTime)} – {fmtTime(scene.endTime)}
        </p>
      </div>
    </div>
  );
}

// ─── Clip Node ────────────────────────────────────────────────────────────────

function ClipNode({
  sceneIndex, clip, onRegen, onManualReject, videoId,
}: {
  sceneIndex:      number;
  clip?:           WorkflowClip;
  onRegen?:        (i: number) => void;
  onManualReject?: (i: number, note: string) => void;
  videoId?:        string;
}) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNote,      setRejectNote]      = useState("");
  const [submitting,      setSubmitting]      = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const status       = clip?.status ?? "pending";
  const isComplete   = status === "complete";
  const isGenerating = status === "generating";
  const isFailed     = status === "failed";
  const isRejected   = clip?.manualRejected ?? false;

  // Focus textarea when reject panel opens
  useEffect(() => {
    if (showRejectInput) inputRef.current?.focus();
  }, [showRejectInput]);

  async function handleRejectSubmit() {
    const note = rejectNote.trim();
    if (!note || !onManualReject) return;
    setSubmitting(true);
    try {
      await onManualReject(sceneIndex, note);
      setShowRejectInput(false);
      setRejectNote("");
    } finally {
      setSubmitting(false);
    }
  }

  // Show reject button when clip is complete and not yet manually rejected
  const canReject = isComplete && !isRejected && !!onManualReject;

  return (
    <div
      className="rounded-xl border flex flex-col overflow-hidden shrink-0 transition-all"
      style={{
        width: 156,
        backgroundColor: "#111",
        borderColor: isRejected ? "#555" : isComplete ? "#34C759" : isFailed ? "#E85D4A" : isGenerating ? "#D4A843" : "#1A1A1A",
      }}
    >
      {/* Thumbnail */}
      <div className="relative flex items-center justify-center" style={{ minHeight: 52, backgroundColor: "#0A0A0A" }}>
        {isComplete && clip?.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl}
            alt={`Clip ${sceneIndex + 1}`}
            className="w-full h-full object-cover"
            style={{ maxHeight: 52, opacity: isRejected ? 0.4 : 1 }}
          />
        ) : isGenerating ? (
          <Loader2 size={18} className="animate-spin" style={{ color: "#D4A843" }} />
        ) : isFailed ? (
          <X size={18} style={{ color: "#E85D4A" }} />
        ) : isComplete ? (
          <Check size={18} style={{ color: "#34C759" }} />
        ) : (
          <Film size={16} style={{ color: "#333" }} />
        )}
        {isComplete && !isRejected && (
          <div className="absolute top-1 right-1">
            <Check size={10} style={{ color: "#34C759" }} />
          </div>
        )}
        {isRejected && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <p className="text-[9px] font-semibold" style={{ color: "#888" }}>Redirected</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-2.5 py-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold" style={{ color: isRejected ? "#555" : isComplete ? "#34C759" : isFailed ? "#E85D4A" : "#555" }}>
          Clip {sceneIndex + 1}
        </p>
        <div className="flex items-center gap-1.5">
          {isFailed && onRegen && (
            <button
              onClick={() => onRegen(sceneIndex)}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}
            >
              Retry
            </button>
          )}
          {isComplete && clip?.videoUrl && !isRejected && (
            <a
              href={clip.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-semibold"
              style={{ color: "#D4A843" }}
            >
              <Play size={10} />
            </a>
          )}
          {canReject && !showRejectInput && (
            <button
              onClick={() => setShowRejectInput(true)}
              title="Reject & Redirect"
              className="flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "rgba(212,168,67,0.08)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.2)" }}
            >
              <CornerDownRight size={8} />
              Redirect
            </button>
          )}
        </div>
      </div>

      {/* Inline reject input */}
      {showRejectInput && (
        <div className="px-2.5 pb-2.5 space-y-1.5 border-t" style={{ borderColor: "#1E1E1E" }}>
          <p className="text-[9px] font-semibold pt-2" style={{ color: "#D4A843" }}>
            What should change?
          </p>
          <textarea
            ref={inputRef}
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRejectSubmit(); }
              if (e.key === "Escape") { setShowRejectInput(false); setRejectNote(""); }
            }}
            placeholder="Make it darker…"
            rows={2}
            className="w-full text-[10px] text-white rounded px-2 py-1 resize-none"
            style={{ backgroundColor: "#0A0A0A", border: "1px solid #2A2A2A", outline: "none" }}
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => { setShowRejectInput(false); setRejectNote(""); }}
              className="flex-1 text-[9px] font-semibold py-1 rounded"
              style={{ backgroundColor: "#1A1A1A", color: "#555" }}
            >
              Cancel
            </button>
            <button
              onClick={handleRejectSubmit}
              disabled={!rejectNote.trim() || submitting}
              className="flex-1 text-[9px] font-semibold py-1 rounded flex items-center justify-center gap-1"
              style={{
                backgroundColor: rejectNote.trim() && !submitting ? "#D4A843" : "#1A1A1A",
                color: rejectNote.trim() && !submitting ? "#0A0A0A" : "#444",
              }}
            >
              {submitting ? <Loader2 size={8} className="animate-spin" /> : null}
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small Row Arrow ─────────────────────────────────────────────────────────

function SmallArrow({ active }: { active?: boolean }) {
  return (
    <div className="flex items-center justify-center shrink-0" style={{ width: 24 }}>
      <ChevronRight size={14} style={{ color: active ? "#D4A843" : "#333" }} />
    </div>
  );
}

// ─── Final Video Node ─────────────────────────────────────────────────────────

function FinalNode({
  finalVideoUrl, thumbnailUrl, videoId, isComplete,
}: {
  finalVideoUrl?: string | null;
  thumbnailUrl?: string | null;
  videoId?: string;
  isComplete: boolean;
}) {
  return (
    <div
      className="rounded-xl border flex flex-col overflow-hidden shrink-0"
      style={{
        width: 192, minHeight: 120,
        backgroundColor: "#111",
        borderColor: isComplete ? "#D4A843" : "#1A1A1A",
      }}
    >
      {/* Thumbnail / placeholder */}
      <div className="relative flex-1 flex items-center justify-center" style={{ minHeight: 72, backgroundColor: "#0A0A0A" }}>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="Final video" className="w-full h-full object-cover" />
        ) : isComplete ? (
          <Check size={24} style={{ color: "#D4A843" }} />
        ) : (
          <Film size={24} style={{ color: "#222" }} />
        )}
      </div>

      {/* Actions */}
      <div className="px-3 py-3 space-y-2">
        <p className="text-xs font-bold" style={{ color: isComplete ? "#D4A843" : "#555" }}>
          {isComplete ? "Final Video" : "Not yet generated"}
        </p>
        {isComplete && videoId && (
          <div className="flex gap-2">
            <a
              href={`/video-studio/${videoId}/preview`}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded"
              style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}
            >
              <Play size={9} /> Preview
            </a>
            {finalVideoUrl && (
              <a
                href={finalVideoUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded"
                style={{ backgroundColor: "#1A1A1A", color: "#888" }}
              >
                <Download size={9} /> MP4
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Scene Edit Panel ─────────────────────────────────────────────────────────

function SceneEditPanel({
  scene, onClose, onSave,
}: {
  scene: WorkflowScene;
  onClose: () => void;
  onSave: (updates: Partial<WorkflowScene>) => void;
}) {
  const [description,      setDescription]      = useState(scene.description);
  const [cameraDirection,  setCameraDirection]  = useState<string>(scene.cameraDirection ?? "static_wide");

  function handleSave() {
    onSave({ description, cameraDirection });
    onClose();
  }

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex flex-col shadow-2xl"
      style={{ width: "min(420px, 100vw)", backgroundColor: "#0F0F0F", borderLeft: "1px solid #222" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1E1E1E" }}>
        <div>
          <p className="text-sm font-bold text-white">Scene {scene.index + 1}</p>
          <p className="text-xs mt-0.5 font-semibold" style={{ color: "#D4A843" }}>{scene.title}</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "#1A1A1A" }}
        >
          <X size={14} style={{ color: "#888" }} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Timing */}
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#555" }}>Timing</p>
            <p className="text-xs font-bold text-white mt-0.5">
              {fmtTime(scene.startTime)} – {fmtTime(scene.endTime)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#555" }}>Energy</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: energyColor(scene.energyLevel) }} />
              <p className="text-xs font-bold text-white">{energyLabel(scene.energyLevel)}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#555" }}>Type</p>
            <p className="text-xs font-bold text-white mt-0.5">{scene.type}</p>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
            Scene Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none resize-none transition-all"
            style={{ borderColor: "#2A2A2A" }}
            onFocus={e => (e.target.style.borderColor = "#D4A843")}
            onBlur={e => (e.target.style.borderColor = "#2A2A2A")}
          />
        </div>

        {/* Camera Direction */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
            Camera Direction
          </label>
          <CameraDirectionPicker
            value={cameraDirection as CameraDirectionKey}
            onChange={v => setCameraDirection(v)}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t" style={{ borderColor: "#1E1E1E" }}>
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          Save Scene
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkflowBoard({
  trackTitle, trackDuration, bpm, musicalKey,
  songSections, hasLyrics,
  brief, onEditBrief,
  shotList, clips = [],
  videoStatus, finalVideoUrl, thumbnailUrl, videoId,
  onEditScene, onRegenClip, onManualReject,
}: WorkflowBoardProps) {
  const [selectedScene, setSelectedScene] = useState<number | null>(null);

  const isGenerating   = videoStatus === "GENERATING" || videoStatus === "STITCHING";
  const isComplete     = videoStatus === "COMPLETE";
  const briefReady     = !!brief;
  const analysisReady  = !!songSections?.length;

  const sceneCount = shotList.length;
  const isMultiScene = sceneCount > 1;

  function handleSceneEdit(index: number, updates: Partial<WorkflowScene>) {
    onEditScene?.(index, updates);
  }

  const selectedSceneObj = selectedScene !== null ? shotList[selectedScene] : null;

  return (
    <>
      {/* CSS animation for pulse dot */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.3; transform: translateY(-50%) scale(0.8); }
          50% { opacity: 1; transform: translateY(-50%) scale(1); }
        }
      `}</style>

      {/* Board wrapper */}
      <div className="relative">
        {/* Horizontal scroll on desktop, vertical on mobile */}
        <div
          className="overflow-x-auto pb-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* ─── Desktop: horizontal flex ─────────────────────────────────────── */}
          <div
            className="hidden md:flex items-start gap-0 min-w-max"
            style={{ padding: "4px 2px" }}
          >
            {/* Track */}
            <TrackNode
              title={trackTitle}
              duration={trackDuration}
              bpm={bpm}
              musicalKey={musicalKey}
            />

            <Arrow active={analysisReady} generating={!analysisReady && isGenerating} />

            {/* Analysis */}
            <AnalysisNode sections={songSections} hasLyrics={hasLyrics} />

            <Arrow active={briefReady} generating={analysisReady && !briefReady} />

            {/* Brief */}
            <BriefNode brief={brief} onEditBrief={onEditBrief} />

            {/* FanOut to scenes */}
            {sceneCount > 0 ? (
              <FanOut count={sceneCount} active={briefReady} generating={briefReady && isGenerating} />
            ) : (
              <Arrow active={false} />
            )}

            {/* Scenes + Clips column */}
            {sceneCount > 0 && (
              <div className="flex flex-col" style={{ gap: 8 }}>
                {shotList.map((scene) => {
                  const clip = clips.find(c => c.sceneIndex === scene.index);
                  return (
                    <div key={scene.index} className="flex items-center gap-0">
                      <SceneNode
                        scene={scene}
                        isSelected={selectedScene === scene.index}
                        onClick={() => setSelectedScene(
                          selectedScene === scene.index ? null : scene.index
                        )}
                      />
                      <SmallArrow active={clip?.status === "complete"} />
                      <ClipNode
                        sceneIndex={scene.index}
                        clip={clip}
                        onRegen={onRegenClip}
                        onManualReject={onManualReject}
                        videoId={videoId}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* FanIn to final */}
            {sceneCount > 0 ? (
              <FanIn count={sceneCount} active={isComplete} generating={isGenerating} />
            ) : (
              <Arrow active={isComplete} />
            )}

            {/* Final Video */}
            <FinalNode
              finalVideoUrl={finalVideoUrl}
              thumbnailUrl={thumbnailUrl}
              videoId={videoId}
              isComplete={isComplete}
            />
          </div>

          {/* ─── Mobile: vertical stack ─────────────────────────────────────── */}
          <div className="flex flex-col gap-4 md:hidden">
            <TrackNode title={trackTitle} duration={trackDuration} bpm={bpm} musicalKey={musicalKey} />
            <div className="flex justify-center">
              <svg width="2" height="24"><line x1="1" y1="0" x2="1" y2="24" stroke={analysisReady ? "#D4A843" : "#2A2A2A"} strokeWidth="2" /></svg>
            </div>
            <AnalysisNode sections={songSections} hasLyrics={hasLyrics} />
            <div className="flex justify-center">
              <svg width="2" height="24"><line x1="1" y1="0" x2="1" y2="24" stroke={briefReady ? "#D4A843" : "#2A2A2A"} strokeWidth="2" /></svg>
            </div>
            <BriefNode brief={brief} onEditBrief={onEditBrief} />

            {sceneCount > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-center" style={{ color: "#555" }}>
                  {sceneCount} Scenes
                </p>
                {shotList.map((scene) => {
                  const clip = clips.find(c => c.sceneIndex === scene.index);
                  return (
                    <div key={scene.index} className="flex gap-2">
                      <div className="flex-1">
                        <SceneNode
                          scene={scene}
                          isSelected={selectedScene === scene.index}
                          onClick={() => setSelectedScene(
                            selectedScene === scene.index ? null : scene.index
                          )}
                        />
                      </div>
                      <ClipNode
                        sceneIndex={scene.index}
                        clip={clip}
                        onRegen={onRegenClip}
                        onManualReject={onManualReject}
                        videoId={videoId}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {isComplete && (
              <FinalNode
                finalVideoUrl={finalVideoUrl}
                thumbnailUrl={thumbnailUrl}
                videoId={videoId}
                isComplete={isComplete}
              />
            )}
          </div>
        </div>

        {/* Legend */}
        {sceneCount > 0 && (
          <div className="flex items-center gap-4 mt-2">
            {[
              { label: "Low energy", color: "#60A5FA" },
              { label: "Mid energy", color: "#D4A843" },
              { label: "High energy", color: "#E85D4A" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <p className="text-[10px]" style={{ color: "#666" }}>{label}</p>
              </div>
            ))}
            {onEditScene && (
              <p className="text-[10px] ml-auto" style={{ color: "#555" }}>
                Tap a scene to edit
              </p>
            )}
          </div>
        )}
      </div>

      {/* Scene edit panel overlay */}
      {selectedSceneObj !== null && selectedScene !== null && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setSelectedScene(null)}
          />
          <SceneEditPanel
            scene={selectedSceneObj}
            onClose={() => setSelectedScene(null)}
            onSave={(updates) => handleSceneEdit(selectedScene, updates)}
          />
        </>
      )}
    </>
  );
}
