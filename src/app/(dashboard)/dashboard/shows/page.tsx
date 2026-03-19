"use client";

import { useEffect, useState } from "react";
import {
  Plus, Trash2, Loader2, Ticket, ExternalLink,
  AlertCircle, Users, ToggleLeft, ToggleRight, CalendarDays,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ArtistShow = {
  id:        string;
  venueName: string;
  city:      string;
  date:      string;
  ticketUrl: string | null;
  isSoldOut: boolean;
  createdAt: string;
  _count:    { waitlist: number };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function isPast(iso: string) {
  return new Date(iso) < new Date();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShowsPage() {
  const [shows,   setShows]   = useState<ArtistShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Form state
  const [venue,     setVenue]     = useState("");
  const [city,      setCity]      = useState("");
  const [date,      setDate]      = useState("");
  const [ticketUrl, setTicketUrl] = useState("");

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/dashboard/shows")
      .then((r) => r.json())
      .then(({ shows }) => setShows(shows ?? []))
      .finally(() => setLoading(false));
  }, []);

  // ── Add show ────────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!venue.trim() || !city.trim() || !date) return;
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/dashboard/shows", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          venueName: venue.trim(),
          city:      city.trim(),
          date,
          ticketUrl: ticketUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add show"); return; }
      setShows((prev) => [...prev, data.show].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ));
      setVenue(""); setCity(""); setDate(""); setTicketUrl("");
    } catch {
      setError("Network error — please try again");
    } finally {
      setAdding(false);
    }
  }

  // ── Toggle sold out ─────────────────────────────────────────────────────────
  async function toggleSoldOut(show: ArtistShow) {
    const next = !show.isSoldOut;
    setShows((prev) => prev.map((s) => s.id === show.id ? { ...s, isSoldOut: next } : s));
    await fetch(`/api/dashboard/shows/${show.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isSoldOut: next }),
    });
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setShows((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/dashboard/shows/${id}`, { method: "DELETE" });
  }

  const upcoming = shows.filter((s) => !isPast(s.date));
  const past     = shows.filter((s) => isPast(s.date));

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Shows</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add upcoming shows to your public artist page. Visitors can buy tickets or join the waitlist if sold out.
        </p>
      </div>

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="rounded-2xl border p-5 space-y-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <h2 className="text-sm font-semibold text-foreground">Add a Show</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Venue */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Venue</label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. The Roxy"
              className="w-full px-3 py-2.5 rounded-lg border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1"
              style={{ borderColor: "var(--border)" }}
              required
            />
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Los Angeles, CA"
              className="w-full px-3 py-2.5 rounded-lg border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1"
              style={{ borderColor: "var(--border)" }}
              required
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date & Time</label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border text-sm bg-transparent text-foreground focus:outline-none focus:ring-1"
              style={{ borderColor: "var(--border)", colorScheme: "dark" }}
              required
            />
          </div>

          {/* Ticket URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Ticket URL <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={ticketUrl}
              onChange={(e) => setTicketUrl(e.target.value)}
              placeholder="https://ticketmaster.com/..."
              className="w-full px-3 py-2.5 rounded-lg border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "#E85D4A" }}>
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={adding || !venue.trim() || !city.trim() || !date}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add Show
        </button>
      </form>

      {/* Show list */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={22} className="animate-spin text-muted-foreground" />
        </div>
      ) : shows.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed flex flex-col items-center justify-center py-12 gap-3"
          style={{ borderColor: "var(--border)" }}
        >
          <CalendarDays size={28} className="text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">No shows yet</p>
          <p className="text-xs text-muted-foreground opacity-60">
            Add an upcoming show above to display it on your artist page
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Upcoming ({upcoming.length})
              </p>
              {upcoming.map((show) => (
                <ShowRow
                  key={show.id}
                  show={show}
                  onToggleSoldOut={() => toggleSoldOut(show)}
                  onDelete={() => handleDelete(show.id)}
                />
              ))}
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Past ({past.length})
              </p>
              {past.map((show) => (
                <ShowRow
                  key={show.id}
                  show={show}
                  onToggleSoldOut={() => toggleSoldOut(show)}
                  onDelete={() => handleDelete(show.id)}
                  isPast
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Show row ─────────────────────────────────────────────────────────────────

function ShowRow({
  show,
  onToggleSoldOut,
  onDelete,
  isPast = false,
}: {
  show: ArtistShow;
  onToggleSoldOut: () => void;
  onDelete: () => void;
  isPast?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-4 rounded-xl border px-4 py-3"
      style={{
        borderColor:     "var(--border)",
        backgroundColor: isPast ? "transparent" : "var(--card)",
        opacity:         isPast ? 0.6 : 1,
      }}
    >
      {/* Date block */}
      <div className="shrink-0 text-center w-12">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {new Date(show.date).toLocaleDateString("en-US", { month: "short" })}
        </p>
        <p className="text-xl font-bold text-foreground leading-none">
          {new Date(show.date).getDate()}
        </p>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{show.venueName}</p>
        <p className="text-xs text-muted-foreground truncate">{show.city} · {fmtDate(show.date)}</p>
        {show._count.waitlist > 0 && (
          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "#D4A843" }}>
            <Users size={10} />
            {show._count.waitlist} on waitlist
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Sold out toggle */}
        <button
          onClick={onToggleSoldOut}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
          style={{ color: show.isSoldOut ? "#E85D4A" : "var(--muted-foreground)" }}
          title={show.isSoldOut ? "Mark as available" : "Mark as sold out"}
        >
          {show.isSoldOut
            ? <ToggleRight size={15} />
            : <ToggleLeft size={15} />
          }
          <span className="hidden sm:inline">
            {show.isSoldOut ? "Sold Out" : "Available"}
          </span>
        </button>

        {/* Ticket link */}
        {show.ticketUrl && (
          <a
            href={show.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            title="Open ticket link"
          >
            <Ticket size={14} />
          </a>
        )}

        {/* External link */}
        {show.ticketUrl && (
          <a
            href={show.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            title="Open link"
          >
            <ExternalLink size={14} />
          </a>
        )}

        {/* Delete */}
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
          title="Remove show"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
