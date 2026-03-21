"use client";

import { useState } from "react";
import { Ticket, Bell, Check, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Show = {
  id:        string;
  venueName: string;
  city:      string;
  date:      string;  // ISO string
  ticketUrl: string | null;
  isSoldOut: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isThisWeek(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function fmtMonth(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short" }).toUpperCase();
}

function fmtDay(iso: string) {
  return new Date(iso).getDate();
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
}

// ─── Email input (shared by waitlist + interest) ──────────────────────────────

function EmailCapture({
  placeholder,
  buttonLabel,
  onSubmit,
}: {
  placeholder: string;
  buttonLabel: string;
  onSubmit: (email: string) => Promise<void>;
}) {
  const [email,    setEmail]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);
  const [err,      setErr]      = useState<string | null>(null);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@") || saving) return;
    setErr(null);
    setSaving(true);
    try {
      await onSubmit(email.trim().toLowerCase());
      setDone(true);
    } catch {
      setErr("Something went wrong — please try again");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#34C759" }}>
        <Check size={13} />
        You&apos;re on the list!
      </div>
    );
  }

  return (
    <form onSubmit={handle} className="flex items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border text-xs bg-transparent text-white placeholder:text-white/30 focus:outline-none focus:ring-1"
        style={{ borderColor: "rgba(255,255,255,0.15)" }}
        required
      />
      <button
        type="submit"
        disabled={saving}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity disabled:opacity-50"
        style={{ backgroundColor: "#E85D4A", color: "#fff" }}
      >
        {saving ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />}
        {buttonLabel}
      </button>
      {err && <p className="text-xs" style={{ color: "#E85D4A" }}>{err}</p>}
    </form>
  );
}

// ─── Show card ────────────────────────────────────────────────────────────────

function ShowCard({ show }: { show: Show }) {
  const thisWeek = isThisWeek(show.date);

  async function joinWaitlist(email: string) {
    const res = await fetch(`/api/public/shows/${show.id}/waitlist`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error();
  }

  return (
    <div
      className="flex items-center gap-[14px] rounded-[10px] p-[12px]"
      style={{ backgroundColor: "#111" }}
    >
      {/* ── Date block ──────────────────────────────────────────────────── */}
      <div
        className="flex flex-col items-center justify-center shrink-0"
        style={{ minWidth: 42 }}
      >
        <span
          className="font-bold uppercase leading-none"
          style={{ fontSize: 9, color: "#D4A843", letterSpacing: "1px" }}
        >
          {fmtMonth(show.date)}
        </span>
        <span
          className="font-bold tabular-nums leading-tight mt-0.5"
          style={{ fontSize: 20, color: show.isSoldOut ? "rgba(255,255,255,0.35)" : "#fff" }}
        >
          {fmtDay(show.date)}
        </span>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {thisWeek && !show.isSoldOut && (
            <span
              className="font-bold uppercase"
              style={{
                fontSize:        8,
                color:           "#fff",
                backgroundColor: "#E85D4A",
                padding:         "2px 6px",
                borderRadius:    8,
              }}
            >
              This Week
            </span>
          )}
          {show.isSoldOut && (
            <span
              className="font-bold uppercase"
              style={{
                fontSize:        8,
                color:           "rgba(255,255,255,0.4)",
                backgroundColor: "rgba(255,255,255,0.06)",
                padding:         "2px 6px",
                borderRadius:    8,
              }}
            >
              Sold Out
            </span>
          )}
        </div>

        <p
          className="font-medium truncate"
          style={{ fontSize: 12, color: show.isSoldOut ? "rgba(255,255,255,0.4)" : "#fff" }}
        >
          {show.venueName}
        </p>
        <p className="truncate" style={{ fontSize: 10, color: "#666", marginTop: 1 }}>
          {show.city}
        </p>
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0">
        {show.isSoldOut ? (
          <EmailCapture
            placeholder="your@email.com"
            buttonLabel="Notify Me"
            onSubmit={joinWaitlist}
          />
        ) : show.ticketUrl ? (
          <a
            href={show.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 no-underline transition-all hover:brightness-110"
            style={{
              border:       "1px solid rgba(212,168,67,0.30)",
              color:        "#D4A843",
              fontSize:     11,
              padding:      "5px 12px",
              borderRadius: 99,
            }}
          >
            <Ticket size={10} />
            Tickets
          </a>
        ) : null}
      </div>
    </div>
  );
}

// ─── "Want to see live" panel ─────────────────────────────────────────────────

function WantToSeeLive({
  artistName,
  artistId,
}: {
  artistName: string;
  artistId:   string;
}) {
  async function submitInterest(email: string) {
    const res = await fetch("/api/public/shows/interest", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ artistId, email }),
    });
    if (!res.ok) throw new Error();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/50">
        Want to see{" "}
        <span className="text-white/80 font-semibold">{artistName}</span>{" "}
        live? Drop your email and we&apos;ll let you know when shows are announced.
      </p>
      <EmailCapture
        placeholder="your@email.com"
        buttonLabel="Notify Me"
        onSubmit={submitInterest}
      />
    </div>
  );
}

// ─── ShowsSection ─────────────────────────────────────────────────────────────

export default function ShowsSection({
  shows,
  artistName,
  artistId,
}: {
  shows:      Show[];
  artistName: string;
  artistId:   string;
}) {
  // Only render when upcoming shows exist (page.tsx already filters to future dates)
  const upcoming = shows
    .filter((s) => new Date(s.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (!upcoming.length) return null;

  return (
    <section className="space-y-3">
      <p
        className="text-[10px] font-bold uppercase"
        style={{ color: "#D4A843", letterSpacing: "1.5px" }}
      >
        LIVE
      </p>
      <h2 className="text-[18px] font-semibold text-white leading-tight -mt-1">Shows</h2>

      <div className="space-y-3 mt-3">
        {upcoming.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </div>

      {/* Notify me of new shows — always offered below the show list */}
      <WantToSeeLive artistName={artistName} artistId={artistId} />
    </section>
  );
}
