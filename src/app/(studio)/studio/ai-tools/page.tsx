"use client";

import { useEffect, useRef, useState } from "react";
import {
  Wand2, Users, Loader2, CheckCircle2, AlertCircle, ChevronLeft,
  Upload, X, Download, Play, Music, FileText, Image, Film, Mic,
  Sparkles, Clock,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { PRICING_DEFAULTS } from "@/lib/pricing";

// ─── Types ─────────────────────────────────────────────────────────────────────

type AIJobType =
  | "VIDEO" | "COVER_ART" | "MASTERING"
  | "LYRIC_VIDEO" | "AR_REPORT" | "PRESS_KIT";

type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";

interface RosterItem {
  id:              string;
  name:            string;
  email:           string | null;
  photoUrl:        string | null;
  genre:           string | null;
  indieThisUserId: string | null;
  indieThisName:   string | null;
  isLinked:        boolean;
}

interface ClipSummary {
  total: number; succeeded: number; failed: number; generating: number; pending: number;
}

interface PollData {
  jobId:          string;
  status:         JobStatus;
  priceCharged:   number | null;
  createdAt:      string;
  completedAt:    string | null;
  errorMessage:   string | null;
  outputData:     Record<string, unknown> | null;
  // video/lyric-video extras
  phase?:         number;
  previewReady?:  boolean;
  previewUrl?:    string | null;
  finalVideoUrl?: string | null;
  clips?:         ClipSummary;
  stitching?:     boolean;
  // lyric-video extras
  transcriptionReady?: boolean;
  words?:         WhisperWord[];
  // cover art
  imageUrls?:     string[];
  selectedUrl?:   string | null;
}

interface WhisperWord {
  word: string; start: number; end: number;
}

interface RecentJob {
  id:           string;
  type:         AIJobType;
  status:       JobStatus;
  priceCharged: number | null;
  createdAt:    string;
  completedAt:  string | null;
  errorMessage: string | null;
  outputData:   Record<string, unknown> | null;
  artistId:     string | null;
  artist:       { id: string; name: string; email: string } | null;
}

// ─── Tool cards config ─────────────────────────────────────────────────────────

const TOOLS: Array<{
  type: AIJobType; label: string; desc: string;
  icon: React.ElementType; price: string; color: string;
  external?: string;
}> = [
  {
    type: "VIDEO",      label: "AI Music Video",
    desc: "Generate a full AI music video from a photo + track",
    icon: Film,     price: `from ${PRICING_DEFAULTS.AI_VIDEO_SHORT.display}`, color: "#6366F1",
  },
  {
    type: "COVER_ART",  label: "Cover Art",
    desc: "4 AI-generated album/single cover options",
    icon: Image,    price: PRICING_DEFAULTS.AI_COVER_ART.display,            color: "#EC4899",
  },
  {
    type: "MASTERING",  label: "AI Mastering",
    desc: "3 master profiles: Warm, Punchy, Broadcast Ready",
    icon: Music,    price: PRICING_DEFAULTS.AI_MASTERING.display,            color: "#F59E0B",
  },
  {
    type: "LYRIC_VIDEO", label: "Lyric Video",
    desc: "Auto-transcribe lyrics, review, then render animated video",
    icon: Mic,      price: PRICING_DEFAULTS.AI_LYRIC_VIDEO.display,          color: "#10B981",
  },
  {
    type: "AR_REPORT",  label: "A&R Report",
    desc: "Full artist analysis with audio metrics & industry insights",
    icon: FileText, price: PRICING_DEFAULTS.AI_AAR_REPORT.display,           color: "#3B82F6",
  },
  {
    type: "PRESS_KIT",    label: "EPK / Press Kit",
    desc: "Professional bio, press quotes, tech rider & socials",
    icon: Sparkles, price: PRICING_DEFAULTS.AI_PRESS_KIT.display,            color: "#8B5CF6",
  },
  {
    type: "BIO_GENERATOR", label: "Bio Generator",
    desc: "3 professional bio versions — short, medium & full — tailored to your studio",
    icon: Sparkles, price: "Free",                                            color: "#D4A843",
    external: "/studio/ai-tools/bio-generator",
  },
];

// ─── Tool-specific forms ───────────────────────────────────────────────────────

function VideoForm({ onSubmit, submitting }: {
  onSubmit: (input: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [imageUrl,     setImageUrl]     = useState("");
  const [style,        setStyle]        = useState("cinematic");
  const [durationTier, setDurationTier] = useState("MEDIUM");
  const [uploading,    setUploading]    = useState(false);

  const { startUpload } = useUploadThing("trackCoverArt", {
    onUploadBegin: () => setUploading(true),
    onClientUploadComplete: (res) => {
      if (res?.[0]) setImageUrl(res[0].url);
      setUploading(false);
    },
    onUploadError: () => setUploading(false),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const STYLES = [
    { value: "cinematic",   label: "Cinematic" },
    { value: "music-video", label: "Music Video" },
    { value: "documentary", label: "Documentary" },
    { value: "artistic",    label: "Artistic" },
  ];
  const TIERS = [
    { value: "SHORT",  label: `Short (30s) — ${PRICING_DEFAULTS.AI_VIDEO_SHORT.display}` },
    { value: "MEDIUM", label: `Medium (1min) — ${PRICING_DEFAULTS.AI_VIDEO_MEDIUM.display}` },
    { value: "FULL",   label: `Full (3min) — ${PRICING_DEFAULTS.AI_VIDEO_LONG.display}` },
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
          Artist Photo / Key Image
        </label>
        <div className="flex gap-2">
          <input
            type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
            placeholder="https://…"
            className="flex-1 px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
          <button type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5 transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && startUpload([e.target.files[0]])} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Style</label>
          <select value={style} onChange={e => setStyle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
            {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Duration</label>
          <select value={durationTier} onChange={e => setDurationTier(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
            {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      <button type="button"
        onClick={() => onSubmit({ imageUrl, style, durationTier })}
        disabled={submitting || !imageUrl.trim()}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
        style={{ background: "#D4A843", color: "#0A0A0A", opacity: submitting || !imageUrl.trim() ? 0.5 : 1 }}
      >
        {submitting ? "Generating…" : "Generate Music Video"}
      </button>
    </div>
  );
}

function CoverArtForm({ onSubmit, submitting }: {
  onSubmit: (input: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [style,  setStyle]  = useState("Photorealistic");
  const [mood,   setMood]   = useState("");
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
          Describe the artwork
        </label>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
          placeholder="e.g. A lone guitar on a rainy city street at night, neon reflections…"
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Style</label>
          <select value={style} onChange={e => setStyle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
            {["Photorealistic","Abstract","Illustrated","Minimal","Vintage","Cyberpunk"].map(s =>
              <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Mood (optional)</label>
          <input type="text" value={mood} onChange={e => setMood(e.target.value)}
            placeholder="dark, uplifting, melancholic…"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
      </div>
      <button type="button"
        onClick={() => onSubmit({ artistPrompt: prompt, style, mood })}
        disabled={submitting || !prompt.trim()}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
        style={{ background: "#D4A843", color: "#0A0A0A", opacity: submitting || !prompt.trim() ? 0.5 : 1 }}
      >
        {submitting ? "Generating…" : "Generate Cover Art ($2)"}
      </button>
    </div>
  );
}

function MasteringForm({ onSubmit, submitting }: {
  onSubmit: (input: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [trackUrl,  setTrackUrl]  = useState("");
  const [genre,     setGenre]     = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("artistTrack", {
    onUploadBegin: () => setUploading(true),
    onClientUploadComplete: (res) => {
      if (res?.[0]) setTrackUrl(res[0].url);
      setUploading(false);
    },
    onUploadError: () => setUploading(false),
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Track File</label>
        <div className="flex gap-2">
          <input type="url" value={trackUrl} onChange={e => setTrackUrl(e.target.value)}
            placeholder="https://… or upload →"
            className="flex-1 px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload
          </button>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden"
            onChange={e => e.target.files?.[0] && startUpload([e.target.files[0]])} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Genre (optional)</label>
        <input type="text" value={genre} onChange={e => setGenre(e.target.value)}
          placeholder="Pop, Hip-Hop, Electronic…"
          className="w-full px-3 py-2 rounded-lg border text-sm"
          style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
      </div>
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
        Delivers 3 mastered profiles: Warm (−14 LUFS), Punchy (−9 LUFS), Broadcast Ready (−14 LUFS)
      </p>
      <button type="button"
        onClick={() => onSubmit({ trackUrl, genre })}
        disabled={submitting || !trackUrl.trim()}
        className="w-full py-2.5 rounded-lg text-sm font-semibold"
        style={{ background: "#D4A843", color: "#0A0A0A", opacity: submitting || !trackUrl.trim() ? 0.5 : 1 }}
      >
        {submitting ? "Mastering…" : "Master Track ($5)"}
      </button>
    </div>
  );
}

function LyricVideoForm({ onSubmit, submitting }: {
  onSubmit: (input: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [trackUrl,    setTrackUrl]    = useState("");
  const [visualStyle, setVisualStyle] = useState("cinematic");
  const [accentColor, setAccentColor] = useState("#FFFFFF");
  const [uploading,   setUploading]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("artistTrack", {
    onUploadBegin: () => setUploading(true),
    onClientUploadComplete: (res) => {
      if (res?.[0]) setTrackUrl(res[0].url);
      setUploading(false);
    },
    onUploadError: () => setUploading(false),
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Track File</label>
        <div className="flex gap-2">
          <input type="url" value={trackUrl} onChange={e => setTrackUrl(e.target.value)}
            placeholder="https://… or upload →"
            className="flex-1 px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload
          </button>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden"
            onChange={e => e.target.files?.[0] && startUpload([e.target.files[0]])} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Visual Style</label>
          <select value={visualStyle} onChange={e => setVisualStyle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
            {["cinematic","minimal","neon","vintage","bold"].map(s =>
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Accent Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border"
              style={{ borderColor: "var(--border)" }} />
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{accentColor}</span>
          </div>
        </div>
      </div>
      <button type="button"
        onClick={() => onSubmit({ trackUrl, visualStyle, accentColor })}
        disabled={submitting || !trackUrl.trim()}
        className="w-full py-2.5 rounded-lg text-sm font-semibold"
        style={{ background: "#D4A843", color: "#0A0A0A", opacity: submitting || !trackUrl.trim() ? 0.5 : 1 }}
      >
        {submitting ? "Transcribing…" : "Generate Lyric Video (from $12)"}
      </button>
    </div>
  );
}

function ARReportForm({ onSubmit, submitting }: {
  onSubmit: (input: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [trackUrl,           setTrackUrl]           = useState("");
  const [artistBio,          setArtistBio]          = useState("");
  const [genre,              setGenre]              = useState("");
  const [targetMarket,       setTargetMarket]       = useState("");
  const [comparableArtists,  setComparableArtists]  = useState("");
  const [uploading,          setUploading]          = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("artistTrack", {
    onUploadBegin: () => setUploading(true),
    onClientUploadComplete: (res) => {
      if (res?.[0]) setTrackUrl(res[0].url);
      setUploading(false);
    },
    onUploadError: () => setUploading(false),
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Track File</label>
        <div className="flex gap-2">
          <input type="url" value={trackUrl} onChange={e => setTrackUrl(e.target.value)}
            placeholder="https://…"
            className="flex-1 px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload
          </button>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden"
            onChange={e => e.target.files?.[0] && startUpload([e.target.files[0]])} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Genre</label>
          <input type="text" value={genre} onChange={e => setGenre(e.target.value)}
            placeholder="Pop, R&B, Hip-Hop…"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Target Market</label>
          <input type="text" value={targetMarket} onChange={e => setTargetMarket(e.target.value)}
            placeholder="US, 18-24 fans of…"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Artist Bio (optional)</label>
        <textarea value={artistBio} onChange={e => setArtistBio(e.target.value)} rows={2}
          placeholder="Brief background about the artist…"
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Comparable Artists</label>
        <input type="text" value={comparableArtists} onChange={e => setComparableArtists(e.target.value)}
          placeholder="The Weeknd, Giveon, Frank Ocean"
          className="w-full px-3 py-2 rounded-lg border text-sm"
          style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
      </div>
      <button type="button"
        onClick={() => onSubmit({ trackUrl, artistBio, genre, targetMarket, comparableArtists })}
        disabled={submitting || !trackUrl.trim()}
        className="w-full py-2.5 rounded-lg text-sm font-semibold"
        style={{ background: "#D4A843", color: "#0A0A0A", opacity: submitting || !trackUrl.trim() ? 0.5 : 1 }}
      >
        {submitting ? "Analyzing…" : "Generate A&R Report ($8)"}
      </button>
    </div>
  );
}

function PressKitForm({ onSubmit, submitting, defaultArtistName }: {
  onSubmit: (input: Record<string, unknown>) => void;
  submitting: boolean;
  defaultArtistName?: string;
}) {
  const [artistName,    setArtistName]    = useState(defaultArtistName ?? "");
  const [genre,         setGenre]         = useState("");
  const [location,      setLocation]      = useState("");
  const [bio,           setBio]           = useState("");
  const [achievements,  setAchievements]  = useState("");
  const [instagram,     setInstagram]     = useState("");
  const [spotify,       setSpotify]       = useState("");
  const [bookingEmail,  setBookingEmail]  = useState("");
  const [photoUrl,      setPhotoUrl]      = useState("");
  const [uploading,     setUploading]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("trackCoverArt", {
    onUploadBegin: () => setUploading(true),
    onClientUploadComplete: (res) => {
      if (res?.[0]) setPhotoUrl(res[0].url);
      setUploading(false);
    },
    onUploadError: () => setUploading(false),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Artist Name *</label>
          <input type="text" value={artistName} onChange={e => setArtistName(e.target.value)}
            placeholder="Stage name"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Genre</label>
          <input type="text" value={genre} onChange={e => setGenre(e.target.value)}
            placeholder="R&B / Pop"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Location</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Atlanta, GA"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Booking Email</label>
          <input type="email" value={bookingEmail} onChange={e => setBookingEmail(e.target.value)}
            placeholder="booking@…"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Bio / Background</label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
          placeholder="Key facts about the artist's journey, sound, and story…"
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Achievements</label>
        <textarea value={achievements} onChange={e => setAchievements(e.target.value)} rows={2}
          placeholder="1M streams on Spotify, featured in Rolling Stone…"
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Instagram</label>
          <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)}
            placeholder="@handle"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Spotify URL</label>
          <input type="text" value={spotify} onChange={e => setSpotify(e.target.value)}
            placeholder="https://open.spotify.com/…"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Press Photo (optional)</label>
        <div className="flex gap-2">
          <input type="url" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)}
            placeholder="https://…"
            className="flex-1 px-3 py-2 rounded-lg border text-sm"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-3 py-2 rounded-lg border text-sm flex items-center gap-1.5"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && startUpload([e.target.files[0]])} />
        </div>
      </div>
      <button type="button"
        onClick={() => onSubmit({ artistName, genre, location, bio, achievements, instagram, spotify, bookingEmail, photoUrl: photoUrl || null })}
        disabled={submitting || !artistName.trim()}
        className="w-full py-2.5 rounded-lg text-sm font-semibold"
        style={{ background: "#D4A843", color: "#0A0A0A", opacity: submitting || !artistName.trim() ? 0.5 : 1 }}
      >
        {submitting ? "Generating…" : "Generate Press Kit ($6)"}
      </button>
    </div>
  );
}

// ─── Results display ───────────────────────────────────────────────────────────

function JobResults({ jobData, activeTool, onApproveVideo, onApproveLyrics, approvingVideo, approvingLyrics }: {
  jobData: PollData;
  activeTool: AIJobType;
  onApproveVideo: () => void;
  onApproveLyrics: (words: WhisperWord[]) => void;
  approvingVideo: boolean;
  approvingLyrics: boolean;
}) {
  const out = jobData.outputData ?? {};

  if (jobData.status === "FAILED") {
    return (
      <div className="rounded-xl border p-4 flex items-start gap-3"
        style={{ borderColor: "#EF4444", background: "rgba(239,68,68,0.08)" }}>
        <AlertCircle size={18} className="shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
        <div>
          <p className="text-sm font-medium" style={{ color: "#EF4444" }}>Generation failed</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            {jobData.errorMessage ?? "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  if (jobData.status === "QUEUED" || jobData.status === "PROCESSING") {
    // VIDEO phase 2
    if (activeTool === "VIDEO" && jobData.phase === 2 && jobData.clips) {
      const { total, succeeded, failed, generating } = jobData.clips;
      const pct = total > 0 ? Math.round(((succeeded + failed) / total) * 100) : 0;
      return (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Rendering full video… {pct}%
          </p>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: "#D4A843" }} />
          </div>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {succeeded} clips done · {generating} rendering · {failed} failed
          </p>
        </div>
      );
    }
    // VIDEO phase 1 preview ready
    if (activeTool === "VIDEO" && jobData.previewReady && jobData.previewUrl) {
      return (
        <div className="space-y-4">
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Preview clip ready — approve to render full video</p>
          <video src={jobData.previewUrl} controls className="w-full rounded-xl" />
          <button onClick={onApproveVideo} disabled={approvingVideo}
            className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "#D4A843", color: "#0A0A0A", opacity: approvingVideo ? 0.6 : 1 }}>
            {approvingVideo ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Approve & Render Full Video
          </button>
        </div>
      );
    }
    // LYRIC_VIDEO transcription ready
    if (activeTool === "LYRIC_VIDEO" && jobData.transcriptionReady && jobData.words) {
      return (
        <TranscriptionApprove
          words={jobData.words}
          onApprove={onApproveLyrics}
          approving={approvingLyrics}
        />
      );
    }
    return (
      <div className="flex items-center gap-3 py-4" style={{ color: "var(--muted-foreground)" }}>
        <Loader2 size={18} className="animate-spin" style={{ color: "#D4A843" }} />
        <span className="text-sm">
          {jobData.status === "QUEUED" ? "Queued…" : "Processing…"}
        </span>
      </div>
    );
  }

  // COMPLETE
  if (activeTool === "COVER_ART") {
    const images = (out.imageUrls as string[] | undefined) ?? [];
    return (
      <div className="grid grid-cols-2 gap-3">
        {images.map((url, i) => (
          <div key={i} className="relative group rounded-xl overflow-hidden aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Cover ${i + 1}`} className="w-full h-full object-cover" />
            <a href={url} download target="_blank" rel="noopener noreferrer"
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Download size={20} className="text-white" />
            </a>
          </div>
        ))}
        {images.length === 0 && <p className="col-span-2 text-sm" style={{ color: "var(--muted-foreground)" }}>No images returned</p>}
      </div>
    );
  }

  if (activeTool === "MASTERING") {
    const outputs = (out.outputs as Array<{label: string; downloadUrl: string; loudnessLUFS: number; description: string}> | undefined) ?? [];
    const colors: Record<string, string> = { Warm: "#F59E0B", Punchy: "#EF4444", "Broadcast Ready": "#10B981" };
    return (
      <div className="space-y-3">
        {outputs.map((profile) => (
          <div key={profile.label} className="rounded-xl border p-4 flex items-center gap-4"
            style={{ borderColor: "var(--border)" }}>
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: colors[profile.label] ?? "#D4A843" }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{profile.label}</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {profile.description} · {profile.loudnessLUFS} LUFS
              </p>
              {profile.downloadUrl && (
                <audio src={profile.downloadUrl} controls className="mt-2 w-full h-8" />
              )}
            </div>
            {profile.downloadUrl && (
              <a href={profile.downloadUrl} download
                className="shrink-0 p-2 rounded-lg border transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                <Download size={16} />
              </a>
            )}
          </div>
        ))}
        {outputs.length === 0 && <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No master files returned</p>}
      </div>
    );
  }

  if (activeTool === "VIDEO" || activeTool === "LYRIC_VIDEO") {
    const videoUrl = jobData.finalVideoUrl ?? (out.finalVideoUrl as string | undefined);
    if (videoUrl) {
      return (
        <div className="space-y-3">
          <video src={videoUrl} controls className="w-full rounded-xl" />
          <a href={videoUrl} download
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: "#D4A843" }}>
            <Download size={16} /> Download video
          </a>
        </div>
      );
    }
    return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Video ready — no URL returned</p>;
  }

  if (activeTool === "AR_REPORT") {
    const report = (out.report as string | undefined) ?? "";
    return (
      <div className="rounded-xl border p-4 space-y-2 max-h-96 overflow-y-auto"
        style={{ borderColor: "var(--border)" }}>
        {report.split("\n").filter(Boolean).map((line, i) => (
          <p key={i} className={line.startsWith("## ") ? "text-sm font-bold mt-3" : "text-sm"}
            style={{ color: line.startsWith("## ") ? "var(--foreground)" : "var(--muted-foreground)" }}>
            {line.replace(/^##\s*/, "")}
          </p>
        ))}
        {!report && <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No report returned</p>}
      </div>
    );
  }

  if (activeTool === "PRESS_KIT") {
    const content = out.content as Record<string, unknown> | undefined;
    const bio = content?.bio as Record<string, string> | undefined;
    return (
      <div className="space-y-4">
        {bio?.medium && (
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--muted-foreground)" }}>Bio</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{bio.medium}</p>
          </div>
        )}
        {typeof out.pdfUrl === "string" && (
          <a href={out.pdfUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: "#D4A843" }}>
            <Download size={16} /> Download PDF Press Kit
          </a>
        )}
        {!bio?.medium && typeof out.pdfUrl !== "string" && (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Press kit generated</p>
        )}
      </div>
    );
  }

  return null;
}

// ─── Transcription approve component ──────────────────────────────────────────

function TranscriptionApprove({ words, onApprove, approving }: {
  words: WhisperWord[];
  onApprove: (words: WhisperWord[]) => void;
  approving: boolean;
}) {
  const [edited, setEdited] = useState<WhisperWord[]>(words);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");

  function startEdit(i: number) {
    setEditIdx(i);
    setEditVal(edited[i].word);
  }
  function commitEdit(i: number) {
    const next = [...edited];
    next[i] = { ...next[i], word: editVal };
    setEdited(next);
    setEditIdx(null);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        Review transcription — click any word to edit
      </p>
      <div className="rounded-xl border p-4 max-h-48 overflow-y-auto flex flex-wrap gap-1.5"
        style={{ borderColor: "var(--border)" }}>
        {edited.map((w, i) => (
          editIdx === i ? (
            <input key={i} autoFocus
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onBlur={() => commitEdit(i)}
              onKeyDown={e => e.key === "Enter" && commitEdit(i)}
              className="px-1.5 py-0.5 rounded text-sm border"
              style={{ background: "var(--background)", borderColor: "#D4A843", color: "var(--foreground)", width: `${Math.max(editVal.length * 9, 40)}px` }}
            />
          ) : (
            <button key={i} type="button" onClick={() => startEdit(i)}
              className={`px-1.5 py-0.5 rounded text-sm transition-colors ${w.word !== words[i]?.word ? "font-semibold" : ""}`}
              style={{
                color: w.word !== words[i]?.word ? "#D4A843" : "var(--foreground)",
                background: w.word !== words[i]?.word ? "rgba(212,168,67,0.1)" : "transparent",
              }}>
              {w.word}
            </button>
          )
        ))}
      </div>
      <button onClick={() => onApprove(edited)} disabled={approving}
        className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
        style={{ background: "#D4A843", color: "#0A0A0A", opacity: approving ? 0.6 : 1 }}>
        {approving ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
        Approve Lyrics & Render Video
      </button>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function StudioAIToolsPage() {
  // Roster
  const [roster,          setRoster]          = useState<RosterItem[]>([]);
  const [rosterLoading,   setRosterLoading]   = useState(true);
  const [selectedContact, setSelectedContact] = useState<RosterItem | null>(null);

  // Tool selection
  const [activeTool, setActiveTool] = useState<AIJobType | null>(null);

  // Job state
  const [submitting,      setSubmitting]      = useState(false);
  const [submitError,     setSubmitError]     = useState<string | null>(null);
  const [activeJobId,     setActiveJobId]     = useState<string | null>(null);
  const [jobData,         setJobData]         = useState<PollData | null>(null);
  const [approvingVideo,  setApprovingVideo]  = useState(false);
  const [approvingLyrics, setApprovingLyrics] = useState(false);

  // Recent jobs
  const [recentJobs,      setRecentJobs]      = useState<RecentJob[]>([]);
  const [historyLoading,  setHistoryLoading]  = useState(true);

  // Client selector dropdown
  const [contactSearch,   setContactSearch]   = useState("");
  const [contactDropOpen, setContactDropOpen] = useState(false);
  const contactDropRef = useRef<HTMLDivElement>(null);

  // ── Load roster + history ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/studio/ai-tools/roster")
      .then(r => r.json())
      .then(d => setRoster(d.roster ?? []))
      .catch(() => {})
      .finally(() => setRosterLoading(false));

    fetch("/api/studio/ai-tools")
      .then(r => r.json())
      .then(d => setRecentJobs(d.jobs ?? []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  // ── Close contact dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (contactDropRef.current && !contactDropRef.current.contains(e.target as Node)) {
        setContactDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // ── Poll active job ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeJobId) return;
    if (jobData?.status === "COMPLETE" || jobData?.status === "FAILED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai-jobs/${activeJobId}`);
        if (!res.ok) return;
        const data: PollData = await res.json();
        setJobData(data);
        if (data.status === "COMPLETE" || data.status === "FAILED") {
          clearInterval(interval);
          // Refresh recent jobs
          fetch("/api/studio/ai-tools")
            .then(r => r.json())
            .then(d => setRecentJobs(d.jobs ?? []))
            .catch(() => {});
        }
      } catch { /* ignore */ }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeJobId, jobData?.status]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(toolType: AIJobType, inputData: Record<string, unknown>) {
    setSubmitting(true);
    setSubmitError(null);
    setJobData(null);
    setActiveJobId(null);

    try {
      const res = await fetch("/api/studio/ai-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:      toolType,
          contactId: selectedContact?.id ?? null,
          inputData,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error ?? "Something went wrong");
        return;
      }

      setActiveJobId(data.jobId);
      setJobData({
        jobId:       data.jobId,
        status:      "QUEUED",
        priceCharged: null,
        createdAt:   new Date().toISOString(),
        completedAt: null,
        errorMessage: null,
        outputData:  null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Approve video (phase 1 → 2) ──────────────────────────────────────────────
  async function handleApproveVideo() {
    if (!activeJobId) return;
    setApprovingVideo(true);
    try {
      await fetch(`/api/ai-jobs/${activeJobId}/approve-video`, { method: "POST" });
      setJobData(prev => prev ? { ...prev, phase: 2, previewReady: false } : prev);
    } catch { /* ignore */ }
    finally { setApprovingVideo(false); }
  }

  // ── Approve lyrics (phase 1 → 2) ─────────────────────────────────────────────
  async function handleApproveLyrics(words: WhisperWord[]) {
    if (!activeJobId) return;
    setApprovingLyrics(true);
    try {
      await fetch(`/api/ai-jobs/${activeJobId}/approve-lyrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words }),
      });
      setJobData(prev => prev ? { ...prev, transcriptionReady: false, phase: 2 } : prev);
    } catch { /* ignore */ }
    finally { setApprovingLyrics(false); }
  }

  // ── Reset to tool selector ────────────────────────────────────────────────────
  function resetTool() {
    setActiveTool(null);
    setActiveJobId(null);
    setJobData(null);
    setSubmitError(null);
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const activeCfg = TOOLS.find(t => t.type === activeTool);
  const contactName = selectedContact?.name ?? "no client";

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <div className="border-b px-8 py-5 flex items-center justify-between"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(212,168,67,0.12)" }}>
            <Wand2 size={18} style={{ color: "#D4A843" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>AI Tools</h1>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Generate AI content for your clients
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 space-y-8 max-w-5xl">
        {/* ── Client Selector ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={16} style={{ color: "var(--muted-foreground)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Client</h2>
            </div>
            {selectedContact && (
              <button
                onClick={() => { setSelectedContact(null); setContactSearch(""); }}
                className="text-xs transition-colors"
                style={{ color: "var(--muted-foreground)" }}
              >
                Clear
              </button>
            )}
          </div>

          {rosterLoading ? (
            <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
              <Loader2 size={14} className="animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : (
            <div className="relative" ref={contactDropRef}>
              {/* Trigger button */}
              <button
                onClick={() => { setContactDropOpen(o => !o); setContactSearch(""); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors"
                style={{
                  borderColor: contactDropOpen ? "#D4A843" : "var(--border)",
                  background: "var(--background)",
                  color: "var(--foreground)",
                }}
              >
                {selectedContact ? (
                  <>
                    {selectedContact.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedContact.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: "rgba(212,168,67,0.15)", color: "#D4A843" }}>
                        {selectedContact.name[0].toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 font-medium">{selectedContact.name}</span>
                    {selectedContact.genre && (
                      <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>
                        {selectedContact.genre}
                      </span>
                    )}
                    {selectedContact.isLinked && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: "rgba(212,168,67,0.15)", color: "#D4A843" }}>
                        linked
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "var(--border)" }}>
                      <Users size={13} style={{ color: "var(--muted-foreground)" }} />
                    </div>
                    <span style={{ color: "var(--muted-foreground)" }}>No client selected</span>
                  </>
                )}
                <ChevronLeft size={14} className={`shrink-0 ml-auto transition-transform ${contactDropOpen ? "-rotate-90" : "rotate-180"}`}
                  style={{ color: "var(--muted-foreground)" }} />
              </button>

              {/* Dropdown */}
              {contactDropOpen && (
                <div className="absolute z-50 mt-1.5 w-full rounded-xl border shadow-lg overflow-hidden"
                  style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  {/* Search */}
                  <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
                    <input
                      autoFocus
                      type="text"
                      value={contactSearch}
                      onChange={e => setContactSearch(e.target.value)}
                      placeholder="Search contacts…"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--background)", color: "var(--foreground)", border: "none" }}
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {/* No client option */}
                    <button
                      onClick={() => { setSelectedContact(null); setContactDropOpen(false); setContactSearch(""); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors hover:bg-white/5"
                      style={{ color: selectedContact === null ? "#D4A843" : "var(--muted-foreground)" }}
                    >
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "var(--border)" }}>
                        <Users size={13} style={{ color: "var(--muted-foreground)" }} />
                      </div>
                      No client — generate without linking
                    </button>

                    {/* Filtered contacts */}
                    {roster
                      .filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                                   (c.genre ?? "").toLowerCase().includes(contactSearch.toLowerCase()))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(contact => (
                        <button
                          key={contact.id}
                          onClick={() => { setSelectedContact(contact); setContactDropOpen(false); setContactSearch(""); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors hover:bg-white/5"
                          style={{
                            background: selectedContact?.id === contact.id ? "rgba(212,168,67,0.07)" : "transparent",
                            color: selectedContact?.id === contact.id ? "#D4A843" : "var(--foreground)",
                          }}
                        >
                          {contact.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={contact.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: "var(--border)", color: "var(--foreground)" }}>
                              {contact.name[0].toUpperCase()}
                            </div>
                          )}
                          <span className="flex-1">{contact.name}</span>
                          {contact.genre && (
                            <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>
                              {contact.genre}
                            </span>
                          )}
                          {contact.isLinked && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: "rgba(212,168,67,0.15)", color: "#D4A843" }}>
                              linked
                            </span>
                          )}
                        </button>
                      ))}

                    {roster.filter(c =>
                      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                      (c.genre ?? "").toLowerCase().includes(contactSearch.toLowerCase())
                    ).length === 0 && contactSearch && (
                      <p className="px-4 py-3 text-sm" style={{ color: "var(--muted-foreground)" }}>
                        No contacts match &quot;{contactSearch}&quot;
                      </p>
                    )}

                    {roster.length === 0 && (
                      <p className="px-4 py-3 text-sm" style={{ color: "var(--muted-foreground)" }}>
                        No contacts yet — add clients in your CRM first.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedContact?.isLinked && (
            <p className="mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
              Output will also appear in {selectedContact.indieThisName ?? selectedContact.name}&apos;s IndieThis dashboard.
            </p>
          )}
        </div>

        {/* ── Tool grid ─────────────────────────────────────────────────────── */}
        {!activeTool && (
          <div>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
              Choose an AI Tool — generating for <span style={{ color: "#D4A843" }}>{contactName}</span>
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {TOOLS.map(tool => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.type}
                    onClick={() => {
                      if (tool.external) {
                        window.location.href = tool.external;
                      } else {
                        setActiveTool(tool.type);
                      }
                    }}
                    className="text-left rounded-2xl border p-5 transition-all hover:scale-[1.02]"
                    style={{ borderColor: "var(--border)", background: "var(--card)" }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                      style={{ background: `${tool.color}1A` }}>
                      <Icon size={20} style={{ color: tool.color }} />
                    </div>
                    <p className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                      {tool.label}
                    </p>
                    <p className="text-xs mb-2 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                      {tool.desc}
                    </p>
                    <span className="text-xs font-semibold" style={{ color: "#D4A843" }}>
                      {tool.price}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Active tool form + results ─────────────────────────────────────── */}
        {activeTool && activeCfg && (
          <div className="rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {/* Tool header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${activeCfg.color}1A` }}>
                  <activeCfg.icon size={18} style={{ color: activeCfg.color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{activeCfg.label}</p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    for <span style={{ color: "#D4A843" }}>{contactName}</span>
                  </p>
                </div>
              </div>
              <button onClick={resetTool}
                className="p-2 rounded-lg transition-colors"
                style={{ color: "var(--muted-foreground)" }}>
                <X size={16} />
              </button>
            </div>

            <div className="p-5 grid grid-cols-2 gap-8">
              {/* Form */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-4"
                  style={{ color: "var(--muted-foreground)" }}>Configuration</p>
                {submitError && (
                  <div className="mb-4 rounded-lg border p-3 flex items-start gap-2"
                    style={{ borderColor: "#EF4444", background: "rgba(239,68,68,0.08)" }}>
                    <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
                    <p className="text-xs" style={{ color: "#EF4444" }}>{submitError}</p>
                  </div>
                )}
                {activeTool === "VIDEO"      && <VideoForm      onSubmit={i => handleSubmit("VIDEO",      i)} submitting={submitting} />}
                {activeTool === "COVER_ART"  && <CoverArtForm   onSubmit={i => handleSubmit("COVER_ART",  i)} submitting={submitting} />}
                {activeTool === "MASTERING"  && <MasteringForm  onSubmit={i => handleSubmit("MASTERING",  i)} submitting={submitting} />}
                {activeTool === "LYRIC_VIDEO"&& <LyricVideoForm onSubmit={i => handleSubmit("LYRIC_VIDEO",i)} submitting={submitting} />}
                {activeTool === "AR_REPORT"  && <ARReportForm   onSubmit={i => handleSubmit("AR_REPORT",  i)} submitting={submitting} />}
                {activeTool === "PRESS_KIT"  && <PressKitForm   onSubmit={i => handleSubmit("PRESS_KIT",  i)} submitting={submitting}
                  defaultArtistName={selectedContact?.name} />}
              </div>

              {/* Results */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-4"
                  style={{ color: "var(--muted-foreground)" }}>Output</p>
                {!activeJobId && (
                  <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed"
                    style={{ borderColor: "var(--border)" }}>
                    <activeCfg.icon size={32} style={{ color: "var(--border)" }} />
                    <p className="text-sm mt-3" style={{ color: "var(--muted-foreground)" }}>
                      Output will appear here
                    </p>
                  </div>
                )}
                {activeJobId && jobData && (
                  <JobResults
                    jobData={jobData}
                    activeTool={activeTool}
                    onApproveVideo={handleApproveVideo}
                    onApproveLyrics={handleApproveLyrics}
                    approvingVideo={approvingVideo}
                    approvingLyrics={approvingLyrics}
                  />
                )}
              </div>
            </div>

            {/* Job status bar */}
            {jobData && (
              <div className="px-5 pb-5">
                <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                  {jobData.status === "COMPLETE" && <CheckCircle2 size={16} style={{ color: "#10B981" }} />}
                  {jobData.status === "FAILED"   && <AlertCircle  size={16} style={{ color: "#EF4444" }} />}
                  {(jobData.status === "QUEUED" || jobData.status === "PROCESSING") &&
                    <Loader2 size={16} className="animate-spin" style={{ color: "#D4A843" }} />}
                  <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                    Job {activeJobId?.slice(0, 8)}… · {jobData.status}
                    {jobData.priceCharged != null && ` · $${jobData.priceCharged.toFixed(2)} charged`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Recent jobs history ────────────────────────────────────────────── */}
        {recentJobs.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
              Recent Jobs
            </h2>
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {recentJobs.map((job, idx) => {
                const cfg = TOOLS.find(t => t.type === job.type);
                const Icon = cfg?.icon ?? Wand2;
                return (
                  <div key={job.id}
                    className="flex items-center gap-4 px-5 py-3"
                    style={{
                      background: idx % 2 === 0 ? "var(--card)" : "transparent",
                      borderBottom: idx < recentJobs.length - 1 ? "1px solid var(--border)" : undefined,
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${cfg?.color ?? "#D4A843"}1A` }}>
                      <Icon size={15} style={{ color: cfg?.color ?? "#D4A843" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                        {cfg?.label ?? job.type}
                        {job.artist && (
                          <span className="ml-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                            → {job.artist.name}
                          </span>
                        )}
                      </p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(job.createdAt).toLocaleDateString()}
                        {job.priceCharged != null && ` · $${job.priceCharged.toFixed(2)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {job.status === "COMPLETE" && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
                          <CheckCircle2 size={11} /> Done
                        </span>
                      )}
                      {job.status === "FAILED" && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}>
                          <AlertCircle size={11} /> Failed
                        </span>
                      )}
                      {(job.status === "QUEUED" || job.status === "PROCESSING") && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
                          <Clock size={11} /> {job.status === "QUEUED" ? "Queued" : "Processing"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {historyLoading && (
          <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
            <Loader2 size={14} className="animate-spin" />
            <span className="text-sm">Loading history…</span>
          </div>
        )}
      </div>
    </div>
  );
}
