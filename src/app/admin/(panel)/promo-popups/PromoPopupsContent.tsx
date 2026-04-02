"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, X, Pencil, Trash2, Eye, EyeOff, Upload } from "lucide-react";
import { UploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/lib/uploadthing";

// ── Types ─────────────────────────────────────────────────────────────────────

type PromoPopup = {
  id: string;
  title: string;
  subtitle?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  imageUrl?: string | null;
  backgroundColor?: string | null;
  pages: string[];
  priority: number;
  frequency: string;
  trigger: string;
  triggerDelay?: number | null;
  active: boolean;
  startDate?: string | null;
  endDate?: string | null;
  impressions: number;
  dismissals: number;
  ctaClicks: number;
  createdAt: string;
};

const FREQUENCY_LABELS: Record<string, string> = {
  ONCE_PER_SESSION: "Once / session",
  ONCE_PER_DAY:     "Once / day",
  ALWAYS:           "Always",
  ONCE_EVER:        "Once ever",
};

const TRIGGER_LABELS: Record<string, string> = {
  ON_LOAD:        "On page load",
  ON_SCROLL:      "On scroll (50%)",
  ON_EXIT_INTENT: "Exit intent",
  DELAYED:        "Delayed",
};

const PAGE_OPTIONS = [
  { value: "*",         label: "All pages" },
  { value: "home",      label: "Home (landing)" },
  { value: "explore",   label: "Explore" },
  { value: "pricing",   label: "Pricing" },
  { value: "dashboard", label: "Dashboard" },
  { value: "merch",     label: "Merch store" },
];

const DEFAULT_FORM = {
  title:           "",
  subtitle:        "",
  ctaText:         "",
  ctaUrl:          "",
  imageUrl:        "",
  backgroundColor: "#111111",
  pages:           [] as string[],
  priority:        0,
  frequency:       "ONCE_PER_SESSION",
  trigger:         "ON_LOAD",
  triggerDelay:    "",
  active:          false,
  startDate:       "",
  endDate:         "",
};

type FormState = typeof DEFAULT_FORM;

// ── Main Component ────────────────────────────────────────────────────────────

export default function PromoPopupsContent() {
  const [popups, setPopups]         = useState<PromoPopup[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPopups = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/promo-popups");
      const data = await res.json() as { popups: PromoPopup[] };
      setPopups(data.popups ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPopups(); }, [fetchPopups]);

  function openCreate() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setError("");
    setShowModal(true);
  }

  function openEdit(p: PromoPopup) {
    setEditingId(p.id);
    setForm({
      title:           p.title,
      subtitle:        p.subtitle ?? "",
      ctaText:         p.ctaText  ?? "",
      ctaUrl:          p.ctaUrl   ?? "",
      imageUrl:        p.imageUrl ?? "",
      backgroundColor: p.backgroundColor ?? "#111111",
      pages:           p.pages,
      priority:        p.priority,
      frequency:       p.frequency,
      trigger:         p.trigger,
      triggerDelay:    p.triggerDelay != null ? String(p.triggerDelay) : "",
      active:          p.active,
      startDate:       p.startDate ? p.startDate.slice(0, 16) : "",
      endDate:         p.endDate   ? p.endDate.slice(0, 16)   : "",
    });
    setError("");
    setShowModal(true);
  }

  function togglePage(value: string) {
    setForm((f) => ({
      ...f,
      pages: f.pages.includes(value)
        ? f.pages.filter((p) => p !== value)
        : [...f.pages, value],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        triggerDelay: form.triggerDelay ? parseInt(form.triggerDelay) : null,
        startDate:    form.startDate || null,
        endDate:      form.endDate   || null,
        subtitle:     form.subtitle  || null,
        ctaText:      form.ctaText   || null,
        ctaUrl:       form.ctaUrl    || null,
        imageUrl:     form.imageUrl  || null,
        backgroundColor: form.backgroundColor || null,
      };

      const url    = editingId ? `/api/admin/promo-popups/${editingId}` : "/api/admin/promo-popups";
      const method = editingId ? "PATCH" : "POST";

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }

      setShowModal(false);
      void fetchPopups();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: PromoPopup) {
    await fetch(`/api/admin/promo-popups/${p.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ active: !p.active }),
    });
    setPopups((prev) =>
      prev.map((x) => x.id === p.id ? { ...x, active: !p.active } : x)
    );
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this popup? This cannot be undone.")) return;
    setDeletingId(id);
    await fetch(`/api/admin/promo-popups/${id}`, { method: "DELETE" });
    setPopups((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);
  }

  const ctr = (p: PromoPopup) =>
    p.impressions > 0 ? ((p.ctaClicks / p.impressions) * 100).toFixed(1) : "—";

  return (
    <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F5F5F5", margin: 0 }}>Promo Popups</h1>
          <p style={{ color: "#9A9A9E", fontSize: 13, marginTop: 4 }}>
            Manage marketing popups shown across the platform
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={fetchPopups}
            style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8,
              color: "#9A9A9E", padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={openCreate}
            style={{ background: "#D4A843", border: "none", borderRadius: 8,
              color: "#0A0A0A", padding: "8px 16px", fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={14} /> New Popup
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Popups", value: popups.length },
          { label: "Active",       value: popups.filter((p) => p.active).length },
          { label: "Total Impressions", value: popups.reduce((s, p) => s + p.impressions, 0).toLocaleString() },
        ].map((s) => (
          <div key={s.label} style={{ background: "#111111", border: "1px solid #1E1E1E", borderRadius: 10,
            padding: "16px 20px" }}>
            <div style={{ color: "#9A9A9E", fontSize: 12, marginBottom: 6 }}>{s.label}</div>
            <div style={{ color: "#F5F5F5", fontSize: 22, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#9A9A9E", padding: 40 }}>Loading…</div>
      ) : popups.length === 0 ? (
        <div style={{ textAlign: "center", color: "#9A9A9E", padding: 60,
          background: "#111111", border: "1px solid #1E1E1E", borderRadius: 12 }}>
          No popups yet. Click <strong style={{ color: "#D4A843" }}>New Popup</strong> to create one.
        </div>
      ) : (
        <div style={{ background: "#111111", border: "1px solid #1E1E1E", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1E1E1E" }}>
                {["Popup", "Pages", "Frequency / Trigger", "Stats", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left",
                    color: "#9A9A9E", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {popups.map((p, i) => (
                <tr key={p.id}
                  style={{ borderBottom: i < popups.length - 1 ? "1px solid #1A1A1A" : "none" }}>
                  {/* Popup info */}
                  <td style={{ padding: "14px 16px", maxWidth: 240 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 6,
                          objectFit: "cover", flexShrink: 0 }} />
                      )}
                      <div>
                        <div style={{ color: "#F5F5F5", fontWeight: 600, fontSize: 14,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
                          {p.title}
                        </div>
                        {p.subtitle && (
                          <div style={{ color: "#9A9A9E", fontSize: 12, marginTop: 2,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
                            {p.subtitle}
                          </div>
                        )}
                        {p.ctaText && (
                          <div style={{ color: "#D4A843", fontSize: 11, marginTop: 4 }}>
                            CTA: {p.ctaText}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Pages */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {p.pages.map((pg) => (
                        <span key={pg} style={{ background: "#1A1A1A", border: "1px solid #2A2A2A",
                          borderRadius: 4, padding: "2px 8px", fontSize: 11, color: "#9A9A9E" }}>
                          {pg === "*" ? "All" : pg}
                        </span>
                      ))}
                    </div>
                  </td>
                  {/* Frequency / Trigger */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ color: "#F5F5F5", fontSize: 13 }}>
                      {FREQUENCY_LABELS[p.frequency] ?? p.frequency}
                    </div>
                    <div style={{ color: "#9A9A9E", fontSize: 12, marginTop: 2 }}>
                      {TRIGGER_LABELS[p.trigger] ?? p.trigger}
                      {p.triggerDelay ? ` (${p.triggerDelay}s)` : ""}
                    </div>
                  </td>
                  {/* Stats */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: "#9A9A9E" }}>
                      <span style={{ color: "#F5F5F5" }}>{p.impressions.toLocaleString()}</span> views
                    </div>
                    <div style={{ fontSize: 12, color: "#9A9A9E", marginTop: 2 }}>
                      <span style={{ color: "#D4A843" }}>{ctr(p)}%</span> CTR
                    </div>
                    <div style={{ fontSize: 12, color: "#9A9A9E", marginTop: 2 }}>
                      {p.dismissals.toLocaleString()} dismissed
                    </div>
                  </td>
                  {/* Status */}
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      onClick={() => void toggleActive(p)}
                      style={{ display: "flex", alignItems: "center", gap: 6,
                        background: p.active ? "#14532D22" : "#1A1A1A",
                        border: `1px solid ${p.active ? "#22C55E55" : "#2A2A2A"}`,
                        borderRadius: 6, padding: "4px 10px", cursor: "pointer",
                        color: p.active ? "#22C55E" : "#9A9A9E", fontSize: 12 }}
                    >
                      {p.active ? <Eye size={12} /> : <EyeOff size={12} />}
                      {p.active ? "Live" : "Off"}
                    </button>
                    {p.priority > 0 && (
                      <div style={{ color: "#D4A843", fontSize: 11, marginTop: 4 }}>
                        Priority {p.priority}
                      </div>
                    )}
                  </td>
                  {/* Actions */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => openEdit(p)}
                        style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 6,
                          color: "#9A9A9E", padding: "6px 10px", cursor: "pointer" }}
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => void handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 6,
                          color: "#f87171", padding: "6px 10px", cursor: "pointer" }}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111111", border: "1px solid #2A2A2A", borderRadius: 14,
            width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", padding: 28 }}>
            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ color: "#F5F5F5", fontSize: 18, fontWeight: 700, margin: 0 }}>
                {editingId ? "Edit Popup" : "New Popup"}
              </h2>
              <button onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9A9A9E" }}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div style={{ background: "#3B0F0F", border: "1px solid #7F1D1D", borderRadius: 8,
                padding: "10px 14px", color: "#f87171", fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Title */}
              <Field label="Title *">
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Summer sale — 20% off" style={inputStyle} />
              </Field>

              {/* Subtitle */}
              <Field label="Subtitle">
                <input value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                  placeholder="Short supporting text" style={inputStyle} />
              </Field>

              {/* CTA */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="CTA Button Text">
                  <input value={form.ctaText} onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))}
                    placeholder="Get the deal" style={inputStyle} />
                </Field>
                <Field label="CTA URL">
                  <input value={form.ctaUrl} onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
                    placeholder="https://..." style={inputStyle} />
                </Field>
              </div>

              {/* Image */}
              <Field label="Image">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.imageUrl && (
                    <div style={{ position: "relative", display: "inline-block" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.imageUrl} alt="" style={{ width: "100%", maxHeight: 120,
                        objectFit: "cover", borderRadius: 8, border: "1px solid #2A2A2A" }} />
                      <button onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                        style={{ position: "absolute", top: 6, right: 6, background: "#0A0A0A",
                          border: "1px solid #2A2A2A", borderRadius: 4, color: "#f87171",
                          cursor: "pointer", padding: "2px 4px" }}>
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {!form.imageUrl && (
                    <UploadButton<OurFileRouter, "promoPopupImage">
                      endpoint="promoPopupImage"
                      onClientUploadComplete={(res) => {
                        if (res?.[0]?.url) setForm((f) => ({ ...f, imageUrl: res[0].url }));
                      }}
                      onUploadError={(err) => setError(err.message)}
                      appearance={{
                        button: { background: "#1A1A1A", border: "1px solid #2A2A2A",
                          borderRadius: 8, color: "#9A9A9E", padding: "8px 16px",
                          fontSize: 13, cursor: "pointer" },
                        allowedContent: { color: "#9A9A9E", fontSize: 11 },
                      }}
                      content={{
                        button: (<><Upload size={13} style={{ marginRight: 6 }} />Upload Image</>),
                      }}
                    />
                  )}
                  <input value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="Or paste image URL" style={{ ...inputStyle, fontSize: 12 }} />
                </div>
              </Field>

              {/* Background color */}
              <Field label="Background Color">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="color" value={form.backgroundColor}
                    onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))}
                    style={{ width: 40, height: 36, borderRadius: 6, border: "1px solid #2A2A2A",
                      background: "none", cursor: "pointer", padding: 2 }} />
                  <input value={form.backgroundColor}
                    onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))}
                    placeholder="#111111" style={{ ...inputStyle, flex: 1 }} />
                </div>
              </Field>

              {/* Pages */}
              <Field label="Show On Pages *">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {PAGE_OPTIONS.map((opt) => {
                    const active = form.pages.includes(opt.value);
                    return (
                      <button key={opt.value} type="button" onClick={() => togglePage(opt.value)}
                        style={{ background: active ? "#D4A84322" : "#1A1A1A",
                          border: `1px solid ${active ? "#D4A843" : "#2A2A2A"}`,
                          borderRadius: 6, padding: "5px 12px", color: active ? "#D4A843" : "#9A9A9E",
                          fontSize: 12, cursor: "pointer" }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* Frequency + Trigger */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Frequency">
                  <select value={form.frequency}
                    onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                    style={{ ...inputStyle, cursor: "pointer" }}>
                    {Object.entries(FREQUENCY_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Trigger">
                  <select value={form.trigger}
                    onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
                    style={{ ...inputStyle, cursor: "pointer" }}>
                    {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {form.trigger === "DELAYED" && (
                <Field label="Delay (seconds)">
                  <input type="number" value={form.triggerDelay}
                    onChange={(e) => setForm((f) => ({ ...f, triggerDelay: e.target.value }))}
                    placeholder="5" min="1" max="120" style={inputStyle} />
                </Field>
              )}

              {/* Priority */}
              <Field label="Priority (higher = shown first)">
                <input type="number" value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                  min="0" max="100" style={inputStyle} />
              </Field>

              {/* Schedule */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Start Date (optional)">
                  <input type="datetime-local" value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    style={inputStyle} />
                </Field>
                <Field label="End Date (optional)">
                  <input type="datetime-local" value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    style={inputStyle} />
                </Field>
              </div>

              {/* Active toggle */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#D4A843" }} />
                <span style={{ color: "#F5F5F5", fontSize: 14 }}>Active (show to users)</span>
              </label>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowModal(false)}
                style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8,
                  color: "#9A9A9E", padding: "9px 20px", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => void handleSave()} disabled={saving}
                style={{ background: "#D4A843", border: "none", borderRadius: 8,
                  color: "#0A0A0A", padding: "9px 20px", fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Popup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", color: "#9A9A9E", fontSize: 12,
        fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0A0A0A",
  border: "1px solid #2A2A2A",
  borderRadius: 8,
  color: "#F5F5F5",
  padding: "9px 12px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
