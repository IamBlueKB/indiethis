"use client";

/**
 * src/components/avatar/AvatarPicker.tsx
 *
 * Reusable AvatarPicker — used across every tool that accepts a reference image.
 *
 * Behaviour:
 *   - Fetches the user's saved avatars on mount
 *   - If the user has a default avatar, pre-selects it automatically
 *   - One tap to switch between avatars
 *   - "Upload instead" collapses the picker and shows a standard file input
 *   - "Manage avatars" link opens /dashboard/avatar in a new tab
 *   - When an avatar is selected, calls onSelect({ url, dominantColors })
 *   - When "upload instead" is chosen, calls onUploadUrl(url) with the UT-uploaded URL
 *   - No avatars saved yet → shows a "Create your first avatar →" nudge card
 *
 * Props:
 *   onSelect        — called when an avatar is picked; provides avatarUrl + dominantColors
 *   onUploadUrl     — called when a fresh photo is uploaded instead
 *   selectedUrl     — currently selected image URL (controlled)
 *   label           — override the section heading (default "Reference Photo")
 *   compact         — renders a smaller inline version (no heading)
 *   className       — extra wrapper classes
 */

import { useEffect, useState, useRef } from "react";
import Image                           from "next/image";
import Link                            from "next/link";
import {
  Sparkles, Upload, Check, Loader2, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DominantColors {
  primary:   string;
  secondary: string;
  accent:    string;
}

interface ArtistAvatar {
  id:             string;
  name:           string;
  avatarUrl:      string;
  style:          string;
  isDefault:      boolean;
  dominantColors: DominantColors | null;
}

export interface AvatarSelectPayload {
  url:            string;
  dominantColors: DominantColors | null;
  avatarId:       string;
}

interface AvatarPickerProps {
  onSelect:      (payload: AvatarSelectPayload) => void;
  onUploadUrl?:  (url: string) => void;
  selectedUrl?:  string;
  label?:        string;
  compact?:      boolean;
  className?:    string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD   = "#D4A843";
const BG     = "#111111";
const BORDER = "#1E1E1E";
const MUTED  = "#666666";

// ─── Component ────────────────────────────────────────────────────────────────

export default function AvatarPicker({
  onSelect,
  onUploadUrl,
  selectedUrl,
  label     = "Reference Photo",
  compact   = false,
  className = "",
}: AvatarPickerProps) {
  const [avatars,    setAvatars]    = useState<ArtistAvatar[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [uploadErr,  setUploadErr]  = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch saved avatars ────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/dashboard/avatar")
      .then(r => r.json())
      .then((d: { avatars?: ArtistAvatar[] }) => {
        const list = d.avatars ?? [];
        setAvatars(list);

        // Auto-select the default avatar if nothing is selected yet
        if (!selectedUrl && list.length > 0) {
          const def = list.find(a => a.isDefault) ?? list[0];
          onSelect({ url: def.avatarUrl, dominantColors: def.dominantColors ?? null, avatarId: def.id });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Upload a fresh photo instead ──────────────────────────────────────────

  const { startUpload, isUploading } = useUploadThing("avatarSourcePhoto", {
    onClientUploadComplete: (res) => {
      const url = (res?.[0] as { serverData?: { url?: string }; url?: string } | undefined)
        ?.serverData?.url ?? res?.[0]?.url ?? "";
      if (url && onUploadUrl) onUploadUrl(url);
      setShowUpload(false);
    },
    onUploadError: (e) => {
      setUploadErr(e.message ?? "Upload failed");
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadErr("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadErr("Image must be under 8MB.");
      return;
    }
    startUpload([file]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`} style={{ color: MUTED }}>
        <Loader2 size={14} className="animate-spin" /> Loading avatars…
      </div>
    );
  }

  // No avatars yet — nudge to create one
  if (avatars.length === 0) {
    return (
      <div className={className}>
        {!compact && (
          <p className="text-xs font-semibold text-white mb-2">{label}</p>
        )}
        <Link
          href="/dashboard/avatar"
          target="_blank"
          className="flex items-center gap-3 rounded-xl border p-3 transition-all hover:border-[#D4A843]/50 no-underline"
          style={{ borderColor: BORDER, backgroundColor: BG }}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
            <Sparkles size={16} style={{ color: GOLD }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Create your avatar</p>
            <p className="text-xs" style={{ color: MUTED }}>Save a stylized portrait to reuse across tools</p>
          </div>
          <ExternalLink size={14} style={{ color: MUTED }} />
        </Link>

        {/* Fallback upload */}
        {onUploadUrl && (
          <div className="mt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
              style={{ color: MUTED }}
            >
              <Upload size={12} />
              {isUploading ? "Uploading…" : "Upload a photo instead"}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
            {uploadErr && <p className="text-[11px] mt-1" style={{ color: "#E85D4A" }}>{uploadErr}</p>}
          </div>
        )}
      </div>
    );
  }

  // Has avatars
  const visibleAvatars = compact && !expanded ? avatars.slice(0, 3) : avatars;

  return (
    <div className={className}>
      {!compact && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-white">{label}</p>
          <Link
            href="/dashboard/avatar"
            target="_blank"
            className="text-[11px] flex items-center gap-1 no-underline hover:opacity-70 transition-opacity"
            style={{ color: MUTED }}
          >
            Manage <ExternalLink size={10} />
          </Link>
        </div>
      )}

      {/* Avatar thumbnails */}
      <div className="flex items-center gap-2 flex-wrap">
        {visibleAvatars.map(avatar => {
          const isSelected = selectedUrl === avatar.avatarUrl;
          return (
            <button
              key={avatar.id}
              onClick={() => onSelect({ url: avatar.avatarUrl, dominantColors: avatar.dominantColors ?? null, avatarId: avatar.id })}
              title={avatar.name}
              className="relative shrink-0 rounded-xl overflow-hidden transition-all"
              style={{
                width:  compact ? 44 : 56,
                height: compact ? 44 : 56,
                border: `2px solid ${isSelected ? GOLD : BORDER}`,
              }}
            >
              <Image
                src={avatar.avatarUrl}
                alt={avatar.name}
                fill
                className="object-cover"
                sizes="56px"
              />
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: GOLD }}>
                    <Check size={10} style={{ color: "#0A0A0A" }} />
                  </div>
                </div>
              )}
              {avatar.isDefault && !isSelected && (
                <div
                  className="absolute bottom-0 inset-x-0 text-center text-[8px] font-bold leading-4"
                  style={{ backgroundColor: "rgba(212,168,67,0.85)", color: "#0A0A0A" }}
                >
                  DEFAULT
                </div>
              )}
            </button>
          );
        })}

        {/* Show more / less toggle when compact and >3 avatars */}
        {compact && avatars.length > 3 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="shrink-0 flex items-center justify-center rounded-xl text-[10px] font-medium transition-all"
            style={{ width: 44, height: 44, border: `2px solid ${BORDER}`, backgroundColor: BG, color: MUTED }}
          >
            {expanded ? <ChevronUp size={14} /> : <><ChevronDown size={14} /></>}
          </button>
        )}

        {/* Upload instead toggle */}
        {onUploadUrl && (
          <button
            onClick={() => setShowUpload(s => !s)}
            title="Upload a photo instead"
            className="shrink-0 flex items-center justify-center rounded-xl transition-all hover:border-[#D4A843]/40"
            style={{
              width:           compact ? 44 : 56,
              height:          compact ? 44 : 56,
              border:          `2px dashed ${showUpload ? GOLD : BORDER}`,
              backgroundColor: BG,
              color:           showUpload ? GOLD : MUTED,
            }}
          >
            <Upload size={compact ? 14 : 16} />
          </button>
        )}
      </div>

      {/* Avatar name tooltip under selected */}
      {!compact && selectedUrl && (
        <p className="text-[11px] mt-1.5" style={{ color: MUTED }}>
          {avatars.find(a => a.avatarUrl === selectedUrl)?.name ?? "Custom photo"} selected
        </p>
      )}

      {/* Inline upload zone */}
      {showUpload && onUploadUrl && (
        <div className="mt-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2 transition-all disabled:opacity-50"
            style={{ backgroundColor: "rgba(212,168,67,0.07)", color: GOLD, border: `1px solid rgba(212,168,67,0.2)` }}
          >
            {isUploading
              ? <><Loader2 size={12} className="animate-spin" /> Uploading…</>
              : <><Upload size={12} /> Choose photo</>}
          </button>
          <p className="text-[11px] mt-1" style={{ color: MUTED }}>JPG, PNG, WEBP · max 8MB</p>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
          {uploadErr && <p className="text-[11px] mt-1" style={{ color: "#E85D4A" }}>{uploadErr}</p>}
        </div>
      )}
    </div>
  );
}
