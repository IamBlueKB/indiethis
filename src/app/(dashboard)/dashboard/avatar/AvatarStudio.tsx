"use client";

/**
 * src/app/(dashboard)/dashboard/avatar/AvatarStudio.tsx
 *
 * Artist Avatar Studio — full creation flow + management view.
 *
 * Screens:
 *   "manage"   — grid of saved avatars (default when avatars exist)
 *   "upload"   — upload source photo (Screen 1)
 *   "style"    — pick style + name the avatar (Screen 2)
 *   "generate" — generating animation (Screen 3)
 *   "pick"     — 2×2 grid of 4 variations to select (Screen 4)
 */

import { useState, useRef, useCallback } from "react";
import Image                             from "next/image";
import {
  Upload, Sparkles, ChevronRight, ArrowLeft, Check,
  Star, UserCircle, Trash2, Loader2, X, RefreshCw,
} from "lucide-react";
import { useUploadThing }  from "@/lib/uploadthing-client";
import { AVATAR_STYLES }   from "@/lib/avatar/styles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArtistAvatar {
  id:             string;
  name:           string;
  sourcePhotoUrl: string;
  avatarUrl:      string;
  style:          string;
  isDefault:      boolean;
  dominantColors: unknown;
  createdAt:      Date | string;
}

interface AvatarVariation {
  url:    string;
  seed:   number;
  falUrl: string;
}

type Screen = "manage" | "upload" | "style" | "generate" | "pick";

const MAX_AVATARS = 3;
const GOLD        = "#D4A843";
const BG          = "#0A0A0A";
const CARD        = "#111111";
const BORDER      = "#1E1E1E";
const MUTED       = "#666666";
const CORAL       = "#E85D4A";

// ─── Component ────────────────────────────────────────────────────────────────

export default function AvatarStudio({ initialAvatars }: { initialAvatars: ArtistAvatar[] }) {
  const [avatars,       setAvatars]       = useState<ArtistAvatar[]>(initialAvatars);
  const [screen,        setScreen]        = useState<Screen>(
    initialAvatars.length > 0 ? "manage" : "upload",
  );

  // Creation flow state
  const [sourceUrl,     setSourceUrl]     = useState<string>("");
  const [sourcePreview, setSourcePreview] = useState<string>("");
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [avatarName,    setAvatarName]    = useState<string>("");
  const [variations,    setVariations]    = useState<AvatarVariation[]>([]);
  const [selectedVar,   setSelectedVar]   = useState<string>("");
  const [expandedImg,   setExpandedImg]   = useState<string | null>(null);

  // UI state
  const [uploading,     setUploading]     = useState(false);
  const [generating,    setGenerating]    = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [deleteId,      setDeleteId]      = useState<string | null>(null);
  const [settingProfile, setSettingProfile] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── UploadThing ─────────────────────────────────────────────────────────────

  const { startUpload, isUploading } = useUploadThing("avatarSourcePhoto", {
    onClientUploadComplete: (res) => {
      const url = (res?.[0] as { serverData?: { url?: string }; url?: string } | undefined)
        ?.serverData?.url ?? res?.[0]?.url ?? "";
      setSourceUrl(url);
      setUploading(false);
    },
    onUploadError: (e) => {
      setError(e.message ?? "Upload failed. Please try again.");
      setUploading(false);
    },
  });

  // ── File selection ───────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be under 8MB.");
      return;
    }
    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setSourcePreview(e.target?.result as string ?? "");
    reader.readAsDataURL(file);

    setUploading(true);
    await startUpload([file]);
  }, [startUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  // ── Generate ────────────────────────────────────────────────────────────────

  async function runGeneration() {
    if (!sourceUrl || !selectedStyle) return;
    setError(null);
    setGenerating(true);
    setScreen("generate");

    try {
      const res  = await fetch("/api/dashboard/avatar/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sourcePhotoUrl: sourceUrl, style: selectedStyle }),
      });
      const data = await res.json() as { variations?: AvatarVariation[]; error?: string };

      if (!res.ok || !data.variations?.length) {
        throw new Error(data.error ?? "Generation failed");
      }

      setVariations(data.variations);
      setSelectedVar(data.variations[0].url);
      setScreen("pick");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed. Please try again.");
      setScreen("style");
    } finally {
      setGenerating(false);
    }
  }

  // ── Save selected variation ──────────────────────────────────────────────────

  async function saveAvatar() {
    if (!selectedVar || !avatarName.trim()) return;
    setSaving(true);
    setError(null);

    const styleConfig = AVATAR_STYLES[selectedStyle];
    const promptUsed  = styleConfig
      ? `${styleConfig.promptBase}. Professional portrait of the person in the reference image, maintaining their exact facial features.`
      : undefined;

    try {
      const res  = await fetch("/api/dashboard/avatar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          sourcePhotoUrl:       sourceUrl,
          style:                selectedStyle,
          name:                 avatarName.trim(),
          selectedVariationUrl: selectedVar,
          promptUsed,
        }),
      });
      const data = await res.json() as { avatar?: ArtistAvatar; error?: string };

      if (!res.ok || !data.avatar) throw new Error(data.error ?? "Failed to save avatar");

      setAvatars(prev => [...prev, data.avatar!]);

      // Reset creation state
      setSourceUrl("");
      setSourcePreview("");
      setSelectedStyle("");
      setAvatarName("");
      setVariations([]);
      setSelectedVar("");
      setScreen("manage");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save avatar");
    } finally {
      setSaving(false);
    }
  }

  // ── Set default ──────────────────────────────────────────────────────────────

  async function setDefault(id: string) {
    setAvatars(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
    await fetch(`/api/dashboard/avatar/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isDefault: true }),
    });
  }

  // ── Set as profile photo ─────────────────────────────────────────────────────

  async function setProfilePhoto(id: string) {
    setSettingProfile(id);
    await fetch(`/api/dashboard/avatar/${id}/set-profile`, { method: "POST" });
    setSettingProfile(null);
  }

  // ── Delete avatar ────────────────────────────────────────────────────────────

  async function deleteAvatar(id: string) {
    setDeleteId(null);
    const wasDefault = avatars.find(a => a.id === id)?.isDefault;
    setAvatars(prev => {
      const remaining = prev.filter(a => a.id !== id);
      if (wasDefault && remaining.length > 0) remaining[remaining.length - 1].isDefault = true;
      return remaining;
    });
    await fetch(`/api/dashboard/avatar/${id}`, { method: "DELETE" });
    if (avatars.length === 1) setScreen("upload"); // went to 0 avatars
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: BG, color: "#F0F0F0" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b px-6 h-16 flex items-center justify-between"
        style={{ backgroundColor: "rgba(10,10,10,0.95)", borderColor: BORDER, backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-3">
          {(screen !== "manage" && screen !== "upload") && (
            <button
              onClick={() => {
                if (screen === "style")    { setScreen("upload"); }
                if (screen === "generate") { setScreen("style"); }
                if (screen === "pick")     { setScreen("style"); }
              }}
              className="text-xs font-medium transition-colors hover:text-white"
              style={{ color: MUTED }}
            >
              <ArrowLeft size={14} className="inline mr-1" />Back
            </button>
          )}
          {avatars.length > 0 && screen !== "manage" && (
            <button
              onClick={() => setScreen("manage")}
              className="text-xs font-medium transition-colors hover:text-white"
              style={{ color: MUTED }}
            >
              ← My Avatars
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
              <Sparkles size={14} style={{ color: GOLD }} />
            </div>
            <span className="text-sm font-bold text-white">Avatar Studio</span>
          </div>
        </div>

        {screen === "manage" && avatars.length < MAX_AVATARS && (
          <button
            onClick={() => { setSourceUrl(""); setSourcePreview(""); setScreen("upload"); }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ backgroundColor: `rgba(212,168,67,0.12)`, color: GOLD, border: `1px solid rgba(212,168,67,0.2)` }}
          >
            <Sparkles size={12} /> Create New
          </button>
        )}
      </header>

      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-xl">

          {/* ── Error banner ──────────────────────────────────────────────── */}
          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl p-3 text-sm" style={{ backgroundColor: "rgba(232,93,74,0.08)", border: `1px solid rgba(232,93,74,0.25)`, color: CORAL }}>
              <X size={15} className="shrink-0 mt-0.5" onClick={() => setError(null)} />
              {error}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SCREEN: MANAGE
          ════════════════════════════════════════════════════════════════ */}
          {screen === "manage" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-white">Your Avatars</h1>
                <p className="text-sm mt-1" style={{ color: MUTED }}>
                  {avatars.length < MAX_AVATARS
                    ? `${avatars.length} of ${MAX_AVATARS} avatars created.`
                    : `You have ${MAX_AVATARS} avatars. Delete one to create a new style.`}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {avatars.map(avatar => (
                  <div
                    key={avatar.id}
                    className="rounded-2xl border overflow-hidden"
                    style={{ borderColor: avatar.isDefault ? `rgba(212,168,67,0.4)` : BORDER, backgroundColor: CARD }}
                  >
                    {/* Avatar image */}
                    <div className="relative aspect-square">
                      <Image
                        src={avatar.avatarUrl}
                        alt={avatar.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 33vw"
                      />
                      {avatar.isDefault && (
                        <span
                          className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: GOLD, color: BG }}
                        >
                          DEFAULT
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white truncate">{avatar.name}</span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full shrink-0 capitalize"
                          style={{ backgroundColor: "rgba(212,168,67,0.1)", color: GOLD }}
                        >
                          {(AVATAR_STYLES[avatar.style]?.label ?? avatar.style)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {!avatar.isDefault && (
                          <button
                            onClick={() => setDefault(avatar.id)}
                            className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 rounded-lg transition-all hover:opacity-80"
                            style={{ backgroundColor: "rgba(212,168,67,0.08)", color: GOLD, border: `1px solid rgba(212,168,67,0.15)` }}
                            title="Set as default avatar in tools"
                          >
                            <Star size={11} /> Set Default
                          </button>
                        )}
                        <button
                          onClick={() => setProfilePhoto(avatar.id)}
                          disabled={settingProfile === avatar.id}
                          className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-50"
                          style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "#ccc", border: `1px solid ${BORDER}` }}
                          title="Use as your profile photo"
                        >
                          {settingProfile === avatar.id
                            ? <Loader2 size={11} className="animate-spin" />
                            : <UserCircle size={11} />}
                          Profile
                        </button>
                        <button
                          onClick={() => setDeleteId(avatar.id)}
                          className="p-1.5 rounded-lg transition-all hover:opacity-80"
                          style={{ backgroundColor: "rgba(232,93,74,0.08)", color: CORAL, border: `1px solid rgba(232,93,74,0.15)` }}
                          title="Delete avatar"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Max reached message */}
              {avatars.length >= MAX_AVATARS && (
                <p className="text-xs text-center" style={{ color: MUTED }}>
                  Maximum 3 avatars reached. Delete one to create a new style.
                </p>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SCREEN 1: UPLOAD
          ════════════════════════════════════════════════════════════════ */}
          {screen === "upload" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ backgroundColor: "rgba(212,168,67,0.12)", border: `1px solid rgba(212,168,67,0.2)` }}
                >
                  <Sparkles size={22} style={{ color: GOLD }} />
                </div>
                <h1 className="text-2xl font-black text-white">Create Your Avatar</h1>
                <p className="text-sm" style={{ color: MUTED }}>
                  Upload a clear photo. Our AI creates a stylized version you can use across all your visuals.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
                {/* Upload zone */}
                <div
                  className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 cursor-pointer transition-all hover:border-[#D4A843]/60 hover:bg-[#D4A843]/5 aspect-square"
                  style={{ borderColor: sourcePreview ? GOLD : "#2A2A2A", backgroundColor: CARD }}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {sourcePreview ? (
                    <div className="relative w-full h-full rounded-xl overflow-hidden">
                      <Image src={sourcePreview} alt="Preview" fill className="object-cover" />
                      <div
                        className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                      >
                        <RefreshCw size={20} style={{ color: "#fff" }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload size={28} style={{ color: GOLD, marginBottom: 8 }} />
                      <p className="text-sm font-semibold text-white">Drop photo here</p>
                      <p className="text-xs mt-1" style={{ color: MUTED }}>or tap to browse</p>
                      <p className="text-[11px] mt-2" style={{ color: MUTED }}>JPG, PNG, WEBP · max 8MB</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                  />
                </div>

                {/* Guidelines */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-white">Photo guidelines</p>
                  {[
                    "Use a clear, well-lit photo",
                    "Face should be visible and centered",
                    "Avoid heavy filters or sunglasses",
                    "Portrait orientation works best",
                  ].map(tip => (
                    <div key={tip} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: GOLD }} />
                      <p className="text-xs" style={{ color: "#aaa" }}>{tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              {(uploading || isUploading) && (
                <div className="flex items-center gap-2 text-sm" style={{ color: GOLD }}>
                  <Loader2 size={15} className="animate-spin" /> Uploading…
                </div>
              )}

              <button
                onClick={() => setScreen("style")}
                disabled={!sourceUrl || uploading || isUploading}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ backgroundColor: GOLD, color: BG }}
              >
                Continue <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SCREEN 2: STYLE
          ════════════════════════════════════════════════════════════════ */}
          {screen === "style" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-white">Choose Your Style</h1>
                <p className="text-sm mt-1" style={{ color: MUTED }}>
                  Pick the aesthetic that fits your sound and vibe.
                </p>
              </div>

              {/* Style grid */}
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(AVATAR_STYLES).map(([key, style]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedStyle(key)}
                    className="text-left rounded-2xl border p-3 transition-all"
                    style={{
                      borderColor:     selectedStyle === key ? GOLD : BORDER,
                      backgroundColor: selectedStyle === key ? "rgba(212,168,67,0.06)" : CARD,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white">{style.label}</span>
                      {selectedStyle === key && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: GOLD }}>
                          <Check size={11} style={{ color: BG }} />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: MUTED }}>
                      {style.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* Name field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white">Name this avatar</label>
                <input
                  type="text"
                  value={avatarName}
                  onChange={e => setAvatarName(e.target.value)}
                  placeholder="Main Look"
                  maxLength={32}
                  className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none transition-all"
                  style={{ borderColor: BORDER }}
                  onFocus={e => (e.target.style.borderColor = GOLD)}
                  onBlur={e  => (e.target.style.borderColor = BORDER)}
                />
                <p className="text-[11px]" style={{ color: MUTED }}>
                  Helps you identify avatars when you have multiple saved.
                </p>
              </div>

              <button
                onClick={runGeneration}
                disabled={!selectedStyle || !avatarName.trim()}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ backgroundColor: CORAL, color: "#fff" }}
              >
                <Sparkles size={15} /> Create Avatar
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SCREEN 3: GENERATING
          ════════════════════════════════════════════════════════════════ */}
          {screen === "generate" && generating && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(212,168,67,0.1)", border: `1px solid rgba(212,168,67,0.2)` }}
              >
                <Sparkles size={32} className="animate-pulse" style={{ color: GOLD }} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Creating your avatar…</h2>
                <p className="text-sm mt-2" style={{ color: MUTED }}>
                  Generating 4 variations. This takes about 30–60 seconds.
                </p>
              </div>
              <div className="flex gap-2">
                {[0,1,2,3].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: GOLD, animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SCREEN 4: PICK
          ════════════════════════════════════════════════════════════════ */}
          {screen === "pick" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-white">Choose Your Favourite</h1>
                <p className="text-sm mt-1" style={{ color: MUTED }}>
                  Tap any image to expand. Select the one that feels most like you.
                </p>
              </div>

              {/* 2×2 grid */}
              <div className="grid grid-cols-2 gap-3">
                {variations.map((v, i) => (
                  <div key={v.url} className="relative">
                    <button
                      onClick={() => setSelectedVar(v.url)}
                      className="relative w-full aspect-square rounded-2xl overflow-hidden transition-all"
                      style={{
                        border: `2px solid ${selectedVar === v.url ? GOLD : BORDER}`,
                      }}
                    >
                      <Image
                        src={v.url}
                        alt={`Variation ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 280px"
                      />
                      {selectedVar === v.url && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: GOLD }}>
                          <Check size={13} style={{ color: BG }} />
                        </div>
                      )}
                    </button>
                    {/* Expand button */}
                    <button
                      onClick={() => setExpandedImg(v.url)}
                      className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: "rgba(0,0,0,0.7)", color: "#eee", backdropFilter: "blur(4px)" }}
                    >
                      expand
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={saveAvatar}
                disabled={!selectedVar || saving}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ backgroundColor: GOLD, color: BG }}
              >
                {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Check size={15} /> Save This Avatar</>}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── Full-screen image expand ───────────────────────────────────────────── */}
      {expandedImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
          onClick={() => setExpandedImg(null)}
        >
          <div className="relative max-w-lg w-full aspect-square rounded-2xl overflow-hidden shadow-2xl">
            <Image src={expandedImg} alt="Avatar preview" fill className="object-cover" />
          </div>
          <button
            className="absolute top-5 right-5 p-2 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            onClick={() => setExpandedImg(null)}
          >
            <X size={18} style={{ color: "#fff" }} />
          </button>
        </div>
      )}

      {/* ── Delete confirmation modal ─────────────────────────────────────────── */}
      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
        >
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ backgroundColor: "#161616", border: `1px solid ${BORDER}` }}>
            <h3 className="text-base font-bold text-white">Delete this avatar?</h3>
            <p className="text-sm" style={{ color: MUTED }}>
              Previously generated content that used this avatar keeps its existing visuals — only the saved avatar is removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#aaa", border: `1px solid ${BORDER}` }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteAvatar(deleteId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ backgroundColor: "rgba(232,93,74,0.15)", color: CORAL, border: `1px solid rgba(232,93,74,0.3)` }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
