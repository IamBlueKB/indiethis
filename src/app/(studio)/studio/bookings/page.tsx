"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle, DollarSign,
  X, Pencil, Check, Loader2, User, StickyNote, Send, Mail, Phone,
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
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function handleSend() {
    if (!email.trim() && !phone.trim()) {
      setError("Enter an email or phone number.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/intake-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          sessionDate: sessionDate || undefined,
          sessionTime: sessionTime || undefined,
          endTime: endTime || undefined,
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
          className="w-full max-w-sm rounded-2xl border p-6 space-y-4 shadow-xl"
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

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</label>
                <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Time</label>
                  <input type="time" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End Time</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }} />
                </div>
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

export default function StudioBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [sendIntakeOpen, setSendIntakeOpen] = useState(false);

  useEffect(() => {
    fetch("/api/studio/bookings")
      .then((r) => r.json())
      .then((d) => { setBookings(d.bookings ?? []); setLoading(false); });
  }, []);

  const handleUpdate = useCallback((id: string, patch: Partial<Booking>) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, ...patch } : b));
    setSelected((prev) => prev?.id === id ? { ...prev, ...patch } : prev);
  }, []);

  const filtered = filter === "ALL" ? bookings : bookings.filter((b) => b.status === filter);

  const counts = {
    ALL:       bookings.length,
    PENDING:   bookings.filter((b) => b.status === "PENDING").length,
    CONFIRMED: bookings.filter((b) => b.status === "CONFIRMED").length,
    COMPLETED: bookings.filter((b) => b.status === "COMPLETED").length,
    CANCELLED: bookings.filter((b) => b.status === "CANCELLED").length,
  };

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

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        {(["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={
              filter === f
                ? { backgroundColor: "var(--background)", color: "var(--foreground)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            {f === "ALL" ? "All" : STATUS_CONFIG[f]?.label}
            {counts[f] > 0 && <span className="ml-1.5 text-[10px] opacity-60">{counts[f]}</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
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

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Calendar size={32} className="mx-auto text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No bookings found.</p>
          </div>
        ) : (
          filtered.map((b) => {
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
                  <p className="text-xs text-muted-foreground">
                    {b.contact ? b.contact.name : b.artist.email}
                  </p>
                  {b.engineerNotes && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic truncate">
                      &ldquo;{b.engineerNotes}&rdquo;
                    </p>
                  )}
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
          })
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <BookingDrawer
          booking={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
