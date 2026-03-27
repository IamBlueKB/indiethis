"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, AlertTriangle, Download, CreditCard, Send } from "lucide-react";

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
  studio: {
    name: string;
    email: string | null;
    phone: string | null;
    logo: string | null;
    cashAppHandle: string | null;
    zelleHandle: string | null;
    paypalHandle: string | null;
    venmoHandle: string | null;
    stripePaymentsEnabled: boolean;
  };
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
  const searchParams = useSearchParams();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  // If returning from Stripe success, show confirmed state
  const stripeSuccess = searchParams.get("paid") === "stripe";

  useEffect(() => {
    fetch(`/api/invoice/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || d.error) setError(d.error ?? "Failed to load invoice.");
        else setInvoice(d);
      })
      .catch(() => setError("Could not reach the server. Please check the link and try again."));
  }, [id]);

  async function handleStripeCheckout() {
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/invoice/${id}/stripe-checkout`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setPayError(data.error ?? "Could not start checkout. Please try again.");
      }
    } catch {
      setPayError("Network error. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  async function handleNotifyPayment(method: string) {
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/invoice/${id}/notify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      if (res.ok) {
        setNotified(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setPayError(data.error ?? "Could not send notification. Please try again.");
      }
    } catch {
      setPayError("Network error. Please try again.");
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
  const isPaid = invoice.status === "PAID" || stripeSuccess;

  // Build available payment handles
  const handles = [
    invoice.studio.cashAppHandle && { label: "Cash App", handle: invoice.studio.cashAppHandle, method: "Cash App" },
    invoice.studio.zelleHandle   && { label: "Zelle",    handle: invoice.studio.zelleHandle,   method: "Zelle" },
    invoice.studio.paypalHandle  && { label: "PayPal",   handle: invoice.studio.paypalHandle,  method: "PayPal" },
    invoice.studio.venmoHandle   && { label: "Venmo",    handle: invoice.studio.venmoHandle,   method: "Venmo" },
  ].filter(Boolean) as { label: string; handle: string; method: string }[];

  return (
    <div className="min-h-screen py-10 px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header card */}
        <div
          className="rounded-2xl border p-6"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="mb-6">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 w-full">
                Invoice from
              </p>
              <h1 className="text-2xl font-bold text-foreground">{invoice.studio.name}</h1>
              <p className="text-xs text-muted-foreground self-center">
                #{String(invoice.invoiceNumber).padStart(4, "0")}
              </p>
            </div>
            {invoice.studio.email && (
              <p className="text-sm text-muted-foreground mt-0.5">{invoice.studio.email}</p>
            )}
            <div className={`flex items-center gap-1.5 mt-2 ${status.color}`}>
              <StatusIcon size={14} />
              <span className="text-sm font-semibold">{status.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Bill To</p>
              <p className="text-foreground font-medium">{invoice.contact.name}</p>
              {invoice.contact.email && <p className="text-muted-foreground text-xs">{invoice.contact.email}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Due Date</p>
              <p className="text-foreground font-medium">{dueDate}</p>
              <p className="text-muted-foreground text-xs">Issued {issueDate}</p>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div
            className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3"
            style={{ gridTemplateColumns: "1fr auto auto", borderBottom: "1px solid var(--border)" }}
          >
            <span>Description</span>
            <span className="text-right pr-6">Qty</span>
            <span className="text-right">Amount</span>
          </div>
          {(invoice.lineItems as LineItem[]).map((item, i) => (
            <div
              key={i}
              className="grid px-6 py-4 text-sm"
              style={{
                gridTemplateColumns: "1fr auto auto",
                borderBottom: i < invoice.lineItems.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <span className="text-foreground">{item.description}</span>
              <span className="text-muted-foreground text-right pr-6">{item.quantity}</span>
              <span className="text-foreground font-medium text-right">${item.total.toFixed(2)}</span>
            </div>
          ))}
          <div className="px-6 py-4 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>${invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.taxRate > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax ({invoice.taxRate}%)</span>
                <span>${invoice.tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-foreground pt-1" style={{ borderTop: "1px solid var(--border)" }}>
              <span>Total</span>
              <span>${invoice.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div
            className="rounded-2xl border p-6"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Notes
            </p>
            <p className="leading-relaxed">{invoice.notes}</p>
          </div>
        )}

        {/* Payment section */}
        {!isPaid && !notified ? (
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

            {/* Stripe card payment */}
            {invoice.studio.stripePaymentsEnabled && (
              <button
                onClick={handleStripeCheckout}
                disabled={paying}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                <CreditCard size={16} />
                {paying && selectedMethod === null ? "Redirecting…" : `Pay $${invoice.total.toFixed(2)} with Card`}
              </button>
            )}

            {/* Manual payment handles */}
            {handles.length > 0 && (
              <div className="space-y-3">
                {invoice.studio.stripePaymentsEnabled && (
                  <p className="text-xs text-muted-foreground">Or pay via:</p>
                )}
                <div className="space-y-2">
                  {handles.map((h) => (
                    <button
                      key={h.method}
                      onClick={() => setSelectedMethod(selectedMethod === h.method ? null : h.method)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium border transition-colors"
                      style={{
                        borderColor: selectedMethod === h.method ? "#D4A843" : "var(--border)",
                        backgroundColor: selectedMethod === h.method ? "#D4A84318" : "transparent",
                        color: "var(--foreground)",
                      }}
                    >
                      <span>{h.label}</span>
                      <span className="text-muted-foreground font-mono text-xs">{h.handle}</span>
                    </button>
                  ))}
                </div>

                {selectedMethod && (
                  <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "rgba(212,168,67,0.08)", border: "1px solid rgba(212,168,67,0.25)" }}>
                    <p className="text-sm text-foreground">
                      Send <strong>${invoice.total.toFixed(2)}</strong> to{" "}
                      <strong>{handles.find(h => h.method === selectedMethod)?.handle}</strong> via {selectedMethod}, then tap below.
                    </p>
                    <button
                      onClick={() => handleNotifyPayment(selectedMethod)}
                      disabled={paying}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                    >
                      <Send size={15} />
                      {paying ? "Sending…" : `I've sent the payment`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!invoice.studio.stripePaymentsEnabled && handles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Contact {invoice.studio.name} directly to arrange payment.
              </p>
            )}

            {payError && (
              <div className="rounded-xl p-3 flex items-start gap-2 text-sm text-red-400" style={{ backgroundColor: "rgba(232,93,74,0.1)", border: "1px solid rgba(232,93,74,0.3)" }}>
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                {payError}
              </div>
            )}
          </div>
        ) : notified ? (
          <div className="rounded-2xl border p-6 flex items-center gap-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
            <div>
              <p className="text-foreground font-semibold">Payment Notification Sent</p>
              <p className="text-sm text-muted-foreground">
                {invoice.studio.name} has been notified and will confirm your payment.
              </p>
            </div>
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
