"use client";

import { useEffect, useState } from "react";
import { Inbox, FileText, Music2, Youtube, ChevronDown, ChevronUp, ExternalLink, Trash2, CalendarClock, Mail, Phone, Zap, StickyNote } from "lucide-react";

type Submission = {
  id: string;
  artistName: string;
  genre: string | null;
  projectDesc: string | null;
  youtubeLinks: string[];
  fileUrls: string[];
  notes: string | null;
  bpmDetected: number | null;
  keyDetected: string | null;
  createdAt: string;
  intakeLink: { name: string; email: string };
  contact: { id: string; name: string } | null;
};

type BookingRequest = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
};

function parseBookingMessage(message: string) {
  const lines = message.replace("[BOOKING REQUEST]\n", "").split("\n");
  const result: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf(": ");
    if (idx !== -1) {
      result[line.slice(0, idx)] = line.slice(idx + 2);
    }
  }
  return result;
}

export default function StudioInboxPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDeleteSubmission(id: string) {
    setDeleting(id);
    await fetch(`/api/studio/inbox/${id}`, { method: "DELETE" });
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    setDeleting(null);
    setExpanded(null);
  }

  async function handleDeleteBookingRequest(id: string) {
    setDeleting(id);
    await fetch(`/api/studio/booking-requests/${id}`, { method: "DELETE" });
    setBookingRequests((prev) => prev.filter((r) => r.id !== id));
    setDeleting(null);
    setExpanded(null);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/studio/inbox").then((r) => r.json()),
      fetch("/api/studio/booking-requests").then((r) => r.json()),
    ]).then(([inbox, bookings]) => {
      setSubmissions(inbox.submissions ?? []);
      setBookingRequests(bookings.requests ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Booking requests and intake form submissions</p>
      </div>

      {/* BOOKING REQUESTS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={15} className="text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Booking Requests</h2>
          {bookingRequests.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}>
              {bookingRequests.length}
            </span>
          )}
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : bookingRequests.length === 0 ? (
            <div className="py-10 text-center space-y-1">
              <CalendarClock size={28} className="mx-auto text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No booking requests yet.</p>
            </div>
          ) : (
            bookingRequests.map((r) => {
              const isOpen = expanded === r.id;
              const details = parseBookingMessage(r.message);
              return (
                <div key={r.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}>
                        {r.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {details["Session type"] && <span className="mr-2">{details["Session type"]}</span>}
                          {details["Requested date"] && <span>{details["Requested date"]}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {isOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: "var(--border)" }}>
                      <div className="grid sm:grid-cols-2 gap-4 pt-4">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Mail size={11} /> Email</p>
                          <a href={`mailto:${r.email}`} className="text-sm text-accent hover:underline no-underline">{r.email}</a>
                        </div>
                        {r.phone && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Phone size={11} /> Phone</p>
                            <a href={`tel:${r.phone}`} className="text-sm text-foreground no-underline">{r.phone}</a>
                          </div>
                        )}
                        {details["Session type"] && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Session Type</p>
                            <p className="text-sm text-foreground">{details["Session type"]}</p>
                          </div>
                        )}
                        {(details["Requested date"] || details["Requested time"]) && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Requested Time</p>
                            <p className="text-sm text-foreground">
                              {[details["Requested date"], details["Requested time"]].filter(Boolean).join(" at ")}
                            </p>
                          </div>
                        )}
                      </div>
                      {details["Notes"] && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{details["Notes"]}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <a href={`mailto:${r.email}?subject=Re: Your booking request`}
                          className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline no-underline font-medium">
                          Reply to {r.name} →
                        </a>
                        <button
                          onClick={() => handleDeleteBookingRequest(r.id)}
                          disabled={deleting === r.id}
                          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                        >
                          <Trash2 size={13} />
                          {deleting === r.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* INTAKE SUBMISSIONS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Inbox size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Intake Submissions</h2>
          {submissions.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground">
              {submissions.length}
            </span>
          )}
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : submissions.length === 0 ? (
            <div className="py-10 text-center space-y-1">
              <Inbox size={28} className="mx-auto text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No submissions yet.</p>
              <p className="text-xs text-muted-foreground">Send intake form links from the Contacts page.</p>
            </div>
          ) : (
            submissions.map((s) => {
              const isOpen = expanded === s.id;
              return (
                <div key={s.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}>
                        {s.artistName[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{s.artistName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.genre && <span className="mr-2">{s.genre}</span>}
                          via {s.intakeLink.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {isOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: "var(--border)" }}>
                      {s.projectDesc && (
                        <div className="pt-4 space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project Description</p>
                          <p className="text-sm text-foreground leading-relaxed">{s.projectDesc}</p>
                        </div>
                      )}
                      {s.youtubeLinks.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Youtube size={12} /> Reference Links
                          </p>
                          {s.youtubeLinks.map((link, i) => (
                            <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-sm text-accent hover:underline no-underline">
                              <ExternalLink size={12} />{link}
                            </a>
                          ))}
                        </div>
                      )}
                      {s.fileUrls.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Music2 size={12} /> Uploaded Files
                          </p>
                          {s.fileUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-sm text-accent hover:underline no-underline">
                              <FileText size={12} />{url.split("/").pop() ?? `File ${i + 1}`}
                            </a>
                          ))}
                        </div>
                      )}
                      {(s.bpmDetected != null || s.keyDetected) && (
                        <div className="flex items-center gap-2">
                          {s.bpmDetected != null && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
                              <Zap size={10} />{s.bpmDetected} BPM
                            </span>
                          )}
                          {s.keyDetected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
                              ♪ {s.keyDetected}
                            </span>
                          )}
                        </div>
                      )}
                      {s.notes && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
                          <p className="text-sm text-muted-foreground">{s.notes}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        {s.contact ? (
                          <a href={`/studio/contacts/${s.contact.id}`}
                            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline no-underline">
                            <StickyNote size={11} />
                            {s.contact.name} · View project history →
                          </a>
                        ) : <span />}
                        <button
                          onClick={() => handleDeleteSubmission(s.id)}
                          disabled={deleting === s.id}
                          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                        >
                          <Trash2 size={13} />
                          {deleting === s.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
