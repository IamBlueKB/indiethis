"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Plus, Edit3, Trash2, Loader2, X, MapPin, Clock, Ticket } from "lucide-react";

type DJEvent = {
  id: string;
  name: string;
  venue: string;
  city: string;
  date: string;
  time: string | null;
  ticketUrl: string | null;
  description: string | null;
  createdAt: string;
};

type FormState = {
  name: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  ticketUrl: string;
  description: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  venue: "",
  city: "",
  date: "",
  time: "",
  ticketUrl: "",
  description: "",
};

function EventModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial: FormState;
  onClose: () => void;
  onSave: (form: FormState) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);

  function set(k: keyof FormState, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  const isEdit = !!initial.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">{isEdit ? "Edit Event" : "Add Event"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Event Name *</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
              style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
              placeholder="Friday Night Takeover"
              value={form.name}
              onChange={e => set("name", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Venue *</label>
              <input
                className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
                style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                placeholder="Club XYZ"
                value={form.venue}
                onChange={e => set("venue", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>City *</label>
              <input
                className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
                style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                placeholder="Atlanta, GA"
                value={form.city}
                onChange={e => set("city", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Date *</label>
              <input
                type="date"
                className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
                style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                value={form.date}
                onChange={e => set("date", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Time (optional)</label>
              <input
                className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
                style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                placeholder="10:00 PM"
                value={form.time}
                onChange={e => set("time", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Ticket URL (optional)</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
              style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
              placeholder="https://eventbrite.com/..."
              value={form.ticketUrl}
              onChange={e => set("ticketUrl", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Description (optional)</label>
            <textarea
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors resize-none"
              style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
              placeholder="Special guest DJs, open bar until midnight..."
              value={form.description}
              onChange={e => set("description", e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={{ borderColor: "#333", color: "#888" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim() || !form.venue.trim() || !form.city.trim() || !form.date}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : (isEdit ? "Save Changes" : "Add Event")}
          </button>
        </div>
      </div>
    </div>
  );
}

function EventCard({
  event,
  onEdit,
  onDelete,
  deleting,
}: {
  event: DJEvent;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const date = new Date(event.date);
  const isPast = date < new Date();

  return (
    <div
      className="flex items-start justify-between p-4 rounded-xl border"
      style={{ backgroundColor: "#141414", borderColor: "#2a2a2a", opacity: isPast ? 0.7 : 1 }}
    >
      <div className="flex gap-4">
        <div
          className="flex flex-col items-center justify-center w-14 h-14 rounded-xl shrink-0 text-center"
          style={{ backgroundColor: isPast ? "#1a1a1a" : "#1a1500" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isPast ? "#555" : "#D4A843" }}>
            {date.toLocaleDateString("en-US", { month: "short" })}
          </span>
          <span className="text-xl font-black leading-none" style={{ color: isPast ? "#666" : "#fff" }}>
            {date.getDate()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{event.name}</p>
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
            <p className="text-[11px] mt-1.5 line-clamp-2" style={{ color: "#666" }}>{event.description}</p>
          )}
          {event.ticketUrl && (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium hover:underline"
              style={{ color: "#D4A843" }}
            >
              <Ticket size={10} />
              Get Tickets
            </a>
          )}
        </div>
      </div>
      <div className="flex gap-2 ml-3 shrink-0">
        <button
          onClick={onEdit}
          className="flex items-center justify-center w-8 h-8 rounded-lg border transition-colors hover:border-[#D4A843] hover:text-[#D4A843]"
          style={{ borderColor: "#333", color: "#888" }}
        >
          <Edit3 size={13} />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="flex items-center justify-center w-8 h-8 rounded-lg border transition-colors hover:border-red-500 hover:text-red-500"
          style={{ borderColor: "#333", color: "#888" }}
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

export default function DJEventsPage() {
  const [events, setEvents] = useState<DJEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<DJEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/dj/events")
      .then(r => r.json())
      .then((d: { events?: DJEvent[]; error?: string }) => {
        if (d.error) setError(d.error);
        else setEvents(d.events ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const now = new Date();
  const upcoming = events.filter(e => new Date(e.date) >= now);
  const past = events.filter(e => new Date(e.date) < now);

  async function handleSave(form: FormState) {
    setSaving(true);
    const payload = {
      name: form.name,
      venue: form.venue,
      city: form.city,
      date: form.date,
      time: form.time || null,
      ticketUrl: form.ticketUrl || null,
      description: form.description || null,
    };

    if (editingEvent) {
      const res = await fetch(`/api/dashboard/dj/events/${editingEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { event?: DJEvent; error?: string };
      if (data.event) {
        setEvents(prev => prev.map(e => e.id === editingEvent.id ? data.event! : e).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setEditingEvent(null);
        setShowModal(false);
      }
    } else {
      const res = await fetch("/api/dashboard/dj/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { event?: DJEvent; error?: string };
      if (data.event) {
        setEvents(prev => [...prev, data.event!].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setShowModal(false);
      }
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    setDeletingId(id);
    await fetch(`/api/dashboard/dj/events/${id}`, { method: "DELETE" });
    setEvents(prev => prev.filter(e => e.id !== id));
    setDeletingId(null);
  }

  function openEdit(event: DJEvent) {
    setEditingEvent(event);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingEvent(null);
  }

  const modalInitial: FormState = editingEvent
    ? {
        name: editingEvent.name,
        venue: editingEvent.venue,
        city: editingEvent.city,
        date: editingEvent.date.split("T")[0],
        time: editingEvent.time ?? "",
        ticketUrl: editingEvent.ticketUrl ?? "",
        description: editingEvent.description ?? "",
      }
    : EMPTY_FORM;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-1" style={{ color: "#D4A843" }}>DJ</p>
          <h1 className="text-2xl font-bold text-white">Events</h1>
          <p className="text-sm mt-1" style={{ color: "#888" }}>Your upcoming and past shows</p>
        </div>
        <button
          onClick={() => { setEditingEvent(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={15} />
          Add Event
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg border text-sm" style={{ backgroundColor: "#1a0a0a", borderColor: "#3a1a1a", color: "#f87171" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 border rounded-2xl" style={{ borderColor: "#2a2a2a" }}>
          <CalendarDays size={40} className="mx-auto mb-4" style={{ color: "#333" }} />
          <p className="text-white font-semibold mb-2">No events yet</p>
          <p className="text-sm mb-6" style={{ color: "#666" }}>Add your first upcoming show or gig.</p>
          <button
            onClick={() => { setEditingEvent(null); setShowModal(true); }}
            className="px-5 py-2.5 rounded-lg text-sm font-bold"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            Add Event
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: "#D4A843" }}>Upcoming</p>
              <div className="space-y-3">
                {upcoming.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEdit={() => openEdit(event)}
                    onDelete={() => handleDelete(event.id)}
                    deleting={deletingId === event.id}
                  />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: "#555" }}>Past Events</p>
              <div className="space-y-3">
                {past.reverse().map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEdit={() => openEdit(event)}
                    onDelete={() => handleDelete(event.id)}
                    deleting={deletingId === event.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <EventModal
          initial={modalInitial}
          onClose={closeModal}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
