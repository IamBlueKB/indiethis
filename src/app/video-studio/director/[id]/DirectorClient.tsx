"use client";

/**
 * DirectorClient — Director Mode 4-phase workflow
 *
 * Phase 1: Chat with Claude (collect vision, one question at a time)
 * Phase 2: Creative Brief review (movie treatment card)
 * Phase 3: Shot List + audio-synced timeline preview
 * Phase 4: Approve + Generate (redirects to /generating)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter }                                 from "next/navigation";
import {
  Film, Clapperboard, Send, Loader2, ChevronRight,
  ChevronLeft, AlertCircle, Music2, Activity, Zap,
  Play, Pause, Clock, Camera, Wand2, Check,
  GripVertical, RefreshCw, Star,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role:      "user" | "assistant";
  content:   string;
  createdAt: string;
}

interface CreativeBrief {
  title:          string;
  logline:        string;
  tone:           string;
  colorPalette:   string[];
  visualThemes:   string[];
  narrative:      string;
  cinematography: string;
  references:     string[];
  specialNotes:   string;
}

interface ShotListScene {
  index:        number;
  title:        string;
  description:  string;
  model:        string;
  modelDisplay: string;
  modelReason:  string;
  startTime:    number;
  endTime:      number;
  duration:     number;
  type:         string;
  energyLevel:  number;
  prompt:       string;
  hasLipSync:   boolean;
}

type Phase = 1 | 2 | 3 | 4;

interface Props {
  id:                  string;
  trackTitle:          string;
  videoLength:         string;
  aspectRatio:         string;
  bpm:                 number | null;
  musicalKey:          string | null;
  energy:              number | null;
  initialConversation: ChatMessage[];
  initialBrief:        object | null;
  initialShotList:     object[] | null;
  userId:              string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  "Veo 3.1":               "#A78BFA",
  "Seedance 2.0":          "#34D399",
  "Kling 3.0 Pro":         "#D4A843",
  "Kling 2.6 Pro (Elements)": "#FB923C",
  "Seedance 1.5 Pro":      "#60A5FA",
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function DirectorClient({
  id, trackTitle, videoLength, aspectRatio,
  bpm, musicalKey, energy,
  initialConversation, initialBrief, initialShotList,
  userId,
}: Props) {
  const router = useRouter();

  // Phase — determine from initial state
  const getInitialPhase = (): Phase => {
    if (initialShotList && initialShotList.length > 0) return 3;
    if (initialBrief) return 2;
    return 1;
  };

  const [phase,       setPhase]       = useState<Phase>(getInitialPhase);
  const [messages,    setMessages]    = useState<ChatMessage[]>(initialConversation);
  const [brief,       setBrief]       = useState<CreativeBrief | null>(initialBrief as CreativeBrief | null);
  const [shotList,    setShotList]    = useState<ShotListScene[]>((initialShotList as ShotListScene[]) ?? []);

  // Chat state
  const [inputMsg,    setInputMsg]    = useState("");
  const [sending,     setSending]     = useState(false);
  const [chatError,   setChatError]   = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Brief phase
  const [genShotList, setGenShotList] = useState(false);
  const [shotListErr, setShotListErr] = useState<string | null>(null);

  // Shot list phase
  const [audioEl,     setAudioEl]     = useState<HTMLAudioElement | null>(null);
  const [playing,     setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeScene, setActiveScene] = useState<number | null>(null);
  const [dragging,    setDragging]    = useState<number | null>(null);

  // Approval
  const [guestEmail,  setGuestEmail]  = useState("");
  const [approving,   setApproving]   = useState(false);
  const [approveErr,  setApproveErr]  = useState<string | null>(null);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Audio playback tracker for shot list timeline
  useEffect(() => {
    if (!audioEl) return;
    const handler = () => {
      setCurrentTime(audioEl.currentTime);
      const active = shotList.findIndex(
        s => audioEl.currentTime >= s.startTime && audioEl.currentTime < s.endTime
      );
      setActiveScene(active >= 0 ? active : null);
    };
    audioEl.addEventListener("timeupdate", handler);
    audioEl.addEventListener("ended",     () => setPlaying(false));
    return () => { audioEl.removeEventListener("timeupdate", handler); };
  }, [audioEl, shotList]);

  // ── Initial assistant greeting ───────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 1 || messages.length > 0) return;
    // Auto-send a greeting to kick off the conversation
    const greeting: ChatMessage = {
      role:      "assistant",
      content:   `I've analyzed "${trackTitle}"${bpm ? ` — ${bpm} BPM` : ""}${musicalKey ? `, key of ${musicalKey}` : ""}. Let's craft your vision.\n\nFirst question: what's the one feeling you want people to walk away with after watching this video?`,
      createdAt: new Date().toISOString(),
    };
    setMessages([greeting]);
  }, [phase, messages.length, trackTitle, bpm, musicalKey]);

  // ── Send chat message ─────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!inputMsg.trim() || sending) return;
    setChatError(null);

    const userMsg: ChatMessage = {
      role:      "user",
      content:   inputMsg.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputMsg("");
    setSending(true);

    try {
      const res  = await fetch(`/api/video-studio/director/${id}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: userMsg.content }),
      });
      const data = await res.json();
      if (!res.ok) { setChatError(data.error ?? "Failed to send"); setSending(false); return; }

      const assistantMsg: ChatMessage = {
        role:      "assistant",
        content:   data.reply,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (data.done && data.brief) {
        setBrief(data.brief);
        setPhase(2);
      }
    } catch {
      setChatError("Connection error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  // ── Generate shot list ────────────────────────────────────────────────────────
  async function handleGenerateShotList() {
    setGenShotList(true);
    setShotListErr(null);
    try {
      const res  = await fetch(`/api/video-studio/director/${id}/shot-list`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setShotListErr(data.error ?? "Failed to generate"); setGenShotList(false); return; }
      setShotList(data.shotList ?? []);
      setPhase(3);
    } catch {
      setShotListErr("Connection error. Please try again.");
    } finally {
      setGenShotList(false);
    }
  }

  // ── Drag-reorder shot list ────────────────────────────────────────────────────
  function handleDragStart(idx: number) { setDragging(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragging === null || dragging === idx) return;
    const updated = [...shotList];
    const [moved] = updated.splice(dragging, 1);
    updated.splice(idx, 0, moved);
    // Re-index
    const reindexed = updated.map((s, i) => ({ ...s, index: i }));
    setShotList(reindexed);
    setDragging(idx);
  }
  function handleDragEnd() { setDragging(null); }

  // ── Toggle audio playback ─────────────────────────────────────────────────────
  function togglePlay() {
    if (!audioEl) return;
    if (playing) { audioEl.pause(); setPlaying(false); }
    else          { audioEl.play();  setPlaying(true);  }
  }

  // ── Jump to scene time ────────────────────────────────────────────────────────
  function jumpToScene(s: ShotListScene) {
    if (!audioEl) return;
    audioEl.currentTime = s.startTime;
    audioEl.play();
    setPlaying(true);
    setActiveScene(s.index);
  }

  // ── Approve and generate ──────────────────────────────────────────────────────
  async function handleApprove() {
    if (approving) return;
    if (!userId && !guestEmail.trim()) return;
    setApproving(true);
    setApproveErr(null);

    try {
      const res  = await fetch(`/api/video-studio/director/${id}/approve`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ guestEmail: !userId ? guestEmail.trim() : undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setApproveErr(data.error ?? "Failed to start"); setApproving(false); return; }

      if (!data.requiresPayment) {
        router.push(`/video-studio/${id}/generating`);
        return;
      }
      // Has checkout URL
      if (data.url) {
        if (!userId && guestEmail.trim()) {
          document.cookie = `videoStudio_guest=${encodeURIComponent(JSON.stringify({ email: guestEmail.trim(), videoId: id }))}; max-age=604800; path=/`;
        }
        window.location.href = data.url;
      }
    } catch {
      setApproveErr("Something went wrong. Please try again.");
    } finally {
      setApproving(false);
    }
  }

  const lengthLabel = videoLength === "SHORT" ? "Short" : videoLength === "EXTENDED" ? "Extended" : "Standard";

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0A0A0A", color: "#F0F0F0" }}>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b" style={{ backgroundColor: "#0A0A0A", borderColor: "#1E1E1E" }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
              <Film size={16} style={{ color: "#D4A843" }} />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Music Video Studio</p>
              <p className="text-[10px] leading-none mt-0.5" style={{ color: "#888" }}>Director Mode</p>
            </div>
          </div>

          {/* Phase indicator */}
          <div className="flex items-center gap-3">
            {([1, 2, 3] as Phase[]).map(p => (
              <div key={p} className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    backgroundColor: phase >= p ? "#D4A843" : "#1A1A1A",
                    color:           phase >= p ? "#0A0A0A" : "#555",
                    border:          `1px solid ${phase >= p ? "#D4A843" : "#2A2A2A"}`,
                  }}
                >
                  {phase > p ? <Check size={10} /> : p}
                </div>
                {p < 3 && <div className="w-8 h-px" style={{ backgroundColor: phase > p ? "#D4A843" : "#2A2A2A" }} />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">

        {/* Track info badge */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: "#1A1A1A" }}>
            <Music2 size={12} style={{ color: "#D4A843" }} />
            <span className="text-xs font-semibold text-white">{trackTitle}</span>
          </div>
          {bpm && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#666" }}>
              <Activity size={11} /> {bpm} BPM
            </div>
          )}
          {musicalKey && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#666" }}>
              <Music2 size={11} /> {musicalKey}
            </div>
          )}
          {energy != null && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#666" }}>
              <Zap size={11} /> {Math.round(energy * 10)}/10
            </div>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#1A1A1A", color: "#888" }}>
            {lengthLabel}
          </span>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            PHASE 1 — Chat with Claude
            ══════════════════════════════════════════════════════════════════════ */}
        {phase === 1 && (
          <div className="flex flex-col h-[calc(100vh-240px)]">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-white">Let's build your vision</h1>
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                Answer honestly — there are no wrong answers. The more specific you are, the better the result.
              </p>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-3 mt-0.5" style={{ backgroundColor: "rgba(212,168,67,0.2)" }}>
                      <Clapperboard size={13} style={{ color: "#D4A843" }} />
                    </div>
                  )}
                  <div
                    className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                    style={{
                      backgroundColor: msg.role === "user" ? "rgba(212,168,67,0.15)" : "#1A1A1A",
                      color:           msg.role === "user" ? "#F0F0F0" : "#DDD",
                      borderRadius:    msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-3 mt-0.5" style={{ backgroundColor: "rgba(212,168,67,0.2)" }}>
                    <Clapperboard size={13} style={{ color: "#D4A843" }} />
                  </div>
                  <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#1A1A1A", borderRadius: "4px 18px 18px 18px" }}>
                    <Loader2 size={14} className="animate-spin" style={{ color: "#D4A843" }} />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            {chatError && (
              <p className="text-xs text-red-400 flex items-center gap-1 mb-2">
                <AlertCircle size={11} /> {chatError}
              </p>
            )}
            <div className="flex gap-3 pt-3 border-t" style={{ borderColor: "#1E1E1E" }}>
              <input
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type your answer…"
                className="flex-1 rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none transition"
                style={{ borderColor: "#2A2A2A" }}
                onFocus={e => e.target.style.borderColor = "#D4A843"}
                onBlur={e => e.target.style.borderColor = "#2A2A2A"}
                disabled={sending}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !inputMsg.trim()}
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition disabled:opacity-40"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            PHASE 2 — Creative Brief Review
            ══════════════════════════════════════════════════════════════════════ */}
        {phase === 2 && brief && (
          <div className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
                <Star size={11} /> Creative Brief
              </div>
              <h1 className="text-3xl font-black text-white">{brief.title}</h1>
              <p className="text-base mt-2 italic" style={{ color: "#AAA" }}>{brief.logline}</p>
            </div>

            {/* Tone + color palette */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                {brief.colorPalette?.map((hex, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border border-white/10" style={{ backgroundColor: hex }} title={hex} />
                ))}
              </div>
              <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>{brief.tone}</p>
            </div>

            {/* Narrative */}
            <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "#2A2A2A", backgroundColor: "#0F0F0F" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>Narrative</p>
              <p className="text-sm leading-relaxed" style={{ color: "#CCC" }}>{brief.narrative}</p>
            </div>

            {/* Cinematography */}
            <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "#2A2A2A", backgroundColor: "#0F0F0F" }}>
              <div className="flex items-center gap-2">
                <Camera size={14} style={{ color: "#D4A843" }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>Cinematography</p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "#CCC" }}>{brief.cinematography}</p>
            </div>

            {/* Visual themes + references */}
            <div className="grid grid-cols-2 gap-4">
              {brief.visualThemes?.length > 0 && (
                <div className="rounded-2xl border p-4" style={{ borderColor: "#2A2A2A", backgroundColor: "#0F0F0F" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#555" }}>Visual Themes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {brief.visualThemes.map((t, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: "#1A1A1A", color: "#AAA" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {brief.references?.length > 0 && (
                <div className="rounded-2xl border p-4" style={{ borderColor: "#2A2A2A", backgroundColor: "#0F0F0F" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#555" }}>References</p>
                  <div className="space-y-1">
                    {brief.references.map((r, i) => (
                      <p key={i} className="text-xs" style={{ color: "#888" }}>• {r}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Continue chat or generate shot list */}
            <div className="pt-4 border-t space-y-4" style={{ borderColor: "#1E1E1E" }}>
              <p className="text-sm" style={{ color: "#888" }}>
                Happy with the brief? Generate your shot list, or go back to refine.
              </p>
              {shotListErr && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {shotListErr}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPhase(1)}
                  className="flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-xl border transition"
                  style={{ borderColor: "#2A2A2A", color: "#888" }}
                >
                  <ChevronLeft size={14} /> Refine Vision
                </button>
                <button
                  onClick={handleGenerateShotList}
                  disabled={genShotList}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {genShotList
                    ? <><Loader2 size={14} className="animate-spin" /> Generating Shot List…</>
                    : <><Wand2 size={14} /> Generate Shot List <ChevronRight size={14} /></>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            PHASE 3 — Shot List + Timeline Preview
            ══════════════════════════════════════════════════════════════════════ */}
        {phase === 3 && shotList.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Your Shot List</h1>
                <p className="text-sm mt-1" style={{ color: "#888" }}>
                  {shotList.length} scenes — drag to reorder, or approve to generate.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPhase(2)}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border"
                  style={{ borderColor: "#2A2A2A", color: "#888" }}
                >
                  <ChevronLeft size={12} /> Brief
                </button>
              </div>
            </div>

            {/* Model legend */}
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(shotList.map(s => s.modelDisplay))).map(model => (
                <div key={model} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: "#1A1A1A" }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MODEL_COLORS[model] ?? "#888" }} />
                  <span style={{ color: MODEL_COLORS[model] ?? "#888" }}>{model}</span>
                </div>
              ))}
            </div>

            {/* Scene cards */}
            <div className="space-y-2">
              {shotList.map((scene, idx) => (
                <div
                  key={scene.index}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className="rounded-xl border px-4 py-4 transition-all cursor-grab active:cursor-grabbing"
                  style={{
                    borderColor:     activeScene === idx ? "#D4A843" : dragging === idx ? "#444" : "#2A2A2A",
                    backgroundColor: activeScene === idx ? "rgba(212,168,67,0.06)" : "#0F0F0F",
                    opacity:         dragging !== null && dragging !== idx ? 0.7 : 1,
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Drag handle */}
                    <div className="mt-1 shrink-0" style={{ color: "#444" }}>
                      <GripVertical size={14} />
                    </div>

                    {/* Scene number */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ backgroundColor: MODEL_COLORS[scene.modelDisplay] ? `${MODEL_COLORS[scene.modelDisplay]}20` : "#1A1A1A", color: MODEL_COLORS[scene.modelDisplay] ?? "#888" }}
                    >
                      {idx + 1}
                    </div>

                    {/* Scene info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-white truncate">{scene.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs" style={{ color: "#666" }}>
                            {scene.startTime.toFixed(1)}s – {scene.endTime.toFixed(1)}s
                          </span>
                          <button
                            onClick={() => jumpToScene(scene)}
                            className="w-6 h-6 rounded-full flex items-center justify-center transition"
                            style={{ backgroundColor: "#1A1A1A", color: "#D4A843" }}
                          >
                            <Play size={9} className="ml-0.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: "#888" }}>{scene.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: MODEL_COLORS[scene.modelDisplay] ?? "#888" }} />
                          <span className="text-xs" style={{ color: MODEL_COLORS[scene.modelDisplay] ?? "#888" }}>{scene.modelDisplay}</span>
                        </div>
                        <span className="text-xs" style={{ color: "#555" }}>{scene.modelReason}</span>
                        {scene.hasLipSync && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(167,139,250,0.15)", color: "#A78BFA" }}>
                            Lip sync
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timeline bar */}
                  <div className="mt-3 ml-10 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#1A1A1A" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: MODEL_COLORS[scene.modelDisplay] ?? "#D4A843",
                        opacity:         activeScene === idx ? 1 : 0.5,
                        width:           "100%",
                        transform:       activeScene === idx && audioEl
                          ? `scaleX(${Math.min((currentTime - scene.startTime) / (scene.endTime - scene.startTime), 1)})`
                          : "scaleX(0)",
                        transformOrigin: "left",
                        transition:      "transform 0.2s linear",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Approve section */}
            <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "#2A2A2A", backgroundColor: "#0F0F0F" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Ready to generate?</p>
                  <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                    {shotList.length} scenes will be generated in parallel using the optimal AI models.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: "#666" }}>Production time</p>
                  <p className="text-sm font-bold" style={{ color: "#D4A843" }}>~{Math.ceil(shotList.length * 2)} min</p>
                </div>
              </div>

              {!userId && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>
                    Your email — we'll send your video here
                  </label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none"
                    style={{ borderColor: "#2A2A2A" }}
                    onFocus={e => e.target.style.borderColor = "#D4A843"}
                    onBlur={e => e.target.style.borderColor = "#2A2A2A"}
                  />
                </div>
              )}

              {approveErr && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {approveErr}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPhase(2)}
                  className="flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-xl border"
                  style={{ borderColor: "#2A2A2A", color: "#888" }}
                >
                  <ChevronLeft size={14} /> Brief
                </button>
                <button
                  onClick={handleApprove}
                  disabled={approving || (!userId && !guestEmail.trim())}
                  className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-black transition-all disabled:opacity-40"
                  style={{ backgroundColor: "#E85D4A", color: "#fff" }}
                >
                  {approving
                    ? <><Loader2 size={16} className="animate-spin" /> Starting…</>
                    : <><Film size={16} /> Generate My Video</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
