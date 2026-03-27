"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle, DollarSign,
  X, Pencil, Check, Loader2, User, StickyNote, Send, Mail, Phone,
  FileText, Eye, EyeOff, Trash2, ChevronDown, ChevronUp, Plus, MessageSquare,
  Music2, ExternalLink, Youtube, Download, RotateCcw,
} from "lucide-react";
import { formatPhoneInput } from "@/lib/formatPhone";

type Booking = {
  id: string;
  dateTime: string;
  duration: number | null;
  sessionType: string | null;
  status: string;
  paymentStatus: string;
  notes: string | null;
  engineerNotes: string | null;
  artist: { name: string; email: string };
  contact: { id: string; name: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:   { label: "Pending",   color: "text-yellow-400", icon: AlertCircle },
  CONFIRMED: { label: "Confirmed", color: "text-blue-400",   icon: Clock },
  COMPLETED: { label: "Completed", color: "text-emerald-400",icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "text-red-400",    icon: XCircle },
};

const INTAKE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:   { label: "Pending",   color: "text-yellow-400", icon: AlertCircle },
  CONFIRMED: { label: "Confirmed", color: "text-blue-400",   icon: Clock },
  COMPLETED: { label: "Completed", color: "text-emerald-400",icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "text-red-400",    icon: XCircle },
};

const PAYMENT_COLOR: Record<string, string> = {
  UNPAID:  "text-red-400",
  DEPOSIT: "text-yellow-400",
  PAID:    "text-emerald-400",
  WAIVED:  "text-muted-foreground",
};

const NEXT_STATUS: Record<string, string | null> = {
  PENDING:   "CONFIRMED",
  CONFIRMED: "COMPLETED",
  COMPLETED: null,
  CANCELLED: null,
};

const NEXT_PAYMENT: Record<string, string | null> = {
  UNPAID:  "DEPOSIT",
  DEPOSIT: "PAID",
  PAID:    null,
  WAIVED:  null,
};

// ─── Time Picker ─────────────────────────────────────────────────────────────
function TimePicker({ value, onChange, label, required, highlight }: {
  value: string; onChange: (v: string) => void;
  label: string; required?: boolean; highlight?: boolean;
}) {
  const curH = value ? value.split(":")[0] : "";
  const curM = value ? value.split(":")[1] : "00";

  const SELECT = "rounded-lg border px-2 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50 flex-1";

  function hours() {
    const opts = [];
    for (let h = 0; h < 24; h++) {
      const ampm = h < 12 ? "AM" : "PM";
      const h12 = h % 12 || 12;
      opts.push({ val: String(h).padStart(2, "0"), label: `${h12} ${ampm}` });
    }
    return opts;
  }

  function handleHour(h: string) {
    onChange(`${h}:${curM || "00"}`);
  }
  function handleMin(m: string) {
    onChange(`${curH || "00"}:${m}`);
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: highlight ? "#D4A843" : "var(--muted-foreground)" }}>
        {label}{required ? " *" : ""}
      </label>
      <div className="flex gap-1.5">
        <select value={curH} onChange={(e) => handleHour(e.target.value)}
          className={SELECT} style={{ borderColor: highlight ? "#D4A843" : "var(--border)" }}>
          <option value="">Hr</option>
          {hours().map(({ val, label: lbl }) => <option key={val} value={val}>{lbl}</option>)}
        </select>
        <select value={curM} onChange={(e) => handleMin(e.target.value)}
          className={SELECT} style={{ borderColor: highlight ? "#D4A843" : "var(--border)" }}>
          {["00", "15", "30", "45"].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─── Send Intake Form Modal ───────────────────────────────────────────────────

function SendIntakeModal({
  defaultEmail = "",
  defaultPhone = "",
  defaultDate = "",
  defaultTime = "",
  defaultEndTime = "",
  onClose,
}: {
  defaultEmail?: string;
  defaultPhone?: string;
  defaultDate?: string;
  defaultTime?: string;
  defaultEndTime?: string;
  onClose: () => void;
}) {
  const [email, setEmail]             = useState(defaultEmail);
  const [phone, setPhone]             = useState(defaultPhone);
  const [sessionDate, setSessionDate] = useState(defaultDate);
  const [sessionTime, setSessionTime] = useState(defaultTime);
  const [endTime, setEndTime]         = useState(defaultEndTime);
  const [hourlyRate, setHourlyRate]   = useState("");
  const [sessionHours, setSessionHours] = useState("");
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const totalCost = hourlyRate && sessionHours
    ? (parseFloat(hourlyRate) * parseFloat(sessionHours))
    : null;

  function autoEndTime(start: string, hrs: string) {
    if (!start || !hrs || isNaN(parseFloat(hrs))) return;
    const [h, m] = start.split(":").map(Number);
    const totalMins = h * 60 + m + Math.round(parseFloat(hrs) * 60);
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    setEndTime(`${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`);
  }

  async function handleSend() {
    if (!email.trim() && !phone.trim()) {
      setError("Enter an email or phone number.");
      return;
    }
    if (!sessionDate) {
      setError("Session date is required.");
      return;
    }
    if (!sessionTime) {
      setError("Start time is required.");
      return;
    }
    if (!endTime) {
      setError("End time is required.");
      return;
    }
    if (new Date(`${sessionDate}T${sessionTime}`) < new Date()) {
      setError("Session date and time cannot be in the past.");
      return;
    }
    if (endTime <= sessionTime) {
      setError("End time must be after start time.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/intake-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:        email.trim() || undefined,
          phone:        phone.trim() || undefined,
          sessionDate:  sessionDate || undefined,
          sessionTime:  sessionTime || undefined,
          endTime:      endTime || undefined,
          hourlyRate:   hourlyRate   ? parseFloat(hourlyRate)   : undefined,
          sessionHours: sessionHours ? parseFloat(sessionHours) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) setSent(true);
      else setError(data.error ?? "Failed to send.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-60 bg-black/60" onClick={onClose} />
      <div
        className="fixed inset-0 z-70 flex items-center justify-center p-4"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="w-full max-w-sm rounded-2xl border p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", pointerEvents: "auto" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground">Send Intake Form</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5">
              <X size={15} />
            </button>
          </div>

          {sent ? (
            <div className="py-6 text-center space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
              <p className="text-sm font-semibold text-foreground">Sent!</p>
              <p className="text-xs text-muted-foreground">Intake link delivered. Expires in 72 hours.</p>
              <button onClick={onClose} className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>Done</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Mail size={11} /> Email
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="artist@example.com"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }} />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Phone size={11} /> Phone
                </label>
                <input value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  placeholder="(555) 123-4567" inputMode="tel"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }} />
              </div>

              <p className="text-[10px] text-muted-foreground">Email, phone, or both. Client fills in their own name and info.</p>

              {/* Pricing (optional) — above time fields so end time auto-fills when start is picked */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Rate / hr (optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="e.g. 75"
                      className="w-full rounded-xl border pl-6 pr-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                      style={{ borderColor: "var(--border)" }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Hours (optional)
                  </label>
                  <input
                    type="number" min="0" step="0.5"
                    value={sessionHours}
                    onChange={(e) => { setSessionHours(e.target.value); autoEndTime(sessionTime, e.target.value); }}
                    placeholder="e.g. 2"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
              </div>
              {totalCost !== null && !isNaN(totalCost) && (
                <p className="text-xs font-semibold" style={{ color: "#D4A843" }}>
                  Session total: ${totalCost.toFixed(2)} — artist will see this on the form
                </p>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: !sessionDate ? "#D4A843" : "var(--muted-foreground)" }}>
                  Date *
                </label>
                <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: !sessionDate ? "#D4A843" : "var(--border)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TimePicker label="Start Time" required value={sessionTime} highlight={!sessionTime}
                  onChange={(v) => { setSessionTime(v); autoEndTime(v, sessionHours); }} />
                <TimePicker label="End Time" required value={endTime} highlight={!endTime}
                  onChange={setEndTime} />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>Cancel</button>
                <button onClick={handleSend} disabled={sending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Session Notes Section ────────────────────────────────────────────────────

type SessionNoteAttachment = { id: string; fileUrl: string; fileName: string; fileSize: number | null };
type SessionNote = {
  id: string;
  title: string;
  body: string;
  status: string;
  isShared: boolean;
  artistFeedback: string | null;
  feedbackAt: string | null;
  createdAt: string;
  attachments: SessionNoteAttachment[];
};

function SessionNotesSection({ bookingId }: { bookingId: string }) {
  const [notes, setNotes]             = useState<SessionNote[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [composing, setComposing]     = useState(false);
  const [newTitle, setNewTitle]       = useState("");
  const [newBody, setNewBody]         = useState("");
  const [newShared, setNewShared]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [togglingId, setTogglingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [saveError, setSaveError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/studio/session-notes?sessionId=${bookingId}`)
      .then((r) => r.json())
      .then((d) => { setNotes(d.notes ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [bookingId]);

  async function createNote() {
    if (!newTitle.trim() || !newBody.trim()) {
      setSaveError("Title and notes are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/studio/session-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingSessionId: bookingId,
          title: newTitle.trim(),
          body: newBody.trim(),
          isShared: newShared,
        }),
      });
      if (!res.ok) { setSaveError("Failed to save note."); return; }
      const data = await res.json() as { note: SessionNote };
      setNotes((prev) => [data.note, ...prev]);
      setNewTitle(""); setNewBody(""); setNewShared(false); setComposing(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleShare(note: SessionNote) {
    setTogglingId(note.id);
    try {
      const res = await fetch(`/api/studio/session-notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isShared: !note.isShared }),
      });
      if (res.ok) {
        const data = await res.json() as { note: SessionNote };
        setNotes((prev) => prev.map((n) => n.id === note.id ? data.note : n));
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteNote(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/studio/session-notes/${id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (expanded === id) setExpanded(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Session Notes</p>
        <button
          onClick={() => { setComposing((v) => !v); setSaveError(null); }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5"
          style={{ color: "#D4A843" }}
        >
          <Plus size={12} /> Add Note
        </button>
      </div>

      {/* Compose form */}
      {composing && (
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Note title (e.g. Mix notes, Stem list)"
            className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/30"
            style={{ borderColor: "var(--border)" }}
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={4}
            placeholder="Write your session notes here…"
            className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/30"
            style={{ borderColor: "var(--border)" }}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => setNewShared((v) => !v)}
                className="relative w-9 h-5 rounded-full transition-colors"
                style={{ backgroundColor: newShared ? "#D4A843" : "rgba(255,255,255,0.12)" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: newShared ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
              <span className="text-xs text-muted-foreground">Share with artist</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => { setComposing(false); setSaveError(null); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                Cancel
              </button>
              <button
                onClick={createNote}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </button>
            </div>
          </div>
          {saveError && <p className="text-xs text-red-400">{saveError}</p>}
        </div>
      )}

      {/* Notes list */}
      {loading ? (
        <div className="py-4 flex justify-center">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground opacity-50">
          <FileText size={13} /> No session notes yet.
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
            >
              {/* Note header row */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-white/3 transition-colors"
                onClick={() => setExpanded((v) => v === note.id ? null : note.id)}
              >
                <FileText size={13} className="shrink-0" style={{ color: "#D4A843" }} />
                <span className="flex-1 text-sm font-semibold text-foreground truncate">{note.title}</span>
                {note.artistFeedback && (
                  <MessageSquare size={12} className="text-emerald-400 shrink-0" />
                )}
                <span
                  className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    backgroundColor: note.isShared ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.07)",
                    color: note.isShared ? "#D4A843" : "var(--muted-foreground)",
                  }}
                >
                  {note.isShared ? "Shared" : "Studio only"}
                </span>
                {expanded === note.id ? <ChevronUp size={13} className="text-muted-foreground shrink-0" /> : <ChevronDown size={13} className="text-muted-foreground shrink-0" />}
              </div>

              {/* Expanded body */}
              {expanded === note.id && (
                <div className="border-t px-3 py-3 space-y-3" style={{ borderColor: "var(--border)" }}>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{note.body}</p>

                  {/* Artist feedback */}
                  {note.artistFeedback && (
                    <div
                      className="rounded-lg p-3 space-y-1"
                      style={{ backgroundColor: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Artist Feedback</p>
                      <p className="text-xs text-foreground leading-relaxed">{note.artistFeedback}</p>
                      {note.feedbackAt && (
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(note.feedbackAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Note actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleShare(note)}
                      disabled={togglingId === note.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border disabled:opacity-50"
                      style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                      title={note.isShared ? "Hide from artist" : "Share with artist"}
                    >
                      {togglingId === note.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : note.isShared ? (
                        <EyeOff size={12} />
                      ) : (
                        <Eye size={12} />
                      )}
                      {note.isShared ? "Hide from artist" : "Share with artist"}
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      disabled={deletingId === note.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border disabled:opacity-50"
                      style={{ borderColor: "rgba(239,68,68,0.3)", color: "#f87171" }}
                    >
                      {deletingId === note.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Delete
                    </button>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function BookingDrawer({
  booking,
  onClose,
  onUpdate,
}: {
  booking: Booking;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Booking>) => void;
}) {
  const [engNotes, setEngNotes]       = useState(booking.engineerNotes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes]  = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [sendIntakeOpen, setSendIntakeOpen] = useState(false);

  const dt = new Date(booking.dateTime);
  const nextStatus = NEXT_STATUS[booking.status];
  const nextPayment = NEXT_PAYMENT[booking.paymentStatus];

  async function patch(data: Record<string, string | null>) {
    await fetch(`/api/studio/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async function advanceStatus() {
    if (!nextStatus) return;
    setUpdatingStatus(true);
    await patch({ status: nextStatus });
    onUpdate(booking.id, { status: nextStatus });
    setUpdatingStatus(false);
  }

  async function advancePayment() {
    if (!nextPayment) return;
    setUpdatingPayment(true);
    await patch({ paymentStatus: nextPayment });
    onUpdate(booking.id, { paymentStatus: nextPayment });
    setUpdatingPayment(false);
  }

  async function saveNotes() {
    setSavingNotes(true);
    await patch({ engineerNotes: engNotes.trim() || null });
    onUpdate(booking.id, { engineerNotes: engNotes.trim() || null });
    setEditingNotes(false);
    setSavingNotes(false);
  }

  const statusCfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.PENDING;
  const StatusIcon = statusCfg.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md border-l overflow-y-auto flex flex-col"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-bold text-foreground">Booking Details</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-5">
          {/* Artist */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
              style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}
            >
              {booking.artist.name[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{booking.artist.name}</p>
              <p className="text-xs text-muted-foreground">{booking.artist.email}</p>
              {booking.contact && (
                <p className="text-xs text-muted-foreground">CRM: {booking.contact.name}</p>
              )}
            </div>
          </div>

          {/* Date / Time / Duration / Type */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Date", value: dt.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" }) },
              { label: "Time", value: dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) },
              { label: "Duration", value: booking.duration ? `${booking.duration} hr${booking.duration !== 1 ? "s" : ""}` : "—" },
              { label: "Type", value: booking.sessionType ?? "Session" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl border p-3"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                <p className="text-sm font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booking Status</p>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${statusCfg.color}`}
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <StatusIcon size={14} />
                {statusCfg.label}
              </div>
              {nextStatus && (
                <button
                  onClick={advanceStatus}
                  disabled={updatingStatus}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {updatingStatus ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Mark {STATUS_CONFIG[nextStatus]?.label}
                </button>
              )}
            </div>
          </div>

          {/* Payment */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment</p>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${PAYMENT_COLOR[booking.paymentStatus] ?? "text-muted-foreground"}`}
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <DollarSign size={14} />
                {booking.paymentStatus}
              </div>
              {nextPayment && (
                <button
                  onClick={advancePayment}
                  disabled={updatingPayment}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 border"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  {updatingPayment ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={12} />}
                  Mark {nextPayment === "DEPOSIT" ? "Deposit Received" : "Paid"}
                </button>
              )}
            </div>
          </div>

          {/* Client notes (read-only) */}
          {booking.notes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Client Notes</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{booking.notes}</p>
            </div>
          )}

          {/* Engineer notes (editable) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Engineer Notes</p>
              {!editingNotes ? (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <Pencil size={12} />
                </button>
              ) : (
                <div className="flex gap-1">
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="p-1 rounded text-emerald-400 hover:bg-white/5 disabled:opacity-50"
                  >
                    {savingNotes ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  </button>
                  <button
                    onClick={() => { setEngNotes(booking.engineerNotes ?? ""); setEditingNotes(false); }}
                    className="p-1 rounded text-muted-foreground hover:bg-white/5"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <textarea
                value={engNotes}
                onChange={(e) => setEngNotes(e.target.value)}
                rows={4}
                placeholder="Session notes, mix notes, client preferences…"
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/30"
                style={{ borderColor: "var(--border)" }}
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {engNotes || (
                  <span className="flex items-center gap-1.5 opacity-50">
                    <StickyNote size={13} /> No engineer notes yet. Click the pencil to add.
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Session Notes */}
          <div className="border-t pt-5" style={{ borderColor: "var(--border)" }}>
            <SessionNotesSection bookingId={booking.id} />
          </div>
        </div>

        {/* Footer: Send Intake Form */}
        <div className="px-6 py-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setSendIntakeOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <Send size={14} />
            Send Intake Form
          </button>
        </div>
      </div>

      {/* Send intake modal */}
      {sendIntakeOpen && (
        <SendIntakeModal
          defaultEmail={booking.artist.email ?? ""}
          defaultDate={new Date(booking.dateTime).toISOString().split("T")[0]}
          defaultTime={new Date(booking.dateTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
          onClose={() => setSendIntakeOpen(false)}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type BookingRequest = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  createdAt: string;
};

type IntakeSubmissionItem = {
  id: string;
  artistName: string;
  genre: string | null;
  projectDesc: string | null;
  notes: string | null;
  depositPaid: boolean;
  depositAmount: number | null;
  paymentMethod: string | null;
  aiVideoRequested: boolean;
  youtubeLinks: string[];
  fileUrls: string[];
  photoUrl: string | null;
  bpmDetected: number | null;
  keyDetected: string | null;
  status: string;
  createdAt: string;
  contact: { name: string; email: string; phone: string | null } | null;
  intakeLink: { sessionDate: string | null; sessionTime: string | null; endTime: string | null; hourlyRate: number | null; sessionHours: number | null } | null;
};

function TrackAnalysisSection({
  intake,
  onSave,
}: {
  intake: IntakeSubmissionItem;
  onSave: (bpm: number | null, key: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [bpmVal, setBpmVal]   = useState(intake.bpmDetected?.toString() ?? "");
  const [keyVal, setKeyVal]   = useState(intake.keyDetected ?? "");
  const [saving, setSaving]   = useState(false);
  const hasFiles              = (intake.fileUrls?.length ?? 0) > 0;

  // Sync edit fields when parent values update
  useEffect(() => {
    if (!editing) {
      setBpmVal(intake.bpmDetected?.toString() ?? "");
      setKeyVal(intake.keyDetected ?? "");
    }
  }, [intake.bpmDetected, intake.keyDetected, editing]);

  async function handleSave() {
    setSaving(true);
    const bpm = bpmVal.trim() ? parseInt(bpmVal.trim(), 10) : null;
    const key = keyVal.trim() || null;
    await fetch(`/api/studio/intake-submissions/${intake.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bpmDetected: bpm, keyDetected: key }),
    });
    onSave(bpm, key);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Track Analysis</p>
        {!editing && (
          <button onClick={() => { setBpmVal(intake.bpmDetected?.toString() ?? ""); setKeyVal(intake.keyDetected ?? ""); setEditing(true); }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <Pencil size={10} /> Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="rounded-xl border p-3 space-y-3" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">BPM</p>
              <input type="number" value={bpmVal} onChange={(e) => setBpmVal(e.target.value)}
                placeholder="e.g. 140" min="1" max="300"
                className="w-full rounded-lg border px-2.5 py-1.5 text-sm bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Key</p>
              <input type="text" value={keyVal} onChange={(e) => setKeyVal(e.target.value)}
                placeholder="e.g. A minor"
                className="w-full rounded-lg border px-2.5 py-1.5 text-sm bg-transparent text-foreground outline-none focus:ring-1 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border" style={{ borderColor: "var(--border)" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">BPM</p>
              <p className="text-sm font-semibold" style={{ color: intake.bpmDetected ? "#D4A843" : "var(--muted-foreground)" }}>
                {intake.bpmDetected ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border p-3" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Key</p>
              <p className="text-sm font-semibold" style={{ color: intake.keyDetected ? "#60a5fa" : "var(--muted-foreground)" }}>
                {intake.keyDetected ?? "—"}
              </p>
            </div>
          </div>
          {!intake.bpmDetected && !intake.keyDetected && hasFiles && (
            <p className="text-[10px] text-muted-foreground mt-1">Auto-detected on new submissions — use Edit to enter manually</p>
          )}
        </>
      )}
    </div>
  );
}

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank");
  }
}

export default function StudioBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [intakeSubmissions, setIntakeSubmissions] = useState<IntakeSubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [selectedIntake, setSelectedIntake] = useState<IntakeSubmissionItem | null>(null);
  const [sendIntakeOpen, setSendIntakeOpen] = useState(false);
  const [intakeRequest, setIntakeRequest] = useState<BookingRequest | null>(null);

  const loadData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    fetch("/api/studio/bookings")
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json();
        if (!d.bookings) return;
        setBookings(d.bookings);
        setRequests(d.requests ?? []);
        setIntakeSubmissions(d.intakeSubmissions ?? []);
        // Keep open drawer in sync with fresh data
        setSelectedIntake((prev) =>
          prev ? (d.intakeSubmissions ?? []).find((s: IntakeSubmissionItem) => s.id === prev.id) ?? prev : null
        );
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpdate = useCallback((id: string, patch: Partial<Booking>) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, ...patch } : b));
    setSelected((prev) => prev?.id === id ? { ...prev, ...patch } : prev);
  }, []);

  const updateIntakeStatus = useCallback(async (id: string, newStatus: string) => {
    const res = await fetch(`/api/studio/intake-submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setIntakeSubmissions((prev) => prev.map((x) => x.id === id ? { ...x, status: newStatus } : x));
      setSelectedIntake((prev) => prev?.id === id ? { ...prev, status: newStatus } : prev);
    }
  }, []);

  const filteredIntakes = filter === "ALL"
    ? intakeSubmissions
    : intakeSubmissions.filter((s) => s.status === filter);

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All studio sessions</p>
        </div>
        <button
          onClick={() => setSendIntakeOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Send size={14} /> Send Intake Form
        </button>
      </div>

      {sendIntakeOpen && <SendIntakeModal onClose={() => setSendIntakeOpen(false)} />}
      {intakeRequest && (
        <SendIntakeModal
          defaultEmail={intakeRequest.email}
          defaultPhone={intakeRequest.phone ?? ""}
          onClose={() => setIntakeRequest(null)}
        />
      )}

      {/* Booking Requests from public page */}
      {requests.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
            <MessageSquare size={14} className="text-yellow-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Booking Requests ({requests.length})
            </span>
          </div>
          {requests.map((r) => {
            const lines = (r.message ?? "").split("\n").filter((l) => l && !l.startsWith("["));
            return (
              <div key={r.id} className="px-5 py-4 border-b last:border-b-0 flex items-start justify-between gap-4" style={{ borderColor: "var(--border)" }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.email}{r.phone ? ` · ${r.phone}` : ""}</p>
                  {lines.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{lines.join(" · ")}</p>
                  )}
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setIntakeRequest(r)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                    >
                      Send Intake
                    </button>
                    <a
                      href={`mailto:${r.email}?subject=Re: Your booking request`}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                    >
                      Reply
                    </a>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this booking request?")) return;
                        await fetch(`/api/studio/booking-requests/${r.id}`, { method: "DELETE" });
                        setRequests((prev) => prev.filter((x) => x.id !== r.id));
                      }}
                      className="p-1.5 rounded-lg border text-red-400 hover:bg-red-400/10 transition-colors"
                      style={{ borderColor: "var(--border)" }}
                      title="Delete request"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Intake Submissions Table ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Submitted Intake Forms</h2>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Loader2 size={12} className={refreshing ? "animate-spin" : "hidden"} />
            {!refreshing && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>}
            Refresh
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          {(["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const).map((f) => {
            const cnt = f === "ALL" ? intakeSubmissions.length : intakeSubmissions.filter((s) => s.status === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={filter === f ? { backgroundColor: "var(--background)", color: "var(--foreground)" } : { color: "var(--muted-foreground)" }}
              >
                {f === "ALL" ? "All" : STATUS_CONFIG[f]?.label}
                {cnt > 0 && <span className="ml-1.5 text-[10px] opacity-60">{cnt}</span>}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="grid grid-cols-[1fr_160px_120px_110px_130px] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b" style={{ borderColor: "var(--border)" }}>
            <span>Artist / Contact</span>
            <span>Session Date</span>
            <span>Genre</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          ) : filteredIntakes.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FileText size={32} className="mx-auto text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No intake submissions yet.</p>
            </div>
          ) : (
            filteredIntakes.map((s) => {
              const sc = INTAKE_STATUS_CONFIG[s.status] ?? INTAKE_STATUS_CONFIG.PENDING;
              const StatusIcon = sc.icon;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedIntake(s)}
                  className="grid grid-cols-[1fr_160px_120px_110px_130px] gap-4 px-5 py-4 items-center border-b last:border-b-0 hover:bg-white/3 transition-colors cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.artistName}</p>
                    <p className="text-xs text-muted-foreground">{s.contact?.email ?? "—"}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {s.depositPaid && s.paymentMethod && s.paymentMethod !== "stripe" && (() => {
                        const verified = ["CONFIRMED", "COMPLETED"].includes(s.status);
                        return verified ? (
                          <span className="text-[10px] text-emerald-400 font-semibold">
                            ✓ Payment received via {s.paymentMethod}{s.depositAmount ? ` — $${s.depositAmount}` : ""}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold" style={{ color: "#D4A843" }}>
                            ⏳ Check {s.paymentMethod}{s.depositAmount ? ` — $${s.depositAmount}` : ""}
                          </span>
                        );
                      })()}
                      {s.depositPaid && s.paymentMethod === "stripe" && (
                        <span className="text-[10px] text-emerald-400 font-semibold">
                          ✓ Deposit paid{s.depositAmount ? ` $${s.depositAmount}` : ""}
                        </span>
                      )}
                      {s.depositPaid && !s.paymentMethod && (
                        <span className="text-[10px] text-emerald-400 font-semibold">✓ Deposit</span>
                      )}
                      {(s.fileUrls ?? []).length > 0 && (
                        <span className="text-[10px] text-muted-foreground">🎵 {s.fileUrls.length} file{s.fileUrls.length !== 1 ? "s" : ""}</span>
                      )}
                      {(s.youtubeLinks ?? []).length > 0 && (
                        <span className="text-[10px] text-muted-foreground">▶ {s.youtubeLinks.length} ref</span>
                      )}
                      {s.photoUrl && <span className="text-[10px] text-muted-foreground">📷 photo</span>}
                      {s.aiVideoRequested && <span className="text-[10px] font-semibold" style={{ color: "#D4A843" }}>AI Video</span>}
                    </div>
                  </div>
                  <div>
                    {s.intakeLink?.sessionDate ? (
                      <>
                        <p className="text-sm text-foreground">
                          {new Date(s.intakeLink.sessionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        {s.intakeLink.sessionTime && (
                          <p className="text-xs text-muted-foreground">
                            {s.intakeLink.sessionTime}{s.intakeLink.endTime ? ` – ${s.intakeLink.endTime}` : ""}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{s.genre ?? "—"}</span>
                  <div className={`flex items-center gap-1.5 text-sm font-semibold ${sc.color}`}>
                    <StatusIcon size={13} />
                    {sc.label}
                  </div>
                  <div className="flex flex-col gap-1 items-start" onClick={(e) => e.stopPropagation()}>
                    {s.status === "PENDING" && (
                      <button onClick={() => updateIntakeStatus(s.id, "CONFIRMED")}
                        className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-400/15 text-emerald-400 hover:bg-emerald-400/25 transition-colors">
                        Confirm
                      </button>
                    )}
                    {(s.status === "PENDING" || s.status === "CONFIRMED") && (
                      <button onClick={() => updateIntakeStatus(s.id, "COMPLETED")}
                        className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-blue-400/15 text-blue-400 hover:bg-blue-400/25 transition-colors">
                        Complete
                      </button>
                    )}
                    {s.status !== "CANCELLED" && s.status !== "COMPLETED" && (
                      <button onClick={() => updateIntakeStatus(s.id, "CANCELLED")}
                        className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors">
                        Cancel
                      </button>
                    )}
                    {s.status === "CANCELLED" && (
                      <button onClick={() => updateIntakeStatus(s.id, "PENDING")}
                        className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-colors">
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── BookingSession table (confirmed sessions) ─────────────────────── */}
      {bookings.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sessions</span>
          </div>
          <div
            className="grid grid-cols-[1fr_160px_120px_110px_110px] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <span>Artist / Client</span>
            <span>Date & Time</span>
            <span>Type</span>
            <span>Status</span>
            <span>Payment</span>
          </div>
          {bookings.map((b) => {
            const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.PENDING;
            const StatusIcon = cfg.icon;
            const dt = new Date(b.dateTime);
            return (
              <div
                key={b.id}
                onClick={() => setSelected(b)}
                className="grid grid-cols-[1fr_160px_120px_110px_110px] gap-4 px-5 py-4 items-center border-b last:border-b-0 hover:bg-white/3 transition-colors cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{b.artist.name}</p>
                  <p className="text-xs text-muted-foreground">{b.contact ? b.contact.name : b.artist.email}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground">
                    {dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    {b.duration && ` · ${b.duration}h`}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">{b.sessionType ?? "Session"}</span>
                <div className={`flex items-center gap-1.5 text-sm font-semibold ${cfg.color}`}>
                  <StatusIcon size={13} />
                  {cfg.label}
                </div>
                <div className={`flex items-center gap-1 text-sm font-semibold ${PAYMENT_COLOR[b.paymentStatus] ?? "text-muted-foreground"}`}>
                  <DollarSign size={12} />
                  {b.paymentStatus}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BookingSession detail drawer */}
      {selected && (
        <BookingDrawer
          booking={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Intake submission detail drawer */}
      {selectedIntake && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSelectedIntake(null)} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md border-l overflow-y-auto flex flex-col"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-base font-bold text-foreground">Intake Submission</h2>
              <button onClick={() => setSelectedIntake(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 p-6 space-y-5 overflow-y-auto">
              {/* Artist info */}
              <div className="flex items-center gap-3">
                {selectedIntake.photoUrl ? (
                  <img src={selectedIntake.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                    style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}>
                    {selectedIntake.artistName[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-foreground">{selectedIntake.artistName}</p>
                  <p className="text-xs text-muted-foreground">{selectedIntake.contact?.email ?? "—"}</p>
                  {selectedIntake.contact?.phone && <p className="text-xs text-muted-foreground">{selectedIntake.contact.phone}</p>}
                </div>
              </div>

              {/* Status + actions */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => { const sc = INTAKE_STATUS_CONFIG[selectedIntake.status] ?? INTAKE_STATUS_CONFIG.PENDING; const Icon = sc.icon; return (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${sc.color}`} style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                      <Icon size={14} /> {sc.label}
                    </div>
                  ); })()}
                  {selectedIntake.status === "PENDING" && (
                    <button onClick={() => updateIntakeStatus(selectedIntake.id, "CONFIRMED")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                      <Check size={12} /> Confirm
                    </button>
                  )}
                  {(selectedIntake.status === "PENDING" || selectedIntake.status === "CONFIRMED") && (
                    <button onClick={() => updateIntakeStatus(selectedIntake.id, "COMPLETED")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                      <CheckCircle2 size={12} /> Complete
                    </button>
                  )}
                  {selectedIntake.status !== "CANCELLED" && selectedIntake.status !== "COMPLETED" && (
                    <button onClick={() => updateIntakeStatus(selectedIntake.id, "CANCELLED")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171" }}>
                      <X size={12} /> Cancel
                    </button>
                  )}
                  {selectedIntake.status === "CANCELLED" && (
                    <button onClick={() => updateIntakeStatus(selectedIntake.id, "PENDING")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                      style={{ borderColor: "#D4A843", color: "#D4A843" }}>
                      <RotateCcw size={12} /> Restore
                    </button>
                  )}
                </div>
              </div>

              {/* Session date */}
              {selectedIntake.intakeLink?.sessionDate && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border p-3" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Date</p>
                    <p className="text-sm font-semibold text-foreground">
                      {new Date(selectedIntake.intakeLink.sessionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  {selectedIntake.intakeLink.sessionTime && (
                    <div className="rounded-xl border p-3" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Time</p>
                      <p className="text-sm font-semibold text-foreground">
                        {selectedIntake.intakeLink.sessionTime}{selectedIntake.intakeLink.endTime ? ` – ${selectedIntake.intakeLink.endTime}` : ""}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Genre / Project */}
              {(selectedIntake.genre || selectedIntake.projectDesc) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Project</p>
                  {selectedIntake.genre && <p className="text-sm text-foreground">{selectedIntake.genre}</p>}
                  {selectedIntake.projectDesc && <p className="text-sm text-muted-foreground mt-0.5">{selectedIntake.projectDesc}</p>}
                </div>
              )}

              {/* Notes */}
              {selectedIntake.notes && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedIntake.notes}</p>
                </div>
              )}

              {/* Payment banner */}
              {selectedIntake.depositPaid && selectedIntake.paymentMethod && selectedIntake.paymentMethod !== "stripe" && (() => {
                const rate  = selectedIntake.intakeLink?.hourlyRate ?? null;
                const hrs   = selectedIntake.intakeLink?.sessionHours ?? null;
                const total = rate && hrs ? rate * hrs : null;
                const dep   = selectedIntake.depositAmount ?? 0;
                const isFull = total !== null && dep >= total;
                const confirmed = ["CONFIRMED", "COMPLETED"].includes(selectedIntake.status);
                return confirmed ? (
                  <div className="rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
                    <span className="text-base leading-none mt-0.5">✓</span>
                    <div>
                      <p className="text-sm font-semibold text-emerald-400">
                        {isFull ? "Full payment" : "Deposit"} received via {selectedIntake.paymentMethod}
                      </p>
                      {dep > 0 && <p className="text-xs text-muted-foreground mt-0.5">${dep.toFixed(2)} confirmed.</p>}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ backgroundColor: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.35)" }}>
                    <span className="text-base leading-none mt-0.5">⏳</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>
                        {isFull ? "Full payment" : "Deposit"} claimed via {selectedIntake.paymentMethod}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dep > 0 ? `$${dep.toFixed(2)} — ` : ""}Check your {selectedIntake.paymentMethod} to confirm receipt, then press Confirm above.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Payment / Pricing */}
              {(() => {
                const rate    = selectedIntake.intakeLink?.hourlyRate ?? null;
                const hrs     = selectedIntake.intakeLink?.sessionHours ?? null;
                const total   = rate && hrs ? rate * hrs : null;
                const deposit = selectedIntake.depositPaid ? (selectedIntake.depositAmount ?? 0) : 0;
                const balance = total !== null ? total - deposit : null;
                const hasAny  = total !== null || selectedIntake.depositPaid;
                if (!hasAny) return null;
                return (
                  <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "rgba(212,168,67,0.25)", backgroundColor: "rgba(212,168,67,0.05)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#D4A843" }}>Session Pricing</p>
                    {total !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Total ({hrs} hr{hrs !== 1 ? "s" : ""} × ${rate}/hr)</span>
                        <span className="text-sm font-semibold text-foreground">${total.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedIntake.depositPaid && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Deposit paid{selectedIntake.paymentMethod ? ` via ${selectedIntake.paymentMethod}` : ""}
                        </span>
                        <span className="text-sm font-semibold text-emerald-400">
                          −${deposit.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {balance !== null && (
                      <>
                        <div className="border-t" style={{ borderColor: "rgba(212,168,67,0.2)" }} />
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">Balance Due</span>
                          <span className="text-sm font-bold" style={{ color: balance > 0 ? "#D4A843" : "#34C759" }}>
                            ${balance.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                    {!total && selectedIntake.depositPaid && (
                      <p className="text-xs text-muted-foreground">
                        Deposit: ${deposit.toFixed(2)}{selectedIntake.paymentMethod ? ` via ${selectedIntake.paymentMethod}` : ""}
                      </p>
                    )}
                  </div>
                );
              })()}
              {selectedIntake.aiVideoRequested && (
                <div className="rounded-xl border p-3" style={{ backgroundColor: "rgba(212,168,67,0.08)", borderColor: "rgba(212,168,67,0.3)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#D4A843" }}>AI Music Video Requested</p>
                  <p className="text-xs text-muted-foreground">$49 — will be added to invoice</p>
                </div>
              )}

              {/* Artist photo */}
              {selectedIntake.photoUrl && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Artist Photo</p>
                  <div className="relative rounded-xl overflow-hidden" style={{ maxHeight: 220 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedIntake.photoUrl} alt="Artist" className="w-full object-cover rounded-xl" style={{ maxHeight: 220 }} />
                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadFile(selectedIntake.photoUrl!, `${selectedIntake.artistName}-photo`); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ backgroundColor: "rgba(0,0,0,0.65)", color: "#fff" }}>
                        <Download size={10} /> Download
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* BPM / Key */}
              <TrackAnalysisSection intake={selectedIntake} onSave={(bpm, key) => {
                setSelectedIntake((p) => p ? { ...p, bpmDetected: bpm, keyDetected: key } : p);
                setIntakeSubmissions((p) => p.map((x) => x.id === selectedIntake.id ? { ...x, bpmDetected: bpm, keyDetected: key } : x));
              }} />

              {/* Uploaded files */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Uploaded Files</p>
                {(selectedIntake.fileUrls ?? []).filter(Boolean).length === 0 ? (
                  <p className="text-xs text-muted-foreground opacity-50">No files submitted.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedIntake.fileUrls.filter(Boolean).map((url, i) => {
                      const raw = url.split("?")[0].split("/").pop() ?? "";
                      const name = raw ? decodeURIComponent(raw) : `File ${i + 1}`;
                      const isAudio = /\.(mp3|wav|flac|aac|m4a|ogg)$/i.test(name);
                      return (
                        <div key={i} className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
                          style={{ borderColor: "var(--border)" }}>
                          <Music2 size={13} className={isAudio ? "text-accent shrink-0" : "text-muted-foreground shrink-0"} />
                          <p className="flex-1 text-xs text-foreground truncate min-w-0">{name}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadFile(url, name); }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold shrink-0 hover:bg-white/10 transition-colors"
                            style={{ color: "var(--muted-foreground)" }}>
                            <Download size={11} /> Download
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reference tracks */}
              {(selectedIntake.youtubeLinks ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reference Tracks</p>
                  <div className="space-y-1.5">
                    {selectedIntake.youtubeLinks.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-white/5 transition-colors"
                        style={{ borderColor: "var(--border)" }}
                        onClick={(e) => e.stopPropagation()}>
                        <Youtube size={13} className="text-red-400 shrink-0" />
                        <span className="text-xs text-foreground truncate">{url}</span>
                        <ExternalLink size={11} className="text-muted-foreground shrink-0 ml-auto" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
