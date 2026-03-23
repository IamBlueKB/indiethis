"use client";

import { useState } from "react";
import { X, Radio, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BeatLicenseTrack = {
  id:                 string;
  title:              string;
  price:              number | null;
  coverArtUrl:        string | null;
  streamLeaseEnabled: boolean;
  artist: {
    name:       string;
    artistName: string | null;
    artistSlug: string | null;
  };
};

export type StreamLeaseTarget = {
  trackId:      string;
  beatTitle:    string;
  producerName: string;
  coverArtUrl:  string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const LICENSE_OPTIONS = [
  { type: "LEASE",         label: "Lease",        description: "Limited use — demos, non-commercial projects."  },
  { type: "NON_EXCLUSIVE", label: "Non-Exclusive", description: "Commercial use. Producer may sell to others."  },
  { type: "EXCLUSIVE",     label: "Exclusive",     description: "Full rights. Producer stops selling this beat." },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function BeatLicenseModal({
  track,
  onClose,
  onStreamLease,
}: {
  track:          BeatLicenseTrack;
  onClose:        () => void;
  onStreamLease?: (target: StreamLeaseTarget) => void;
}) {
  const [licenseType, setLicenseType] = useState<string>("NON_EXCLUSIVE");
  const [licensing,   setLicensing]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleLicense() {
    if (!track.price) return;
    setLicensing(true);
    setError(null);
    try {
      const res  = await fetch("/api/beats/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ trackId: track.id, licenseType }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (res.status === 401) { window.location.href = `/signup?next=/dashboard/marketplace`; return; }
      if (data.url) { window.location.href = data.url; return; }
      setError(data.error ?? "Something went wrong.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLicensing(false);
    }
  }

  function handleStreamLeaseClick() {
    const producerName = track.artist.artistName ?? track.artist.name;
    const target: StreamLeaseTarget = {
      trackId:     track.id,
      beatTitle:   track.title,
      producerName,
      coverArtUrl: track.coverArtUrl,
    };
    if (onStreamLease) {
      onClose();
      onStreamLease(target);
    } else {
      window.location.href = `/signup?next=/dashboard/marketplace`;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="rounded-2xl border w-full max-w-md p-6 space-y-5"
        style={{ backgroundColor: "var(--card, #1a1a1a)", borderColor: "var(--border, rgba(255,255,255,0.1))" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">License Beat</p>
            <p className="text-base font-bold text-foreground truncate">{track.title}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {track.artist.artistSlug ? (
                <a
                  href={`/${track.artist.artistSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline hover:underline"
                >
                  by {track.artist.artistName ?? track.artist.name}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">by {track.artist.artistName ?? track.artist.name}</p>
              )}
              {track.artist.artistSlug && (
                <a
                  href={`/${track.artist.artistSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] no-underline hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  View all beats →
                </a>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2 shrink-0">
            {track.coverArtUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.coverArtUrl} alt={track.title} className="w-14 h-14 rounded-xl object-cover" />
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* License options */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">License Type</p>
          {LICENSE_OPTIONS.map(({ type, label, description }) => (
            <button
              key={type}
              onClick={() => setLicenseType(type)}
              className="w-full text-left rounded-xl border p-3 transition-all"
              style={{
                borderColor:     licenseType === type ? "#D4A843" : "var(--border, rgba(255,255,255,0.1))",
                backgroundColor: licenseType === type ? "rgba(212,168,67,0.06)" : "var(--background, #111)",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                {track.price && <p className="text-sm font-bold text-foreground">${track.price.toFixed(2)}</p>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </button>
          ))}

          {track.streamLeaseEnabled && (
            <button
              onClick={handleStreamLeaseClick}
              className="w-full text-left rounded-xl border p-3 transition-all"
              style={{ borderColor: "rgba(232,93,74,0.4)", backgroundColor: "rgba(232,93,74,0.04)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio size={13} style={{ color: "#E85D4A" }} />
                  <p className="text-sm font-semibold text-foreground">Stream Lease</p>
                </div>
                <p className="text-sm font-bold" style={{ color: "#E85D4A" }}>$1/mo</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 pl-5">
                Record your song over this beat and stream it exclusively on IndieThis. Cancel anytime.
              </p>
            </button>
          )}
        </div>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        {!track.price && (
          <p className="text-xs text-center text-muted-foreground">
            This track doesn&apos;t have a price set. Contact the producer directly.
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border, rgba(255,255,255,0.1))", color: "var(--foreground, #fff)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleLicense()}
            disabled={licensing || !track.price}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {licensing
              ? <><Loader2 size={14} className="animate-spin" /> Processing…</>
              : `Purchase — $${track.price?.toFixed(2) ?? "—"}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
