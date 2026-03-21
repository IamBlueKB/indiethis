"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Music2, ShoppingCart, Clock, CheckCircle2, Eye, Download, Search, User, Loader2, X } from "lucide-react";
import { useAudioStore } from "@/store";
import BeatPreviewPlayer from "@/components/audio/BeatPreviewPlayer";

type BeatPreview = {
  id: string;
  status: string;
  isDownloadable: boolean;
  expiresAt: string;
  createdAt: string;
  track: {
    id: string;
    title: string;
    description: string | null;
    fileUrl: string;
    coverArtUrl: string | null;
    price: number | null;
    projectName: string | null;
    bpm: number | null;
    musicalKey: string | null;
  };
  producer: { displayName: string };
};

type BrowseTrack = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  coverArtUrl: string | null;
  price: number | null;
  projectName: string | null;
  plays: number;
  bpm: number | null;
  musicalKey: string | null;
  createdAt: string;
  /** True when the current user holds an active BeatLicense for this track. */
  isOwned: boolean;
  artist: {
    id: string;
    name: string;
    artistName: string | null;
    artistSlug: string | null;
    photo: string | null;
  };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:   { label: "New",      color: "text-yellow-400",  icon: Clock },
  LISTENED:  { label: "Listened", color: "text-blue-400",    icon: Eye },
  PURCHASED: { label: "Licensed", color: "text-emerald-400", icon: CheckCircle2 },
  EXPIRED:   { label: "Expired",  color: "text-red-400",     icon: Clock },
};

// ─── My Previews tab ─────────────────────────────────────────────────────────

function MyPreviews() {
  const [previews, setPreviews] = useState<BeatPreview[]>([]);
  const [loading, setLoading] = useState(true);

  // License modal state
  const [licensePreview, setLicensePreview] = useState<BeatPreview | null>(null);
  const [licenseType, setLicenseType] = useState<string>("NON_EXCLUSIVE");
  const [licensing, setLicensing] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  async function handlePreviewLicense() {
    if (!licensePreview?.track.price) return;
    setLicensing(true);
    setLicenseError(null);
    try {
      const res = await fetch("/api/beats/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewId: licensePreview.id, licenseType }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLicenseError(data.error ?? "Something went wrong.");
        setLicensing(false);
      }
    } catch {
      setLicenseError("Network error. Please try again.");
      setLicensing(false);
    }
  }

  useEffect(() => {
    fetch("/api/beats/previews")
      .then((r) => r.json())
      .then((d) => { setPreviews(d.previews ?? []); setLoading(false); });
  }, []);

  async function markListened(p: BeatPreview) {
    if (p.status === "PENDING") {
      await fetch(`/api/beats/previews/${p.id}`);  // GET marks as LISTENED server-side
      setPreviews((prev) => prev.map((x) => x.id === p.id ? { ...x, status: "LISTENED" } : x));
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;

  if (previews.length === 0) return (
    <div className="rounded-2xl border py-16 text-center space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <Music2 size={40} className="mx-auto text-muted-foreground opacity-40" />
      <p className="text-sm font-semibold text-foreground">No beat previews yet</p>
      <p className="text-xs text-muted-foreground">Producers will share previews with you here.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* ── Preview License Modal ─────────────────────────────────────── */}
      {licensePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            className="rounded-2xl border w-full max-w-md p-6 space-y-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">License Beat</p>
                <p className="text-base font-bold text-foreground truncate">{licensePreview.track.title}</p>
                <p className="text-sm text-muted-foreground">by {licensePreview.producer.displayName}</p>
              </div>
              <div className="flex items-start gap-2 shrink-0">
                {licensePreview.track.coverArtUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={licensePreview.track.coverArtUrl} alt={licensePreview.track.title} className="w-14 h-14 rounded-xl object-cover" />
                )}
                <button
                  onClick={() => setLicensePreview(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">License Type</p>
              {LICENSE_OPTIONS.map(({ type, label, description }) => (
                <button
                  key={type}
                  onClick={() => setLicenseType(type)}
                  className="w-full text-left rounded-xl border p-3 transition-all"
                  style={{
                    borderColor: licenseType === type ? "#D4A843" : "var(--border)",
                    backgroundColor: licenseType === type ? "rgba(212,168,67,0.06)" : "var(--background)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    {licensePreview.track.price && (
                      <p className="text-sm font-bold text-foreground">${licensePreview.track.price.toFixed(2)}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </button>
              ))}
            </div>

            {licenseError && <p className="text-xs text-red-400 text-center">{licenseError}</p>}
            {!licensePreview.track.price && (
              <p className="text-xs text-center text-muted-foreground">
                This track doesn&apos;t have a price set. Contact the producer directly.
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setLicensePreview(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Cancel
              </button>
              <button
                onClick={handlePreviewLicense}
                disabled={licensing || !licensePreview.track.price}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {licensing
                  ? <><Loader2 size={14} className="animate-spin" /> Processing…</>
                  : `Purchase — $${licensePreview.track.price?.toFixed(2) ?? "—"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {previews.map((p) => {
        const isExpired = new Date(p.expiresAt) < new Date();
        const effectiveStatus = isExpired && p.status !== "PURCHASED" ? "EXPIRED" : p.status;
        const effectiveCfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.PENDING;
        const EffectiveStatusIcon = effectiveCfg.icon;

        return (
          <div key={p.id} className="rounded-2xl border p-5 flex items-center gap-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div
              className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center"
              style={{
                backgroundImage: p.track.coverArtUrl ? `url(${p.track.coverArtUrl})` : undefined,
                backgroundSize: "cover", backgroundPosition: "center",
                backgroundColor: p.track.coverArtUrl ? undefined : "var(--border)",
              }}
            >
              {!p.track.coverArtUrl && <Music2 size={20} className="text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{p.track.title}</p>
              <p className="text-xs text-muted-foreground">by {p.producer.displayName}</p>
              {p.track.projectName && <p className="text-xs text-muted-foreground">{p.track.projectName}</p>}
              {(p.track.bpm != null || p.track.musicalKey) && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {p.track.bpm != null && (
                    <span className="text-[11px] font-semibold" style={{ color: "#D4A843" }}>{p.track.bpm} BPM</span>
                  )}
                  {p.track.bpm != null && p.track.musicalKey && (
                    <span className="text-[11px] text-muted-foreground/40">·</span>
                  )}
                  {p.track.musicalKey && (
                    <span className="text-[11px] font-semibold" style={{ color: "#D4A843" }}>{p.track.musicalKey}</span>
                  )}
                </div>
              )}
              {/* Beat player — shown unless expired-and-unpurchased */}
              {effectiveStatus !== "EXPIRED" && (
                <BeatPreviewPlayer
                  trackId={p.track.id}
                  title={p.track.title}
                  producerName={p.producer.displayName}
                  fileUrl={p.track.fileUrl}
                  coverArtUrl={p.track.coverArtUrl ?? undefined}
                  isOwned={effectiveStatus === "PURCHASED"}
                  onPlay={() => markListened(p)}
                  className="mt-2 w-full"
                />
              )}
            </div>
            {p.track.price && (
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-foreground">${p.track.price.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">license</p>
              </div>
            )}
            <div className={`flex items-center gap-1.5 text-xs font-semibold shrink-0 ${effectiveCfg.color}`}>
              <EffectiveStatusIcon size={12} />
              {effectiveCfg.label}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!isExpired && effectiveStatus !== "PURCHASED" && (
                <button
                  onClick={() => { setLicensePreview(p); setLicenseType("NON_EXCLUSIVE"); setLicenseError(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  <ShoppingCart size={12} /> License
                </button>
              )}
              {effectiveStatus === "PURCHASED" && p.isDownloadable && (
                <a
                  href={p.track.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-white/5 no-underline"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  <Download size={12} /> Download
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Browse Beats tab ─────────────────────────────────────────────────────────

const LICENSE_OPTIONS = [
  { type: "LEASE",         label: "Lease",         description: "Limited use — demos, non-commercial projects."      },
  { type: "NON_EXCLUSIVE", label: "Non-Exclusive",  description: "Commercial use. Producer may sell to others."      },
  { type: "EXCLUSIVE",     label: "Exclusive",      description: "Full rights. Producer stops selling this beat."    },
] as const;

function BrowseBeats() {
  const [tracks, setTracks] = useState<BrowseTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const currentTrack = useAudioStore((s) => s.currentTrack);

  // License modal state
  const [licenseTrack, setLicenseTrack] = useState<BrowseTrack | null>(null);
  const [licenseType, setLicenseType] = useState<string>("NON_EXCLUSIVE");
  const [licensing, setLicensing] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  async function handleLicense() {
    if (!licenseTrack?.price) return;
    setLicensing(true);
    setLicenseError(null);
    try {
      const res = await fetch("/api/beats/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: licenseTrack.id, licenseType }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLicenseError(data.error ?? "Something went wrong.");
        setLicensing(false);
      }
    } catch {
      setLicenseError("Network error. Please try again.");
      setLicensing(false);
    }
  }

  function openLicenseModal(track: BrowseTrack) {
    setLicenseTrack(track);
    setLicenseType("NON_EXCLUSIVE");
    setLicenseError(null);
  }

  useEffect(() => {
    fetch("/api/dashboard/marketplace/browse")
      .then((r) => r.json())
      .then((d) => { setTracks(d.tracks ?? []); setLoading(false); });
  }, []);

  const filtered = search.trim()
    ? tracks.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.artist.artistName ?? t.artist.name).toLowerCase().includes(search.toLowerCase())
      )
    : tracks;

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search beats or producers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/30"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        />
      </div>

      {/* ── License Modal ──────────────────────────────────────────────── */}
      {licenseTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            className="rounded-2xl border w-full max-w-md p-6 space-y-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">License Beat</p>
                <p className="text-base font-bold text-foreground truncate">{licenseTrack.title}</p>
                <p className="text-sm text-muted-foreground">
                  by {licenseTrack.artist.artistName ?? licenseTrack.artist.name}
                </p>
              </div>
              <div className="flex items-start gap-2 shrink-0">
                {licenseTrack.coverArtUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={licenseTrack.coverArtUrl}
                    alt={licenseTrack.title}
                    className="w-14 h-14 rounded-xl object-cover"
                  />
                )}
                <button
                  onClick={() => setLicenseTrack(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* License type selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">License Type</p>
              {LICENSE_OPTIONS.map(({ type, label, description }) => (
                <button
                  key={type}
                  onClick={() => setLicenseType(type)}
                  className="w-full text-left rounded-xl border p-3 transition-all"
                  style={{
                    borderColor: licenseType === type ? "#D4A843" : "var(--border)",
                    backgroundColor: licenseType === type ? "rgba(212,168,67,0.06)" : "var(--background)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    {licenseTrack.price && (
                      <p className="text-sm font-bold text-foreground">${licenseTrack.price.toFixed(2)}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </button>
              ))}
            </div>

            {licenseError && (
              <p className="text-xs text-red-400 text-center">{licenseError}</p>
            )}

            {!licenseTrack.price && (
              <p className="text-xs text-center text-muted-foreground">
                This track doesn&apos;t have a price set. Contact the producer directly.
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setLicenseTrack(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleLicense}
                disabled={licensing || !licenseTrack.price}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {licensing ? (
                  <><Loader2 size={14} className="animate-spin" /> Processing…</>
                ) : (
                  `Purchase — $${licenseTrack.price?.toFixed(2) ?? "—"}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border py-16 text-center space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <Music2 size={40} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">
            {search ? "No beats match your search" : "No beats available yet"}
          </p>
          <p className="text-xs text-muted-foreground">
            {search ? "Try a different search term." : "Producers will list their beats here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((t) => {
            const isThis       = currentTrack?.id === t.id;
            const producerName = t.artist.artistName ?? t.artist.name;

            return (
              <div
                key={t.id}
                className="rounded-2xl border p-4 flex items-center gap-4"
                style={{
                  backgroundColor: "var(--card)",
                  borderColor: isThis ? "#D4A843" : "var(--border)",
                  transition: "border-color 0.2s",
                }}
              >
                {/* Cover art */}
                <div
                  className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center"
                  style={{
                    backgroundImage: t.coverArtUrl ? `url(${t.coverArtUrl})` : undefined,
                    backgroundSize: "cover", backgroundPosition: "center",
                    backgroundColor: t.coverArtUrl ? undefined : "var(--border)",
                  }}
                >
                  {!t.coverArtUrl && <Music2 size={18} className="text-muted-foreground" />}
                </div>

                {/* Track info + ownership-aware beat player */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{t.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <User size={10} className="text-muted-foreground" />
                    <p className="text-xs text-muted-foreground truncate">{producerName}</p>
                    {t.projectName && (
                      <>
                        <span className="text-xs text-muted-foreground/40">·</span>
                        <p className="text-xs text-muted-foreground truncate">{t.projectName}</p>
                      </>
                    )}
                  </div>
                  {t.plays > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.plays} plays</p>
                  )}
                  {(t.bpm != null || t.musicalKey) && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {t.bpm != null && (
                        <span className="text-[11px] font-semibold" style={{ color: "#D4A843" }}>{t.bpm} BPM</span>
                      )}
                      {t.bpm != null && t.musicalKey && (
                        <span className="text-[11px] text-muted-foreground/40">·</span>
                      )}
                      {t.musicalKey && (
                        <span className="text-[11px] font-semibold" style={{ color: "#D4A843" }}>{t.musicalKey}</span>
                      )}
                    </div>
                  )}
                  {/* BeatPreviewPlayer: watermark + Preview badge if not owned;
                      full quality + Owned badge if licensed */}
                  <BeatPreviewPlayer
                    trackId={t.id}
                    title={t.title}
                    producerName={producerName}
                    fileUrl={t.fileUrl}
                    coverArtUrl={t.coverArtUrl ?? undefined}
                    isOwned={t.isOwned}
                    className="mt-2 w-full"
                  />
                </div>

                {/* Price */}
                {t.price && !t.isOwned && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">${t.price.toFixed(2)}</p>
                    <p className="text-[11px] text-muted-foreground">license</p>
                  </div>
                )}

                {/* License action — hidden once owned (BeatPreviewPlayer shows Owned badge) */}
                {!t.isOwned && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                      onClick={() => openLicenseModal(t)}
                    >
                      <ShoppingCart size={12} /> License
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [tab, setTab] = useState<"previews" | "browse">("previews");
  const searchParams = useSearchParams();
  const justLicensed = searchParams.get("licensed") === "1";
  const [dismissedBanner, setDismissedBanner] = useState(false);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {justLicensed && !dismissedBanner && (
        <div
          className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 border"
          style={{ backgroundColor: "rgba(52,199,89,0.08)", borderColor: "rgba(52,199,89,0.25)" }}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} style={{ color: "#34C759" }} />
            <div>
              <p className="text-sm font-semibold text-foreground">License purchased!</p>
              <p className="text-xs text-muted-foreground">Your beat license is confirmed. Check My Previews to download.</p>
            </div>
          </div>
          <button
            onClick={() => setDismissedBanner(true)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground">Beat Marketplace</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Discover and license beats from independent producers</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        {(["previews", "browse"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            style={
              tab === t
                ? { backgroundColor: "var(--background)", color: "var(--foreground)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            {t === "previews" ? "My Previews" : "Browse Beats"}
          </button>
        ))}
      </div>

      {tab === "previews" ? <MyPreviews /> : <BrowseBeats />}
    </div>
  );
}
