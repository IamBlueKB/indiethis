"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Users, Music2, Check, X, Clock, AlertTriangle, Copy, CheckCircle2, Loader2, ChevronDown, ChevronUp, Plus, Download,
} from "lucide-react";
import SplitSheetModal from "../music/SplitSheetModal";

// ── Types ──────────────────────────────────────────────────────────────────

type SplitEntry = {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  role: string;
  percentage: number;
  agreedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  reviewToken: string;
};

type SplitSheet = {
  id: string;
  status: "PENDING" | "ACTIVE" | "DISPUTED" | "EXPIRED";
  documentUrl?: string | null;
  splits: SplitEntry[];
  track: { id: string; title: string; coverArtUrl: string | null };
  createdBy?: { name: string | null; email: string };
  createdById?: string;
};

// ── Status helpers ─────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; bg: string; color: string; Icon: React.FC<{ size?: number }> }> = {
  PENDING:  { label: "Pending",  bg: "rgba(212,168,67,0.12)",  color: "#D4A843", Icon: Clock },
  ACTIVE:   { label: "Active",   bg: "rgba(52,199,89,0.12)",   color: "#34C759", Icon: CheckCircle2 },
  DISPUTED: { label: "Disputed", bg: "rgba(232,93,74,0.12)",   color: "#E85D4A", Icon: AlertTriangle },
  EXPIRED:  { label: "Expired",  bg: "rgba(120,120,120,0.12)", color: "#888",    Icon: X },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.EXPIRED;
  const Icon = meta.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      <Icon size={10} />
      {meta.label}
    </span>
  );
}

// ── Split Sheet Card ────────────────────────────────────────────────────────

function SplitSheetCard({
  sheet,
  currentUserId,
  isOwned,
  onAgree,
  onReject,
  onCopyLink,
  copied,
}: {
  sheet: SplitSheet;
  currentUserId: string;
  isOwned: boolean;
  onAgree: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onCopyLink: (token: string) => void;
  copied: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  const mySplit = sheet.splits.find((s) => s.userId === currentUserId);
  const agreedCount = sheet.splits.filter((s) => s.agreedAt).length;
  const totalCount = sheet.splits.length;
  const progressPct = Math.round((agreedCount / totalCount) * 100);

  async function handleAgree() {
    setActing(true);
    try {
      const res = await fetch(`/api/dashboard/splits/${sheet.id}/agree`, { method: "POST" });
      if (res.ok) onAgree(sheet.id);
    } finally { setActing(false); }
  }

  async function handleReject() {
    setActing(true);
    try {
      const res = await fetch(`/api/dashboard/splits/${sheet.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      if (res.ok) { onReject(sheet.id, rejectReason); setRejecting(false); }
    } finally { setActing(false); }
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-5 py-4">
        {/* Cover art */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
          style={{ backgroundColor: "var(--border)" }}
        >
          {sheet.track.coverArtUrl
            ? <img src={sheet.track.coverArtUrl} alt={sheet.track.title} className="w-full h-full object-cover" />
            : <Music2 size={16} className="text-muted-foreground" />
          }
        </div>

        {/* Title + status */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{sheet.track.title}</p>
          {!isOwned && sheet.createdBy && (
            <p className="text-[11px] text-muted-foreground">from {sheet.createdBy.name ?? sheet.createdBy.email}</p>
          )}
        </div>

        <StatusBadge status={sheet.status} />

        {/* Download PDF */}
        {sheet.status === "ACTIVE" && sheet.documentUrl && (
          <a
            href={sheet.documentUrl}
            target="_blank"
            rel="noreferrer"
            title="Download split sheet PDF"
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
          >
            <Download size={12} />
          </a>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground"
          style={{ backgroundColor: "var(--border)" }}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Progress bar (PENDING) */}
      {sheet.status === "PENDING" && (
        <div className="px-5 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">{agreedCount} of {totalCount} agreed</span>
            <span className="text-[10px] font-semibold" style={{ color: "#D4A843" }}>{progressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, backgroundColor: "#D4A843" }}
            />
          </div>
        </div>
      )}

      {/* Expanded splits list */}
      {expanded && (
        <div className="border-t px-5 py-4 space-y-2" style={{ borderColor: "var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contributors</p>
          {sheet.splits.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{s.name}</p>
                <p className="text-[10px] text-muted-foreground">{s.email} · {s.role}</p>
              </div>
              <span className="text-sm font-bold shrink-0" style={{ color: "#D4A843" }}>{s.percentage}%</span>
              <div className="shrink-0">
                {s.agreedAt
                  ? <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}>✓ Agreed</span>
                  : s.rejectedAt
                    ? <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}>✗ Rejected</span>
                    : <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>⏳ Pending</span>
                }
              </div>
              {/* Copy link for non-user contributors (owner only) */}
              {isOwned && !s.userId && (
                <button
                  onClick={() => onCopyLink(s.reviewToken)}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                  title="Copy review link"
                >
                  {copied === s.reviewToken
                    ? <Check size={11} style={{ color: "#34C759" }} />
                    : <Copy size={11} />
                  }
                </button>
              )}
              {s.rejectionReason && (
                <span className="text-[10px] text-muted-foreground italic ml-1 truncate max-w-[120px]" title={s.rejectionReason}>
                  {s.rejectionReason}
                </span>
              )}
            </div>
          ))}

          {/* My action — agree/reject (if I'm a participant and haven't acted yet) */}
          {mySplit && !mySplit.agreedAt && !mySplit.rejectedAt && sheet.status === "PENDING" && (
            <div className="pt-2 space-y-2">
              {!rejecting ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleAgree}
                    disabled={acting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                    style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}
                  >
                    {acting ? <Loader2 size={12} className="animate-spin" /> : <><Check size={12} /> Agree to Split</>}
                  </button>
                  <button
                    onClick={() => setRejecting(true)}
                    disabled={acting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                    style={{ backgroundColor: "rgba(232,93,74,0.08)", color: "#E85D4A" }}
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    className="w-full rounded-xl border px-3 py-2.5 text-xs bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={acting}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                      style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}
                    >
                      {acting ? <Loader2 size={12} className="animate-spin" /> : "Confirm Reject"}
                    </button>
                    <button
                      onClick={() => setRejecting(false)}
                      disabled={acting}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground"
                      style={{ backgroundColor: "var(--border)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Track picker types ──────────────────────────────────────────────────────

type TrackOption = { id: string; title: string; coverArtUrl: string | null };

// ── Page ────────────────────────────────────────────────────────────────────

export default function SplitsPage() {
  const { data: session } = useSession();
  const currentUserId    = session?.user?.id    ?? "";
  const currentUserName  = (session?.user as { name?: string })?.name  ?? "";
  const currentUserEmail = (session?.user as { email?: string })?.email ?? "";

  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState<SplitSheet[]>([]);
  const [participating, setParticipating] = useState<SplitSheet[]>([]);
  const [tab, setTab] = useState<"mine" | "participating">("mine");
  const [copied, setCopied] = useState<string | null>(null);

  // Track picker
  const [showPicker, setShowPicker] = useState(false);
  const [tracks, setTracks]         = useState<TrackOption[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<TrackOption | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/splits")
      .then((r) => r.json())
      .then((d) => {
        setCreated(d.created ?? []);
        setParticipating(d.participating ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function openTrackPicker() {
    setShowPicker(true);
    if (tracks.length > 0) return; // already loaded
    setTracksLoading(true);
    try {
      const res = await fetch("/api/dashboard/tracks");
      const data = await res.json();
      setTracks(data.tracks ?? []);
    } finally {
      setTracksLoading(false);
    }
  }

  function copyLink(reviewToken: string) {
    const url = `${window.location.origin}/splits/review/${reviewToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(reviewToken);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function handleAgree(sheetId: string) {
    // Re-fetch to get updated state
    fetch("/api/dashboard/splits")
      .then((r) => r.json())
      .then((d) => {
        setCreated(d.created ?? []);
        setParticipating(d.participating ?? []);
      });
  }

  function handleReject(sheetId: string) {
    fetch("/api/dashboard/splits")
      .then((r) => r.json())
      .then((d) => {
        setCreated(d.created ?? []);
        setParticipating(d.participating ?? []);
      });
  }

  const activeList = tab === "mine" ? created : participating;

  const stats = {
    active: created.filter((s) => s.status === "ACTIVE").length + participating.filter((s) => s.status === "ACTIVE").length,
    pending: created.filter((s) => s.status === "PENDING").length + participating.filter((s) => s.status === "PENDING").length,
    disputed: created.filter((s) => s.status === "DISPUTED").length + participating.filter((s) => s.status === "DISPUTED").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Split Sheets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage royalty splits with collaborators</p>
        </div>
        <button
          onClick={openTrackPicker}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={15} /> New Split Sheet
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { label: "Active",   value: stats.active,   bg: "rgba(52,199,89,0.08)",   color: "#34C759" },
          { label: "Pending",  value: stats.pending,  bg: "rgba(212,168,67,0.08)",  color: "#D4A843" },
          { label: "Disputed", value: stats.disputed, bg: "rgba(232,93,74,0.08)",   color: "#E85D4A" },
        ] as const).map(({ label, value, bg, color }) => (
          <div
            key={label}
            className="rounded-2xl border p-4 text-center"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 p-1 rounded-xl border w-fit" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        {([
          { key: "mine", label: `My Sheets (${created.length})` },
          { key: "participating", label: `Participating (${participating.length})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === key
              ? { backgroundColor: "var(--background)", color: "var(--foreground)" }
              : { color: "var(--muted-foreground)" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={24} className="animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : activeList.length === 0 ? (
        <div
          className="rounded-2xl border py-16 text-center space-y-3"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: "rgba(212,168,67,0.1)" }}
          >
            <Users size={24} style={{ color: "#D4A843" }} />
          </div>
          <div>
            <p className="font-bold">
              {tab === "mine" ? "No split sheets yet" : "No split sheets to review"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {tab === "mine"
                ? "Click \"New Split Sheet\" above to get started."
                : "When artists invite you to a split sheet, it will appear here."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {activeList.map((sheet) => (
            <SplitSheetCard
              key={sheet.id}
              sheet={sheet}
              currentUserId={currentUserId}
              isOwned={tab === "mine"}
              onAgree={handleAgree}
              onReject={handleReject}
              onCopyLink={copyLink}
              copied={copied}
            />
          ))}
        </div>
      )}

      {/* Track picker modal */}
      {showPicker && !selectedTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="font-bold text-sm">New Split Sheet</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Choose a track to split earnings for</p>
              </div>
              <button
                onClick={() => setShowPicker(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {tracksLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : tracks.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Music2 size={28} className="mx-auto text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground">No tracks uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tracks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTrack(t); setShowPicker(false); }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border hover:border-[#D4A843]/40 transition-colors text-left"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                        style={{ backgroundColor: "var(--border)" }}
                      >
                        {t.coverArtUrl
                          ? <img src={t.coverArtUrl} alt={t.title} className="w-full h-full object-cover" />
                          : <Music2 size={14} className="text-muted-foreground" />
                        }
                      </div>
                      <p className="text-sm font-semibold truncate">{t.title}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Split sheet modal for selected track */}
      {selectedTrack && (
        <SplitSheetModal
          trackId={selectedTrack.id}
          trackTitle={selectedTrack.title}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserEmail={currentUserEmail}
          onClose={() => {
            setSelectedTrack(null);
            fetch("/api/dashboard/splits")
              .then((r) => r.json())
              .then((d) => {
                setCreated(d.created ?? []);
                setParticipating(d.participating ?? []);
              });
          }}
        />
      )}
    </div>
  );
}
