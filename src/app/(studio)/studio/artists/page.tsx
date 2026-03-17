"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Instagram, Calendar, Music2, ExternalLink } from "lucide-react";

type Artist = {
  id: string;
  name: string;
  artistName: string | null;
  email: string | null;
  instagramHandle: string | null;
  photo: string | null;
  createdAt: string;
  sessions: { id: string; status: string }[];
};

type StudioArtist = {
  id: string;
  joinedAt: string;
  artist: Artist;
};

const SESSION_STATUS_COLOR: Record<string, string> = {
  COMPLETED: "text-emerald-400",
  CONFIRMED: "text-blue-400",
  PENDING: "text-yellow-400",
  CANCELLED: "text-red-400",
};

export default function ArtistsPage() {
  const [artists, setArtists] = useState<StudioArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/studio/artists")
      .then((r) => r.json())
      .then((d) => { setArtists(d.artists ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = artists.filter((sa) => {
    const q = search.toLowerCase();
    return (
      sa.artist.name.toLowerCase().includes(q) ||
      (sa.artist.artistName ?? "").toLowerCase().includes(q) ||
      (sa.artist.email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Artists</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Artists with linked IndieThis accounts</p>
        </div>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search artists…"
        className="w-full max-w-sm rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
        style={{ borderColor: "var(--border)" }}
      />

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl border py-14 text-center space-y-2"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <Users size={32} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">No artists yet</p>
          <p className="text-xs text-muted-foreground">Artists appear here when they create an IndieThis account and book a session.</p>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          {filtered.map((sa, i) => {
            const a = sa.artist;
            const completed = a.sessions.filter((s) => s.status === "COMPLETED").length;
            const upcoming = a.sessions.filter((s) => s.status === "CONFIRMED" || s.status === "PENDING").length;
            return (
              <div
                key={sa.id}
                className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
                style={{ borderColor: "var(--border)", borderTopWidth: i === 0 ? 0 : undefined }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                  style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}
                >
                  {a.name[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{a.name}</p>
                    {a.artistName && (
                      <span className="text-xs text-muted-foreground">· {a.artistName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {a.email && (
                      <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                    )}
                    {a.instagramHandle && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Instagram size={11} /> @{a.instagramHandle}
                      </span>
                    )}
                  </div>
                </div>

                {/* Sessions */}
                <div className="text-right shrink-0 space-y-0.5">
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-sm font-bold text-foreground">{completed}</p>
                      <p className="text-[10px] text-muted-foreground">Done</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-bold ${upcoming > 0 ? "text-accent" : "text-muted-foreground"}`}>{upcoming}</p>
                      <p className="text-[10px] text-muted-foreground">Upcoming</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/studio/contacts?email=${encodeURIComponent(a.email ?? "")}`}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                    title="View CRM contact"
                  >
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} artist{filtered.length !== 1 ? "s" : ""} linked
        </p>
      )}
    </div>
  );
}
