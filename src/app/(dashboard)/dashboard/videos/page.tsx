"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, ExternalLink, GripVertical, Upload, Link as LinkIcon, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VideoType = "UPLOAD" | "YOUTUBE" | "VIMEO";
type VideoCategory = "LIVE" | "SESSION" | "FREESTYLE" | "BTS" | "ACOUSTIC" | "REHEARSAL";

type Video = {
  id: string;
  title: string;
  description?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  type: VideoType;
  category?: VideoCategory | null;
  duration?: number | null;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
};

const CATEGORIES: VideoCategory[] = ["LIVE", "SESSION", "FREESTYLE", "BTS", "ACOUSTIC", "REHEARSAL"];

const CATEGORY_COLORS: Record<VideoCategory, string> = {
  LIVE:      "#E85D4A",
  SESSION:   "#D4A843",
  FREESTYLE: "#fff",
  BTS:       "#999",
  ACOUSTIC:  "#1D9E74",
  REHEARSAL: "#7B77DD",
};

function detectVideoType(url: string): { type: "YOUTUBE" | "VIMEO" | null; embedUrl: string | null } {
  if (/youtube\.com|youtu\.be/.test(url)) {
    const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    const id = match?.[1];
    return { type: "YOUTUBE", embedUrl: id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null };
  }
  if (/vimeo\.com/.test(url)) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    const id = match?.[1];
    return { type: "VIMEO", embedUrl: id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null };
  }
  return { type: null, embedUrl: null };
}

function VideoCard({ video, onDelete, onTogglePublished }: {
  video: Video;
  onDelete: (id: string) => void;
  onTogglePublished: (id: string, val: boolean) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${video.title}"?`)) return;
    setDeleting(true);
    await fetch(`/api/dashboard/videos/${video.id}`, { method: "DELETE" });
    onDelete(video.id);
  };

  const handleToggle = async () => {
    await fetch(`/api/dashboard/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !video.isPublished }),
    });
    onTogglePublished(video.id, !video.isPublished);
  };

  const typeColor = video.type === "UPLOAD" ? "#D4A843" : video.type === "YOUTUBE" ? "#E85D4A" : "#9B9BFF";
  const catColor = video.category ? CATEGORY_COLORS[video.category] : "#666";

  return (
    <div style={{
      backgroundColor: "#0D0D0D",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10,
      padding: "14px 16px",
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      opacity: video.isPublished ? 1 : 0.55,
    }}>
      <div style={{ color: "#333", cursor: "grab", paddingTop: 2 }}>
        <GripVertical size={14} />
      </div>

      {/* Thumbnail */}
      {video.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.thumbnailUrl} alt="" style={{ width: 60, height: 42, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
      ) : (
        <div style={{ width: 60, height: 42, backgroundColor: "#1a1a1a", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 18 }}>🎬</span>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {video.title}
          </span>
          <span style={{ fontSize: 9, fontWeight: 800, color: typeColor, border: `1px solid ${typeColor}40`, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.5px", flexShrink: 0 }}>
            {video.type}
          </span>
          {video.category && (
            <span style={{ fontSize: 9, fontWeight: 800, color: catColor, border: `1px solid ${catColor}40`, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.5px" }}>
              {video.category}
            </span>
          )}
        </div>
        {video.description && (
          <p style={{ fontSize: 11, color: "#555", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{video.description}</p>
        )}
      </div>

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button onClick={handleToggle} title={video.isPublished ? "Unpublish" : "Publish"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: video.isPublished ? "#D4A843" : "#444" }}>
          {video.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        {(video.videoUrl || video.embedUrl) && (
          <a href={video.videoUrl || video.embedUrl || "#"} target="_blank" rel="noopener noreferrer"
            style={{ padding: 6, color: "#555", display: "flex", alignItems: "center" }}>
            <ExternalLink size={14} />
          </a>
        )}
        <button onClick={handleDelete} disabled={deleting}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: deleting ? "#333" : "#555" }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function UploadForm({ onSuccess }: { onSuccess: (v: Video) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<VideoCategory>("LIVE");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !title.trim()) {
      alert("Please enter a title first.");
      return;
    }
    setUploading(true);
    setProgress(10);

    try {
      // Get presigned upload URL
      const res = await fetch("/api/dashboard/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      });
      const { uploadUrl, videoUrl } = await res.json();
      setProgress(30);

      // Upload to R2/storage
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setProgress(70);

      // Save to DB
      const save = await fetch("/api/dashboard/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, videoUrl, type: "UPLOAD", category }),
      });
      const { video } = await save.json();
      setProgress(100);
      onSuccess(video);
      setTitle("");
      setDescription("");
      setCategory("LIVE");
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
      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <Upload size={14} style={{ color: "#D4A843" }} /> Upload Video
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title (required)" className="rounded-lg" style={{ backgroundColor: "#111" }} />
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="rounded-lg" style={{ backgroundColor: "#111" }} />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as VideoCategory)}
          style={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#ccc", padding: "8px 12px", fontSize: 13 }}
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div>
          <input ref={fileRef} type="file" accept="video/mp4,video/mov,video/webm,video/quicktime" onChange={handleFile} disabled={uploading || !title.trim()} style={{ display: "none" }} id="video-file-input" />
          <label htmlFor="video-file-input">
            <Button asChild disabled={uploading || !title.trim()} style={{ backgroundColor: uploading ? "#333" : "#D4A843", color: "#0A0A0A", borderRadius: 8, width: "100%", cursor: "pointer" }}>
              <span>{uploading ? `Uploading... ${progress}%` : "Choose File (mp4, mov, webm · max 500MB)"}</span>
            </Button>
          </label>
        </div>
        {uploading && (
          <div style={{ height: 4, backgroundColor: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", backgroundColor: "#D4A843", width: `${progress}%`, transition: "width 0.3s" }} />
          </div>
        )}
      </div>
    </div>
  );
}

function LinkForm({ onSuccess }: { onSuccess: (v: Video) => void }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);

  const handleUrlChange = (val: string) => {
    setUrl(val);
    const { type } = detectVideoType(val);
    setDetected(type);
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
      setUrl("");
      setTitle("");
      setDetected(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#0D0D0D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <LinkIcon size={14} style={{ color: "#D4A843" }} /> Add YouTube / Vimeo Link
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <Input value={url} onChange={(e) => handleUrlChange(e.target.value)} placeholder="YouTube or Vimeo URL" className="rounded-lg" style={{ backgroundColor: "#111" }} />
          {detected && (
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, fontWeight: 700, color: detected === "YOUTUBE" ? "#E85D4A" : "#9B9BFF", textTransform: "uppercase" }}>
              {detected}
            </span>
          )}
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Custom title (optional)" className="rounded-lg" style={{ backgroundColor: "#111" }} />
        <Button type="submit" disabled={saving || !url.trim()} style={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", color: "#ccc", borderRadius: 8 }}>
          {saving ? "Adding..." : "Add Link"}
        </Button>
      </form>
    </div>
  );
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upload" | "link">("upload");

  useEffect(() => {
    fetch("/api/dashboard/videos")
      .then((r) => r.json())
      .then((d) => setVideos(d.videos || []))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = (v: Video) => setVideos((prev) => [v, ...prev]);
  const handleDelete = (id: string) => setVideos((prev) => prev.filter((v) => v.id !== id));
  const handleToggle = (id: string, val: boolean) => setVideos((prev) => prev.map((v) => v.id === id ? { ...v, isPublished: val } : v));

  const uploads = videos.filter((v) => v.type === "UPLOAD");
  const embeds = videos.filter((v) => v.type !== "UPLOAD");

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 16px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", marginBottom: 4 }}>Videos</h1>
        <p style={{ fontSize: 13, color: "#555" }}>Upload performance footage or add YouTube/Vimeo links to your artist page.</p>
      </div>

      {/* Add forms */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["upload", "link"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 18px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
              backgroundColor: tab === t ? "#D4A843" : "transparent",
              color: tab === t ? "#0A0A0A" : "#555",
              border: tab === t ? "none" : "1px solid rgba(255,255,255,0.08)",
              textTransform: "capitalize",
            }}>
              {t === "upload" ? "Upload Video" : "Add Link"}
            </button>
          ))}
        </div>
        {tab === "upload" ? <UploadForm onSuccess={handleAdd} /> : <LinkForm onSuccess={handleAdd} />}
      </div>

      {loading ? (
        <div style={{ color: "#333", fontSize: 13, textAlign: "center", padding: 40 }}>Loading…</div>
      ) : videos.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#333", fontSize: 13 }}>
          No videos yet. Upload one or add a YouTube link above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {uploads.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#555", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4, marginTop: 8 }}>
                Uploads ({uploads.length})
              </div>
              {uploads.map((v) => <VideoCard key={v.id} video={v} onDelete={handleDelete} onTogglePublished={handleToggle} />)}
            </>
          )}
          {embeds.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#555", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4, marginTop: 16 }}>
                YouTube / Vimeo ({embeds.length})
              </div>
              {embeds.map((v) => <VideoCard key={v.id} video={v} onDelete={handleDelete} onTogglePublished={handleToggle} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
