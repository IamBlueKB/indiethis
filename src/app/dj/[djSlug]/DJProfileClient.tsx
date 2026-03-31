"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle, Instagram, Music2, MapPin, Ticket, Calendar, Clock,
  Play, Video, Loader2, Send,
} from "lucide-react";

type Crate = {
  id: string;
  name: string;
  coverArtUrl: string | null;
  _count: { items: number };
};

type DJSet = {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number | null;
  venue: string | null;
  date: string | null;
};

type DJEvent = {
  id: string;
  name: string;
  venue: string;
  city: string;
  date: string;
  time: string | null;
  ticketUrl: string | null;
  description: string | null;
};

type MixTrackItem = {
  id: string;
  position: number;
  startTime: number | null;
  title: string | null;
  artist: string | null;
  trackId: string | null;
  track: {
    id: string;
    title: string;
    artist: { name: string | null; artistName: string | null; artistSlug: string | null };
  } | null;
};

type DJMixPublic = {
  id: string;
  title: string;
  audioUrl: string;
  coverArtUrl: string | null;
  canvasVideoUrl: string | null;
  duration: number | null;
  description: string | null;
  tracklist: MixTrackItem[];
};

type DJProfileData = {
  id: string;
  slug: string;
  bio: string | null;
  genres: string[];
  city: string | null;
  profilePhotoUrl: string | null;
  socialLinks: Record<string, string> | null;
  isVerified: boolean;
  user: { name: string; artistName: string | null; photo: string | null };
  crates: Crate[];
  sets: DJSet[];
  events: DJEvent[];
  mixes?: DJMixPublic[];
  totalCrateItems: number;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
  return match ? match[1] : null;
}

function getThumbnail(set: DJSet): string | null {
  if (set.thumbnailUrl) return set.thumbnailUrl;
  const ytId = getYouTubeId(set.videoUrl);
  if (ytId) return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
  return null;
}

type SocialIcon = {
  key: string;
  label: string;
  icon: React.ReactNode;
  urlPrefix: string;
};

const SOCIAL_ICONS: SocialIcon[] = [
  {
    key: "instagram",
    label: "Instagram",
    icon: <Instagram size={18} />,
    urlPrefix: "https://instagram.com/",
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.12 8.12 0 004.76 1.52V6.76a4.85 4.85 0 01-.99-.07z"/>
      </svg>
    ),
    urlPrefix: "https://tiktok.com/@",
  },
  {
    key: "twitter",
    label: "Twitter / X",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    urlPrefix: "https://twitter.com/",
  },
  {
    key: "soundcloud",
    label: "SoundCloud",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M1.175 12.225c-.015.108-.023.218-.023.33C1.152 15.32 3.16 17 5.5 17h13.5c2.485 0 4.5-2.015 4.5-4.5S21.485 8 19 8c-.27 0-.533.025-.788.07C17.57 5.666 15.45 4 13 4c-2.21 0-4.11 1.343-4.96 3.273A3.75 3.75 0 005.5 7 3.75 3.75 0 001.75 10.75c0 .508.105.992.294 1.432A1.5 1.5 0 001.175 12.225z"/>
      </svg>
    ),
    urlPrefix: "https://soundcloud.com/",
  },
];

type BookingFormState = {
  name: string;
  email: string;
  phone: string;
  eventDate: string;
  venue: string;
  message: string;
};

const EMPTY_BOOKING: BookingFormState = {
  name: "",
  email: "",
  phone: "",
  eventDate: "",
  venue: "",
  message: "",
};

export default function DJProfileClient({ djProfile }: { djProfile: DJProfileData }) {
  const [bookingForm, setBookingForm] = useState<BookingFormState>(EMPTY_BOOKING);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [expandedSet, setExpandedSet] = useState<string | null>(null);
  const [activeMixId, setActiveMixId] = useState<string | null>(null);

  // Set attribution cookie when fan visits this DJ's profile
  useEffect(() => {
    if (!djProfile?.id) return;
    fetch("/api/dj/attribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        djProfileId: djProfile.id,
        sourceType: "PROFILE",
        sourceId: djProfile.id,
      }),
    }).catch(() => {}); // fire and forget
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track mix attribution when a fan opens/plays a mix
  useEffect(() => {
    if (!activeMixId || !djProfile?.id) return;
    fetch("/api/dj/attribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        djProfileId: djProfile.id,
        sourceType: "MIX",
        sourceId: activeMixId,
      }),
    }).catch(() => {});
  }, [activeMixId]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayName = djProfile.user.artistName ?? djProfile.user.name;
  const photo = djProfile.profilePhotoUrl ?? djProfile.user.photo;
  const socialLinks = djProfile.socialLinks ?? {};

  function setBookField(k: keyof BookingFormState, v: string) {
    setBookingForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleBookingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingForm.name.trim() || !bookingForm.email.includes("@") || !bookingForm.message.trim()) {
      setBookingError("Please fill in name, email, and message.");
      return;
    }
    setBookingLoading(true);
    setBookingError(null);
    try {
      const res = await fetch(`/api/dj/${djProfile.slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingForm),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setBookingError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setBookingSuccess(true);
      setBookingForm(EMPTY_BOOKING);
    } catch {
      setBookingError("Something went wrong. Please try again.");
    } finally {
      setBookingLoading(false);
    }
  }

  function scrollToBooking() {
    document.getElementById("booking-form")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#fff" }}>
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #141414 0%, #0A0A0A 100%)" }}>
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Photo */}
            <div
              className="w-36 h-36 md:w-48 md:h-48 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center text-4xl font-black"
              style={{ backgroundColor: "#1a1a1a" }}
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span style={{ color: "#D4A843" }}>{displayName[0]?.toUpperCase()}</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                <h1 className="text-3xl md:text-4xl font-black text-white">{displayName}</h1>
                {djProfile.isVerified && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{ backgroundColor: "#1a1500", color: "#D4A843" }}
                  >
                    <CheckCircle size={12} />
                    Verified DJ
                  </span>
                )}
              </div>

              {djProfile.city && (
                <div className="flex items-center justify-center md:justify-start gap-1.5 mb-3">
                  <MapPin size={13} style={{ color: "#888" }} />
                  <span className="text-sm" style={{ color: "#888" }}>{djProfile.city}</span>
                </div>
              )}

              {djProfile.bio && (
                <p className="text-sm leading-relaxed mb-4 max-w-xl" style={{ color: "#bbb" }}>
                  {djProfile.bio}
                </p>
              )}

              {/* Genre chips */}
              {djProfile.genres.length > 0 && (
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                  {djProfile.genres.map(g => (
                    <span
                      key={g}
                      className="px-3 py-1 rounded-full text-xs font-semibold border"
                      style={{ borderColor: "#D4A843", color: "#D4A843", backgroundColor: "rgba(212,168,67,0.08)" }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Social links */}
              {Object.keys(socialLinks).length > 0 && (
                <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-5">
                  {SOCIAL_ICONS.filter(s => socialLinks[s.key]).map(s => (
                    <a
                      key={s.key}
                      href={socialLinks[s.key].startsWith("http") ? socialLinks[s.key] : `${s.urlPrefix}${socialLinks[s.key]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-lg flex items-center justify-center border transition-colors hover:border-[#D4A843] hover:text-[#D4A843]"
                      style={{ borderColor: "#333", color: "#888" }}
                      aria-label={s.label}
                    >
                      {s.icon}
                    </a>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="flex flex-wrap justify-center md:justify-start gap-6 mb-5">
                <div className="text-center md:text-left">
                  <p className="text-xl font-black" style={{ color: "#D4A843" }}>{djProfile.totalCrateItems}</p>
                  <p className="text-[11px]" style={{ color: "#666" }}>tracks in crates</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-xl font-black text-white">{djProfile.sets.length}</p>
                  <p className="text-[11px]" style={{ color: "#666" }}>sets recorded</p>
                </div>
              </div>

              {/* Book button */}
              <button
                onClick={scrollToBooking}
                className="px-6 py-3 rounded-xl text-sm font-black transition-colors"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                Book This DJ
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-16">

        {/* Public Crates */}
        {djProfile.crates.length > 0 && (
          <section>
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-1" style={{ color: "#D4A843" }}>Crates</p>
              <h2 className="text-xl font-bold text-white">Music Crates</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {djProfile.crates.map(crate => (
                <Link
                  key={crate.id}
                  href={`/dj/${djProfile.slug}/crate/${encodeURIComponent(crate.name)}`}
                  className="group rounded-xl overflow-hidden border transition-colors hover:border-[#D4A843]"
                  style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
                >
                  <div className="aspect-square relative" style={{ backgroundColor: "#1a1a1a" }}>
                    {crate.coverArtUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={crate.coverArtUrl} alt={crate.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music2 size={28} style={{ color: "#333" }} />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-[#D4A843] transition-colors">{crate.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "#666" }}>{crate._count.items} tracks</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Sets */}
        {djProfile.sets.length > 0 && (
          <section>
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-1" style={{ color: "#D4A843" }}>Sets</p>
              <h2 className="text-xl font-bold text-white">Recorded Sets</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {djProfile.sets.map(set => {
                const thumb = getThumbnail(set);
                const ytId = getYouTubeId(set.videoUrl);
                const isExpanded = expandedSet === set.id;

                return (
                  <div
                    key={set.id}
                    className="rounded-xl border overflow-hidden"
                    style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
                  >
                    {isExpanded && ytId ? (
                      <div className="aspect-video">
                        <iframe
                          src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                          title={set.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="w-full h-full"
                        />
                      </div>
                    ) : (
                      <div
                        className="relative aspect-video cursor-pointer group"
                        style={{ backgroundColor: "#1a1a1a" }}
                        onClick={() => {
                          if (ytId) setExpandedSet(set.id);
                          else window.open(set.videoUrl, "_blank");
                        }}
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={set.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video size={28} style={{ color: "#444" }} />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "#D4A843" }}>
                            <Play size={18} fill="#0A0A0A" style={{ color: "#0A0A0A" }} />
                          </div>
                        </div>
                        {set.duration != null && (
                          <span
                            className="absolute bottom-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: "rgba(0,0,0,0.8)", color: "#fff" }}
                          >
                            {formatDuration(set.duration)}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-sm font-semibold text-white truncate">{set.title}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {set.venue && (
                          <span className="text-[11px]" style={{ color: "#666" }}>{set.venue}</span>
                        )}
                        {set.date && (
                          <span className="text-[11px]" style={{ color: "#666" }}>
                            {new Date(set.date).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Upcoming Events */}
        <section>
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-1" style={{ color: "#D4A843" }}>Shows</p>
            <h2 className="text-xl font-bold text-white">Upcoming Events</h2>
          </div>
          {djProfile.events.length === 0 ? (
            <div
              className="text-center py-10 rounded-xl border"
              style={{ borderColor: "#2a2a2a", color: "#555" }}
            >
              <Calendar size={28} className="mx-auto mb-2" style={{ color: "#333" }} />
              <p className="text-sm">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-3">
              {djProfile.events.map(event => {
                const date = new Date(event.date);
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 rounded-xl border"
                    style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
                  >
                    <div
                      className="flex flex-col items-center justify-center w-14 h-14 rounded-xl shrink-0"
                      style={{ backgroundColor: "#1a1500" }}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#D4A843" }}>
                        {date.toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className="text-xl font-black leading-none text-white">
                        {date.getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{event.name}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                        <div className="flex items-center gap-1">
                          <MapPin size={11} style={{ color: "#555" }} />
                          <span className="text-[11px]" style={{ color: "#888" }}>{event.venue}, {event.city}</span>
                        </div>
                        {event.time && (
                          <div className="flex items-center gap-1">
                            <Clock size={11} style={{ color: "#555" }} />
                            <span className="text-[11px]" style={{ color: "#888" }}>{event.time}</span>
                          </div>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-[11px] mt-1 line-clamp-2" style={{ color: "#666" }}>{event.description}</p>
                      )}
                    </div>
                    {event.ticketUrl && (
                      <a
                        href={event.ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:border-[#D4A843] hover:text-[#D4A843]"
                        style={{ borderColor: "#333", color: "#888" }}
                      >
                        <Ticket size={12} />
                        Tickets
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Mixes */}
        {djProfile.mixes && djProfile.mixes.length > 0 && (
          <section>
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-1" style={{ color: "#D4A843" }}>Mixes</p>
              <h2 className="text-xl font-bold text-white">Full Mixes</h2>
            </div>
            <div className="space-y-4">
              {djProfile.mixes.map(mix => {
                const isActive = activeMixId === mix.id;
                return (
                  <div key={mix.id} className="rounded-xl border overflow-hidden" style={{ borderColor: "#222" }}>
                    {/* Mix header */}
                    <button
                      onClick={() => setActiveMixId(isActive ? null : mix.id)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 flex items-center justify-center">
                        {(mix.coverArtUrl || mix.canvasVideoUrl)
                          ? <img src={mix.coverArtUrl ?? ''} alt="" className="w-full h-full object-cover" />
                          : <span className="text-2xl">🎵</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{mix.title}</p>
                        {mix.description && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "#888" }}>{mix.description}</p>}
                        <p className="text-xs mt-1" style={{ color: "#666" }}>
                          {mix.tracklist.length} tracks
                          {mix.duration && ` · ${Math.floor(mix.duration / 3600)}h ${Math.floor((mix.duration % 3600) / 60)}m`}
                        </p>
                      </div>
                      <span className="text-xs" style={{ color: "#666" }}>{isActive ? "▲" : "▼"}</span>
                    </button>

                    {/* Expanded player + tracklist */}
                    {isActive && (
                      <div className="border-t" style={{ borderColor: "#222" }}>
                        {/* Audio player */}
                        <div className="p-4 pb-0">
                          <audio controls className="w-full h-10" style={{ colorScheme: "dark" }}>
                            <source src={mix.audioUrl} />
                            Your browser does not support audio playback.
                          </audio>
                        </div>
                        {/* Tracklist */}
                        {mix.tracklist.length > 0 && (
                          <div className="p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "#555" }}>Tracklist</p>
                            <div className="space-y-2">
                              {mix.tracklist.map(item => {
                                const displayTitle  = item.track?.title ?? item.title ?? "Unknown Track";
                                const displayArtist = item.track?.artist?.artistName ?? item.track?.artist?.name ?? item.artist ?? "Unknown Artist";
                                const artistSlug    = item.track?.artist?.artistSlug;
                                const startSec      = item.startTime ?? 0;
                                const mm = Math.floor(startSec / 60);
                                const ss = startSec % 60;
                                const timeLabel = `${mm}:${String(ss).padStart(2, "0")}`;
                                return (
                                  <div key={item.id} className="flex items-center gap-3">
                                    <span className="text-xs font-mono w-10 text-right flex-shrink-0" style={{ color: "#555" }}>{timeLabel}</span>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm text-white truncate block">{displayTitle}</span>
                                      {artistSlug ? (
                                        <a href={`/${artistSlug}`} className="text-xs hover:underline" style={{ color: "#D4A843" }}>{displayArtist}</a>
                                      ) : (
                                        <span className="text-xs" style={{ color: "#666" }}>{displayArtist}</span>
                                      )}
                                    </div>
                                    {item.trackId && (
                                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#D4A843" }} title="IndieThis track" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Book This DJ */}
        <section id="booking-form">
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-1" style={{ color: "#D4A843" }}>Bookings</p>
            <h2 className="text-xl font-bold text-white">Book {displayName}</h2>
            <p className="text-sm mt-1" style={{ color: "#888" }}>Fill out the form below and the DJ will be in touch.</p>
          </div>

          {bookingSuccess ? (
            <div
              className="p-6 rounded-xl border text-center"
              style={{ backgroundColor: "#0a1a0a", borderColor: "#1a3a1a" }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "#4ade80", color: "#0A0A0A" }}>
                <Send size={18} />
              </div>
              <p className="text-white font-semibold mb-1">Inquiry sent!</p>
              <p className="text-sm" style={{ color: "#888" }}>Your inquiry has been sent. The DJ will be in touch.</p>
              <button
                onClick={() => setBookingSuccess(false)}
                className="mt-4 text-xs underline"
                style={{ color: "#666" }}
              >
                Send another inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleBookingSubmit} className="max-w-lg space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Your Name *</label>
                  <input
                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
                    style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                    placeholder="John Smith"
                    value={bookingForm.name}
                    onChange={e => setBookField("name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Email *</label>
                  <input
                    type="email"
                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
                    style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                    placeholder="you@example.com"
                    value={bookingForm.email}
                    onChange={e => setBookField("email", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Phone (optional)</label>
                  <input
                    type="tel"
                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
                    style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                    placeholder="+1 555 555 5555"
                    value={bookingForm.phone}
                    onChange={e => setBookField("phone", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Event Date (optional)</label>
                  <input
                    type="date"
                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
                    style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                    value={bookingForm.eventDate}
                    onChange={e => setBookField("eventDate", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Venue (optional)</label>
                <input
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
                  style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                  placeholder="Club XYZ, Atlanta"
                  value={bookingForm.venue}
                  onChange={e => setBookField("venue", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Message *</label>
                <textarea
                  rows={4}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors resize-none"
                  style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                  placeholder="Tell the DJ about your event, expected crowd size, music preferences..."
                  value={bookingForm.message}
                  onChange={e => setBookField("message", e.target.value)}
                />
              </div>

              {bookingError && (
                <p className="text-sm" style={{ color: "#f87171" }}>{bookingError}</p>
              )}

              <button
                type="submit"
                disabled={bookingLoading}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-black transition-colors disabled:opacity-60"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {bookingLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Send size={15} />
                    Send Inquiry
                  </>
                )}
              </button>
            </form>
          )}
        </section>
      </div>

      {/* Footer spacer */}
      <div className="h-16" />
    </div>
  );
}

