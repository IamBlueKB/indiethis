"use client";

import { useState } from "react";
import { Ticket, Bell, Check, Loader2, MapPin } from "lucide-react";

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
      className="rounded-2xl border overflow-hidden"
      style={{
        borderColor:     show.isSoldOut ? "rgba(255,255,255,0.1)" : "rgba(212,168,67,0.2)",
        backgroundColor: show.isSoldOut ? "rgba(255,255,255,0.02)" : "rgba(212,168,67,0.03)",
      }}
    >
      <div className="flex items-stretch">

        {/* ── Date block ──────────────────────────────────────────────────── */}
        <div
          className="flex flex-col items-center justify-center px-5 py-4 shrink-0 min-w-[72px]"
          style={{
            backgroundColor: show.isSoldOut ? "rgba(255,255,255,0.04)" : "rgba(212,168,67,0.08)",
            borderRight:     `1px solid ${show.isSoldOut ? "rgba(255,255,255,0.08)" : "rgba(212,168,67,0.15)"}`,
          }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-widest leading-none"
            style={{ color: show.isSoldOut ? "rgba(255,255,255,0.3)" : "rgba(212,168,67,0.7)" }}
          >
            {fmtMonth(show.date)}
          </span>
          <span
            className="text-3xl font-black leading-tight tabular-nums mt-0.5"
            style={{ color: show.isSoldOut ? "rgba(255,255,255,0.4)" : "#D4A843" }}
          >
            {fmtDay(show.date)}
          </span>
        </div>

        {/* ── Main content ────────────────────────────────────────────────── */}
        <div className="flex-1 px-4 py-4 flex flex-col justify-between gap-3">

          {/* Top: badges + venue */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {thisWeek && !show.isSoldOut && (
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(232,93,74,0.15)", color: "#E85D4A" }}
                >
                  This Week
                </span>
              )}
              {show.isSoldOut && (
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                >
                  Sold Out
                </span>
              )}
            </div>

            <p
              className="text-sm font-bold leading-tight"
              style={{ color: show.isSoldOut ? "rgba(255,255,255,0.5)" : "#fff" }}
            >
              {show.venueName}
            </p>
            <p className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              <MapPin size={10} />
              {show.city}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
              {fmtFull(show.date)} · {fmtTime(show.date)}
            </p>
          </div>

          {/* CTA area */}
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
              className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-full text-xs font-bold no-underline
                         transition-all hover:brightness-110 hover:scale-[1.02]"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              <Ticket size={11} />
              Get Tickets
            </a>
          ) : null}
        </div>
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
  // Only show upcoming (future) shows, sorted ascending
  const upcoming = shows
    .filter((s) => new Date(s.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const hasShows = upcoming.length > 0;

  return (
    <section className="space-y-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">Shows</h2>

      {hasShows ? (
        <div className="space-y-3">
          {upcoming.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </div>
      ) : (
        <WantToSeeLive artistName={artistName} artistId={artistId} />
      )}
    </section>
  );
}
