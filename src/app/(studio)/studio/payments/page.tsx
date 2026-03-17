"use client";

import { useEffect, useState } from "react";
import {
  Plus, Send, Download, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Trash2, Eye,
} from "lucide-react";
import Link from "next/link";

type LineItem = { description: string; quantity: number; rate: number; total: number };

type Invoice = {
  id: string;
  invoiceNumber: number;
  status: string;
  total: number;
  dueDate: string;
  createdAt: string;
  contact: { name: string; email: string | null };
};

type Contact = { id: string; name: string; email: string | null };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT:   { label: "Draft",   color: "text-muted-foreground",  icon: Clock },
  SENT:    { label: "Sent",    color: "text-blue-400",          icon: Send },
  VIEWED:  { label: "Viewed",  color: "text-yellow-400",        icon: Eye },
  PAID:    { label: "Paid",    color: "text-emerald-400",       icon: CheckCircle2 },
  OVERDUE: { label: "Overdue", color: "text-red-400",           icon: AlertTriangle },
};

const EMPTY_LINE: LineItem = { description: "", quantity: 1, rate: 0, total: 0 };

export default function StudioPaymentsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [contactId, setContactId] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE }]);
  const [taxRate, setTaxRate] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Action states
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/studio/invoices").then((r) => r.json()),
      fetch("/api/studio/contacts").then((r) => r.json()),
    ]).then(([inv, con]) => {
      setInvoices(inv.invoices ?? []);
      setContacts(con.contacts ?? []);
      setLoading(false);
    });
  }, []);

  function updateLineItem(i: number, field: keyof LineItem, raw: string) {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[i] };
      if (field === "description") {
        item.description = raw;
      } else {
        const val = parseFloat(raw) || 0;
        (item as Record<string, unknown>)[field] = val;
        item.total = item.quantity * item.rate;
      }
      if (field === "quantity" || field === "rate") {
        item.total = item.quantity * item.rate;
      }
      updated[i] = item;
      return updated;
    });
  }

  const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  async function handleCreate() {
    if (!contactId || !lineItems.some((i) => i.description) || !dueDate) return;
    setCreating(true);
    try {
      const res = await fetch("/api/studio/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, lineItems, taxRate, dueDate, notes }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices((prev) => [data.invoice, ...prev]);
        setShowCreate(false);
        setLineItems([{ ...EMPTY_LINE }]);
        setContactId("");
        setDueDate("");
        setNotes("");
        setTaxRate(0);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleSend(invoiceId: string) {
    setSendingId(invoiceId);
    try {
      const res = await fetch(`/api/studio/invoices/${invoiceId}/send`, { method: "POST" });
      if (res.ok) {
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: "SENT" } : inv))
        );
      }
    } finally {
      setSendingId(null);
    }
  }

  async function handleDelete(invoiceId: string) {
    setDeletingId(invoiceId);
    try {
      const res = await fetch(`/api/studio/invoices/${invoiceId}`, { method: "DELETE" });
      if (res.ok) {
        setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
      }
    } finally {
      setDeletingId(null);
    }
  }

  const totals = {
    paid: invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0),
    outstanding: invoices
      .filter((i) => ["SENT", "VIEWED", "OVERDUE"].includes(i.status))
      .reduce((s, i) => s + i.total, 0),
    overdue: invoices.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + i.total, 0),
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Invoices and payment history</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          {showCreate ? <ChevronUp size={15} /> : <Plus size={15} />}
          {showCreate ? "Cancel" : "Create Invoice"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Collected", amount: totals.paid, color: "text-emerald-400" },
          { label: "Outstanding", amount: totals.outstanding, color: "text-blue-400" },
          { label: "Overdue", amount: totals.overdue, color: "text-red-400" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border p-4"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className={`text-xl font-bold ${card.color}`}>${card.amount.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Create invoice form */}
      {showCreate && (
        <div
          className="rounded-2xl border p-6 space-y-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <h2 className="text-base font-semibold text-foreground">New Invoice</h2>

          {/* Contact */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Client (Contact)
            </label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">Select a contact…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.email ? ` — ${c.email}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Line Items
            </label>
            <div className="grid grid-cols-[1fr_80px_90px_90px_32px] gap-2 text-xs text-muted-foreground px-1">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            {lineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_90px_90px_32px] gap-2 items-center">
                <input
                  value={item.description}
                  onChange={(e) => updateLineItem(i, "description", e.target.value)}
                  placeholder="e.g. Studio session (2 hrs)"
                  className="rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }}
                />
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(i, "quantity", e.target.value)}
                  className="rounded-lg border px-2 py-2 text-sm bg-transparent text-foreground text-right outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.rate}
                  onChange={(e) => updateLineItem(i, "rate", e.target.value)}
                  className="rounded-lg border px-2 py-2 text-sm bg-transparent text-foreground text-right outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }}
                />
                <div className="text-sm text-foreground text-right font-semibold">
                  ${item.total.toFixed(2)}
                </div>
                <button
                  onClick={() => setLineItems((prev) => prev.filter((_, j) => j !== i))}
                  disabled={lineItems.length === 1}
                  className="text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setLineItems((prev) => [...prev, { ...EMPTY_LINE }])}
              className="text-xs text-accent hover:underline"
            >
              + Add line item
            </button>
          </div>

          {/* Tax, Due date, Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tax Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Payment instructions, terms, thank-you note…"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Preview totals */}
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8 text-muted-foreground">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {tax > 0 && (
              <div className="flex gap-8 text-muted-foreground">
                <span>Tax ({taxRate}%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex gap-8 font-bold text-foreground text-base">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !contactId || !dueDate || !lineItems.some((i) => i.description)}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {creating ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      )}

      {/* Invoice list */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="grid grid-cols-[1fr_120px_100px_100px_auto] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <span>Client</span>
          <span>Invoice #</span>
          <span>Due</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : invoices.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No invoices yet. Create your first one above.
          </div>
        ) : (
          invoices.map((invoice) => {
            const cfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.DRAFT;
            const StatusIcon = cfg.icon;
            const due = new Date(invoice.dueDate).toLocaleDateString("en-US", {
              month: "short", day: "numeric",
            });

            return (
              <div
                key={invoice.id}
                className="grid grid-cols-[1fr_120px_100px_100px_auto] gap-4 px-5 py-4 items-center border-b last:border-b-0 hover:bg-white/3 transition-colors"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{invoice.contact.name}</p>
                  {invoice.contact.email && (
                    <p className="text-xs text-muted-foreground">{invoice.contact.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIcon size={12} className={cfg.color} />
                  <span className="text-sm text-foreground">
                    #{String(invoice.invoiceNumber).padStart(4, "0")}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">{due}</span>
                <span className="text-sm font-semibold text-foreground text-right">
                  ${invoice.total.toFixed(2)}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1.5 justify-end">
                  {/* Send — only DRAFT */}
                  {invoice.status === "DRAFT" && (
                    <button
                      onClick={() => handleSend(invoice.id)}
                      disabled={sendingId === invoice.id}
                      title="Send to client"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-colors disabled:opacity-50"
                    >
                      <Send size={14} />
                    </button>
                  )}
                  {/* Resend — SENT/VIEWED/OVERDUE */}
                  {["SENT", "VIEWED", "OVERDUE"].includes(invoice.status) && (
                    <button
                      onClick={() => handleSend(invoice.id)}
                      disabled={sendingId === invoice.id}
                      title="Resend invoice"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-colors disabled:opacity-50"
                    >
                      <Send size={14} />
                    </button>
                  )}
                  {/* PDF */}
                  <a
                    href={`/api/studio/invoices/${invoice.id}/pdf`}
                    title="Download PDF"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                  >
                    <Download size={14} />
                  </a>
                  {/* View public page */}
                  <Link
                    href={`/invoice/${invoice.id}`}
                    target="_blank"
                    title="View client page"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                  >
                    <Eye size={14} />
                  </Link>
                  {/* Delete — DRAFT only */}
                  {invoice.status === "DRAFT" && (
                    <button
                      onClick={() => handleDelete(invoice.id)}
                      disabled={deletingId === invoice.id}
                      title="Delete draft"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
