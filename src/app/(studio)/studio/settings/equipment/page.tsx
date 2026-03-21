"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Cpu } from "lucide-react";

type EquipmentItem = {
  id: string;
  category: string;
  name: string;
  sortOrder: number;
};

const CATEGORIES = [
  { value: "CONSOLE",     label: "Consoles" },
  { value: "MONITORS",    label: "Monitors" },
  { value: "MICROPHONES", label: "Microphones" },
  { value: "OUTBOARD",    label: "Outboard Gear" },
  { value: "DAW",         label: "DAW & Software" },
  { value: "OTHER",       label: "Other" },
];

const INPUT = "w-full rounded-xl border px-4 py-2.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/40";
const SELECT = INPUT + " cursor-pointer";

const CATEGORY_ORDER = ["CONSOLE", "MONITORS", "MICROPHONES", "OUTBOARD", "DAW", "OTHER"];
const CATEGORY_LABELS: Record<string, string> = {
  CONSOLE: "Consoles", MONITORS: "Monitors", MICROPHONES: "Microphones",
  OUTBOARD: "Outboard Gear", DAW: "DAW & Software", OTHER: "Other",
};

export default function EquipmentSettingsPage() {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ category: "CONSOLE", name: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/studio/equipment")
      .then((r) => r.json())
      .then((d) => { setEquipment(d.equipment ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/studio/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sortOrder: equipment.filter((x) => x.category === form.category).length }),
      });
      const data = await res.json();
      if (res.ok) {
        setEquipment((e) => [...e, data.item]);
        setForm((f) => ({ ...f, name: "" }));
      }
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/studio/equipment/${id}`, { method: "DELETE" });
    setEquipment((e) => e.filter((x) => x.id !== id));
  }

  // Group by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, EquipmentItem[]>>((acc, cat) => {
    const items = equipment.filter((e) => e.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Equipment List</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gear available at your studio — shown in the "Equipment" section, grouped by category.</p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="rounded-xl border p-4 flex items-end gap-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <div className="space-y-1.5 w-44 shrink-0">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
          <select className={SELECT} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Equipment Name</label>
          <input className={INPUT} placeholder="e.g. SSL 4000 G+, Neve 1073, Pro Tools Ultimate" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ borderColor: "var(--border)" }} />
        </div>
        <button type="submit" disabled={saving || !form.name}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 shrink-0"
          style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}>
          <Plus size={14} /> Add
        </button>
      </form>

      {/* Equipment grouped by category */}
      {equipment.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center" style={{ borderColor: "var(--border)" }}>
          <Cpu size={24} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No equipment listed yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Add your consoles, microphones, monitors, and other gear.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border)" }}>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#D4A843" }}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5 group">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#D4A843" }} />
                      <span className="text-sm text-foreground">{item.name}</span>
                    </div>
                    <button onClick={() => handleDelete(item.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
