"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Check, CheckCheck, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
};

// ── Filter labels ─────────────────────────────────────────────────────────────

const TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: "Revenue",    types: ["MERCH_ORDER", "TIP_RECEIVED", "BEAT_LICENSE_SOLD", "STREAM_LEASE_ACTIVATED", "STREAM_LEASE_CANCELLED", "MUSIC_SALE", "PAYMENT_RECEIVED", "SPLIT_PAYMENT_RECEIVED"] },
  { label: "Bookings",   types: ["BOOKING_REQUEST", "BOOKING_CONFIRMED", "BOOKING_CANCELLED", "BOOKING_INQUIRY", "INTAKE_SUBMISSION", "FILE_DELIVERED", "SESSION_NOTE_ADDED", "ARTIST_SESSION_FEEDBACK"] },
  { label: "Splits",     types: ["SPLIT_SHEET_RECEIVED", "SPLIT_SHEET_INVITE", "SPLIT_SHEET_AGREED", "SPLIT_SHEET_ACTIVE", "SPLIT_SHEET_REJECTED"] },
  { label: "Release",    types: ["RELEASE_PLAN_TASK_DUE", "RELEASE_PLAN_OVERDUE", "RELEASE_PLAN_LAUNCH_DAY", "PRE_SAVE_MILESTONE"] },
  { label: "AI",         types: ["AI_JOB_COMPLETE", "AI_GENERATION_COMPLETE"] },
  { label: "Platform",   types: ["SUBSCRIPTION_RENEWED", "SUBSCRIPTION_FAILED", "TRIAL_EXPIRING", "ACCOUNT_COMPED", "FAN_SIGNUP"] },
  { label: "Ambassador", types: ["AMBASSADOR_SIGNUP", "AMBASSADOR_CONVERSION", "AMBASSADOR_REFERRAL_CHURNED", "PROMO_CODE_REDEEMED"] },
];

const TYPE_LABEL: Record<string, string> = {
  MERCH_ORDER:              "Merch Order",
  TIP_RECEIVED:             "Tip",
  BEAT_LICENSE_SOLD:        "Beat License",
  STREAM_LEASE_ACTIVATED:   "Stream Lease",
  STREAM_LEASE_CANCELLED:   "Stream Lease",
  MUSIC_SALE:               "Music Sale",
  PAYMENT_RECEIVED:         "Payment",
  SPLIT_PAYMENT_RECEIVED:   "Split Payment",
  BOOKING_REQUEST:          "Booking",
  BOOKING_CONFIRMED:        "Booking",
  BOOKING_CANCELLED:        "Booking",
  BOOKING_INQUIRY:          "Booking",
  INTAKE_SUBMISSION:        "Intake",
  FILE_DELIVERED:           "Files",
  SESSION_NOTE_ADDED:       "Session",
  ARTIST_SESSION_FEEDBACK:  "Session",
  SPLIT_SHEET_RECEIVED:     "Split Sheet",
  SPLIT_SHEET_INVITE:       "Split Sheet",
  SPLIT_SHEET_AGREED:       "Split Sheet",
  SPLIT_SHEET_ACTIVE:       "Split Sheet",
  SPLIT_SHEET_REJECTED:     "Split Sheet",
  RELEASE_PLAN_TASK_DUE:    "Release Plan",
  RELEASE_PLAN_OVERDUE:     "Release Plan",
  RELEASE_PLAN_LAUNCH_DAY:  "Release Plan",
  PRE_SAVE_MILESTONE:       "Pre-Save",
  AI_JOB_COMPLETE:          "AI",
  AI_GENERATION_COMPLETE:   "AI",
  SUBSCRIPTION_RENEWED:     "Subscription",
  SUBSCRIPTION_FAILED:      "Subscription",
  TRIAL_EXPIRING:           "Trial",
  ACCOUNT_COMPED:           "Account",
  FAN_SIGNUP:               "Fan",
  AMBASSADOR_SIGNUP:        "Ambassador",
  AMBASSADOR_CONVERSION:    "Ambassador",
  AMBASSADOR_REFERRAL_CHURNED: "Ambassador",
  PROMO_CODE_REDEEMED:      "Promo",
};

const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  Revenue:    { bg: "#16a34a22", text: "#4ade80" },
  Bookings:   { bg: "#2563eb22", text: "#60a5fa" },
  Splits:     { bg: "#7c3aed22", text: "#a78bfa" },
  Release:    { bg: "#D4A84322", text: "#D4A843" },
  AI:         { bg: "#7c3aed22", text: "#c084fc" },
  Platform:   { bg: "#0891b222", text: "#22d3ee" },
  Ambassador: { bg: "#d9770622", text: "#fb923c" },
};

function getGroupForType(type: string): string {
  for (const g of TYPE_GROUPS) {
    if (g.types.includes(type)) return g.label;
  }
  return "Platform";
}

// ── Notification icon ─────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  const group = getGroupForType(type);
  const color = TYPE_COLOR[group] ?? TYPE_COLOR.Platform;
  const icons: Record<string, string> = {
    Revenue:    "💰",
    Bookings:   "📅",
    Splits:     "✂",
    Release:    "📋",
    AI:         "✨",
    Platform:   "⚡",
    Ambassador: "🤝",
  };
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0"
      style={{ backgroundColor: color.bg, color: color.text }}
    >
      {icons[group] ?? "🔔"}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NotificationsContent() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total,  setTotal]  = useState(0);
  const [pages,  setPages]  = useState(1);
  const [page,   setPage]   = useState(1);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [markingAll, setMarkingAll]   = useState(false);

  const fetchPage = useCallback(async (p: number, group: string | null) => {
    setLoading(true);
    try {
      // Build type filter — pass first type of the group (server will do contains match)
      // For simplicity, no type filter via group for now — just paginate all
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      const res = await fetch(`/api/dashboard/notifications?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json() as {
        notifications: Notification[];
        total: number;
        pages: number;
        unreadCount: number;
      };
      // Client-side group filter
      const all = data.notifications ?? [];
      const filtered = group
        ? all.filter((n) => getGroupForType(n.type) === group)
        : all;
      setNotifications(filtered);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
      setUnread(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(page, activeGroup);
  }, [page, activeGroup, fetchPage]);

  async function handleMarkAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await fetch("/api/dashboard/notifications", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleToggleRead(n: Notification) {
    const newRead = !n.isRead;
    setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: newRead } : x));
    setUnread((c) => newRead ? Math.max(0, c - 1) : c + 1);
    await fetch(`/api/dashboard/notifications/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: newRead }),
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell size={22} style={{ color: "#D4A843" }} />
            Notifications
          </h1>
          {unread > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{unread} unread</p>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
          >
            {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            Mark all read
          </button>
        )}
      </div>

      {/* Group filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setActiveGroup(null); setPage(1); }}
          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={activeGroup === null
            ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
            : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
          }
        >
          All
        </button>
        {TYPE_GROUPS.map((g) => {
          const color = TYPE_COLOR[g.label];
          const isActive = activeGroup === g.label;
          return (
            <button
              key={g.label}
              onClick={() => { setActiveGroup(g.label); setPage(1); }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={isActive
                ? { backgroundColor: color.text, color: "#0A0A0A" }
                : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
              }
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{total} total</span>
        {activeGroup && <span>· filtered by <span className="text-foreground font-medium">{activeGroup}</span></span>}
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div
          className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-16 gap-3"
          style={{ borderColor: "var(--border)" }}
        >
          <Bell size={40} className="text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">
            {activeGroup ? `No ${activeGroup.toLowerCase()} notifications` : "You're all caught up!"}
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          {notifications.map((n, i) => {
            const group = getGroupForType(n.type);
            const color = TYPE_COLOR[group] ?? TYPE_COLOR.Platform;
            const label = TYPE_LABEL[n.type] ?? n.type;
            const isLast = i === notifications.length - 1;

            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-4 transition-colors ${!isLast ? "border-b" : ""}`}
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: n.isRead ? "transparent" : "rgba(212,168,67,0.03)",
                }}
              >
                <NotifIcon type={n.type} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-0.5">
                    <div className="min-w-0">
                      <p className={`text-sm leading-snug ${n.isRead ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                        {n.title}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                      style={{ backgroundColor: color.bg, color: color.text }}
                    >
                      {label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {n.link && (
                    <a
                      href={n.link}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                      title="Open"
                    >
                      <ChevronRight size={14} />
                    </a>
                  )}
                  <button
                    onClick={() => handleToggleRead(n)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                    title={n.isRead ? "Mark unread" : "Mark read"}
                  >
                    <Check size={14} style={{ color: n.isRead ? "var(--muted-foreground)" : "#D4A843" }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border disabled:opacity-40 hover:text-foreground transition-colors"
            style={{ borderColor: "var(--border)" }}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span>Page {page} of {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border disabled:opacity-40 hover:text-foreground transition-colors"
            style={{ borderColor: "var(--border)" }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
