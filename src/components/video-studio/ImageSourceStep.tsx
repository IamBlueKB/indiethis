"use client";

/**
 * ImageSourceStep — wizard step for choosing the reference image.
 *
 * Three options:
 *   UPLOAD       — upload 1-3 photos; select one as primary
 *   AVATAR       — use the user's saved IndieThis avatar
 *   AI_GENERATED — describe in text, generate via Seedream V4
 *
 * The selected image URL + source are passed up via onConfirm().
 */

import { useRef, useState }   from "react";
import { Upload, User, Sparkles, X, Loader2, RefreshCw, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { useUploadThing }     from "@/lib/uploadthing-client";
import AvatarPicker, { type AvatarSelectPayload } from "@/components/avatar/AvatarPicker";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ImageSource = "UPLOAD" | "AVATAR" | "AI_GENERATED";

interface Props {
  userId:         string | null;
  userPhoto?:     string | null;   // User.photo (NextAuth session image)
  onBack:         () => void;
  onConfirm:      (imageUrl: string, source: ImageSource) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ImageSourceStep({ userId, onBack, onConfirm }: Props) {

  // Active option
  const [activeSource, setActiveSource] = useState<ImageSource | null>(null);

  // ── UPLOAD state ──────────────────────────────────────────────────────────────
  const [uploadedImages, setUploadedImages]   = useState<string[]>([]);
  const [primaryImage,   setPrimaryImage]     = useState<string | null>(null);
  const [uploadError,    setUploadError]      = useState<string | null>(null);
  const uploadInputRef                        = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("videoStudioRef", {
    onUploadError: (e) => setUploadError(e.message),
    onClientUploadComplete: (res) => {
      const urls = res.map(r => r.url).filter(Boolean);
      setUploadedImages(prev => {
        const combined = [...prev, ...urls].slice(0, 3);
        if (!primaryImage && combined.length > 0) setPrimaryImage(combined[0]);
        return combined;
      });
      setUploadError(null);
    },
  });

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const allowed = files.slice(0, 3 - uploadedImages.length);
    if (allowed.length === 0) return;
    startUpload(allowed);
    e.target.value = "";
  }

  function removeImage(url: string) {
    setUploadedImages(prev => {
      const next = prev.filter(u => u !== url);
      if (primaryImage === url) setPrimaryImage(next[0] ?? null);
      return next;
    });
  }

  // ── AVATAR state ──────────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // ── AI GENERATED state ────────────────────────────────────────────────────────
  const [aiPrompt,     setAiPrompt]     = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImageUrl,   setAiImageUrl]   = useState<string | null>(null);
  const [aiError,      setAiError]      = useState<string | null>(null);

  async function handleGenerate() {
    if (!aiPrompt.trim() || aiGenerating) return;
    setAiGenerating(true);
    setAiError(null);
    setAiImageUrl(null);
    try {
      const res  = await fetch("/api/video-studio/generate-ref-image", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.imageUrl) {
        setAiError(data.error ?? "Generation failed. Please try again.");
      } else {
        setAiImageUrl(data.imageUrl);
      }
    } catch {
      setAiError("Connection error. Please try again.");
    } finally {
      setAiGenerating(false);
    }
  }

  // ── Derive the currently selected image ───────────────────────────────────────
  const selectedImageUrl: string | null =
    activeSource === "UPLOAD"       ? (primaryImage ?? null)  :
    activeSource === "AVATAR"       ? (avatarUrl   ?? null)   :
    activeSource === "AI_GENERATED" ? (aiImageUrl  ?? null)   :
    null;

  const canContinue = !!selectedImageUrl;

  // ─── Card border helper ────────────────────────────────────────────────────────
  function cardStyle(src: ImageSource) {
    const active = activeSource === src;
    return {
      borderColor:     active ? "#D4A843" : "#2A2A2A",
      backgroundColor: active ? "rgba(212,168,67,0.06)" : "transparent",
      cursor:          "pointer",
      transition:      "border-color 0.15s, background-color 0.15s",
    } as React.CSSProperties;
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Add your visual</h1>
        <p className="text-sm mt-1" style={{ color: "#888" }}>
          Your image drives every scene in your video.
        </p>
      </div>

      {/* Option cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* ── Card 1: Upload Photos ── */}
        <button
          type="button"
          onClick={() => setActiveSource("UPLOAD")}
          className="rounded-2xl border p-5 text-left space-y-3"
          style={cardStyle("UPLOAD")}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
            <Upload size={18} style={{ color: "#D4A843" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Upload Photos</p>
            <p className="text-xs mt-0.5" style={{ color: "#888" }}>Use your own photos as the visual base</p>
          </div>
          {activeSource === "UPLOAD" && uploadedImages.length > 0 && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-auto" style={{ backgroundColor: "#D4A843" }}>
              <Check size={11} style={{ color: "#0A0A0A" }} />
            </div>
          )}
        </button>

        {/* ── Card 2: Use Avatar ── */}
        <button
          type="button"
          onClick={() => userId ? setActiveSource("AVATAR") : undefined}
          className="rounded-2xl border p-5 text-left space-y-3"
          style={userId ? cardStyle("AVATAR") : { borderColor: "#1E1E1E", backgroundColor: "transparent", cursor: "not-allowed", opacity: 0.5 }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
            <User size={18} style={{ color: "#D4A843" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Use Your Avatar</p>
            <p className="text-xs mt-0.5" style={{ color: "#888" }}>
              {userId ? "Use your IndieThis profile image" : "Sign in to use your avatar"}
            </p>
          </div>
          {activeSource === "AVATAR" && avatarUrl && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-auto" style={{ backgroundColor: "#D4A843" }}>
              <Check size={11} style={{ color: "#0A0A0A" }} />
            </div>
          )}
        </button>

        {/* ── Card 3: AI Generated ── */}
        <button
          type="button"
          onClick={() => setActiveSource("AI_GENERATED")}
          className="rounded-2xl border p-5 text-left space-y-3"
          style={cardStyle("AI_GENERATED")}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
            <Sparkles size={18} style={{ color: "#D4A843" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">AI Generated</p>
            <p className="text-xs mt-0.5" style={{ color: "#888" }}>Describe your vision and we'll create it</p>
          </div>
          {activeSource === "AI_GENERATED" && aiImageUrl && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-auto" style={{ backgroundColor: "#D4A843" }}>
              <Check size={11} style={{ color: "#0A0A0A" }} />
            </div>
          )}
        </button>
      </div>

      {/* ── Upload expanded panel ── */}
      {activeSource === "UPLOAD" && (
        <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>

          {/* Upload trigger */}
          {uploadedImages.length < 3 && (
            <>
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isUploading}
                className="w-full rounded-xl border-2 border-dashed px-6 py-8 flex flex-col items-center gap-2 transition-all"
                style={{ borderColor: "#333" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#D4A843")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#333")}
              >
                {isUploading
                  ? <Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} />
                  : <Upload size={20} style={{ color: "#D4A843" }} />
                }
                <p className="text-sm font-semibold text-white">
                  {isUploading ? "Uploading…" : "Click to upload"}
                </p>
                <p className="text-xs" style={{ color: "#666" }}>JPG, PNG, WEBP · Max 8MB · Up to {3 - uploadedImages.length} more</p>
              </button>
              {uploadError && (
                <p className="text-xs text-red-400">{uploadError}</p>
              )}
            </>
          )}

          {/* Uploaded image grid */}
          {uploadedImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>
                {uploadedImages.length > 1 ? "Select primary image" : "Uploaded"}
              </p>
              <div className="flex gap-3 flex-wrap">
                {uploadedImages.map(url => (
                  <div key={url} className="relative group">
                    <button
                      type="button"
                      onClick={() => setPrimaryImage(url)}
                      className="rounded-xl overflow-hidden border-2 transition-all block"
                      style={{ borderColor: primaryImage === url ? "#D4A843" : "#333" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-24 h-24 object-cover" />
                      {primaryImage === url && (
                        <div className="absolute inset-0 flex items-end justify-center pb-1.5" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)" }}>
                          <span className="text-[10px] font-bold" style={{ color: "#D4A843" }}>PRIMARY</span>
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: "#E85D4A" }}
                    >
                      <X size={10} style={{ color: "#fff" }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Avatar expanded panel ── */}
      {activeSource === "AVATAR" && userId && (
        <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>Your avatars</p>
          <AvatarPicker
            compact
            label="Select avatar"
            selectedUrl={avatarUrl ?? undefined}
            onSelect={(p: AvatarSelectPayload) => setAvatarUrl(p.url)}
            onUploadUrl={(url: string) => setAvatarUrl(url)}
          />
          {avatarUrl && (
            <div className="flex items-center gap-3 pt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl} alt="Avatar" className="w-12 h-12 rounded-xl object-cover" />
              <p className="text-xs" style={{ color: "#888" }}>This image will be used as the reference for every scene.</p>
            </div>
          )}
        </div>
      )}

      {/* ── AI Generated expanded panel ── */}
      {activeSource === "AI_GENERATED" && (
        <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>
              Describe your visual
            </label>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Describe the main visual — a person, a scene, a mood..."
              className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none resize-none"
              style={{ borderColor: "#333" }}
              onFocus={e => (e.target.style.borderColor = "#D4A843")}
              onBlur={e => (e.target.style.borderColor = "#333")}
            />
            <p className="text-right text-xs" style={{ color: "#555" }}>{aiPrompt.length}/500</p>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={aiGenerating || aiPrompt.trim().length < 3}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {aiGenerating
              ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
              : aiImageUrl
                ? <><RefreshCw size={14} /> Regenerate</>
                : <><Sparkles size={14} /> Generate</>
            }
          </button>

          {aiError && (
            <p className="text-xs text-red-400">{aiError}</p>
          )}

          {aiImageUrl && !aiGenerating && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>Generated</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={aiImageUrl} alt="AI generated" className="w-40 h-40 rounded-xl object-cover" />
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "#888" }}
        >
          <ChevronLeft size={16} /> Back
        </button>
        <button
          type="button"
          onClick={() => selectedImageUrl && onConfirm(selectedImageUrl, activeSource!)}
          disabled={!canContinue}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          Choose Style <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
