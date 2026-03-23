"use client";

import { useState } from "react";
import { Music2, Check, X, Loader2, Users, AlertTriangle, CheckCircle2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type SplitEntry = {
  id: string;
  name: string;
  role: string;
  percentage: number;
  agreedAt: string | null;
  rejectedAt: string | null;
};

type ReviewData = {
  sheet: {
    id: string;
    status: "PENDING" | "ACTIVE" | "DISPUTED" | "EXPIRED";
    track: { id: string; title: string; coverArtUrl: string | null };
    createdBy: { name: string | null };
    splits: SplitEntry[];
  };
  mySplit: {
    id: string;
    name: string;
    role: string;
    percentage: number;
    agreedAt: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
  };
};

// ── Component ──────────────────────────────────────────────────────────────

export default function SplitReviewClient({
  token,
  initialData,
}: {
  token: string;
  initialData: ReviewData;
}) {
  const [data, setData] = useState<ReviewData>(initialData);
  const [acting, setActing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [done, setDone] = useState<"agreed" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { sheet, mySplit } = data;
  const agreedCount = sheet.splits.filter((s) => s.agreedAt).length;
  const totalCount = sheet.splits.length;
  const progressPct = Math.round((agreedCount / totalCount) * 100);

  const alreadyActed = !!mySplit.agreedAt || !!mySplit.rejectedAt;
  const sheetClosed = sheet.status === "ACTIVE" || sheet.status === "EXPIRED";

  async function handleAgree() {
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/splits/review/${token}/agree`, { method: "POST" });
      if (res.ok) {
        setDone("agreed");
      } else {
        const d = await res.json();
        setError(d.error ?? "Something went wrong");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/splits/review/${token}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      if (res.ok) {
        setDone("rejected");
      } else {
        const d = await res.json();
        setError(d.error ?? "Something went wrong");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setActing(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      <div className="w-full max-w-md space-y-5">
        {/* Brand header */}
        <div className="text-center">
          <p className="text-lg font-black tracking-tight" style={{ color: "#D4A843" }}>IndieThis</p>
          <p className="text-xs text-gray-500 mt-0.5">Split Sheet Review</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
        >
          {/* Track header */}
          <div className="flex items-center gap-4 p-5 border-b" style={{ borderColor: "#2a2a2a" }}>
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
              style={{ backgroundColor: "#1e1e1e" }}
            >
              {sheet.track.coverArtUrl
                ? <img src={sheet.track.coverArtUrl} alt={sheet.track.title} className="w-full h-full object-cover" />
                : <Music2 size={22} style={{ color: "#666" }} />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate">{sheet.track.title}</p>
              <p className="text-sm mt-0.5" style={{ color: "#888" }}>
                Managed by {sheet.createdBy.name ?? "an artist"} on IndieThis
              </p>
            </div>
          </div>

          {/* My split highlight */}
          <div className="p-5 border-b" style={{ borderColor: "#2a2a2a" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "#666" }}>Your Share</p>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-3xl font-black" style={{ color: "#D4A843" }}>{mySplit.percentage}%</p>
              </div>
              <div>
                <p className="font-semibold text-white">{mySplit.name}</p>
                <p className="text-sm" style={{ color: "#888" }}>{mySplit.role}</p>
              </div>
            </div>
          </div>

          {/* All contributors */}
          <div className="p-5 border-b" style={{ borderColor: "#2a2a2a" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "#666" }}>All Contributors</p>
            <div className="space-y-2">
              {sheet.splits.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: "#1a1a1a" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                    <p className="text-[10px]" style={{ color: "#888" }}>{s.role}</p>
                  </div>
                  <span className="font-bold text-sm shrink-0" style={{ color: "#D4A843" }}>{s.percentage}%</span>
                  <div className="shrink-0">
                    {s.agreedAt
                      ? <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}>✓ Agreed</span>
                      : s.rejectedAt
                        ? <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}>✗ Rejected</span>
                        : <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>⏳ Pending</span>
                    }
                  </div>
                </div>
              ))}
            </div>

            {/* Progress */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px]" style={{ color: "#666" }}>{agreedCount} of {totalCount} agreed</span>
                <span className="text-[10px] font-semibold" style={{ color: "#D4A843" }}>{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#2a2a2a" }}>
                <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: "#D4A843", transition: "width 0.3s" }} />
              </div>
            </div>
          </div>

          {/* Action area */}
          <div className="p-5">
            {done === "agreed" ? (
              <div className="text-center space-y-2 py-3">
                <CheckCircle2 size={32} className="mx-auto" style={{ color: "#34C759" }} />
                <p className="font-bold text-white">You agreed to the split!</p>
                <p className="text-sm" style={{ color: "#888" }}>
                  The track creator has been notified. Earnings will be distributed automatically once all contributors agree.
                </p>
              </div>
            ) : done === "rejected" ? (
              <div className="text-center space-y-2 py-3">
                <AlertTriangle size={32} className="mx-auto" style={{ color: "#E85D4A" }} />
                <p className="font-bold text-white">You rejected the split.</p>
                <p className="text-sm" style={{ color: "#888" }}>
                  The track creator has been notified. They may revise and re-send the split sheet.
                </p>
              </div>
            ) : alreadyActed ? (
              <div className="text-center space-y-2 py-3">
                {mySplit.agreedAt ? (
                  <>
                    <CheckCircle2 size={28} className="mx-auto" style={{ color: "#34C759" }} />
                    <p className="font-semibold text-white">You already agreed</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={28} className="mx-auto" style={{ color: "#E85D4A" }} />
                    <p className="font-semibold text-white">You already rejected this split</p>
                    {mySplit.rejectionReason && (
                      <p className="text-sm italic" style={{ color: "#888" }}>"{mySplit.rejectionReason}"</p>
                    )}
                  </>
                )}
              </div>
            ) : sheetClosed ? (
              <div className="text-center py-3">
                <p className="font-semibold" style={{ color: "#888" }}>
                  {sheet.status === "ACTIVE" ? "This split sheet is now active." : "This split sheet has expired."}
                </p>
              </div>
            ) : (
              <>
                {error && (
                  <p className="text-xs mb-3 text-center" style={{ color: "#E85D4A" }}>{error}</p>
                )}
                {!rejecting ? (
                  <div className="space-y-2">
                    <p className="text-sm text-center mb-4" style={{ color: "#aaa" }}>
                      By agreeing, you confirm your {mySplit.percentage}% share as <strong style={{ color: "#fff" }}>{mySplit.role}</strong> for this track.
                    </p>
                    <button
                      onClick={handleAgree}
                      disabled={acting}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold disabled:opacity-50 transition-opacity"
                      style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                    >
                      {acting ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Agree to Split</>}
                    </button>
                    <button
                      onClick={() => setRejecting(true)}
                      disabled={acting}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold disabled:opacity-50"
                      style={{ backgroundColor: "rgba(232,93,74,0.1)", color: "#E85D4A" }}
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm mb-2" style={{ color: "#aaa" }}>Reason for rejection (optional):</p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. The percentage doesn't reflect my contribution…"
                      rows={3}
                      className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-white outline-none focus:ring-1 resize-none"
                      style={{ borderColor: "#3a3a3a", backgroundColor: "#1a1a1a" }}
                    />
                    <button
                      onClick={handleReject}
                      disabled={acting}
                      className="w-full py-3 rounded-xl font-bold disabled:opacity-50"
                      style={{ backgroundColor: "rgba(232,93,74,0.15)", color: "#E85D4A" }}
                    >
                      {acting ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Confirm Rejection"}
                    </button>
                    <button
                      onClick={() => setRejecting(false)}
                      disabled={acting}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold"
                      style={{ color: "#666" }}
                    >
                      Go Back
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: "#555" }}>
          Powered by{" "}
          <a href="https://indiethis.com" className="hover:underline" style={{ color: "#888" }}>
            IndieThis
          </a>{" "}
          · Your music business, simplified.
        </p>
      </div>
    </div>
  );
}
