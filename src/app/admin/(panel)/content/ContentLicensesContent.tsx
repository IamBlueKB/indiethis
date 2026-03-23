"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Archive, ExternalLink, Mail, CheckCircle,
  AlertTriangle, Music2, Radio, ChevronDown, ChevronRight,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type LicenseSource = string;

type LicenseDoc = {
  id:        string;
  title:     string;
  fileUrl:   string;
  fileType:  string;
  source:    LicenseSource;
  notes:     string | null;
  createdAt: string;
};

type Artist = {
  id:    string;
  name:  string;
  email: string;
};

type Beat = {
  id:               string;
  title:            string;
  createdAt:        string;
  artist:           Artist;
  licenseDocuments: LicenseDoc[];
};

type Track = Beat; // same shape

type StreamLease = {
  id:                string;
  trackTitle:        string;
  createdAt:         string;
  duplicateFlag:     boolean;
  duplicateFlagNote: string | null;
  isActive:          boolean;
  artist:            Artist;
  licenseDocuments:  LicenseDoc[];
};

type TabType = "beats" | "tracks" | "leases";

// ─── Source config ─────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  SPLICE:           "Splice",
  SUNO:             "Suno",
  UDIO:             "Udio",
  SOUNDRAW:         "Soundraw",
  LANDR:            "LANDR",
  TRACKLIB:         "Tracklib",
  LOOPCLOUD:        "Loopcloud",
  AI_GENERATION:    "AI Generated",
  SAMPLE_CLEARANCE: "Sample Clearance",
  WORK_FOR_HIRE:    "Work for Hire",
  CUSTOM:           "Custom",
  OTHER:            "Other",
};

const SOURCE_COLORS: Record<string, string> = {
  SPLICE:           "text-blue-400",
  SUNO:             "text-violet-400",
  UDIO:             "text-purple-400",
  SOUNDRAW:         "text-cyan-400",
  LANDR:            "text-emerald-400",
  TRACKLIB:         "text-teal-400",
  LOOPCLOUD:        "text-indigo-400",
  AI_GENERATION:    "text-amber-400",
  SAMPLE_CLEARANCE: "text-rose-400",
  WORK_FOR_HIRE:    "text-orange-400",
  CUSTOM:           "text-stone-400",
  OTHER:            "text-zinc-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Inline license documents ─────────────────────────────────────────────────

function LicensesSection({ docs }: { docs: LicenseDoc[] }) {
  if (docs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No license documents attached.</p>
    );
  }

  return (
    <div className="space-y-2">
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 px-3 py-2 rounded-lg"
          style={{ backgroundColor: "var(--background)" }}
        >
          <FileText size={13} className="text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground truncate">{doc.title}</span>
              <span className={cn("text-[10px] font-medium shrink-0", SOURCE_COLORS[doc.source] ?? "text-zinc-400")}>
                {SOURCE_LABELS[doc.source] ?? doc.source}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">{fmt(doc.createdAt)}</p>
          </div>
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-accent hover:underline shrink-0"
          >
            <ExternalLink size={11} />
            View
          </a>
        </div>
      ))}
    </div>
  );
}

// ─── Content card (shared between beats/tracks/leases) ───────────────────────

type ContentCardProps = {
  id:               string;
  title:            string;
  artist:           Artist;
  createdAt:        string;
  licenseDocuments: LicenseDoc[];
  contentType:      "beat" | "track" | "streamLease";
  badge?:           React.ReactNode;
};

function ContentCard({
  id, title, artist, createdAt, licenseDocuments, contentType, badge,
}: ContentCardProps) {
  const [expanded,   setExpanded]   = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [sent,       setSent]       = useState(false);
  const [error,      setError]      = useState("");

  const hasDocuments = licenseDocuments.length > 0;

  async function requestDocs() {
    setRequesting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/content/${contentType}/${id}/request-docs`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to send email.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Network error.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--card)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {expanded
            ? <ChevronDown size={15} />
            : <ChevronRight size={15} />
          }
        </button>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{title}</span>
            {badge}
            {/* License count badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
                hasDocuments
                  ? "bg-emerald-500/12 text-emerald-400"
                  : "bg-white/5 text-muted-foreground"
              )}
            >
              <Archive size={9} />
              {hasDocuments ? `${licenseDocuments.length} doc${licenseDocuments.length !== 1 ? "s" : ""}` : "No docs"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            <button
              onClick={() => window.open(`/admin/users/${artist.id}`, "_blank")}
              className="hover:underline hover:text-foreground transition-colors"
            >
              {artist.name}
            </button>
            {" · "}{artist.email}{" · "}Added {fmt(createdAt)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {sent ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <CheckCircle size={13} />
              Email sent
            </span>
          ) : (
            <button
              onClick={requestDocs}
              disabled={requesting}
              title="Send documentation request email to user"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "rgba(212,168,67,0.12)",
                color: "#D4A843",
                border: "1px solid rgba(212,168,67,0.25)",
              }}
            >
              {requesting
                ? <Loader2 size={12} className="animate-spin" />
                : <Mail size={12} />
              }
              Request Docs
            </button>
          )}
        </div>
      </div>

      {/* Expanded: license docs section */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-1 border-t"
          style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Licenses
          </p>
          <LicensesSection docs={licenseDocuments} />
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContentLicensesContent() {
  const [beats,        setBeats]       = useState<Beat[]>([]);
  const [tracks,       setTracks]      = useState<Track[]>([]);
  const [streamLeases, setLeases]      = useState<StreamLease[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [activeTab,    setActiveTab]   = useState<TabType>("leases");
  const [showFlaggedOnly, setFlaggedOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/content");
      if (res.ok) {
        const j = await res.json();
        setBeats(j.beats   ?? []);
        setTracks(j.tracks ?? []);
        setLeases(j.streamLeases ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Derived
  const flaggedLeases = streamLeases.filter(l => l.duplicateFlag);
  const displayedLeases = showFlaggedOnly ? flaggedLeases : streamLeases;

  const tabCounts: Record<TabType, number> = {
    beats:  beats.length,
    tracks: tracks.length,
    leases: streamLeases.length,
  };

  const TABS: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: "leases", label: "Stream Leases", icon: Radio  },
    { key: "beats",  label: "Beats",         icon: Music2 },
    { key: "tracks", label: "Tracks",        icon: Music2 },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
            Content &amp; Licenses
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review attached license documents for beats, tracks, and stream leases. Request documentation from users when needed.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-white/5 transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Loader2 size={14} className={loading ? "animate-spin" : "hidden"} />
          Refresh
        </button>
      </div>

      {/* Flagged alert */}
      {!loading && flaggedLeases.length > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{
            backgroundColor: "rgba(255,159,10,0.08)",
            border: "1px solid rgba(255,159,10,0.25)",
          }}
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: "#FF9F0A" }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "#FF9F0A" }}>
              {flaggedLeases.length} stream lease{flaggedLeases.length !== 1 ? "s" : ""} flagged for duplicate audio
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              These leases may involve reused audio. Review their license documentation and request proof of ownership if missing.
            </p>
          </div>
          <button
            onClick={() => { setActiveTab("leases"); setFlaggedOnly(true); }}
            className="text-xs font-medium shrink-0 hover:underline"
            style={{ color: "#FF9F0A" }}
          >
            View flagged →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); if (key !== "leases") setFlaggedOnly(false); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === key
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={14} />
            {label}
            <span
              className={cn(
                "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                activeTab === key ? "bg-accent/15 text-accent" : "bg-white/5 text-muted-foreground"
              )}
            >
              {tabCounts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Flagged-only toggle for leases tab */}
      {activeTab === "leases" && flaggedLeases.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFlaggedOnly(f => !f)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              showFlaggedOnly
                ? "text-[#0A0A0A]"
                : "text-muted-foreground hover:text-foreground bg-white/5"
            )}
            style={showFlaggedOnly ? { backgroundColor: "#FF9F0A" } : {}}
          >
            <AlertTriangle size={11} />
            Flagged only ({flaggedLeases.length})
          </button>
          {showFlaggedOnly && (
            <button
              onClick={() => setFlaggedOnly(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Show all
            </button>
          )}
        </div>
      )}

      {/* Content list */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading…
        </div>
      ) : (
        <div className="space-y-2">
          {activeTab === "beats" && (
            beats.length === 0
              ? <EmptyState label="No beats found." />
              : beats.map(b => (
                <ContentCard
                  key={b.id}
                  id={b.id}
                  title={b.title}
                  artist={b.artist}
                  createdAt={b.createdAt}
                  licenseDocuments={b.licenseDocuments}
                  contentType="beat"
                />
              ))
          )}

          {activeTab === "tracks" && (
            tracks.length === 0
              ? <EmptyState label="No tracks found." />
              : tracks.map(t => (
                <ContentCard
                  key={t.id}
                  id={t.id}
                  title={t.title}
                  artist={t.artist}
                  createdAt={t.createdAt}
                  licenseDocuments={t.licenseDocuments}
                  contentType="track"
                />
              ))
          )}

          {activeTab === "leases" && (
            displayedLeases.length === 0
              ? <EmptyState label={showFlaggedOnly ? "No flagged leases." : "No stream leases found."} />
              : displayedLeases.map(l => (
                <ContentCard
                  key={l.id}
                  id={l.id}
                  title={l.trackTitle}
                  artist={l.artist}
                  createdAt={l.createdAt}
                  licenseDocuments={l.licenseDocuments}
                  contentType="streamLease"
                  badge={l.duplicateFlag ? (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                      style={{
                        backgroundColor: "rgba(255,159,10,0.15)",
                        color: "#FF9F0A",
                      }}
                    >
                      <AlertTriangle size={9} />
                      Duplicate flag
                    </span>
                  ) : undefined}
                />
              ))
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      className="rounded-2xl border p-12 text-center"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <Archive size={28} className="mx-auto mb-3 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
