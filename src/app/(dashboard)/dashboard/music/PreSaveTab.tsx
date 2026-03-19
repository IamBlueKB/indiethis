"use client";

import { useEffect, useState } from "react";
import {
  Music2, Loader2, Plus, Trash2, X, ImagePlus,
  CheckCircle2, ToggleLeft, ToggleRight, CalendarDays,
  TrendingUp, Zap,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Campaign = {
  id:            string;
  title:         string;
  artUrl:        string | null;
  releaseDate:   string;
  spotifyUrl:    string | null;
  appleMusicUrl: string | null;
  isActive:      boolean;
  createdAt:     string;
  stats: { spotify: number; appleMusic: number; total: number };
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function SpotifyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.51 17.31a.748.748 0 01-1.03.248c-2.82-1.723-6.37-2.112-10.553-1.157a.748.748 0 01-.353-1.453c4.576-1.047 8.502-.596 11.688 1.332a.748.748 0 01.248 1.03zm1.47-3.268a.937.937 0 01-1.288.308c-3.226-1.983-8.14-2.558-11.953-1.4a.937.937 0 01-.544-1.793c4.358-1.322 9.776-.681 13.477 1.596a.937.937 0 01.308 1.289zm.127-3.403c-3.868-2.297-10.248-2.508-13.942-1.388a1.124 1.124 0 01-.653-2.15c4.238-1.287 11.284-1.038 15.735 1.607a1.124 1.124 0 01-1.14 1.931z" />
    </svg>
  );
}

function AppleMusicIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.15 3.34.428 2.004.958 1.04 1.88.475 3.208A4.86 4.86 0 00.09 4.88c-.014.277-.021.554-.022.832V18.3c.003.28.012.56.03.838.051.824.227 1.626.62 2.372.684 1.296 1.768 2.15 3.19 2.545.525.145 1.062.208 1.608.225.293.01.586.015.878.015H18.56c.293 0 .586-.005.878-.015.546-.017 1.083-.08 1.608-.225 1.422-.395 2.506-1.249 3.19-2.545.393-.746.57-1.548.62-2.372.018-.278.027-.558.03-.838V5.71c0-.007-.003-.013-.003-.02l.003-.07c0-.007.003-.013.003-.02v-.496c-.001-.295-.018-.59-.037-.88zM12 18.83c-3.757 0-6.8-3.042-6.8-6.8S8.243 5.23 12 5.23s6.8 3.042 6.8 6.8-3.043 6.8-6.8 6.8zm0-11.09c-2.37 0-4.29 1.92-4.29 4.29S9.63 16.32 12 16.32s4.29-1.92 4.29-4.29S14.37 7.74 12 7.74zm6.96-2.95a1.59 1.59 0 110-3.18 1.59 1.59 0 010 3.18z" />
    </svg>
  );
}

// ─── Create form ──────────────────────────────────────────────────────────────

function CreateForm({ onCreated }: { onCreated: (c: Campaign) => void }) {
  const [open,         setOpen]         = useState(false);
  const [title,        setTitle]        = useState("");
  const [artUrl,       setArtUrl]       = useState<string | null>(null);
  const [releaseDate,  setReleaseDate]  = useState("");
  const [spotifyUrl,   setSpotifyUrl]   = useState("");
  const [appleUrl,     setAppleUrl]     = useState("");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");

  const { startUpload, isUploading } = useUploadThing("albumArt", {
    onClientUploadComplete: (res) => {
      const url = res[0]?.url;
      if (url) setArtUrl(url);
    },
  });

  function reset() {
    setTitle(""); setArtUrl(null); setReleaseDate("");
    setSpotifyUrl(""); setAppleUrl(""); setError(""); setOpen(false);
  }

  async function handleSave() {
    if (!title.trim() || !releaseDate) { setError("Title and release date are required."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/dashboard/presave", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title:        title.trim(),
          artUrl:       artUrl ?? null,
          releaseDate,
          spotifyUrl:   spotifyUrl.trim() || null,
          appleMusicUrl: appleUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create"); return; }
      onCreated(data.campaign as Campaign);
      reset();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
      >
        <Plus size={15} /> New Pre-save Campaign
      </button>
    );
  }

  return (
    <div
      className="rounded-2xl border p-5 space-y-4"
      style={{ backgroundColor: "var(--card)", borderColor: "#D4A843" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={15} style={{ color: "#D4A843" }} />
          <p className="text-sm font-semibold text-foreground">New Pre-save Campaign</p>
        </div>
        <button onClick={reset} className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>

      {/* Album art + title row */}
      <div className="flex items-start gap-4">
        <div className="shrink-0 space-y-2">
          <div
            className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center border"
            style={{ borderColor: "var(--border)", backgroundColor: "rgba(212,168,67,0.06)" }}
          >
            {artUrl
              ? <img src={artUrl} alt="Album art" className="w-full h-full object-cover" />
              : <Music2 size={22} style={{ color: "rgba(212,168,67,0.3)" }} />
            }
          </div>
          <label
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {isUploading
              ? <><Loader2 size={11} className="animate-spin" /> Uploading…</>
              : <><ImagePlus size={11} /> {artUrl ? "Replace" : "Upload Art"}</>}
            <input
              type="file" accept="image/*" className="sr-only"
              disabled={isUploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) startUpload([f]); e.target.value = ""; }}
            />
          </label>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Release Title <span style={{ color: "#E85D4A" }}>*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer EP, Track Name"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CalendarDays size={11} /> Release Date <span style={{ color: "#E85D4A" }}>*</span>
            </label>
            <input
              type="datetime-local"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)", colorScheme: "dark" }}
            />
          </div>
        </div>
      </div>

      {/* Platform URLs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <span style={{ color: "#1DB954" }}><SpotifyIcon size={11} /></span> Spotify Pre-save URL
          </label>
          <input
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value)}
            placeholder="https://distrokid.com/hyperfollow/…"
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <span style={{ color: "#FA243C" }}><AppleMusicIcon size={11} /></span> Apple Music Pre-save URL
          </label>
          <input
            value={appleUrl}
            onChange={(e) => setAppleUrl(e.target.value)}
            placeholder="https://music.apple.com/…"
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
      </div>

      {error && <p className="text-xs" style={{ color: "#E85D4A" }}>{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving || isUploading || !title.trim() || !releaseDate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          {saving
            ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
            : isUploading
            ? "Uploading art…"
            : <><CheckCircle2 size={14} /> Create Campaign</>}
        </button>
        <button
          onClick={reset}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground"
          style={{ backgroundColor: "var(--border)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Campaign card ────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onDelete,
  onToggle,
}: {
  campaign: Campaign;
  onDelete: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
}) {
  const [deleting,  setDeleting]  = useState(false);
  const [toggling,  setToggling]  = useState(false);

  const releaseDate = new Date(campaign.releaseDate);
  const isReleased  = releaseDate <= new Date();
  const dateLabel   = releaseDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/dashboard/presave/${campaign.id}`, { method: "DELETE" });
    onDelete(campaign.id);
  }

  async function handleToggle() {
    setToggling(true);
    await fetch(`/api/dashboard/presave/${campaign.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive: !campaign.isActive }),
    });
    onToggle(campaign.id, !campaign.isActive);
    setToggling(false);
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: "var(--card)",
        borderColor:     campaign.isActive ? "rgba(212,168,67,0.25)" : "var(--border)",
      }}
    >
      <div className="flex gap-4 p-4">
        {/* Album art */}
        <div
          className="w-16 h-16 rounded-xl shrink-0 overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: "rgba(212,168,67,0.06)" }}
        >
          {campaign.artUrl
            ? <img src={campaign.artUrl} alt={campaign.title} className="w-full h-full object-cover" />
            : <Music2 size={20} style={{ color: "rgba(212,168,67,0.3)" }} />
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground truncate leading-snug">{campaign.title}</p>
            {/* Active toggle */}
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
              style={campaign.isActive
                ? { backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }
                : { backgroundColor: "var(--border)", color: "var(--muted-foreground)" }
              }
            >
              {toggling
                ? <Loader2 size={10} className="animate-spin" />
                : campaign.isActive
                ? <><ToggleRight size={12} /> Live</>
                : <><ToggleLeft size={12} /> Off</>
              }
            </button>
          </div>

          {/* Date + status */}
          <div className="flex items-center gap-1.5">
            <CalendarDays size={10} className="text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground">{dateLabel}</span>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={isReleased
                ? { backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }
                : { backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }
              }
            >
              {isReleased ? "Released" : "Upcoming"}
            </span>
          </div>

          {/* Platform URLs */}
          <div className="flex items-center gap-2 flex-wrap">
            {campaign.spotifyUrl
              ? <span className="flex items-center gap-1 text-[11px]" style={{ color: "#1DB954" }}><SpotifyIcon size={10} /> Spotify linked</span>
              : <span className="flex items-center gap-1 text-[11px] text-muted-foreground/40"><SpotifyIcon size={10} /> No Spotify URL</span>
            }
            {campaign.appleMusicUrl
              ? <span className="flex items-center gap-1 text-[11px]" style={{ color: "#FA243C" }}><AppleMusicIcon size={10} /> Apple Music linked</span>
              : <span className="flex items-center gap-1 text-[11px] text-muted-foreground/40"><AppleMusicIcon size={10} /> No Apple URL</span>
            }
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div
        className="border-t flex items-stretch"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={12} style={{ color: "#D4A843" }} />
            <span className="text-lg font-bold text-foreground leading-none">{campaign.stats.total}</span>
          </div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total clicks</span>
        </div>
        <div className="w-px" style={{ backgroundColor: "var(--border)" }} />
        <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
          <div className="flex items-center gap-1.5">
            <span style={{ color: "#1DB954" }}><SpotifyIcon size={12} /></span>
            <span className="text-lg font-bold text-foreground leading-none">{campaign.stats.spotify}</span>
          </div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Spotify</span>
        </div>
        <div className="w-px" style={{ backgroundColor: "var(--border)" }} />
        <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
          <div className="flex items-center gap-1.5">
            <span style={{ color: "#FA243C" }}><AppleMusicIcon size={12} /></span>
            <span className="text-lg font-bold text-foreground leading-none">{campaign.stats.appleMusic}</span>
          </div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Apple Music</span>
        </div>
        <div className="w-px" style={{ backgroundColor: "var(--border)" }} />
        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors"
          title="Delete campaign"
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function PreSaveTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/presave")
      .then((r) => r.json())
      .then((d) => { setCampaigns(d.campaigns ?? []); })
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(c: Campaign) {
    setCampaigns((prev) => [c, ...prev]);
  }

  function handleDelete(id: string) {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  function handleToggle(id: string, isActive: boolean) {
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, isActive } : c));
  }

  const active   = campaigns.filter((c) => c.isActive);
  const inactive = campaigns.filter((c) => !c.isActive);

  return (
    <div className="space-y-5">
      {/* Explainer */}
      <div
        className="rounded-2xl border p-4 flex items-start gap-3"
        style={{ backgroundColor: "rgba(212,168,67,0.04)", borderColor: "rgba(212,168,67,0.15)" }}
      >
        <Zap size={16} className="mt-0.5 shrink-0" style={{ color: "#D4A843" }} />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">How it works</p>
          <p className="text-xs text-muted-foreground">
            Create a campaign and the pre-save card automatically appears on your artist page with a live countdown.
            After your release date it switches to a <strong className="text-foreground">&ldquo;Listen Now&rdquo;</strong> card.
            Toggle a campaign off to hide it from your page without deleting it.
          </p>
        </div>
      </div>

      {/* Create button / form */}
      <CreateForm onCreated={handleCreated} />

      {/* Campaign list */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div
          className="rounded-2xl border py-14 text-center space-y-2"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <Zap size={32} className="mx-auto" style={{ color: "rgba(212,168,67,0.2)" }} />
          <p className="text-sm font-semibold text-foreground">No campaigns yet</p>
          <p className="text-xs text-muted-foreground">Create your first pre-save campaign above to hype your next release.</p>
        </div>
      ) : (
        <>
          {/* Active campaigns */}
          {active.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active ({active.length})</p>
              {active.map((c) => (
                <CampaignCard key={c.id} campaign={c} onDelete={handleDelete} onToggle={handleToggle} />
              ))}
            </div>
          )}

          {/* Inactive campaigns */}
          {inactive.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inactive ({inactive.length})</p>
              {inactive.map((c) => (
                <CampaignCard key={c.id} campaign={c} onDelete={handleDelete} onToggle={handleToggle} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
