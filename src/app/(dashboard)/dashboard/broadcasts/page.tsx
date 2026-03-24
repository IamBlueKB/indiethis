"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MessageSquare, Users, Send, Loader2, CheckCircle2,
  AlertCircle, ChevronDown, BarChart2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type BroadcastLog = {
  id:             string;
  message:        string;
  segment:        string;
  recipientCount: number;
  successCount:   number;
  sentAt:         string;
};

type SegmentKey =
  | "ALL"
  | "RELEASE_NOTIFY"
  | "SHOW_NOTIFY"
  | "TOP_SPENDERS"
  | "MERCH_BUYERS"
  | "ZIP";

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENTS: { key: SegmentKey; label: string; description: string }[] = [
  { key: "ALL",            label: "All fans with phone",      description: "Everyone who gave a phone number" },
  { key: "RELEASE_NOTIFY", label: "Release alert subscribers", description: "Signed up for new release alerts" },
  { key: "SHOW_NOTIFY",    label: "Show alert subscribers",    description: "Signed up for show notifications" },
  { key: "TOP_SPENDERS",   label: "Top spenders",             description: "Fans who made any purchase" },
  { key: "MERCH_BUYERS",   label: "Merch buyers",             description: "Fans who bought merch" },
  { key: "ZIP",            label: "By ZIP code",              description: "Fans in a specific ZIP code" },
];

const TIER_LABELS: Record<string, string> = {
  LAUNCH: "Launch",
  PUSH:   "Push",
  REIGN:  "Reign",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function segmentLabel(segment: string): string {
  const [type, value] = segment.split(":");
  const found = SEGMENTS.find((s) => s.key === type);
  if (found?.key === "ZIP" && value) return `ZIP: ${value}`;
  return found?.label ?? segment;
}

function smsSegmentCount(msg: string): number {
  if (!msg) return 0;
  return Math.ceil(msg.length / 160);
}

function estimateCost(msgLen: number, recipients: number): string {
  const segs = Math.ceil(msgLen / 160) || 1;
  return (segs * recipients * 0.009).toFixed(2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BroadcastsPage() {
  // ── Dashboard state ───────────────────────────────────────────────────────
  const [logs,          setLogs]          = useState<BroadcastLog[]>([]);
  const [usedThisMonth, setUsedThisMonth] = useState(0);
  const [limit,         setLimit]         = useState(100);
  const [tier,          setTier]          = useState("LAUNCH");
  const [dashLoading,   setDashLoading]   = useState(true);

  // ── Compose state ─────────────────────────────────────────────────────────
  const [message,       setMessage]       = useState("");
  const [segment,       setSegment]       = useState<SegmentKey>("ALL");
  const [zipInput,      setZipInput]      = useState("");
  const [recipCount,    setRecipCount]    = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending,       setSending]       = useState(false);
  const [success,       setSuccess]       = useState<{ count: number } | null>(null);
  const [error,         setError]         = useState("");

  // ── Load dashboard ────────────────────────────────────────────────────────
  function loadDashboard() {
    setDashLoading(true);
    fetch("/api/dashboard/broadcasts")
      .then((r) => r.json())
      .then(({ logs: l = [], usedThisMonth: u = 0, limit: lim = 100, tier: t = "LAUNCH" }) => {
        setLogs(l);
        setUsedThisMonth(u);
        setLimit(lim);
        setTier(t);
      })
      .finally(() => setDashLoading(false));
  }
  useEffect(() => { loadDashboard(); }, []);

  // ── Recipient preview (debounced) ─────────────────────────────────────────
  const fetchPreview = useCallback(() => {
    const seg = segment === "ZIP" ? "ZIP" : segment;
    const qs  = segment === "ZIP" && zipInput
      ? `?segment=ZIP&zip=${encodeURIComponent(zipInput)}`
      : `?segment=${seg}`;

    setPreviewLoading(true);
    fetch(`/api/dashboard/broadcasts/preview${qs}`)
      .then((r) => r.json())
      .then(({ count }) => setRecipCount(typeof count === "number" ? count : null))
      .catch(() => setRecipCount(null))
      .finally(() => setPreviewLoading(false));
  }, [segment, zipInput]);

  useEffect(() => {
    const t = setTimeout(fetchPreview, 400);
    return () => clearTimeout(t);
  }, [fetchPreview]);

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    setError("");
    setSuccess(null);
    if (!message.trim()) { setError("Message cannot be empty."); return; }

    const segmentStr =
      segment === "ZIP" && zipInput ? `ZIP:${zipInput.trim()}` : segment;

    setSending(true);
    try {
      const res = await fetch("/api/dashboard/broadcasts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: message.trim(), segment: segmentStr }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to send."); return; }
      setSuccess({ count: data.successCount ?? data.recipientCount });
      setMessage("");
      loadDashboard();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const remaining     = Math.max(0, limit - usedThisMonth);
  const usagePct      = Math.min(100, Math.round((usedThisMonth / limit) * 100));
  const msgLen        = message.length;
  const smsSeg        = smsSegmentCount(message);
  const charRemaining = smsSeg * 160 - msgLen;
  const estimatedRecs = recipCount ?? 0;
  const canSend       = !!message.trim() && !sending && remaining > 0 &&
                        (segment !== "ZIP" || !!zipInput.trim());

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(212,168,67,0.10)" }}
        >
          <MessageSquare size={16} className="text-accent" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">SMS Broadcasts</h1>
          <p className="text-xs text-muted-foreground">Send text messages to your fan segments</p>
        </div>
      </div>

      {/* ── Usage bar ───────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-5 space-y-3"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Monthly Usage</span>
          </div>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(212,168,67,0.10)", color: "#D4A843" }}
          >
            {TIER_LABELS[tier] ?? tier} Plan
          </span>
        </div>

        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{usedThisMonth.toLocaleString()} sent</span>
            <span>{remaining.toLocaleString()} remaining of {limit.toLocaleString()}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${usagePct}%`,
                backgroundColor: usagePct >= 90 ? "#E85D4A" : usagePct >= 70 ? "#D4A843" : "#34C759",
              }}
            />
          </div>
        </div>

        {remaining === 0 && (
          <div
            className="rounded-xl border p-3 space-y-1.5"
            style={{ backgroundColor: "rgba(212,168,67,0.06)", borderColor: "rgba(212,168,67,0.2)" }}
          >
            <p className="text-xs font-semibold text-foreground">
              You&apos;ve used all {limit.toLocaleString()} SMS broadcasts this month.
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {tier !== "REIGN" && (
                <a
                  href="/dashboard/upgrade"
                  className="text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{ color: "#D4A843" }}
                >
                  Upgrade to {tier === "LAUNCH" ? "Push for 250" : "Reign for 500"}/mo →
                </a>
              )}
              <span className="text-xs text-muted-foreground">
                {tier === "REIGN" ? "Resets next billing cycle." : "or wait until next month"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Compose ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-5 space-y-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <h2 className="text-sm font-semibold text-foreground">Compose Broadcast</h2>

        {/* Segment selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Audience
          </label>
          <div className="relative">
            <select
              value={segment}
              onChange={(e) => { setSegment(e.target.value as SegmentKey); setZipInput(""); }}
              className="w-full appearance-none px-3 py-2.5 rounded-xl border text-sm bg-transparent text-foreground pr-8 focus:outline-none focus:ring-1"
              style={{ borderColor: "var(--border)" }}
            >
              {SEGMENTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label} — {s.description}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          {/* ZIP input */}
          {segment === "ZIP" && (
            <input
              type="text"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="Enter ZIP code…"
              className="w-40 px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1"
              style={{ borderColor: "var(--border)" }}
            />
          )}

          {/* Recipient count */}
          <div className="flex items-center gap-1.5 text-xs">
            <Users size={11} className="text-muted-foreground" />
            {previewLoading ? (
              <span className="text-muted-foreground">Loading…</span>
            ) : recipCount !== null ? (
              <span style={{ color: recipCount > 0 ? "#34C759" : "var(--muted-foreground)" }}>
                {recipCount.toLocaleString()} recipient{recipCount !== 1 ? "s" : ""} with phone
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            {recipCount !== null && remaining < recipCount && (
              <span className="text-yellow-400 ml-1">
                (capped at {remaining} by monthly limit)
              </span>
            )}
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 918))}
            placeholder="Write your message…"
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 resize-none leading-relaxed"
            style={{ borderColor: "var(--border)" }}
          />
          {/* Char + cost info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {msgLen} chars
              {msgLen > 0 && (
                <> · <span className={charRemaining < 20 ? "text-yellow-400" : ""}>
                  {charRemaining} left in SMS {smsSeg}
                </span>
                {smsSeg > 1 && <> · {smsSeg} SMS segments</>}
                </>
              )}
            </span>
            {msgLen > 0 && estimatedRecs > 0 && (
              <span>
                Est. cost:{" "}
                <span className="font-semibold text-foreground">
                  ~${estimateCost(msgLen, Math.min(estimatedRecs, remaining))}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Errors / success */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 rounded-xl border border-red-500/20 bg-red-500/05 px-3 py-2.5">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-sm text-emerald-400 rounded-xl border border-emerald-500/20 bg-emerald-500/05 px-3 py-2.5">
            <CheckCircle2 size={14} />
            Sent to {success.count.toLocaleString()} recipient{success.count !== 1 ? "s" : ""}!
          </div>
        )}

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#E85D4A", color: "white" }}
        >
          {sending ? (
            <><Loader2 size={14} className="animate-spin" /> Sending…</>
          ) : (
            <><Send size={14} /> Send Broadcast</>
          )}
        </button>
      </div>

      {/* ── Broadcast history ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Broadcast History</h2>
        {dashLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div
            className="rounded-2xl border py-12 text-center"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <MessageSquare size={28} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.12)" }} />
            <p className="text-sm text-muted-foreground">No broadcasts sent yet</p>
          </div>
        ) : (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            {/* Header row */}
            <div
              className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              style={{ borderColor: "var(--border)" }}
            >
              <span>Message</span>
              <span>Segment</span>
              <span className="text-right">Sent</span>
              <span className="text-right">Date</span>
            </div>

            {logs.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-start px-4 py-3 border-b last:border-b-0 hover:bg-white/[0.02] transition-colors"
                style={{ borderColor: "var(--border)" }}
              >
                {/* Message preview */}
                <p className="text-sm text-foreground truncate" title={log.message}>
                  {log.message}
                </p>

                {/* Segment badge */}
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                  style={{ backgroundColor: "rgba(212,168,67,0.10)", color: "#D4A843" }}
                >
                  {segmentLabel(log.segment)}
                </span>

                {/* Recipient count */}
                <p className="text-xs tabular-nums text-right text-muted-foreground shrink-0">
                  {log.successCount.toLocaleString()}/{log.recipientCount.toLocaleString()}
                </p>

                {/* Date */}
                <p className="text-xs text-muted-foreground text-right whitespace-nowrap shrink-0">
                  {new Date(log.sentAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
