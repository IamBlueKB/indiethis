"use client";

import { useEffect, useState, useCallback } from "react";
import { useAudioStore, type AudioTrack } from "@/store";
import {
  Radio, DollarSign, BarChart2, Music2,
  ChevronDown, ChevronRight, Play, Pause,
  ExternalLink, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lease = {
  id: string;
  trackTitle: string;
  audioUrl: string;
  coverUrl: string | null;
  isActive: boolean;
  activatedAt: string;
  cancelledAt: string | null;
  artist: {
    id: string;
    name: string;
    artistSlug: string | null;
    photo: string | null;
  };
  totalPlays: number;
  playsThisMonth: number;
};

type BeatGroup = {
  beatId: string;
  beatTitle: string;
  coverArtUrl: string | null;
  activeCount: number;
  totalLeases: number;
  monthlyIncome: number;
  totalPlays: number;
  playsThisMonth: number;
  leases: Lease[];
};

type Stats = {
  totalActiveLeases: number;
  monthlyIncome: number;
  totalPlaysThisMonth: number;
  mostPopularBeat: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Play Button ──────────────────────────────────────────────────────────────

function LeasePlayButton({ lease }: { lease: Lease }) {
  const { play, pause, resume, currentTrack, isPlaying } = useAudioStore();

  const isThis    = currentTrack?.id === lease.id;
  const isThisPlaying = isThis && isPlaying;

  function handleClick() {
    if (isThis) {
      isPlaying ? pause() : resume();
      return;
    }
    const track: AudioTrack = {
      id:       lease.id,
      title:    lease.trackTitle,
      artist:   lease.artist.name,
      src:      lease.audioUrl,
      coverArt: lease.coverUrl ?? undefined,
    };
    play(track);
  }

  return (
    <button
      onClick={handleClick}
      title={isThisPlaying ? "Pause" : "Play"}
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors"
      style={{
        backgroundColor: isThis ? "var(--accent)" : "var(--background)",
        border: "1px solid var(--border)",
        color: isThis ? "var(--background)" : "var(--muted-foreground)",
      }}
    >
      {isThisPlaying
        ? <Pause size={11} fill="currentColor" />
        : <Play  size={11} fill="currentColor" className="translate-x-px" />
      }
    </button>
  );
}

// ─── Beat Group Row ───────────────────────────────────────────────────────────

function BeatGroupCard({ group }: { group: BeatGroup }) {
  const [expanded, setExpanded] = useState(group.leases.length <= 5);

  const visibleLeases  = expanded ? group.leases : group.leases.slice(0, 3);
  const hiddenCount    = group.leases.length - 3;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      {/* Beat header */}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Cover */}
        <div
          className="w-11 h-11 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
          style={{ backgroundColor: "var(--background)" }}
        >
          {group.coverArtUrl
            ? <img src={group.coverArtUrl} alt={group.beatTitle} className="w-full h-full object-cover" />  // eslint-disable-line @next/next/no-img-element
            : <Music2 size={16} className="text-muted-foreground" />
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{group.beatTitle}</p>
          <p className="text-xs text-muted-foreground">
            {group.activeCount} active lease{group.activeCount !== 1 ? "s" : ""}
            {group.totalLeases > group.activeCount && ` · ${group.totalLeases - group.activeCount} cancelled`}
            {" · "}
            <span style={{ color: "#D4A843" }}>${group.monthlyIncome.toFixed(2)}/mo</span>
          </p>
        </div>

        {/* Expand icon */}
        <div className="text-muted-foreground">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {/* Lease rows */}
      {expanded && (
        <div className="border-t" style={{ borderColor: "var(--border)" }}>
          {visibleLeases.map((lease, i) => (
            <div
              key={lease.id}
              className={`flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors ${
                i < visibleLeases.length - 1 ? "border-b" : ""
              }`}
              style={{ borderColor: "var(--border)" }}
            >
              {/* Play button */}
              <LeasePlayButton lease={lease} />

              {/* Artist avatar */}
              <div
                className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: lease.artist.photo ? "transparent" : "var(--accent)",
                  color: "var(--background)",
                }}
              >
                {lease.artist.photo
                  ? <img src={lease.artist.photo} alt={lease.artist.name} className="w-full h-full object-cover" />  // eslint-disable-line @next/next/no-img-element
                  : lease.artist.name[0]?.toUpperCase()
                }
              </div>

              {/* Track title + artist */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    &ldquo;{lease.trackTitle}&rdquo;
                  </span>
                  {lease.artist.artistSlug && (
                    <a
                      href={`/${lease.artist.artistSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      title="View artist profile"
                    >
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  by{" "}
                  {lease.artist.artistSlug ? (
                    <a
                      href={`/${lease.artist.artistSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground transition-colors"
                    >
                      {lease.artist.name}
                    </a>
                  ) : (
                    lease.artist.name
                  )}
                </p>
              </div>

              {/* Play count */}
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-sm font-medium text-foreground">{lease.totalPlays.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">plays</p>
              </div>

              {/* Active since / cancelled */}
              <div className="text-right shrink-0 hidden md:block w-36">
                {lease.isActive ? (
                  <>
                    <p className="text-xs text-green-400 font-medium">Active</p>
                    <p className="text-[10px] text-muted-foreground">since {formatDate(lease.activatedAt)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground font-medium">Cancelled</p>
                    {lease.cancelledAt && (
                      <p className="text-[10px] text-muted-foreground">{formatDate(lease.cancelledAt)}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Show more / less */}
          {group.leases.length > 3 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-t"
              style={{ borderColor: "var(--border)" }}
            >
              {expanded
                ? "Show less"
                : `Show ${hiddenCount} more lease${hiddenCount !== 1 ? "s" : ""}…`
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProducerStreamLeasesPage() {
  const [beatGroups, setBeatGroups] = useState<BeatGroup[]>([]);
  const [stats,      setStats]      = useState<Stats>({
    totalActiveLeases: 0, monthlyIncome: 0, totalPlaysThisMonth: 0, mostPopularBeat: null,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/producer/stream-leases");
      if (res.ok) {
        const data = await res.json();
        setBeatGroups(data.beatGroups);
        setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">Stream Leases</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Leases",       value: stats.totalActiveLeases,                 icon: Radio },
          { label: "Monthly Income",      value: `$${stats.monthlyIncome.toFixed(2)}`,    icon: DollarSign },
          { label: "Plays This Month",    value: stats.totalPlaysThisMonth.toLocaleString(), icon: BarChart2 },
          { label: "Most Popular Beat",   value: stats.mostPopularBeat ?? "—",             icon: Music2 },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border p-4"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <p className={`font-bold text-foreground ${label === "Most Popular Beat" ? "text-sm truncate" : "text-2xl"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Beat groups */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : beatGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Radio size={36} className="text-muted-foreground mb-3" />
          <p className="font-medium text-foreground mb-1">No stream leases yet</p>
          <p className="text-sm text-muted-foreground">
            When artists lease your beats, they&apos;ll appear here grouped by beat.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {beatGroups.map((group) => (
            <BeatGroupCard key={group.beatId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
