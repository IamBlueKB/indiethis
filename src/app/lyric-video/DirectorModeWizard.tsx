"use client";

/**
 * src/app/lyric-video/DirectorModeWizard.tsx
 *
 * Lyric Video Studio — Director Mode Wizard (5 screens)
 *
 * Phase 0: Track input       (upload audio, title, cover art)
 * Phase 1: Creative chat     (Claude as creative director — conversation-based brief)
 * Phase 2: Section plan      (review + override per-section typography + prompts)
 * Phase 3: Confirm + Pay     (summary → Stripe checkout)
 * Phase 4: Generating        (progress poll)
 * Phase 5: Review            (video player, per-section re-gen, download)
 *
 * Pricing: $29.99 guest / $24.99 subscriber
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Loader2, Upload, CheckCircle2, AlertCircle,
  Download, Sparkles, Lock, Film, Send, RefreshCw, Star, Clapperboard,
} from "lucide-react";
import { useUploadThing }  from "@/lib/uploadthing-client";
import TypographyPreview   from "@/components/lyric-video/TypographyPreview";
import type { TypographyStyleData } from "@/components/lyric-video/TypographyPreview";
import { PRICING_DEFAULTS } from "@/lib/pricing";
import AvatarPicker, { type AvatarSelectPayload } from "@/components/avatar/AvatarPicker";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role:    "user" | "assistant";
  content: string;
}

interface SectionPlan {
  sectionIndex:       number;
  type:               string;
  lyrics:             string | null;
  startTime:          number;
  endTime:            number;
  backgroundPrompt:   string;
  typographyStyleId?: string;
}

interface JobStatus {
  id:           string;
  status:       "PENDING" | "ANALYZING" | "GENERATING" | "STITCHING" | "COMPLETE" | "FAILED";
  progress:     number;
  currentStep:  string | null;
  finalVideoUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
}

interface Props {
  guestEmail:     string;
  artistName?:    string | null;
  isSubscriber?:  boolean;
  userId?:        string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GUEST_PRICE   = PRICING_DEFAULTS.LYRIC_VIDEO_DIRECTOR_GUEST.display; // $29.99
const SUB_PRICE     = PRICING_DEFAULTS.LYRIC_VIDEO_DIRECTOR_SUB.display;   // $24.99
const POLL_INTERVAL = 4000;

const STEP_LABELS: Record<string, string> = {
  PENDING:    "Waiting to start…",
  ANALYZING:  "Analyzing your track…",
  GENERATING: "Creating custom background scenes…",
  STITCHING:  "Assembling your lyric video…",
  COMPLETE:   "Done!",
  FAILED:     "Something went wrong",
};

// ─── Utility ──────────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs flex-shrink-0" style={{ color: "#666" }}>{label}</span>
      <span className="text-xs text-right font-medium" style={{ color: "#F0F0F0" }}>{value}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DirectorModeWizard({ guestEmail, artistName, isSubscriber = false, userId = null }: Props) {
  // Phase 0
  const [audioUrl,    setAudioUrl]    = useState<string | null>(null);
  const [audioName,   setAudioName]   = useState<string>("");
  const [trackTitle,  setTrackTitle]  = useState<string>("");
  const [coverArtUrl, setCoverArtUrl] = useState<string>("");
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 1: Chat
  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [chatInput,      setChatInput]       = useState<string>("");
  const [chatLoading,    setChatLoading]     = useState(false);
  const [chatJobId,      setChatJobId]       = useState<string | null>(null); // temp job for chat context
  const [briefLocked,    setBriefLocked]     = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Phase 2: Section plan
  const [sectionPlan,    setSectionPlan]     = useState<SectionPlan[]>([]);
  const [styles,         setStyles]          = useState<TypographyStyleData[]>([]);
  const [planLoading,    setPlanLoading]     = useState(false);
  const [editingSection, setEditingSection]  = useState<number | null>(null);
  const [editPrompt,     setEditPrompt]      = useState<string>("");
  const [editStyleId,    setEditStyleId]     = useState<string>("");

  // Phase 3: Confirm
  const [checkingOut,    setCheckingOut]     = useState(false);
  const [checkoutError,  setCheckoutError]   = useState<string | null>(null);

  // Phase 4/5: Job
  const [jobId,          setJobId]           = useState<string | null>(null);
  const [jobStatus,      setJobStatus]       = useState<JobStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);

  // ── Audio upload ──────────────────────────────────────────────────────────

  const { startUpload } = useUploadThing("lyricVideoAudio", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.url ?? (res?.[0] as { serverData?: { url?: string } })?.serverData?.url ?? "";
      if (url) { setAudioUrl(url); setUploading(false); setUploadError(null); }
    },
    onUploadError: (err) => { setUploadError(err.message || "Upload failed."); setUploading(false); },
  });

  function handleAudioFile(file: File) {
    const validExts = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"];
    if (!validExts.some(ext => file.name.toLowerCase().endsWith(ext))) {
      setUploadError("Please upload an audio file (MP3, WAV, FLAC, AAC).");
      return;
    }
    if (file.size > 64 * 1024 * 1024) { setUploadError("File too large. Max 64MB."); return; }
    setAudioName(file.name);
    setUploadError(null);
    setUploading(true);
    if (!trackTitle) setTrackTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim());
    startUpload([file]);
  }

  // ── Boot conversation when entering Phase 1 ───────────────────────────────

  useEffect(() => {
    if (phase !== 1 || messages.length > 0) return;
    // Create a draft LyricVideo job to get a chatJobId for context
    fetch("/api/lyric-video/brief", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioUrl, trackTitle, coverArtUrl: coverArtUrl || null, guestEmail, mode: "director" }),
    })
      .then(r => r.json())
      .then((d: { jobId?: string; greeting?: string }) => {
        if (d.jobId) setChatJobId(d.jobId);
        const greeting = d.greeting ?? `I'm your creative director for "${trackTitle}". Tell me about the vibe, mood, story, or visuals you want for this track. What should viewers feel?`;
        setMessages([{ role: "assistant", content: greeting }]);
      })
      .catch(() => {
        setMessages([{ role: "assistant", content: `I'm your creative director for "${trackTitle}". Tell me about the vibe, mood, or story you want for this video.` }]);
      });
  }, [phase]);

  // ── Auto-scroll chat ──────────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send chat message ─────────────────────────────────────────────────────

  async function sendMessage() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    setMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const r = await fetch("/api/lyric-video/brief/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: chatJobId, message: chatInput.trim(), history: [...messages, userMsg] }),
      });
      const d: { reply?: string; briefReady?: boolean } = await r.json();
      if (d.reply) setMessages(prev => [...prev, { role: "assistant", content: d.reply! }]);
      if (d.briefReady) setBriefLocked(true);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't connect. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  // ── Lock brief + load section plan ───────────────────────────────────────

  async function handleLockBrief() {
    if (!chatJobId) return;
    setPlanLoading(true);
    try {
      // Lock the brief
      await fetch("/api/lyric-video/brief/lock", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: chatJobId }),
      });
      // Fetch section plan
      const r  = await fetch(`/api/lyric-video/section-plan?jobId=${chatJobId}`);
      const d: { sections?: SectionPlan[] } = await r.json();
      setSectionPlan(d.sections ?? []);

      // Load styles for per-section override picker
      const rs = await fetch("/api/lyric-video/styles");
      const ds: { styles?: TypographyStyleData[] } = await rs.json();
      setStyles(ds.styles ?? []);

      setPhase(2);
    } catch {/* non-fatal */}
    finally { setPlanLoading(false); }
  }

  // ── Section edit ──────────────────────────────────────────────────────────

  function startEdit(section: SectionPlan) {
    setEditingSection(section.sectionIndex);
    setEditPrompt(section.backgroundPrompt);
    setEditStyleId(section.typographyStyleId ?? "");
  }

  function saveEdit() {
    if (editingSection === null) return;
    setSectionPlan(prev => prev.map(s =>
      s.sectionIndex === editingSection
        ? { ...s, backgroundPrompt: editPrompt, typographyStyleId: editStyleId || s.typographyStyleId }
        : s
    ));
    setEditingSection(null);
  }

  // ── Poll ──────────────────────────────────────────────────────────────────

  const pollJob = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/lyric-video/status?jobId=${id}`);
      if (!r.ok) return;
      const d: JobStatus = await r.json();
      setJobStatus(d);
      if (d.status === "COMPLETE") { clearInterval(pollRef.current!); setPhase(5); }
      if (d.status === "FAILED")   { clearInterval(pollRef.current!); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (phase !== 4 || !jobId) return;
    pollJob(jobId);
    pollRef.current = setInterval(() => pollJob(jobId), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, jobId, pollJob]);

  // ── Check Stripe return ───────────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1" && params.get("mode") === "director") {
      const jId = params.get("jobId");
      if (jId) { setJobId(jId); setPhase(4); }
    }
  }, []);

  // ── Checkout ──────────────────────────────────────────────────────────────

  async function handleCheckout() {
    if (!chatJobId) return;
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const r = await fetch("/api/lyric-video/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode:        "director",
          existingJobId: chatJobId,
          sectionPlan,
          isSubscriber,
        }),
      });
      const d: { url?: string; error?: string } = await r.json();
      if (!r.ok || d.error) { setCheckoutError(d.error ?? "Checkout failed."); setCheckingOut(false); return; }
      if (d.url) window.location.href = d.url;
    } catch { setCheckoutError("Network error."); setCheckingOut(false); }
  }

  // ─── Phase renderers ─────────────────────────────────────────────────────

  // Phase 0: Track upload
  if (phase === 0) return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <Clapperboard size={26} className="mx-auto" style={{ color: "#D4A843" }} />
        <p className="font-bold text-white text-lg">Director Mode</p>
        <p className="text-sm" style={{ color: "#888" }}>Chat with an AI creative director to craft your vision</p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleAudioFile(f); }}
        className="w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer"
        style={{ borderColor: audioUrl ? "#D4A843" : "#2A2A2A", backgroundColor: audioUrl ? "rgba(212,168,67,0.05)" : "#0F0F0F", minHeight: "110px", padding: "20px" }}
      >
        {uploading ? (
          <><Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} /><p className="text-sm" style={{ color: "#888" }}>Uploading…</p></>
        ) : audioUrl ? (
          <>
            <CheckCircle2 size={20} style={{ color: "#D4A843" }} />
            <p className="text-sm font-semibold text-white">{audioName}</p>
            <button onClick={(e) => { e.stopPropagation(); setAudioUrl(null); setAudioName(""); }} className="text-xs" style={{ color: "#666" }}>Change</button>
          </>
        ) : (
          <>
            <Upload size={18} style={{ color: "#D4A843" }} />
            <p className="text-sm font-semibold text-white">Drop audio or click to upload</p>
            <p className="text-xs" style={{ color: "#666" }}>MP3, WAV, FLAC, AAC · max 64MB</p>
          </>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.flac,.aac" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAudioFile(f); }} />
      {uploadError && <p className="text-xs" style={{ color: "#E85D4A" }}>{uploadError}</p>}

      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{ color: "#888" }}>Track Title</label>
        <input type="text" placeholder="e.g. Midnight Drive" value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)}
          className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none"
          style={{ borderColor: "#2A2A2A" }}
          onFocus={(e) => (e.target.style.borderColor = "#D4A843")}
          onBlur={(e) => (e.target.style.borderColor = "#2A2A2A")}
        />
      </div>

      {/* Cover art / avatar reference */}
      {userId ? (
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "#1E1E1E", backgroundColor: "#111" }}>
          <p className="text-xs font-semibold text-white">Artist Reference <span style={{ color: "#555", fontWeight: 400 }}>(optional)</span></p>
          <AvatarPicker
            compact
            label="Artist Reference"
            selectedUrl={coverArtUrl || undefined}
            onSelect={(p: AvatarSelectPayload) => setCoverArtUrl(p.url)}
            onUploadUrl={(url: string) => setCoverArtUrl(url)}
          />
        </div>
      ) : (
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: "#888" }}>Cover Art URL <span style={{ color: "#555", fontWeight: 400 }}>(optional)</span></label>
          <input type="url" placeholder="https://…" value={coverArtUrl} onChange={(e) => setCoverArtUrl(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none"
            style={{ borderColor: "#2A2A2A" }}
            onFocus={(e) => (e.target.style.borderColor = "#D4A843")}
            onBlur={(e) => (e.target.style.borderColor = "#2A2A2A")}
          />
        </div>
      )}

      <button onClick={() => setPhase(1)} disabled={!audioUrl || !trackTitle.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
      >
        Start Creative Session <ChevronRight size={15} />
      </button>
    </div>
  );

  // Phase 1: Creative chat
  if (phase === 1) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setPhase(0)} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft size={16} style={{ color: "#888" }} />
        </button>
        <div>
          <p className="font-bold text-white">Creative Director</p>
          <p className="text-xs" style={{ color: "#888" }}>Chat to define your vision · 2–4 messages recommended</p>
        </div>
      </div>

      {/* Chat log */}
      <div
        className="rounded-xl border overflow-y-auto space-y-3"
        style={{ borderColor: "#1A1A1A", backgroundColor: "#0D0D0D", maxHeight: "320px", padding: "16px" }}
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin" style={{ color: "#D4A843" }} />
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm"
              style={{
                backgroundColor: msg.role === "user" ? "#D4A843" : "#1A1A1A",
                color:           msg.role === "user" ? "#0A0A0A" : "#F0F0F0",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3.5 py-2.5" style={{ backgroundColor: "#1A1A1A" }}>
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#D4A843", animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#D4A843", animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#D4A843", animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Describe your vision…"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          className="flex-1 rounded-xl border px-4 py-2.5 text-sm bg-transparent text-white outline-none"
          style={{ borderColor: "#2A2A2A" }}
          onFocus={(e) => (e.target.style.borderColor = "#D4A843")}
          onBlur={(e) => (e.target.style.borderColor = "#2A2A2A")}
        />
        <button onClick={sendMessage} disabled={!chatInput.trim() || chatLoading}
          className="px-3 py-2.5 rounded-xl disabled:opacity-40"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Send size={15} />
        </button>
      </div>

      {messages.length >= 3 && (
        <button onClick={handleLockBrief} disabled={planLoading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          {planLoading ? (
            <><Loader2 size={15} className="animate-spin" /> Building your section plan…</>
          ) : (
            <><CheckCircle2 size={15} /> Lock Brief &amp; Build Section Plan</>
          )}
        </button>
      )}
    </div>
  );

  // Phase 2: Section plan editor
  if (phase === 2) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setPhase(1)} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft size={16} style={{ color: "#888" }} />
        </button>
        <div>
          <p className="font-bold text-white">Section Plan</p>
          <p className="text-xs" style={{ color: "#888" }}>Review and customize each section</p>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {sectionPlan.map((section) => {
          const styleLabel = styles.find(s => s.id === (section.typographyStyleId ?? ""))?.displayName;
          return (
            <div key={section.sectionIndex} className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                    style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
                  >
                    {section.type}
                  </span>
                  <span className="text-xs" style={{ color: "#666" }}>
                    {Math.floor(section.startTime / 60)}:{String(Math.round(section.startTime % 60)).padStart(2, "0")}–
                    {Math.floor(section.endTime / 60)}:{String(Math.round(section.endTime % 60)).padStart(2, "0")}
                  </span>
                </div>
                <button
                  onClick={() => editingSection === section.sectionIndex ? saveEdit() : startEdit(section)}
                  className="text-xs font-semibold"
                  style={{ color: editingSection === section.sectionIndex ? "#D4A843" : "#666" }}
                >
                  {editingSection === section.sectionIndex ? "Save" : "Edit"}
                </button>
              </div>

              {section.lyrics && (
                <p className="text-xs italic" style={{ color: "#777" }}>&quot;{section.lyrics.slice(0, 60)}{section.lyrics.length > 60 ? "…" : ""}&quot;</p>
              )}

              {editingSection === section.sectionIndex ? (
                <div className="space-y-2 pt-1">
                  <textarea
                    rows={2}
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Background scene description…"
                    className="w-full rounded-lg border px-3 py-2 text-xs bg-transparent text-white outline-none resize-none"
                    style={{ borderColor: "#D4A843" }}
                  />
                  <select
                    value={editStyleId}
                    onChange={(e) => setEditStyleId(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-xs bg-transparent text-white outline-none"
                    style={{ borderColor: "#2A2A2A", backgroundColor: "#1A1A1A" }}
                  >
                    <option value="">— Default style —</option>
                    {styles.map(s => (
                      <option key={s.id} value={s.id}>{s.displayName}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <p className="text-xs" style={{ color: "#888" }}>{section.backgroundPrompt.slice(0, 80)}{section.backgroundPrompt.length > 80 ? "…" : ""}</p>
                  {styleLabel && <p className="text-[11px]" style={{ color: "#555" }}>Style: {styleLabel}</p>}
                </>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={() => setPhase(3)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
      >
        Confirm Plan <ChevronRight size={15} />
      </button>
    </div>
  );

  // Phase 3: Confirm + Pay
  if (phase === 3) return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setPhase(2)} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft size={16} style={{ color: "#888" }} />
        </button>
        <div>
          <p className="font-bold text-white text-lg">Confirm &amp; Pay</p>
          <p className="text-xs" style={{ color: "#888" }}>Director Mode — fully customized</p>
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
        <SummaryRow label="Track" value={trackTitle} />
        <SummaryRow label="Sections" value={`${sectionPlan.length} sections`} />
        <div className="border-t pt-3" style={{ borderColor: "#222" }}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-white">Director Mode</span>
            <span className="text-lg font-black" style={{ color: "#D4A843" }}>
              {isSubscriber ? SUB_PRICE : GUEST_PRICE}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "#666" }}>Custom backgrounds per section · per-section typography · instant download</p>
        </div>
      </div>

      {[
        "Custom AI scene for every song section",
        "Per-section typography style overrides",
        "Claude-crafted creative brief",
        "MP4 download in 1080p",
      ].map((f) => (
        <div key={f} className="flex items-center gap-2 text-xs" style={{ color: "#888" }}>
          <CheckCircle2 size={12} style={{ color: "#D4A843" }} /> {f}
        </div>
      ))}

      {checkoutError && <p className="text-xs" style={{ color: "#E85D4A" }}>{checkoutError}</p>}

      <button onClick={handleCheckout} disabled={checkingOut}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold disabled:opacity-50"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
      >
        {checkingOut ? (
          <><Loader2 size={15} className="animate-spin" /> Processing…</>
        ) : (
          <><Lock size={13} /> Pay {isSubscriber ? SUB_PRICE : GUEST_PRICE} &amp; Generate</>
        )}
      </button>
      <p className="text-center text-xs" style={{ color: "#555" }}>Secured by Stripe. No account needed.</p>
    </div>
  );

  // Phase 4: Generating
  if (phase === 4) return (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.2)" }}>
        <Clapperboard size={26} style={{ color: "#D4A843" }} className="animate-pulse" />
      </div>
      <div className="space-y-1">
        <p className="font-bold text-white text-lg">Crafting Your Director Cut</p>
        <p className="text-sm" style={{ color: "#888" }}>{jobStatus ? STEP_LABELS[jobStatus.status] ?? "Working…" : "Starting…"}</p>
      </div>
      <div className="space-y-2">
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#1A1A1A" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${jobStatus?.progress ?? 5}%`, backgroundColor: "#D4A843" }} />
        </div>
        <p className="text-xs text-right" style={{ color: "#666" }}>{jobStatus?.progress ?? 5}%</p>
      </div>
      {jobStatus?.status === "FAILED" && (
        <div className="rounded-xl border p-4 text-left" style={{ borderColor: "#E85D4A33", backgroundColor: "rgba(232,93,74,0.05)" }}>
          <div className="flex items-start gap-2">
            <AlertCircle size={15} style={{ color: "#E85D4A", flexShrink: 0, marginTop: 1 }} />
            <p className="text-sm" style={{ color: "#E85D4A" }}>{jobStatus.errorMessage ?? "Generation failed. Please contact support."}</p>
          </div>
        </div>
      )}
      <p className="text-xs" style={{ color: "#555" }}>Director Mode typically takes 5–12 minutes. We&apos;ll email you when it&apos;s ready.</p>
    </div>
  );

  // Phase 5: Review
  if (phase === 5) return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <CheckCircle2 size={28} className="mx-auto" style={{ color: "#D4A843" }} />
        <p className="font-bold text-white text-lg">Director Cut Complete!</p>
        <p className="text-sm" style={{ color: "#888" }}>{trackTitle}</p>
      </div>
      {jobStatus?.finalVideoUrl && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#0A0A0A" }}>
          <video src={jobStatus.finalVideoUrl} poster={jobStatus.thumbnailUrl ?? undefined} controls className="w-full" style={{ maxHeight: "240px" }} />
        </div>
      )}
      {jobStatus?.finalVideoUrl && (
        <a href={jobStatus.finalVideoUrl} download={`${trackTitle} - Director Cut.mp4`}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Download size={15} /> Download MP4
        </a>
      )}
      {!isSubscriber && (
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
          <div className="flex items-center gap-2">
            <Star size={14} style={{ color: "#D4A843" }} />
            <p className="text-sm font-bold text-white">Unlock unlimited lyric videos</p>
          </div>
          <p className="text-xs" style={{ color: "#888" }}>Subscribe to IndieThis for monthly credits and 10+ AI tools.</p>
          <a href="/pricing" className="block text-center py-2 rounded-lg text-xs font-bold mt-1" style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
            View Plans from $9.99/mo →
          </a>
        </div>
      )}
    </div>
  );

  return null;
}
