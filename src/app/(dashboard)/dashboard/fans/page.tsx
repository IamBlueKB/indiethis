"use client";

import { useEffect, useState } from "react";
import {
  Bell, MapPin, Users, Loader2, Download,
  Mail, Phone, Hash,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FanContact = {
  id:        string;
  email:     string;
  phone:     string | null;
  zip:       string | null;
  source:    "RELEASE_NOTIFY" | "SHOW_NOTIFY";
  createdAt: string;
};

type Tab = "ALL" | "RELEASE_NOTIFY" | "SHOW_NOTIFY";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FansPage() {
  const [contacts,     setContacts]     = useState<FanContact[]>([]);
  const [total,        setTotal]        = useState(0);
  const [releaseCount, setReleaseCount] = useState(0);
  const [showCount,    setShowCount]    = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<Tab>("ALL");

  useEffect(() => {
    const qs = activeTab === "ALL" ? "" : `?source=${activeTab}`;
    setLoading(true);
    fetch(`/api/dashboard/fans${qs}`)
      .then((r) => r.json())
      .then(({ contacts: c = [], total: t = 0, releaseCount: rc = 0, showCount: sc = 0 }) => {
        setContacts(c);
        setTotal(t);
        setReleaseCount(rc);
        setShowCount(sc);
      })
      .finally(() => setLoading(false));
  }, [activeTab]);

  // CSV export
  function exportCsv() {
    const rows = [
      ["Email", "Phone", "ZIP", "List", "Joined"],
      ...contacts.map((c) => [
        c.email,
        c.phone ?? "",
        c.zip   ?? "",
        c.source === "RELEASE_NOTIFY" ? "Release Alerts" : "Show Alerts",
        new Date(c.createdAt).toLocaleDateString("en-US"),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `fans-${activeTab.toLowerCase()}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { id: Tab; label: string; count: number; icon: React.ElementType; color: string }[] = [
    { id: "ALL",            label: "All Fans",      count: total,        icon: Users,  color: "#D4A843" },
    { id: "RELEASE_NOTIFY", label: "Release Alerts", count: releaseCount, icon: Bell,   color: "#D4A843" },
    { id: "SHOW_NOTIFY",    label: "Show Alerts",    count: showCount,    icon: MapPin, color: "#E85D4A" },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Fan List</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Email and SMS contacts captured from your artist page
          </p>
        </div>
        {contacts.length > 0 && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <Download size={13} />
            Export CSV
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {tabs.map(({ id, label, count, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="rounded-2xl border p-4 text-left transition-all hover:brightness-110"
            style={{
              backgroundColor: activeTab === id ? `rgba(${color === "#D4A843" ? "212,168,67" : "232,93,74"},0.08)` : "var(--card)",
              borderColor:     activeTab === id ? color : "var(--border)",
            }}
          >
            <Icon size={15} style={{ color }} className="mb-1.5" />
            <p className="text-xl font-bold text-foreground">{count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Contact list */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Tab bar */}
        <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px"
              style={{
                borderBottomColor: activeTab === id ? "#D4A843" : "transparent",
                color:             activeTab === id ? "var(--foreground)" : "var(--muted-foreground)",
              }}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-14 flex justify-center">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No contacts yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {activeTab === "ALL"
                ? "Fans who sign up via your artist page will appear here"
                : activeTab === "RELEASE_NOTIFY"
                  ? "Fans who sign up for release alerts will appear here"
                  : "Fans who request show notifications will appear here"}
            </p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div
              className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              {[
                { icon: Mail,  label: "Email" },
                { icon: Phone, label: "Phone" },
                { icon: Hash,  label: "ZIP" },
                { icon: Bell,  label: "List" },
              ].map(({ label }) => (
                <p key={label} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
              ))}
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
                Joined
              </p>
            </div>

            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-4 py-3 border-b last:border-b-0 hover:bg-white/3 transition-colors"
                style={{ borderColor: "var(--border)" }}
              >
                {/* Email */}
                <p className="text-sm text-foreground truncate">{contact.email}</p>

                {/* Phone */}
                <p className="text-xs text-muted-foreground tabular-nums">
                  {contact.phone ?? <span className="opacity-30">—</span>}
                </p>

                {/* ZIP */}
                <p className="text-xs text-muted-foreground tabular-nums w-12 text-center">
                  {contact.zip ?? <span className="opacity-30">—</span>}
                </p>

                {/* Source badge */}
                <span
                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                  style={
                    contact.source === "RELEASE_NOTIFY"
                      ? { backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }
                      : { backgroundColor: "rgba(232,93,74,0.12)",  color: "#E85D4A" }
                  }
                >
                  {contact.source === "RELEASE_NOTIFY" ? "Release" : "Shows"}
                </span>

                {/* Date */}
                <p className="text-xs text-muted-foreground text-right whitespace-nowrap">
                  {new Date(contact.createdAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
