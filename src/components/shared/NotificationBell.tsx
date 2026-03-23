"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
};

// Icon per notification type category
function NotifIcon({ type }: { type: string }) {
  const base = "w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0";
  if (type.startsWith("SPLIT_"))       return <div className={base} style={{ backgroundColor: "#7c3aed22", color: "#a78bfa" }}>✂</div>;
  if (type.startsWith("BOOKING_"))     return <div className={base} style={{ backgroundColor: "#2563eb22", color: "#60a5fa" }}>📅</div>;
  if (type.includes("TIP") || type.includes("PAYMENT") || type.includes("EARNED")) return <div className={base} style={{ backgroundColor: "#16a34a22", color: "#4ade80" }}>💰</div>;
  if (type.includes("MERCH"))          return <div className={base} style={{ backgroundColor: "#d9770622", color: "#fb923c" }}>🛍</div>;
  if (type.includes("BEAT") || type.includes("LICENSE")) return <div className={base} style={{ backgroundColor: "#D4A84322", color: "#D4A843" }}>🎵</div>;
  if (type.includes("STREAM_LEASE"))   return <div className={base} style={{ backgroundColor: "#0891b222", color: "#22d3ee" }}>🔗</div>;
  if (type.includes("AI_") || type.includes("GENERATION")) return <div className={base} style={{ backgroundColor: "#7c3aed22", color: "#c084fc" }}>✨</div>;
  if (type.includes("RELEASE_PLAN"))   return <div className={base} style={{ backgroundColor: "#D4A84322", color: "#D4A843" }}>📋</div>;
  if (type.includes("SUBSCRIPTION") || type.includes("TRIAL")) return <div className={base} style={{ backgroundColor: "#16a34a22", color: "#4ade80" }}>⚡</div>;
  if (type === "FILE_DELIVERED")       return <div className={base} style={{ backgroundColor: "#2563eb22", color: "#60a5fa" }}>📁</div>;
  if (type === "INTAKE_SUBMISSION")    return <div className={base} style={{ backgroundColor: "#0891b222", color: "#22d3ee" }}>📝</div>;
  return <div className={base} style={{ backgroundColor: "#1a1a1a", color: "#888" }}>🔔</div>;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [open, setOpen]                   = useState(false);
  const [markingAll, setMarkingAll]       = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json() as { notifications: Notification[]; unreadCount: number };
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function handleMarkAllRead() {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await fetch("/api/dashboard/notifications", { method: "POST" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleClickNotification(n: Notification) {
    if (!n.isRead) {
      // Mark as read optimistically
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
      setUnreadCount((c) => Math.max(0, c - 1));
      fetch(`/api/dashboard/notifications/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      }).catch(() => {});
    }
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors outline-none">
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center leading-none"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[340px] p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <CheckCheck size={13} />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell size={28} className="mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <a
                key={n.id}
                href={n.link ?? "#"}
                onClick={() => handleClickNotification(n)}
                className={`flex items-start gap-3 px-4 py-3 border-b transition-colors no-underline ${
                  n.isRead ? "hover:bg-white/4" : "hover:bg-white/5"
                }`}
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: n.isRead ? "transparent" : "rgba(212,168,67,0.04)",
                }}
              >
                <NotifIcon type={n.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${n.isRead ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                      {n.title}
                    </p>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: "#D4A843" }} />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </a>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 text-xs font-medium no-underline transition-colors"
            style={{ color: "#D4A843" }}
          >
            <Check size={12} />
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
