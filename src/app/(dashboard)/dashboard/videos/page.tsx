"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Trash2, ExternalLink, GripVertical, Upload, Link as LinkIcon,
  Eye, EyeOff, Pencil, X, Check, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ───────────────────────────────────────────────────────────────────

type VideoType     = "UPLOAD" | "YOUTUBE" | "VIMEO";
type VideoCategory = "LIVE" | "SESSION" | "FREESTYLE" | "BTS" | "ACOUSTIC" | "REHEARSAL";

type LinkedProduct = { id: string; title: string; coverArtUrl?: string | null; imageUrl?: string | null };

type Video = {
  id:             string;
  title:          string;
  description?:   string | null;
  videoUrl?:      string | null;
  thumbnailUrl?:  string | null;
  embedUrl?:      string | null;
  type:           VideoType;
  category?:      VideoCategory | null;
  duration?:      number | null;
  sortOrder:      number;
  isPublished:    boolean;
  isYoutubeSynced: boolean;
  linkedTrackId?:  string | null;
  linkedBeatId?:   string | null;
  linkedMerchId?:  string | null;
  createdAt:      string;
  linkedTrack?:   LinkedProduct | null;
  linkedBeat?:    LinkedProduct | null;
  linkedMerch?:   LinkedProduct | null;
};

type ProductItem = { id: string; title: string; coverArtUrl?: string | null; imageUrl?: string | null };
type Products = { tracks: ProductItem[]; beats: ProductItem[]; merch: ProductItem[] };

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES: VideoCategory[] = ["LIVE", "SESSION", "FREESTYLE", "BTS", "ACOUSTIC", "REHEARSAL"];

const CATEGORY_COLORS: Record<VideoCategory, string> = {
  LIVE:      "#E85D4A",
  SESSION:   "#D4A843",
  FREESTYLE: "#fff",
  BTS:       "#999",
  ACOUSTIC:  "#1D9E74",
  REHEARSAL: "#7B77DD",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectVideoType(url: string): { type: "YOUTUBE" | "VIMEO" | null; embedUrl: string | null } {
  if (/youtube\.com|youtu\.be/.test(url)) {
    const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    const id = match?.[1];
    return { type: "YOUTUBE", embedUrl: id ? `https://www.youtube.com/embed/${id}` : null };
  }
  if (/vimeo\.com/.test(url)) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    const id = match?.[1];
    return { type: "VIMEO", embedUrl: id ? `https://player.vimeo.com/video/${id}` : null };
  }
  return { type: null, embedUrl: null };
}

function sourceBadge(video: Video): { label: string; color: string } {
  if (video.type === "UPLOAD") return { label: "Upload", color: "#D4A843" };
  if (video.isYoutubeSynced) return { label: "YouTube · Synced", color: "#E85D4A" };
  if (video.type === "YOUTUBE") return { label: "YouTube", color: "#E85D4A" };
  return { label: "Vimeo", color: "#9B9BFF" };
}

function getLinkedProduct(video: Video): { product: LinkedProduct; tab: "track" | "beat" | "merch" } | null {
  if (video.linkedTrack) return { product: video.linkedTrack, tab: "track" };
  if (video.linkedBeat)  return { product: video.linkedBeat,  tab: "beat"  };
  if (video.linkedMerch) return { product: video.linkedMerch, tab: "merch" };
  return null;
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

function EditModal({ video, onClose, onSave }: {
  video: Video;
  onClose: () => void;
  onSave: (updated: Video) => void;
}) {
  const [title,       setTitle]       = useState(video.title);
  const [description, setDescription] = useState(video.description ?? "");
  const [category,    setCategory]    = useState<VideoCategory | "">(video.category ?? "");
  const [saving,      setSaving]      = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { description: description || null, category: category || null };
      if (!video.isYoutubeSynced) body.title = title.trim() || video.title;

      const res = await fetch(`/api/dashboard/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { video: updated } = await res.json();
      onSave(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      backgroundColor: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 28, width: "100%", maxWidth: 460 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Edit Video</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555" }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "#666", fontWeight: 600, display: "block", marginBottom: 5 }}>TITLE</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={video.isYoutubeSynced}
              placeholder="Video title"
              style={{ backgroundColor: "#0D0D0D", opacity: video.isYoutubeSynced ? 0.5 : 1 }}
            />
            {video.isYoutubeSynced && (
              <p style={{ fontSize: 11, color: "#555", marginTop: 5 }}>Title is managed by YouTube sync.</p>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#666", fontWeight: 600, display: "block", marginBottom: 5 }}>DESCRIPTION</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              style={{
                width: "100%", backgroundColor: "#0D0D0D", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "#ccc", padding: "8px 12px", fontSize: 13, resize: "vertical",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#666", fontWeight: 600, display: "block", marginBottom: 5 }}>CATEGORY</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as VideoCategory | "")}
              style={{
                width: "100%", backgroundColor: "#0D0D0D", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "#ccc", padding: "8px 12px", fontSize: 13,
              }}
            >
              <option value="">No category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
            background: "none", color: "#777", fontSize: 13, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "8px 18px", borderRadius: 8, border: "none",
            backgroundColor: saving ? "#333" : "#D4A843",
            color: saving ? "#888" : "#0A0A0A",
            fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
          }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Link to Product Modal ────────────────────────────────────────────────────

type ProductTab = "track" | "beat" | "merch";

function LinkProductModal({ video, onClose, onLinked }: {
  video: Video;
  onClose: () => void;
  onLinked: (updated: Video) => void;
}) {
  const [tab,      setTab]      = useState<ProductTab>("track");
  const [products, setProducts] = useState<Products | null>(null);
  const [search,   setSearch]   = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/videos/products")
      .then((r) => r.json())
      .then(setProducts);
  }, []);

  const currentLinked = getLinkedProduct(video);

  const items: ProductItem[] = products
    ? (tab === "track" ? products.tracks : tab === "beat" ? products.beats : products.merch)
    : [];

  const filtered = items.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = async (item: ProductItem) => {
    setSaving(true);
    const key = tab === "track" ? "linkedTrackId" : tab === "beat" ? "linkedBeatId" : "linkedMerchId";
    try {
      const res = await fetch(`/api/dashboard/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: item.id }),
      });
      const { video: updated } = await res.json();
      onLinked(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeLink: true }),
      });
      const { video: updated } = await res.json();
      onLinked(updated);
    } finally {
      setSaving(false);
    }
  };

  const tabStyle = (t: ProductTab) => ({
    padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
    backgroundColor: tab === t ? "#D4A843" : "transparent",
    color: tab === t ? "#0A0A0A" : "#555",
    border: tab === t ? "none" : "1px solid rgba(255,255,255,0.08)",
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      backgroundColor: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 28, width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Link to Product</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555" }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 12, color: "#555", marginBottom: 18 }}>
          Linking <span style={{ color: "#ccc" }}>&ldquo;{video.title}&rdquo;</span> — only one product per video.
        </p>

        {/* Current link */}
        {currentLinked && (
          <div style={{ backgroundColor: "#0D0D0D", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {(currentLinked.product.coverArtUrl || currentLinked.product.imageUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(currentLinked.product.coverArtUrl ?? currentLinked.product.imageUrl) || ""}
                  alt=""
                  style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4 }}
                />
              )}
              <div>
                <div style={{ fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Currently linked · {currentLinked.tab}
                </div>
                <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{currentLinked.product.title}</div>
              </div>
            </div>
            <button
              onClick={handleRemove}
              disabled={saving}
              style={{ fontSize: 11, color: "#E85D4A", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Remove
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["track", "beat", "merch"] as ProductTab[]).map((t) => (
            <button key={t} onClick={() => { setTab(t); setSearch(""); }} style={tabStyle(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}s
            </button>
          ))}
        </div>

        {/* Search */}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${tab}s…`}
          style={{ backgroundColor: "#0D0D0D", marginBottom: 12 }}
        />

        {/* Product list */}
        <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {!products ? (
            <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: 24 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: 24 }}>
              {items.length === 0 ? `No ${tab}s found.` : "No results."}
            </div>
          ) : filtered.map((item) => {
            const isSelected = (
              (tab === "track" && video.linkedTrackId === item.id) ||
              (tab === "beat"  && video.linkedBeatId  === item.id) ||
              (tab === "merch" && video.linkedMerchId === item.id)
            );
            const thumb = item.coverArtUrl ?? item.imageUrl;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                disabled={saving || isSelected}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                  borderRadius: 8, border: isSelected ? "1px solid #D4A843" : "1px solid rgba(255,255,255,0.05)",
                  backgroundColor: isSelected ? "rgba(212,168,67,0.08)" : "#0D0D0D",
                  cursor: isSelected ? "default" : "pointer", textAlign: "left",
                }}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 36, height: 36, backgroundColor: "#1a1a1a", borderRadius: 4, flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 13, color: isSelected ? "#D4A843" : "#ccc", fontWeight: isSelected ? 700 : 400, flex: 1 }}>
                  {item.title}
                </span>
                {isSelected && <Check size={14} style={{ color: "#D4A843", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Video Row ────────────────────────────────────────────────────────────────

function VideoRow({ video, onDelete, onUpdate, onLinkClick, isDragging, dragHandlers }: {
  video:        Video;
  onDelete:     (id: string) => void;
  onUpdate:     (updated: Video) => void;
  onLinkClick:  (video: Video) => void;
  isDragging:   boolean;
  dragHandlers: {
    onDragStart: (e: React.DragEvent) => void;
    onDragOver:  (e: React.DragEvent) => void;
    onDrop:      (e: React.DragEvent) => void;
    onDragEnd:   () => void;
  };
}) {
  const [editing,  setEditing]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${video.title}"?`)) return;
    setDeleting(true);
    await fetch(`/api/dashboard/videos/${video.id}`, { method: "DELETE" });
    onDelete(video.id);
  };

  const handleToggle = async () => {
    const res = await fetch(`/api/dashboard/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !video.isPublished }),
    });
    const { video: updated } = await res.json();
    onUpdate(updated);
  };

  const { label: sourceLabel, color: sourceColor } = sourceBadge(video);
  const catColor = video.category ? CATEGORY_COLORS[video.category] : "#666";
  const linked   = getLinkedProduct(video);

  return (
    <>
      <div
        draggable
        {...dragHandlers}
        style={{
          backgroundColor: isDragging ? "#181818" : "#0D0D0D",
          border: isDragging ? "1px solid #D4A84360" : "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
          padding: "12px 14px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          opacity: video.isPublished ? 1 : 0.5,
          transition: "border-color 0.15s, background-color 0.15s",
          cursor: isDragging ? "grabbing" : "default",
        }}
      >
        {/* Drag handle */}
        <div style={{ color: "#2a2a2a", cursor: "grab", flexShrink: 0, paddingTop: 1 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#555")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#2a2a2a")}
        >
          <GripVertical size={14} />
        </div>

        {/* Thumbnail */}
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" style={{ width: 64, height: 44, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
        ) : (
          <div style={{ width: 64, height: 44, backgroundColor: "#1a1a1a", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 20 }}>🎬</span>
          </div>
        )}

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title + badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
              {video.title}
            </span>
            <span style={{ fontSize: 9, fontWeight: 800, color: sourceColor, border: `1px solid ${sourceColor}40`, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.5px", flexShrink: 0 }}>
              {sourceLabel}
            </span>
            {video.category && (
              <span style={{ fontSize: 9, fontWeight: 800, color: catColor, border: `1px solid ${catColor}40`, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.5px", flexShrink: 0 }}>
                {video.category}
              </span>
            )}
          </div>

          {/* Linked product */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {linked ? (
              <>
                {(linked.product.coverArtUrl ?? linked.product.imageUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(linked.product.coverArtUrl ?? linked.product.imageUrl) || ""}
                    alt=""
                    style={{ width: 18, height: 18, objectFit: "cover", borderRadius: 3 }}
                  />
                )}
                <span style={{ fontSize: 11, color: "#D4A843", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {linked.product.title}
                </span>
                <span style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {linked.tab}
                </span>
                <button
                  onClick={() => onLinkClick(video)}
                  style={{ fontSize: 10, color: "#444", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
                >
                  <Pencil size={10} />
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 11, color: "#444" }}>No product linked</span>
                <button
                  onClick={() => onLinkClick(video)}
                  style={{
                    fontSize: 10, fontWeight: 700, color: "#D4A843",
                    background: "none", border: "1px solid #D4A84340",
                    borderRadius: 4, padding: "1px 8px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 3,
                  }}
                >
                  <LinkIcon size={9} /> Link
                </button>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 2, flexShrink: 0, alignItems: "center" }}>
          <button
            onClick={handleToggle}
            title={video.isPublished ? "Unpublish" : "Publish"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: video.isPublished ? "#D4A843" : "#333" }}
          >
            {video.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          {(video.videoUrl || video.embedUrl) && (
            <a
              href={video.videoUrl || video.embedUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: 6, color: "#444", display: "flex", alignItems: "center" }}
            >
              <ExternalLink size={14} />
            </a>
          )}
          <button
            onClick={() => setEditing(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "#444" }}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: deleting ? "#222" : "#3a3a3a" }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing && (
        <EditModal
          video={video}
          onClose={() => setEditing(false)}
          onSave={(updated) => { onUpdate(updated); setEditing(false); }}
        />
      )}
    </>
  );
}

// ─── Upload Form ──────────────────────────────────────────────────────────────

function UploadForm({ onSuccess }: { onSuccess: (v: Video) => void }) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState<VideoCategory>("LIVE");
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !title.trim()) { alert("Please enter a title first."); return; }
    setUploading(true);
    setProgress(10);
    try {
      const res = await fetch("/api/dashboard/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      });
      const { uploadUrl, videoUrl } = await res.json();
      setProgress(30);
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setProgress(70);
      const save = await fetch("/api/dashboard/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, videoUrl, type: "UPLOAD", category }),
      });
      const { video } = await save.json();
      setProgress(100);
      onSuccess(video);
      setTitle(""); setDescription(""); setCategory("LIVE");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      console.error(err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div style={{ backgroundColor: "#0D0D0D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Upload size={13} style={{ color: "#D4A843" }} /> Upload Video
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title (required)" style={{ backgroundColor: "#111" }} />
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" style={{ backgroundColor: "#111" }} />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as VideoCategory)}
          style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#ccc", padding: "8px 12px", fontSize: 13 }}
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/mov,video/webm,video/quicktime"
            onChange={handleFile}
            disabled={uploading || !title.trim()}
            style={{ display: "none" }}
            id="video-file-input"
          />
          <label
            htmlFor="video-file-input"
            style={{
              display: "block", width: "100%", padding: "10px 16px", borderRadius: 8, textAlign: "center",
              backgroundColor: (uploading || !title.trim()) ? "#1a1a1a" : "#D4A843",
              color: (uploading || !title.trim()) ? "#555" : "#0A0A0A",
              cursor: (uploading || !title.trim()) ? "not-allowed" : "pointer",
              fontWeight: 700, fontSize: 13, userSelect: "none",
            }}
          >
            {uploading ? `Uploading… ${progress}%` : "Choose File (mp4, mov, webm · max 500 MB)"}
          </label>
        </div>
        {uploading && (
          <div style={{ height: 3, backgroundColor: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", backgroundColor: "#D4A843", width: `${progress}%`, transition: "width 0.3s" }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Link Form ────────────────────────────────────────────────────────────────

function LinkForm({ onSuccess }: { onSuccess: (v: Video) => void }) {
  const [url,      setUrl]      = useState("");
  const [title,    setTitle]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [detected, setDetected] = useState<string | null>(null);

  const handleUrlChange = (val: string) => {
    setUrl(val);
    setDetected(detectVideoType(val).type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const { type, embedUrl } = detectVideoType(url);
    if (!type) { alert("Only YouTube and Vimeo links are supported."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || url, embedUrl, videoUrl: url, type }),
      });
      const { video } = await res.json();
      onSuccess(video);
      setUrl(""); setTitle(""); setDetected(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#0D0D0D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <LinkIcon size={13} style={{ color: "#D4A843" }} /> Add YouTube / Vimeo Link
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <Input value={url} onChange={(e) => handleUrlChange(e.target.value)} placeholder="YouTube or Vimeo URL" style={{ backgroundColor: "#111" }} />
          {detected && (
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, fontWeight: 700, color: detected === "YOUTUBE" ? "#E85D4A" : "#9B9BFF", textTransform: "uppercase" }}>
              {detected}
            </span>
          )}
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Custom title (optional)" style={{ backgroundColor: "#111" }} />
        <Button type="submit" disabled={saving || !url.trim()} style={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", color: "#ccc", borderRadius: 8 }}>
          {saving ? "Adding…" : "Add Link"}
        </Button>
      </form>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VideosPage() {
  const [videos,   setVideos]   = useState<Video[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<"upload" | "link">("upload");
  const [linkVideo, setLinkVideo] = useState<Video | null>(null);

  // Drag state
  const dragId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/videos")
      .then((r) => r.json())
      .then((d) => setVideos(d.videos || []))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd    = useCallback((v: Video) => setVideos((prev) => [...prev, v].sort((a, b) => a.sortOrder - b.sortOrder)), []);
  const handleDelete = useCallback((id: string) => setVideos((prev) => prev.filter((v) => v.id !== id)), []);
  const handleUpdate = useCallback((updated: Video) => setVideos((prev) => prev.map((v) => v.id === updated.id ? updated : v)), []);

  // Drag-to-reorder
  const makeDragHandlers = useCallback((id: string) => ({
    onDragStart: (e: React.DragEvent) => {
      dragId.current = id;
      setDraggingId(id);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragId.current && dragId.current !== id) {
        setVideos((prev) => {
          const from = prev.findIndex((v) => v.id === dragId.current);
          const to   = prev.findIndex((v) => v.id === id);
          if (from < 0 || to < 0 || from === to) return prev;
          const next = [...prev];
          const [item] = next.splice(from, 1);
          next.splice(to, 0, item);
          return next;
        });
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      // Persist the new order
      setVideos((prev) => {
        const orderedIds = prev.map((v) => v.id);
        fetch("/api/dashboard/videos/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds }),
        }).catch(console.error);
        return prev.map((v, i) => ({ ...v, sortOrder: i }));
      });
    },
    onDragEnd: () => {
      dragId.current = null;
      setDraggingId(null);
    },
  }), []);

  const [addOpen, setAddOpen] = useState(false);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", marginBottom: 4 }}>Videos</h1>
          <p style={{ fontSize: 13, color: "#555" }}>
            Upload footage or add YouTube / Vimeo links. Link videos to your tracks, beats, or merch.
          </p>
        </div>
        <button
          onClick={() => setAddOpen((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 10, border: "none",
            backgroundColor: "#D4A843", color: "#0A0A0A",
            fontWeight: 700, fontSize: 13, cursor: "pointer", flexShrink: 0,
          }}
        >
          + Add Video
          <ChevronDown size={13} style={{ transition: "transform 0.2s", transform: addOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
        </button>
      </div>

      {/* Add forms panel */}
      {addOpen && (
        <div style={{ marginBottom: 28, backgroundColor: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["upload", "link"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
                backgroundColor: tab === t ? "#D4A843" : "transparent",
                color: tab === t ? "#0A0A0A" : "#555",
                border: tab === t ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}>
                {t === "upload" ? "Upload Video" : "Add Link"}
              </button>
            ))}
          </div>
          {tab === "upload"
            ? <UploadForm onSuccess={(v) => { handleAdd(v); setAddOpen(false); }} />
            : <LinkForm   onSuccess={(v) => { handleAdd(v); setAddOpen(false); }} />
          }
        </div>
      )}

      {/* Video list */}
      {loading ? (
        <div style={{ color: "#333", fontSize: 13, textAlign: "center", padding: 60 }}>Loading…</div>
      ) : videos.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, color: "#333", fontSize: 13, border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 14 }}>
          No videos yet. Click <strong style={{ color: "#D4A843" }}>+ Add Video</strong> above to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#444", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>
            {videos.length} Video{videos.length !== 1 ? "s" : ""} — drag to reorder
          </div>
          {videos.map((v) => (
            <VideoRow
              key={v.id}
              video={v}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              onLinkClick={setLinkVideo}
              isDragging={draggingId === v.id}
              dragHandlers={makeDragHandlers(v.id)}
            />
          ))}
        </div>
      )}

      {/* Link product modal */}
      {linkVideo && (
        <LinkProductModal
          video={linkVideo}
          onClose={() => setLinkVideo(null)}
          onLinked={(updated) => { handleUpdate(updated); setLinkVideo(null); }}
        />
      )}
    </div>
  );
}
