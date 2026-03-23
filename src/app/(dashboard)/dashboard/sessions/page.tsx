"use client";

import { useState, useEffect } from "react";
import { Calendar, MapPin, DollarSign, StickyNote, ChevronDown, ChevronUp, FileText, Send, Loader2 } from "lucide-react";
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

type SessionNote = {
  id: string;
  title: string;
  body: string;
  isShared: boolean;
  artistFeedback: string | null;
  feedbackAt: string | null;
  createdAt: string;
  bookingSessionId: string;
  attachments: { id: string; fileUrl: string; fileName: string }[];
  studio: { id: string; name: string; logo: string | null };
  bookingSession: { id: string; dateTime: string; sessionType: string | null; status: string };
};

// ─── Session Notes Panel ──────────────────────────────────────────────────────

function SessionNotesPanel({
  sessionId,
  notes,
  onFeedbackSubmitted,
}: {
  sessionId: string;
  notes: SessionNote[];
  onFeedbackSubmitted: (noteId: string, feedback: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const sessionNotes = notes.filter((n) => n.bookingSessionId === sessionId);

  if (sessionNotes.length === 0) return null;

  async function submitFeedback(noteId: string) {
    if (!feedbackText.trim()) { setFeedbackError("Please write your feedback first."); return; }
    setSubmitting(true);
    setFeedbackError(null);
    try {
      const res = await fetch(`/api/dashboard/session-notes/${noteId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: feedbackText.trim() }),
      });
      if (!res.ok) { setFeedbackError("Failed to submit feedback."); return; }
      onFeedbackSubmitted(noteId, feedbackText.trim());
      setFeedbackId(null);
      setFeedbackText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="border-t pt-3 mt-2 space-y-2"
      style={{ borderColor: "var(--border)" }}
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <StickyNote size={11} style={{ color: "#D4A843" }} />
        Session Notes from Studio
      </p>
      {sessionNotes.map((note) => (
        <div
          key={note.id}
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
        >
          {/* Note header */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/3 transition-colors"
            onClick={() => setExpandedId((v) => v === note.id ? null : note.id)}
          >
            <FileText size={13} style={{ color: "#D4A843" }} className="shrink-0" />
            <span className="flex-1 text-sm font-semibold text-foreground truncate">{note.title}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            {expandedId === note.id
              ? <ChevronUp size={13} className="text-muted-foreground shrink-0" />
              : <ChevronDown size={13} className="text-muted-foreground shrink-0" />
            }
          </button>

          {/* Note body */}
          {expandedId === note.id && (
            <div className="border-t px-3 py-3 space-y-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{note.body}</p>

              {/* Attachments */}
              {note.attachments.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attachments</p>
                  {note.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={a.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-accent hover:underline no-underline"
                    >
                      <FileText size={11} />
                      {a.fileName}
                    </a>
                  ))}
                </div>
              )}

              {/* Artist feedback — already submitted */}
              {note.artistFeedback ? (
                <div
                  className="rounded-lg p-3 space-y-1"
                  style={{ backgroundColor: "rgba(212,168,67,0.08)", border: "1px solid rgba(212,168,67,0.2)" }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#D4A843" }}>Your Feedback</p>
                  <p className="text-xs text-foreground leading-relaxed">{note.artistFeedback}</p>
                  {note.feedbackAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Sent {new Date(note.feedbackAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              ) : (
                /* Feedback form */
                feedbackId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      rows={3}
                      placeholder="Leave feedback for your studio…"
                      className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/30"
                      style={{ borderColor: "var(--border)" }}
                    />
                    {feedbackError && <p className="text-xs text-red-400">{feedbackError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setFeedbackId(null); setFeedbackText(""); setFeedbackError(null); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                        style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => submitFeedback(note.id)}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                      >
                        {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        Send Feedback
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setFeedbackId(note.id); setFeedbackText(""); setFeedbackError(null); }}
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-white/5"
                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                  >
                    <Send size={11} /> Leave Feedback
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const { data: sessions = [], isLoading, isError } = useSessions();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);

  const filtered = filter === "ALL" ? sessions : sessions.filter((s) => s.status === filter);

  // Fetch all shared notes for this artist once on mount
  useEffect(() => {
    fetch("/api/dashboard/session-notes")
      .then((r) => r.json())
      .then((d: { notes?: SessionNote[] }) => setNotes(d.notes ?? []))
      .catch(() => {})
      .finally(() => setNotesLoading(false));
  }, []);

  function handleFeedbackSubmitted(noteId: string, feedback: string) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId ? { ...n, artistFeedback: feedback, feedbackAt: new Date().toISOString() } : n
      )
    );
  }

  // Build a set of sessionIds that have notes
  const sessionIdsWithNotes = new Set(notes.map((n) => n.bookingSessionId));

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
            const hasNotes   = !notesLoading && sessionIdsWithNotes.has(s.id);
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
                  <div className="flex items-center gap-2 shrink-0">
                    {hasNotes && (
                      <span
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}
                      >
                        <StickyNote size={9} />
                        Notes
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusCfg.color} ${statusCfg.bg}`}
                    >
                      {statusCfg.label}
                    </span>
                  </div>
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

                {/* Session notes from studio */}
                {!notesLoading && (
                  <SessionNotesPanel
                    sessionId={s.id}
                    notes={notes}
                    onFeedbackSubmitted={handleFeedbackSubmitted}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
