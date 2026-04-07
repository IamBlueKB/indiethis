"use client";

/**
 * GeneratingClient — progress screen for music video generation.
 *
 * Polls GET /api/video-studio/[id]/status every 5 seconds.
 * - Quick Mode: animated progress bar + stats cards
 * - Director Mode: live WorkflowBoard with per-scene clip status
 * Redirects to /video-studio/[id]/preview when COMPLETE.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter }                         from "next/navigation";
import {
  Film, Music2, Zap, Wand2, Loader2, AlertCircle,
  Activity, Clock, CheckCircle2, RefreshCw,
} from "lucide-react";

import WorkflowBoard, { type WorkflowScene, type WorkflowClip } from "@/components/video-studio/WorkflowBoard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusData {
  id:            string;
  status:        string;
  progress:      number;
  currentStep:   string | null;
  mode:          string;
  trackTitle:    string;
  trackDuration: number;
  bpm:           number | null;
  musicalKey:    string | null;
  energy:        number | null;
  finalVideoUrl: string | null;
  thumbnailUrl:  string | null;
  errorMessage:  string | null;
  sceneCount:    number;
  shotList:      WorkflowScene[];
  clips:         WorkflowClip[];
  songSections:  Array<{ type: string; startTime: number; endTime: number; energy: number }>;
  brief:         {
    title:          string;
    logline:        string;
    tone:           string;
    cinematography?: string;
    colorPalette?:  string[];
  } | null;
  amount:        number;
  createdAt:     string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  PENDING:    "Waiting to start…",
  ANALYZING:  "Analyzing your track — BPM, key, structure…",
  PLANNING:   "Planning your video — scene timing and models…",
  GENERATING: "Generating your scenes…",
  STITCHING:  "Stitching your final video…",
  COMPLETE:   "Done!",
  FAILED:     "Generation failed",
};

const STATUS_PROGRESS: Record<string, number> = {
  PENDING:    3,
  ANALYZING:  15,
  PLANNING:   30,
  GENERATING: 60,
  STITCHING:  88,
  COMPLETE:   100,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function GeneratingClient({ id }: { id: string }) {
  const router = useRouter();

  const [data,    setData]    = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/video-studio/${id}/status`);
      if (!res.ok) { setError("Video not found"); return; }
      const d: StatusData = await res.json();
      setData(d);
      setLoading(false);

      if (d.status === "COMPLETE" && d.finalVideoUrl) {
        router.push(`/video-studio/${id}/preview`);
      }
    } catch {
      setError("Connection issue — retrying…");
    }
  }, [id, router]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [poll]);

  const progress    = data ? (data.progress > 0 ? data.progress : (STATUS_PROGRESS[data.status] ?? 5)) : 3;
  const statusLabel = data ? (data.currentStep ?? STEP_LABELS[data.status] ?? "Processing…") : "Starting…";
  const isFailed    = data?.status === "FAILED";
  const isComplete  = data?.status === "COMPLETE";
  const isDirector  = data?.mode === "DIRECTOR";

  function getTimeEstimate(p: number): string {
    if (p >= 95) return "Almost done…";
    if (p >= 80) return "~1 minute";
    if (p >= 50) return "~3-5 minutes";
    if (p >= 20) return "~5-8 minutes";
    return "~8-12 minutes";
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0A0A0A", color: "#F0F0F0" }}
    >
      {/* Header */}
      <header className="border-b px-6 h-16 flex items-center gap-3" style={{ borderColor: "#1E1E1E" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
          <Film size={16} style={{ color: "#D4A843" }} />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">Music Video Studio</p>
          <p className="text-[10px] leading-none mt-0.5" style={{ color: "#888" }}>
            {isDirector ? "Director Mode" : "Quick Mode"}
          </p>
        </div>
      </header>

      <div className={`flex-1 ${isDirector ? "px-6 py-8 max-w-6xl mx-auto w-full" : "flex flex-col items-center justify-center px-6 py-16 max-w-lg mx-auto w-full"}`}>

        {loading && !data && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin" style={{ color: "#D4A843" }} />
            <p className="text-sm" style={{ color: "#888" }}>Loading…</p>
          </div>
        )}

        {/* ── Failed state ───────────────────────────────────────────────────── */}
        {isFailed && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: "rgba(232,93,74,0.1)" }}>
              <AlertCircle size={28} style={{ color: "#E85D4A" }} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">Generation failed</p>
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                {data?.errorMessage ?? "Something went wrong with your video. Our team has been notified."}
              </p>
            </div>
            <button
              onClick={() => router.push("/video-studio")}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold mx-auto"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              <RefreshCw size={14} /> Try Again
            </button>
          </div>
        )}

        {/* ── Director Mode: Workflow Board ─────────────────────────────────── */}
        {!isFailed && !isComplete && data && isDirector && (
          <div className="space-y-6">
            {/* Status header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
                  <Loader2 size={11} className="animate-spin" />
                  AI is creating your video
                </div>
                <h1 className="text-xl font-bold text-white">{data.trackTitle}</h1>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "#D4A843" }}>{statusLabel}</p>
                <p className="text-sm font-bold text-white">{Math.round(progress)}%</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#1E1E1E" }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${progress}%`, backgroundColor: "#D4A843" }}
              />
            </div>

            {/* Workflow Board — live scene status */}
            <WorkflowBoard
              trackTitle={data.trackTitle}
              trackDuration={data.trackDuration}
              bpm={data.bpm}
              musicalKey={data.musicalKey}
              songSections={data.songSections}
              brief={data.brief}
              shotList={data.shotList}
              clips={data.clips}
              videoStatus={data.status}
              finalVideoUrl={data.finalVideoUrl}
              thumbnailUrl={data.thumbnailUrl}
              videoId={id}
            />

            <p className="text-center text-xs" style={{ color: "#444" }}>
              You can safely close this tab — your video will be ready when you return.
            </p>
          </div>
        )}

        {/* ── Quick Mode: Progress cards ─────────────────────────────────────── */}
        {!isFailed && !isComplete && data && !isDirector && (
          <div className="w-full space-y-8">
            {/* Track title */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-4" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
                <Loader2 size={11} className="animate-spin" />
                AI is creating your video
              </div>
              <h1 className="text-xl font-bold text-white">{data.trackTitle}</h1>
            </div>

            {/* Progress bar */}
            <div className="space-y-3">
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#1E1E1E" }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%`, backgroundColor: "#D4A843" }}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: "#D4A843" }}>{statusLabel}</p>
                <p className="text-xs" style={{ color: "#666" }}>{Math.round(progress)}%</p>
              </div>
            </div>

            {/* Time estimate */}
            <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "#666" }}>
              <Clock size={12} />
              <span>{getTimeEstimate(progress)}</span>
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border px-4 py-4 text-center" style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
                <Activity size={16} style={{ color: data.bpm ? "#D4A843" : "#444" }} className="mx-auto mb-2" />
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#555" }}>BPM</p>
                {data.bpm ? (
                  <p className="text-xl font-black" style={{ color: "#D4A843" }}>{data.bpm}</p>
                ) : (
                  <div className="h-5 w-10 rounded mx-auto animate-pulse" style={{ backgroundColor: "#2A2A2A" }} />
                )}
              </div>
              <div className="rounded-xl border px-4 py-4 text-center" style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
                <Music2 size={16} style={{ color: data.musicalKey ? "#D4A843" : "#444" }} className="mx-auto mb-2" />
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#555" }}>Key</p>
                {data.musicalKey ? (
                  <p className="text-xl font-black" style={{ color: "#D4A843" }}>{data.musicalKey}</p>
                ) : (
                  <div className="h-5 w-8 rounded mx-auto animate-pulse" style={{ backgroundColor: "#2A2A2A" }} />
                )}
              </div>
              <div className="rounded-xl border px-4 py-4 text-center" style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
                <Zap size={16} style={{ color: data.energy !== null ? "#D4A843" : "#444" }} className="mx-auto mb-2" />
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#555" }}>Energy</p>
                {data.energy !== null ? (
                  <p className="text-xl font-black" style={{ color: "#D4A843" }}>{Math.round(data.energy * 10)}/10</p>
                ) : (
                  <div className="h-5 w-10 rounded mx-auto animate-pulse" style={{ backgroundColor: "#2A2A2A" }} />
                )}
              </div>
            </div>

            {/* Scenes count */}
            {data.sceneCount > 0 && (
              <div className="rounded-xl border px-5 py-3 flex items-center justify-between" style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
                <div className="flex items-center gap-2">
                  <Wand2 size={14} style={{ color: "#D4A843" }} />
                  <p className="text-xs font-semibold text-white">{data.sceneCount} scene{data.sceneCount !== 1 ? "s" : ""} planned</p>
                </div>
                <p className="text-xs" style={{ color: "#666" }}>Generating in parallel</p>
              </div>
            )}

            {/* Steps checklist */}
            <div className="space-y-2">
              {(["ANALYZING", "PLANNING", "GENERATING", "STITCHING"] as const).map((s, i) => {
                const statusOrder = ["PENDING", "ANALYZING", "PLANNING", "GENERATING", "STITCHING", "COMPLETE"];
                const currentIdx  = statusOrder.indexOf(data.status);
                const stepIdx     = statusOrder.indexOf(s);
                const isDone      = currentIdx > stepIdx;
                const isActive    = currentIdx === stepIdx;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: isDone ? "rgba(52,199,89,0.2)" : isActive ? "rgba(212,168,67,0.2)" : "#1A1A1A",
                        border: `1px solid ${isDone ? "#34C759" : isActive ? "#D4A843" : "#2A2A2A"}`,
                      }}>
                      {isDone
                        ? <CheckCircle2 size={12} style={{ color: "#34C759" }} />
                        : isActive
                          ? <Loader2 size={10} className="animate-spin" style={{ color: "#D4A843" }} />
                          : <span className="text-[8px]" style={{ color: "#444" }}>{i + 1}</span>}
                    </div>
                    <p className="text-xs" style={{ color: isDone ? "#AAA" : isActive ? "#D4A843" : "#555" }}>
                      {s === "ANALYZING"  ? "Analyzing audio — BPM, key, structure, lyrics" :
                       s === "PLANNING"   ? "Planning scenes with AI model router" :
                       s === "GENERATING" ? "Generating scene clips" :
                                           "Stitching clips into final video"}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs" style={{ color: "#444" }}>
              You can safely close this tab — your video will be ready when you return.
            </p>
          </div>
        )}

        {/* ── Complete (redirect should fire, but fallback button) ───────────── */}
        {isComplete && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: "rgba(52,199,89,0.1)" }}>
              <CheckCircle2 size={28} style={{ color: "#34C759" }} />
            </div>
            <p className="text-lg font-bold text-white">Your video is ready!</p>
            <button
              onClick={() => router.push(`/video-studio/${id}/preview`)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold mx-auto"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              <Film size={14} /> Watch Now
            </button>
          </div>
        )}

        {/* Connection error */}
        {error && !isFailed && (
          <p className="text-xs text-center mt-4" style={{ color: "#666" }}>
            <AlertCircle size={11} className="inline mr-1" />{error}
          </p>
        )}
      </div>
    </div>
  );
}
