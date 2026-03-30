"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Shield, CheckCircle2, AlertCircle, Loader2, Download,
  ChevronDown, ChevronUp, Music2, AlertTriangle,
} from "lucide-react";
import { PRICING_DEFAULTS } from "@/lib/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────

type PackageType = "SINGLE" | "PACK_5" | "PACK_10" | "CATALOG";
type ScanStatus  = "PENDING" | "SCANNING" | "COMPLETED" | "FAILED";

interface MatchEntry {
  platform:   string;
  url:        string | null;
  uploader:   string;
  confidence: number;
  foundAt:    string;
  title:      string;
  artist:     string;
  album:      string;
}

interface TrackResult {
  id:         string;
  trackId:    string;
  matchCount: number;
  matches:    MatchEntry[];
  scannedAt:  string;
  track: {
    id:         string;
    title:      string;
    coverArtUrl: string | null;
  };
}

interface Scan {
  id:          string;
  packageType: string;
  amount:      number;
  status:      ScanStatus;
  createdAt:   string;
  completedAt: string | null;
  tracks:      TrackResult[];
}

interface TrackSummary {
  id:         string;
  title:      string;
  coverArtUrl: string | null;
  fileUrl:    string;
}

// ─── Package config ───────────────────────────────────────────────────────────

const PACKAGES: Array<{
  type:  PackageType;
  label: string;
  limit: number;
  pricingKey: keyof typeof PRICING_DEFAULTS;
}> = [
  { type: "SINGLE",  label: "Single Track",   limit: 1,  pricingKey: "TRACK_SHIELD_SINGLE"  },
  { type: "PACK_5",  label: "5-Track Pack",   limit: 5,  pricingKey: "TRACK_SHIELD_5"       },
  { type: "PACK_10", label: "10-Track Pack",  limit: 10, pricingKey: "TRACK_SHIELD_10"      },
  { type: "CATALOG", label: "Full Catalog",   limit: 50, pricingKey: "TRACK_SHIELD_CATALOG" },
];

const PACKAGE_LABELS: Record<string, string> = {
  SINGLE:  "Single Track",
  PACK_5:  "5-Track Pack",
  PACK_10: "10-Track Pack",
  CATALOG: "Full Catalog",
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ScanStatus }) {
  const map: Record<ScanStatus, { label: string; bg: string; color: string }> = {
    PENDING:   { label: "Pending",   bg: "#78350f22", color: "#D97706" },
    SCANNING:  { label: "Scanning",  bg: "#1e3a8a22", color: "#60A5FA" },
    COMPLETED: { label: "Completed", bg: "#14532d22", color: "#4ADE80" },
    FAILED:    { label: "Failed",    bg: "#7f1d1d22", color: "#F87171" },
  };
  const s = map[status] ?? map.PENDING;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// ─── Single scan row ──────────────────────────────────────────────────────────

function ScanRow({ scan }: { scan: Scan }) {
  const [expanded, setExpanded] = useState(false);
  const totalMatches = scan.tracks.reduce((n, r) => n + r.matchCount, 0);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      {/* Header row */}
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {PACKAGE_LABELS[scan.packageType] ?? scan.packageType}
            </span>
            <StatusBadge status={scan.status} />
            {totalMatches > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
                style={{ backgroundColor: "#7f1d1d22", color: "#F87171" }}
              >
                <AlertTriangle size={11} />
                {totalMatches} match{totalMatches !== 1 ? "es" : ""} found
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {new Date(scan.createdAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
            {" · "}
            {scan.tracks.length} track{scan.tracks.length !== 1 ? "s" : ""}
            {" · "}
            ${(scan.amount / 100).toFixed(2)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {scan.status === "COMPLETED" && (
            <a
              href={`/api/dashboard/ai/track-shield/${scan.id}/pdf`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors no-underline"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              <Download size={13} />
              Download
            </a>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? "Hide" : "View"}
          </button>
        </div>
      </div>

      {/* Expanded results */}
      {expanded && (
        <div
          className="border-t px-4 py-3 space-y-3"
          style={{ borderColor: "var(--border)" }}
        >
          {scan.tracks.map((result) => (
            <div key={result.id}>
              <div className="flex items-center gap-2 mb-1">
                {result.track.coverArtUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.track.coverArtUrl}
                    alt={result.track.title}
                    className="w-8 h-8 rounded object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "var(--muted)" }}
                  >
                    <Music2 size={14} style={{ color: "var(--muted-foreground)" }} />
                  </div>
                )}
                <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {result.track.title}
                </span>
                {result.matchCount === 0 ? (
                  <span className="text-xs" style={{ color: "#4ADE80" }}>
                    <CheckCircle2 size={12} className="inline mr-1" />
                    No matches
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "#F87171" }}>
                    <AlertTriangle size={12} className="inline mr-1" />
                    {result.matchCount} match{result.matchCount !== 1 ? "es" : ""}
                  </span>
                )}
              </div>

              {result.matchCount > 0 && (
                <div className="ml-10 space-y-2">
                  {result.matches.map((m, i) => (
                    <div
                      key={i}
                      className="rounded-lg p-3 text-xs space-y-1"
                      style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
                    >
                      <div>
                        <span style={{ color: "var(--muted-foreground)" }}>Platform: </span>
                        {m.platform}
                      </div>
                      <div>
                        <span style={{ color: "var(--muted-foreground)" }}>Match: </span>
                        {m.title} — {m.artist}
                        {m.album && ` (${m.album})`}
                      </div>
                      <div>
                        <span style={{ color: "var(--muted-foreground)" }}>Confidence: </span>
                        {m.confidence}%
                      </div>
                      {m.url && (
                        <div>
                          <span style={{ color: "var(--muted-foreground)" }}>URL: </span>
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#D4A843" }}
                          >
                            {m.url}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TrackShieldTool() {
  const searchParams = useSearchParams();
  const paidParam   = searchParams.get("paid");
  const scanIdParam = searchParams.get("scanId");

  const [scans,           setScans]           = useState<Scan[]>([]);
  const [tracks,          setTracks]          = useState<TrackSummary[]>([]);
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [selectedPackage, setSelectedPackage] = useState<PackageType>("SINGLE");
  const [loading,         setLoading]         = useState(true);
  const [scanning,        setScanning]        = useState(false);
  const [checkingOut,     setCheckingOut]     = useState(false);
  const [scanError,       setScanError]       = useState<string | null>(null);
  const [activeScanId,    setActiveScanId]    = useState<string | null>(null);

  // Load scan history + user tracks
  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/ai/track-shield").then((r) => r.json()),
      fetch("/api/dashboard/tracks").then((r) => r.json()),
    ])
      .then(([scanData, trackData]: [{ scans?: Scan[] }, { tracks?: TrackSummary[] }]) => {
        setScans(scanData.scans ?? []);
        setTracks(trackData.tracks ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Auto-run scan after Stripe redirect
  const runScan = useCallback(async (scanId: string) => {
    setScanning(true);
    setScanError(null);
    setActiveScanId(scanId);
    try {
      const res = await fetch("/api/dashboard/ai/track-shield/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId }),
      });
      const data = await res.json() as { scan?: Scan; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      if (data.scan) {
        setScans((prev) => {
          const idx = prev.findIndex((s) => s.id === data.scan!.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = data.scan!;
            return next;
          }
          return [data.scan!, ...prev];
        });
      }
      // Clean URL
      window.history.replaceState({}, "", "/dashboard/ai/track-shield");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (paidParam === "1" && scanIdParam) {
      runScan(scanIdParam);
    }
  }, [paidParam, scanIdParam, runScan]);

  // Package selection & validation
  const currentPkg = PACKAGES.find((p) => p.type === selectedPackage)!;

  function toggleTrack(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size < currentPkg.limit) next.add(id);
      }
      return next;
    });
  }

  function handlePackageChange(type: PackageType) {
    setSelectedPackage(type);
    const limit = PACKAGES.find((p) => p.type === type)!.limit;
    if (selectedIds.size > limit) {
      const arr = Array.from(selectedIds).slice(0, limit);
      setSelectedIds(new Set(arr));
    }
  }

  async function handleCheckout() {
    if (selectedIds.size === 0) return;
    setCheckingOut(true);
    try {
      const res = await fetch("/api/dashboard/ai/track-shield/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackIds:    Array.from(selectedIds),
          packageType: selectedPackage,
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckingOut(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 pt-2 pb-12 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "#D4A84318" }}
        >
          <Shield size={24} style={{ color: "#D4A843" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Track Shield
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Scan for unauthorized use of your music across the internet
          </p>
        </div>
      </div>

      {/* Post-payment scanning state */}
      {scanning && (
        <div
          className="flex items-center gap-3 rounded-xl border px-5 py-4"
          style={{ borderColor: "#D4A84340", backgroundColor: "#D4A84310" }}
        >
          <Loader2 size={20} className="animate-spin shrink-0" style={{ color: "#D4A843" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>
              Scanning your tracks…
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              This may take up to a minute. Do not close this tab.
            </p>
          </div>
        </div>
      )}

      {scanError && (
        <div
          className="flex items-center gap-3 rounded-xl border px-5 py-4"
          style={{ borderColor: "#7f1d1d40", backgroundColor: "#7f1d1d10" }}
        >
          <AlertCircle size={20} className="shrink-0" style={{ color: "#F87171" }} />
          <p className="text-sm" style={{ color: "#F87171" }}>{scanError}</p>
        </div>
      )}

      {/* Recently completed scan highlight */}
      {!scanning && activeScanId && (
        (() => {
          const completedScan = scans.find((s) => s.id === activeScanId);
          if (!completedScan || completedScan.status !== "COMPLETED") return null;
          const total = completedScan.tracks.reduce((n, r) => n + r.matchCount, 0);
          return (
            <div
              className="flex items-center gap-3 rounded-xl border px-5 py-4"
              style={{
                borderColor: total > 0 ? "#7f1d1d40" : "#14532d40",
                backgroundColor: total > 0 ? "#7f1d1d10" : "#14532d10",
              }}
            >
              {total > 0 ? (
                <AlertTriangle size={20} className="shrink-0" style={{ color: "#F87171" }} />
              ) : (
                <CheckCircle2 size={20} className="shrink-0" style={{ color: "#4ADE80" }} />
              )}
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: total > 0 ? "#F87171" : "#4ADE80" }}
                >
                  {total > 0
                    ? `${total} potential match${total !== 1 ? "es" : ""} found`
                    : "No matches found — your music is clean!"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  See the full report below.
                </p>
              </div>
            </div>
          );
        })()
      )}

      {/* Past scans */}
      {!loading && scans.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            Scan History
          </h2>
          <div className="space-y-3">
            {scans.map((scan) => (
              <ScanRow key={scan.id} scan={scan} />
            ))}
          </div>
        </section>
      )}

      {/* New scan */}
      <section
        className="rounded-2xl border p-6 space-y-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
          New Scan
        </h2>

        {/* Package selector */}
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: "var(--foreground)" }}>
            Choose a package
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PACKAGES.map((pkg) => {
              const price = PRICING_DEFAULTS[pkg.pricingKey];
              const active = selectedPackage === pkg.type;
              return (
                <button
                  key={pkg.type}
                  onClick={() => handlePackageChange(pkg.type)}
                  className="rounded-xl border p-4 text-left transition-all"
                  style={{
                    borderColor: active ? "#D4A843" : "var(--border)",
                    backgroundColor: active ? "#D4A84314" : "var(--background)",
                  }}
                >
                  <p className="text-sm font-semibold" style={{ color: active ? "#D4A843" : "var(--foreground)" }}>
                    {pkg.label}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                    Up to {pkg.limit} track{pkg.limit !== 1 ? "s" : ""}
                  </p>
                  <p className="text-lg font-bold mt-2" style={{ color: active ? "#D4A843" : "var(--foreground)" }}>
                    {price.display}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Track selector */}
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
            Select tracks{" "}
            <span style={{ color: "var(--muted-foreground)" }}>
              ({selectedIds.size}/{currentPkg.limit})
            </span>
          </p>
          <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
            {currentPkg.type === "SINGLE"
              ? "Select 1 track to scan."
              : `Select up to ${currentPkg.limit} tracks to scan.`}
          </p>

          {loading ? (
            <div className="flex items-center gap-2 py-4" style={{ color: "var(--muted-foreground)" }}>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading tracks…</span>
            </div>
          ) : tracks.length === 0 ? (
            <p className="text-sm py-4" style={{ color: "var(--muted-foreground)" }}>
              No tracks uploaded yet. Upload music from{" "}
              <a href="/dashboard/music" style={{ color: "#D4A843" }}>
                My Music
              </a>{" "}
              first.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {tracks.map((track) => {
                const selected = selectedIds.has(track.id);
                const disabled = !selected && selectedIds.size >= currentPkg.limit;
                return (
                  <label
                    key={track.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors"
                    style={{
                      borderColor:     selected ? "#D4A843" : "var(--border)",
                      backgroundColor: selected ? "#D4A84310" : "transparent",
                      opacity:         disabled ? 0.4 : 1,
                      cursor:          disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={disabled}
                      onChange={() => toggleTrack(track.id)}
                      className="shrink-0"
                      style={{ accentColor: "#D4A843" }}
                    />
                    {track.coverArtUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={track.coverArtUrl}
                        alt={track.title}
                        className="w-8 h-8 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "var(--muted)" }}
                      >
                        <Music2 size={14} style={{ color: "var(--muted-foreground)" }} />
                      </div>
                    )}
                    <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                      {track.title}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleCheckout}
            disabled={selectedIds.size === 0 || checkingOut}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              backgroundColor: selectedIds.size === 0 || checkingOut ? "var(--muted)" : "#D4A843",
              color:           selectedIds.size === 0 || checkingOut ? "var(--muted-foreground)" : "#0A0A0A",
              cursor:          selectedIds.size === 0 || checkingOut ? "not-allowed" : "pointer",
            }}
          >
            {checkingOut ? (
              <><Loader2 size={16} className="animate-spin" /> Processing…</>
            ) : (
              <><Shield size={16} /> Scan Now — {PRICING_DEFAULTS[currentPkg.pricingKey].display}</>
            )}
          </button>
          {selectedIds.size > 0 && (
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {selectedIds.size} track{selectedIds.size !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      </section>

      {/* How it works */}
      <section
        className="rounded-2xl border p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>
          How Track Shield Works
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              step: "1",
              title: "Select & Pay",
              desc: "Choose the tracks you want scanned and complete a one-time payment.",
            },
            {
              step: "2",
              title: "Deep Scan",
              desc: "Track Shield cross-references your audio against a database of 80M+ songs.",
            },
            {
              step: "3",
              title: "Get Your Report",
              desc: "View matches with confidence scores, sources, and download a full report.",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {item.step}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {item.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
