"use client";

import { useState } from "react";
import { Calendar, MapPin, DollarSign } from "lucide-react";
import { useSessions, type BookingSession } from "@/hooks/queries";

type Filter = "ALL" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

const SESSION_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: "Pending",   color: "text-yellow-400",  bg: "bg-yellow-400/10"  },
  CONFIRMED: { label: "Confirmed", color: "text-blue-400",    bg: "bg-blue-400/10"    },
  COMPLETED: { label: "Completed", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  CANCELLED: { label: "Cancelled", color: "text-red-400",     bg: "bg-red-400/10"     },
};

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  UNPAID:  { label: "Unpaid",  color: "text-red-400"     },
  DEPOSIT: { label: "Deposit", color: "text-yellow-400"  },
  PAID:    { label: "Paid",    color: "text-emerald-400" },
};

const TABS: { key: Filter; label: string }[] = [
  { key: "ALL",       label: "All"       },
  { key: "PENDING",   label: "Pending"   },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default function SessionsPage() {
  const { data: sessions = [], isLoading, isError } = useSessions();
  const [filter, setFilter] = useState<Filter>("ALL");

  const filtered = filter === "ALL" ? sessions : sessions.filter((s) => s.status === filter);

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your studio booking history</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ key, label }) => {
          const count = key === "ALL"
            ? sessions.length
            : sessions.filter((s) => s.status === key).length;
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={
                active
                  ? { backgroundColor: "var(--accent)", color: "var(--background)" }
                  : { backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
              }
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-10 flex justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      ) : isError ? (
        <div className="py-10 text-center text-sm text-red-400">
          Failed to load sessions. Please refresh the page.
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl border py-14 text-center space-y-2"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <Calendar size={32} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">No sessions</p>
          <p className="text-xs text-muted-foreground">
            {filter === "ALL"
              ? "Your studio sessions will appear here."
              : `No ${filter.toLowerCase()} sessions.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s: BookingSession) => {
            const statusCfg  = SESSION_STATUS[s.status];
            const paymentCfg = PAYMENT_STATUS[s.paymentStatus];
            return (
              <div
                key={s.id}
                className="rounded-2xl border p-5 space-y-3"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">
                      {new Date(s.dateTime).toLocaleDateString("en-US", {
                        weekday: "long", month: "long", day: "numeric", year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.dateTime).toLocaleTimeString("en-US", {
                        hour: "numeric", minute: "2-digit",
                      })}
                      {s.duration    ? ` · ${s.duration} hrs` : ""}
                      {s.sessionType ? ` · ${s.sessionType}`  : ""}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusCfg.color} ${statusCfg.bg}`}
                  >
                    {statusCfg.label}
                  </span>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin size={11} />
                    {s.studio.name}
                    {s.studio.address ? ` · ${s.studio.address}` : ""}
                  </span>
                  <span className={`flex items-center gap-1 text-xs font-semibold ${paymentCfg.color}`}>
                    <DollarSign size={11} />
                    {paymentCfg.label}
                  </span>
                </div>

                {s.notes && (
                  <p
                    className="text-xs text-muted-foreground leading-relaxed border-t pt-2.5"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {s.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
