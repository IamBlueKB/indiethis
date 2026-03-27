"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock, AlertTriangle, Download, CreditCard } from "lucide-react";

type LineItem = { description: string; quantity: number; rate: number; total: number };

type InvoiceData = {
  id: string;
  invoiceNumber: number;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  dueDate: string;
  status: string;
  notes: string | null;
  createdAt: string;
  studio: { name: string; email: string | null; phone: string | null; logo: string | null };
  contact: { name: string; email: string | null; phone: string | null };
};

const STATUS_CONFIG = {
  DRAFT:   { icon: Clock,         color: "text-muted-foreground",  label: "Draft" },
  SENT:    { icon: Clock,         color: "text-blue-400",          label: "Payment Due" },
  VIEWED:  { icon: Clock,         color: "text-yellow-400",        label: "Viewed — Payment Due" },
  PAID:    { icon: CheckCircle2,  color: "text-emerald-400",       label: "Paid" },
  OVERDUE: { icon: AlertTriangle, color: "text-red-400",           label: "Overdue" },
};

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>("STRIPE");

  useEffect(() => {
    fetch(`/api/invoice/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setInvoice(d);
      })
      .catch(() => setError("Failed to load invoice."));
  }, [id]);

  async function handleMarkPaid(method: string) {
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/studio/invoices/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPaid(true);
        setInvoice((prev) => prev ? { ...prev, status: "PAID" } : prev);
      } else {
        setPayError(data.error ?? "Payment could not be processed. Please try again.");
      }
    } catch {
      setPayError("Network error. Please check your connection and try again.");
    } finally {
      setPaying(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <div className="text-center space-y-2">
          <AlertTriangle size={40} className="text-red-400 mx-auto" />
          <p className="text-foreground font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  const status = STATUS_CONFIG[invoice.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.SENT;
  const StatusIcon = status.icon;
  const dueDate = new Date(invoice.dueDate).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  const issueDate = new Date(invoice.createdAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  const isPaid = invoice.status === "PAID";
  const isOverdue = invoice.status === "OVERDUE";

  return (
    <div className="min-h-screen py-10 px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header card */}
        <div
          className="rounded-2xl border p-6"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Invoice from
              </p>
              <h1 className="text-2xl font-bold text-foreground">{invoice.studio.name}</h1>
              {invoice.studio.email && (
                <p className="text-sm text-muted-foreground">{invoice.studio.email}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">
                #{String(invoice.invoiceNumber).padStart(4, "0")}
              </p>
              <div className={`flex items-center gap-1.5 justify-end mt-1 ${status.color}`}>
                <StatusIcon size={14} />
                <span className="text-sm font-semibold">{status.label}</span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Issued</p>
              <p className="text-foreground">{issueDate}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Due Date</p>
              <p className={`font-semibold ${isOverdue ? "text-red-400" : "text-foreground"}`}>
                {dueDate}
              </p>
            </div>
          </div>

          {/* Billed to */}
          <div className="text-sm">
            <p className="text-xs text-muted-foreground mb-0.5">Billed To</p>
            <p className="text-foreground font-semibold">{invoice.contact.name}</p>
            {invoice.contact.email && (
              <p className="text-muted-foreground">{invoice.contact.email}</p>
            )}
          </div>
        </div>

        {/* Line items */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div
            className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Total</span>
          </div>

          {(Array.isArray(invoice.lineItems) ? invoice.lineItems : []).map((item, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-5 py-3.5 text-sm border-b last:border-b-0"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-foreground">{item.description}</span>
              <span className="text-right text-muted-foreground">{item.quantity}</span>
              <span className="text-right text-muted-foreground">${(item.rate ?? 0).toFixed(2)}</span>
              <span className="text-right text-foreground font-semibold">${(item.total ?? 0).toFixed(2)}</span>
            </div>
          ))}

          <div className="px-5 py-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>${invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.tax > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax ({invoice.taxRate}%)</span>
                <span>${invoice.tax.toFixed(2)}</span>
              </div>
            )}
            <div
              className="flex justify-between text-base font-bold text-foreground pt-2 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              <span>Total Due</span>
              <span>${invoice.total.toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div
            className="rounded-2xl border p-5 text-sm text-muted-foreground"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Notes
            </p>
            <p className="leading-relaxed">{invoice.notes}</p>
          </div>
        )}

        {/* Payment section */}
        {!isPaid ? (
          <div
            className="rounded-2xl border p-6 space-y-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Pay this invoice</p>
              <p className="text-xs text-muted-foreground">
                Select your preferred payment method below.
              </p>
            </div>

            {/* Stripe CTA */}
            <button
              onClick={() => handleMarkPaid("STRIPE")}
              disabled={paying}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              <CreditCard size={16} />
              {paying ? "Processing…" : `Pay $${invoice.total.toFixed(2)} with Card`}
            </button>

            {/* Alternative methods */}
            <div>
              <p className="text-xs text-muted-foreground mb-3">Or pay via:</p>
              <div className="grid grid-cols-3 gap-2">
                {(["ZELLE", "CASHAPP", "PAYPAL"] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => handleMarkPaid(method)}
                    disabled={paying}
                    className="py-2.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-white/5 disabled:opacity-50 text-foreground"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {method}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                After sending payment via one of the above, click the button to notify{" "}
                {invoice.studio.name} and mark the invoice as paid.
              </p>
            </div>

            {payError && (
              <div className="rounded-xl p-3 flex items-start gap-2 text-sm text-red-400" style={{ backgroundColor: "rgba(232,93,74,0.1)", border: "1px solid rgba(232,93,74,0.3)" }}>
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                {payError}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border p-6 flex items-center gap-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
            <div>
              <p className="text-foreground font-semibold">Payment Confirmed</p>
              <p className="text-sm text-muted-foreground">
                Thank you! {invoice.studio.name} has been notified.
              </p>
            </div>
          </div>
        )}

        {/* Download PDF */}
        <a
          href={`/api/studio/invoices/${invoice.id}/pdf`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5 text-muted-foreground"
          style={{ borderColor: "var(--border)" }}
        >
          <Download size={15} />
          Download Invoice PDF
        </a>

        <p className="text-center text-xs text-muted-foreground pb-6">
          Powered by{" "}
          <span className="font-semibold" style={{ color: "#D4A843" }}>
            IndieThis
          </span>
        </p>
      </div>
    </div>
  );
}
