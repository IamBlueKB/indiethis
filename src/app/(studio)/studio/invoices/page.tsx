"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Plus, Send, Check, Eye, AlertCircle, Clock,
  ChevronDown, ChevronUp, Trash2, DollarSign, X, Loader2,
} from "lucide-react";

type LineItem = { description: string; quantity: number; rate: number; total: number };

type Contact = { id: string; name: string; email: string | null };

type Invoice = {
  id: string;
  invoiceNumber: number;
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  dueDate: string;
  status: "DRAFT" | "SENT" | "VIEWED" | "PAID" | "OVERDUE";
  paymentMethod: string | null;
  paidAt: string | null;
  notes: string | null;
  lineItems: LineItem[];
  createdAt: string;
  contact: { name: string; email: string | null };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  DRAFT:   { label: "Draft",   color: "text-muted-foreground", bg: "rgba(255,255,255,0.07)", icon: FileText },
  SENT:    { label: "Sent",    color: "text-blue-400",          bg: "rgba(90,200,250,0.12)",  icon: Send },
  VIEWED:  { label: "Viewed",  color: "text-yellow-400",        bg: "rgba(212,168,67,0.12)",  icon: Eye },
  PAID:    { label: "Paid",    color: "text-emerald-400",       bg: "rgba(52,199,89,0.12)",   icon: Check },
  OVERDUE: { label: "Overdue", color: "text-red-400",           bg: "rgba(232,93,74,0.12)",   icon: AlertCircle },
};

const NEXT_STATUS: Record<string, string | null> = {
  DRAFT:  "SENT",
  SENT:   "PAID",
  VIEWED: "PAID",
  PAID:   null,
  OVERDUE:"PAID",
};

const NEXT_LABEL: Record<string, string> = {
  DRAFT:  "Mark Sent",
  SENT:   "Mark Paid",
  VIEWED: "Mark Paid",
  OVERDUE:"Mark Paid",
};

// ─── Create Invoice Modal ────────────────────────────────────────────────────

function CreateModal({
  contacts,
  onClose,
  onCreated,
}: {
  contacts: Contact[];
  onClose: () => void;
  onCreated: (inv: Invoice) => void;
}) {
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, rate: 0, total: 0 },
  ]);
  const [taxRate, setTaxRate] = useState(0);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateLine(i: number, field: keyof LineItem, raw: string) {
    setLineItems((prev) => {
      const next = [...prev];
      const item = { ...next[i] };
      if (field === "description") {
        item.description = raw;
      } else {
        (item as unknown as Record<string, number>)[field] = parseFloat(raw) || 0;
      }
      item.total = item.quantity * item.rate;
      next[i] = item;
      return next;
    });
  }

  function addLine() {
    setLineItems((p) => [...p, { description: "", quantity: 1, rate: 0, total: 0 }]);
  }

  function removeLine(i: number) {
    setLineItems((p) => p.filter((_, idx) => idx !== i));
  }

  const subtotal = lineItems.reduce((s, l) => s + l.total, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId || lineItems.length === 0) return setError("Contact and at least one line item required.");
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/studio/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, lineItems, taxRate, dueDate, notes }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to create invoice.");
      onCreated(data.invoice);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div
        className="w-full max-w-2xl rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-bold text-foreground">Create Invoice</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Contact + Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Client</label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm text-foreground outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", colorScheme: "dark" }}
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id} style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none"
                  style={{ borderColor: "var(--border)", colorScheme: "dark" }}
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground">Line Items</label>
                <button type="button" onClick={addLine} className="text-xs text-accent hover:underline">+ Add line</button>
              </div>
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-[1fr_64px_88px_88px_28px] gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  <span>Description</span><span>Qty</span><span>Rate ($)</span><span>Total</span><span />
                </div>
                {lineItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_64px_88px_88px_28px] gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Service description"
                      value={item.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      className="rounded-lg border px-2.5 py-1.5 text-sm bg-transparent text-foreground outline-none"
                      style={{ borderColor: "var(--border)" }}
                    />
                    <input
                      type="number" min="1" step="1"
                      value={item.quantity}
                      onChange={(e) => updateLine(i, "quantity", e.target.value)}
                      className="rounded-lg border px-2.5 py-1.5 text-sm bg-transparent text-foreground outline-none text-center"
                      style={{ borderColor: "var(--border)" }}
                    />
                    <input
                      type="number" min="0" step="0.01"
                      value={item.rate}
                      onChange={(e) => updateLine(i, "rate", e.target.value)}
                      className="rounded-lg border px-2.5 py-1.5 text-sm bg-transparent text-foreground outline-none text-right"
                      style={{ borderColor: "var(--border)" }}
                    />
                    <p className="text-sm font-semibold text-foreground text-right pr-1">
                      ${item.total.toFixed(2)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      disabled={lineItems.length === 1}
                      className="p-1 rounded text-muted-foreground hover:text-red-400 disabled:opacity-30"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax + Totals */}
            <div className="flex items-end justify-between gap-4">
              <div className="w-36">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Tax Rate (%)</label>
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs text-muted-foreground">Subtotal: <span className="text-foreground font-semibold">${subtotal.toFixed(2)}</span></p>
                {taxRate > 0 && (
                  <p className="text-xs text-muted-foreground">Tax ({taxRate}%): <span className="text-foreground font-semibold">${tax.toFixed(2)}</span></p>
                )}
                <p className="text-sm font-bold text-foreground">Total: ${total.toFixed(2)}</p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Payment instructions, thank you note, etc."
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-none"
                style={{ borderColor: "var(--border)" }}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t flex justify-end gap-2" style={{ borderColor: "var(--border)" }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Draft Modal ─────────────────────────────────────────────────────────

function EditModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: (updated: Invoice) => void;
}) {
  const [lineItems, setLineItems] = useState<LineItem[]>(
    Array.isArray(invoice.lineItems)
      ? (invoice.lineItems as Array<Record<string, unknown>>).map((item) => ({
          description: String(item.description ?? ""),
          quantity: Number(item.quantity ?? 1),
          rate: Number(item.rate ?? (item as Record<string, unknown>).unitPrice ?? 0),
          total: Number(item.total ?? 0),
        }))
      : [{ description: "", quantity: 1, rate: 0, total: 0 }]
  );
  const [taxRate, setTaxRate] = useState(invoice.taxRate);
  const [dueDate, setDueDate] = useState(invoice.dueDate.slice(0, 10));
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateLine(i: number, field: keyof LineItem, raw: string) {
    setLineItems((prev) => {
      const next = [...prev];
      const item = { ...next[i] };
      if (field === "description") {
        item.description = raw;
      } else {
        (item as unknown as Record<string, number>)[field] = parseFloat(raw) || 0;
      }
      item.total = item.quantity * item.rate;
      next[i] = item;
      return next;
    });
  }

  const subtotal = lineItems.reduce((s, l) => s + l.total, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lineItems.length === 0) return setError("At least one line item required.");
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/studio/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems, taxRate, dueDate, notes }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to save.");
      onSaved({ ...invoice, lineItems, subtotal, tax, taxRate, total, dueDate, notes: notes.trim() || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-2xl rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-bold text-foreground">Edit Invoice #{String(invoice.invoiceNumber).padStart(4, "0")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Due Date */}
            <div className="w-56">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none"
                style={{ borderColor: "var(--border)", colorScheme: "dark" }}
              />
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground">Line Items</label>
                <button type="button" onClick={() => setLineItems((p) => [...p, { description: "", quantity: 1, rate: 0, total: 0 }])} className="text-xs text-accent hover:underline">+ Add line</button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_64px_88px_88px_28px] gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  <span>Description</span><span>Qty</span><span>Rate ($)</span><span>Total</span><span />
                </div>
                {lineItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_64px_88px_88px_28px] gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Service description"
                      value={item.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      className="rounded-lg border px-2.5 py-1.5 text-sm bg-transparent text-foreground outline-none"
                      style={{ borderColor: "var(--border)" }}
                    />
                    <input
                      type="number" min="1" step="1"
                      value={item.quantity}
                      onChange={(e) => updateLine(i, "quantity", e.target.value)}
                      className="rounded-lg border px-2.5 py-1.5 text-sm bg-transparent text-foreground outline-none text-center"
                      style={{ borderColor: "var(--border)" }}
                    />
                    <input
                      type="number" min="0" step="0.01"
                      value={item.rate}
                      onChange={(e) => updateLine(i, "rate", e.target.value)}
                      className="rounded-lg border px-2.5 py-1.5 text-sm bg-transparent text-foreground outline-none text-right"
                      style={{ borderColor: "var(--border)" }}
                    />
                    <p className="text-sm font-semibold text-foreground text-right pr-1">${item.total.toFixed(2)}</p>
                    <button
                      type="button"
                      onClick={() => setLineItems((p) => p.filter((_, idx) => idx !== i))}
                      disabled={lineItems.length === 1}
                      className="p-1 rounded text-muted-foreground hover:text-red-400 disabled:opacity-30"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax + Totals */}
            <div className="flex items-end justify-between gap-4">
              <div className="w-36">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Tax Rate (%)</label>
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs text-muted-foreground">Subtotal: <span className="text-foreground font-semibold">${subtotal.toFixed(2)}</span></p>
                {taxRate > 0 && <p className="text-xs text-muted-foreground">Tax ({taxRate}%): <span className="text-foreground font-semibold">${tax.toFixed(2)}</span></p>}
                <p className="text-sm font-bold text-foreground">Total: ${total.toFixed(2)}</p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Payment instructions, discounts, etc."
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-none"
                style={{ borderColor: "var(--border)" }}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t flex justify-end gap-2" style={{ borderColor: "var(--border)" }}>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold border" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Invoice Row ─────────────────────────────────────────────────────────────

function InvoiceRow({ invoice: initialInvoice, onUpdate, onDelete }: { invoice: Invoice; onUpdate: (id: string, status: string) => void; onDelete: (id: string) => void }) {
  const [invoice, setInvoice] = useState(initialInvoice);
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.DRAFT;
  const StatusIcon = cfg.icon;
  const nextStatus = NEXT_STATUS[invoice.status];
  const overdue = !["PAID", "OVERDUE"].includes(invoice.status) && new Date(invoice.dueDate) < new Date();
  const effectiveStatus = overdue ? "OVERDUE" : invoice.status;
  const effectiveCfg = STATUS_CONFIG[effectiveStatus] ?? cfg;
  const EffectiveStatusIcon = effectiveCfg.icon;

  async function advance() {
    if (!nextStatus) return;
    setUpdating(true);
    await fetch(`/api/studio/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    onUpdate(invoice.id, nextStatus);
    setUpdating(false);
  }

  async function handleSend() {
    setSending(true);
    setSendError(null);
    setSentOk(false);
    try {
      const res = await fetch(`/api/studio/invoices/${invoice.id}/send`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSentOk(true);
        onUpdate(invoice.id, "SENT");
        setTimeout(() => setSentOk(false), 3000);
      } else {
        setSendError(data.error ?? "Failed to send.");
      }
    } catch {
      setSendError("Network error.");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this draft invoice? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/studio/invoices/${invoice.id}`, { method: "DELETE" });
    if (res.ok) onDelete(invoice.id);
    else setDeleting(false);
  }

  const canSend = invoice.status === "DRAFT";
  const canResend = ["SENT", "VIEWED", "OVERDUE"].includes(invoice.status) && !invoice.paidAt;

  const lineItems = Array.isArray(invoice.lineItems)
    ? (invoice.lineItems as Array<Record<string, unknown>>).map((item) => ({
        description: String(item.description ?? ""),
        quantity: Number(item.quantity ?? 1),
        rate: Number(item.rate ?? item.unitPrice ?? 0),
        total: Number(item.total ?? 0),
      }))
    : [];

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      {/* Summary row */}
      <div
        className="grid grid-cols-[auto_1fr_140px_110px_130px_40px] gap-4 px-5 py-4 items-center hover:bg-white/3 cursor-pointer transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        {/* Invoice # */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
        >
          <FileText size={16} className="text-accent" />
        </div>

        {/* Contact + number */}
        <div>
          <p className="text-sm font-semibold text-foreground">
            #{String(invoice.invoiceNumber).padStart(4, "0")} · {invoice.contact.name}
          </p>
          <p className="text-xs text-muted-foreground">{invoice.contact.email}</p>
        </div>

        {/* Due date */}
        <div>
          <p className="text-sm text-foreground">
            {new Date(invoice.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
          <p className="text-xs text-muted-foreground">Due date</p>
        </div>

        {/* Total */}
        <p className="text-sm font-bold text-foreground">${invoice.total.toFixed(2)}</p>

        {/* Status */}
        <div className="flex items-center gap-1.5">
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${effectiveCfg.color}`}
            style={{ backgroundColor: effectiveCfg.bg }}
          >
            <EffectiveStatusIcon size={11} />
            {effectiveCfg.label}
          </span>
        </div>

        {/* Expand toggle */}
        <div className="flex justify-center text-muted-foreground">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: "var(--border)", borderTopStyle: "dashed" }}>
          <div className="pt-4">
            {/* Line items table */}
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              <div
                className="grid grid-cols-[1fr_80px_100px_100px] gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b"
                style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.03)" }}
              >
                <span>Description</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Total</span>
              </div>
              {lineItems.map((item, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_80px_100px_100px] gap-3 px-4 py-2.5 text-sm border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span className="text-foreground">{item.description}</span>
                  <span className="text-muted-foreground text-right">{item.quantity}</span>
                  <span className="text-muted-foreground text-right">${(item.rate ?? 0).toFixed(2)}</span>
                  <span className="text-foreground font-semibold text-right">${(item.total ?? 0).toFixed(2)}</span>
                </div>
              ))}
              <div className="px-4 py-3 space-y-1 text-right" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                <p className="text-xs text-muted-foreground">Subtotal: <span className="text-foreground font-semibold">${invoice.subtotal.toFixed(2)}</span></p>
                {invoice.tax > 0 && (
                  <p className="text-xs text-muted-foreground">Tax ({invoice.taxRate}%): <span className="text-foreground font-semibold">${invoice.tax.toFixed(2)}</span></p>
                )}
                <p className="text-sm font-bold text-foreground">Total: ${invoice.total.toFixed(2)}</p>
              </div>
            </div>

            {invoice.notes && (
              <p className="mt-3 text-xs text-muted-foreground italic">Note: {invoice.notes}</p>
            )}
            {invoice.paidAt && (
              <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                <Check size={11} /> Paid on {new Date(invoice.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {invoice.paymentMethod && ` · ${invoice.paymentMethod}`}
              </p>
            )}

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2 items-center">
              {nextStatus && (
                <button
                  onClick={advance}
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {updating ? <Loader2 size={13} className="animate-spin" /> : <DollarSign size={13} />}
                  {NEXT_LABEL[invoice.status] ?? "Advance"}
                </button>
              )}
              {(canSend || canResend) && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSend(); }}
                  disabled={sending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border disabled:opacity-50"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  {sending ? <Loader2 size={13} className="animate-spin" /> : sentOk ? <Check size={13} className="text-emerald-400" /> : <Send size={13} />}
                  {sending ? "Sending…" : sentOk ? "Sent!" : canSend ? "Send Invoice" : "Resend"}
                </button>
              )}
              {invoice.status === "DRAFT" && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border disabled:opacity-50 text-red-400 hover:bg-red-400/10"
                    style={{ borderColor: "rgba(232,93,74,0.3)" }}
                  >
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Delete
                  </button>
                </>
              )}
              {sendError && <p className="text-xs text-destructive">{sendError}</p>}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <EditModal
          invoice={invoice}
          onClose={() => setEditing(false)}
          onSaved={(updated) => { setInvoice(updated); setEditing(false); }}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/studio/invoices").then((r) => r.json()),
      fetch("/api/studio/contacts").then((r) => r.json()),
    ]).then(([invData, conData]) => {
      setInvoices(invData.invoices ?? []);
      setContacts(conData.contacts ?? []);
      setLoading(false);
    });
  }, []);

  const handleCreated = useCallback((inv: Invoice) => {
    setInvoices((p) => [inv, ...p]);
    setShowCreate(false);
  }, []);

  const handleUpdate = useCallback((id: string, status: string) => {
    setInvoices((p) =>
      p.map((inv) =>
        inv.id === id
          ? {
              ...inv,
              status: status as Invoice["status"],
              paidAt: status === "PAID" ? new Date().toISOString() : inv.paidAt,
            }
          : inv
      )
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setInvoices((p) => p.filter((inv) => inv.id !== id));
  }, []);

  const totalDraft  = invoices.filter((i) => i.status === "DRAFT").reduce((s, i) => s + i.total, 0);
  const totalSent   = invoices.filter((i) => ["SENT", "VIEWED"].includes(i.status)).reduce((s, i) => s + i.total, 0);
  const totalPaid   = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and track client invoices</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={15} /> New Invoice
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Draft",    value: `$${totalDraft.toFixed(2)}`,  icon: FileText,     color: "text-muted-foreground" },
          { label: "Outstanding", value: `$${totalSent.toFixed(2)}`, icon: Clock,        color: "text-yellow-400" },
          { label: "Collected",   value: `$${totalPaid.toFixed(2)}`, icon: DollarSign,   color: "text-emerald-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} className={color} />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Invoice list */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="grid grid-cols-[auto_1fr_140px_110px_130px_40px] gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="w-9" />
          <span>Client</span>
          <span>Due Date</span>
          <span>Total</span>
          <span>Status</span>
          <span />
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <FileText size={36} className="mx-auto text-muted-foreground opacity-40" />
            <p className="text-sm font-semibold text-foreground">No invoices yet</p>
            <p className="text-xs text-muted-foreground">Create your first invoice to get paid.</p>
          </div>
        ) : (
          invoices.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))
        )}
      </div>

      {showCreate && contacts.length > 0 && (
        <CreateModal
          contacts={contacts}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {showCreate && contacts.length === 0 && !loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl border p-8 text-center space-y-3 max-w-sm" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold text-foreground">No contacts yet</p>
            <p className="text-xs text-muted-foreground">Add a contact before creating an invoice.</p>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm font-semibold border" style={{ borderColor: "var(--border)" }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
