"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Loader2, Calendar, MapPin, Phone, Mail } from "lucide-react";

type DJBookingInquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  eventDate: string | null;
  venue: string | null;
  message: string;
  status: string;
  createdAt: string;
};

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:   { label: "Pending",   bg: "#1a1500", color: "#D4A843" },
  RESPONDED: { label: "Responded", bg: "#0a1a1a", color: "#22d3ee" },
  BOOKED:    { label: "Booked",    bg: "#0a1a0a", color: "#4ade80" },
  DECLINED:  { label: "Declined",  bg: "#1a0a0a", color: "#f87171" },
};

export default function DJBookingsPage() {
  const [inquiries, setInquiries] = useState<DJBookingInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/dj/bookings")
      .then(r => r.json())
      .then((d: { inquiries?: DJBookingInquiry[]; error?: string }) => {
        if (d.error) setError(d.error);
        else setInquiries(d.inquiries ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleStatusChange(id: string, status: string) {
    setUpdatingId(id);
    const res = await fetch(`/api/dashboard/dj/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json() as { inquiry?: DJBookingInquiry; error?: string };
    if (data.inquiry) {
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: data.inquiry!.status } : i));
    }
    setUpdatingId(null);
  }

  const statusCounts = inquiries.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-1" style={{ color: "#D4A843" }}>DJ</p>
        <h1 className="text-2xl font-bold text-white">Booking Inquiries</h1>
        <p className="text-sm mt-1" style={{ color: "#888" }}>Requests from people who want to book you</p>
      </div>

      {/* Summary row */}
      {!loading && inquiries.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {Object.entries(STATUS_STYLES).map(([key, style]) => (
            <div
              key={key}
              className="rounded-xl p-3 text-center border"
              style={{ backgroundColor: style.bg, borderColor: "#2a2a2a" }}
            >
              <p className="text-xl font-black" style={{ color: style.color }}>{statusCounts[key] ?? 0}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: "#666" }}>{style.label}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg border text-sm" style={{ backgroundColor: "#1a0a0a", borderColor: "#3a1a1a", color: "#f87171" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
        </div>
      ) : inquiries.length === 0 ? (
        <div className="text-center py-20 border rounded-2xl" style={{ borderColor: "#2a2a2a" }}>
          <MessageSquare size={40} className="mx-auto mb-4" style={{ color: "#333" }} />
          <p className="text-white font-semibold mb-2">No booking inquiries yet</p>
          <p className="text-sm" style={{ color: "#666" }}>Inquiries submitted from your public DJ profile will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inquiries.map(inquiry => {
            const style = STATUS_STYLES[inquiry.status] ?? STATUS_STYLES.PENDING;
            return (
              <div
                key={inquiry.id}
                className="rounded-xl border p-5"
                style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-base font-semibold text-white">{inquiry.name}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                      <a href={`mailto:${inquiry.email}`} className="flex items-center gap-1.5 text-[12px] hover:underline" style={{ color: "#888" }}>
                        <Mail size={11} />
                        {inquiry.email}
                      </a>
                      {inquiry.phone && (
                        <a href={`tel:${inquiry.phone}`} className="flex items-center gap-1.5 text-[12px] hover:underline" style={{ color: "#888" }}>
                          <Phone size={11} />
                          {inquiry.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {updatingId === inquiry.id ? (
                      <Loader2 size={14} className="animate-spin" style={{ color: "#D4A843" }} />
                    ) : (
                      <select
                        value={inquiry.status}
                        onChange={e => handleStatusChange(inquiry.id, e.target.value)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-bold border outline-none cursor-pointer"
                        style={{ backgroundColor: style.bg, color: style.color, borderColor: "#333" }}
                      >
                        {Object.entries(STATUS_STYLES).map(([key, s]) => (
                          <option key={key} value={key} style={{ backgroundColor: "#141414", color: s.color }}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                  {inquiry.eventDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} style={{ color: "#555" }} />
                      <span className="text-[11px]" style={{ color: "#888" }}>
                        {new Date(inquiry.eventDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                    </div>
                  )}
                  {inquiry.venue && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} style={{ color: "#555" }} />
                      <span className="text-[11px]" style={{ color: "#888" }}>{inquiry.venue}</span>
                    </div>
                  )}
                </div>

                <div
                  className="text-sm rounded-lg p-3 border"
                  style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a", color: "#bbb" }}
                >
                  {inquiry.message}
                </div>

                <p className="text-[10px] mt-2" style={{ color: "#555" }}>
                  Received {new Date(inquiry.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
