"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

type Application = {
  id: string;
  appliedAt: string;
  djProfileId: string;
  djSlug: string;
  djName: string;
  userId: string;
  socialLinks: Record<string, string> | null;
  reqAccountAge: boolean;
  accountAgeMonths: number;
  reqTracks: boolean;
  totalCrateItems: number;
  reqSales: boolean;
  attributedSalesCount: number;
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Req({ met, label }: { met: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: met ? "rgba(52,199,89,0.12)" : "rgba(232,93,74,0.12)",
        color: met ? "#34C759" : "#E85D4A",
      }}
    >
      {met ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
      {label}
    </span>
  );
}

function ApplicationRow({ app }: { app: Application }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);
  const [done, setDone] = useState<"approved" | "denied" | null>(null);

  const allMet = app.reqAccountAge && app.reqTracks && app.reqSales;

  async function handleAction(action: "APPROVE" | "DENY") {
    setLoading(action === "APPROVE" ? "approve" : "deny");
    try {
      const res = await fetch(`/api/admin/dj-verification/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: action === "DENY" ? note : undefined }),
      });
      if (res.ok) {
        setDone(action === "APPROVE" ? "approved" : "denied");
      } else {
        const d = await res.json() as { error?: string };
        alert(d.error ?? "Action failed");
      }
    } finally {
      setLoading(null);
    }
  }

  if (done) {
    return (
      <div
        className="rounded-2xl border p-5 flex items-center gap-3"
        style={{
          backgroundColor: "var(--card)",
          borderColor: done === "approved" ? "rgba(52,199,89,0.25)" : "rgba(232,93,74,0.25)",
        }}
      >
        {done === "approved" ? (
          <CheckCircle2 size={16} style={{ color: "#34C759" }} />
        ) : (
          <XCircle size={16} style={{ color: "#E85D4A" }} />
        )}
        <p className="text-sm font-medium text-foreground">
          {app.djName} — {done === "approved" ? "Approved" : "Denied"}
        </p>
      </div>
    );
  }

  const socialEntries = app.socialLinks ? Object.entries(app.socialLinks).filter(([, v]) => !!v) : [];

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Row header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-base font-semibold text-foreground">{app.djName}</p>
              <a
                href={`/dj/${app.djSlug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                /{app.djSlug} <ExternalLink size={10} />
              </a>
              <a
                href={`/admin/users/${app.userId}`}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline"
              >
                View User
              </a>
            </div>
            <p className="text-xs text-muted-foreground">Applied {fmt(app.appliedAt)}</p>
          </div>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            Details {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Requirements pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Req met={app.reqAccountAge} label={`${app.accountAgeMonths}mo account`} />
          <Req met={app.reqTracks} label={`${app.totalCrateItems} crate tracks`} />
          <Req met={app.reqSales} label={`${app.attributedSalesCount} attributed sales`} />
          {!allMet && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(234,179,8,0.12)", color: "#EAB308" }}>
              Requirements not fully met
            </span>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-4 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="pt-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Social Links</p>
            {socialEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">No social links on profile.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {socialEntries.map(([key, value]) => (
                  <a
                    key={key}
                    href={value.startsWith("http") ? value : `https://${value}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border hover:bg-white/5 transition-colors text-foreground"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <ExternalLink size={10} className="text-muted-foreground" />
                    {key}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 pb-5 pt-1 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => handleAction("APPROVE")}
            disabled={loading !== null}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "rgba(52,199,89,0.15)", color: "#34C759" }}
          >
            {loading === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            onClick={() => setExpanded(true)}
            disabled={loading !== null}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}
          >
            Deny
          </button>
        </div>

        {/* Deny note */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Denial Note (shown to DJ)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional reason for denial…"
              className="flex-1 px-3 py-2 rounded-xl border text-sm bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/40"
              style={{ borderColor: "var(--border)" }}
            />
            <button
              onClick={() => handleAction("DENY")}
              disabled={loading !== null}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
              style={{ backgroundColor: "rgba(232,93,74,0.15)", color: "#E85D4A" }}
            >
              {loading === "deny" ? "Denying…" : "Confirm Deny"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DJVerificationContent({
  applications,
}: {
  applications: Application[];
}) {
  if (applications.length === 0) {
    return (
      <div
        className="rounded-2xl border p-10 text-center"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <p className="text-sm text-muted-foreground">No pending verification applications.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((app) => (
        <ApplicationRow key={app.id} app={app} />
      ))}
    </div>
  );
}
