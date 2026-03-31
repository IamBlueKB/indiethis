"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

export default function ConnectStripeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/dashboard/stripe-connect", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Could not start Stripe Connect setup. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        onClick={handleConnect}
        disabled={loading}
        className="inline-flex items-center gap-1.5 underline font-medium disabled:opacity-60"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
        {loading ? "Redirecting to Stripe…" : "Connect Stripe Account"}
      </button>
      {error && <span className="text-xs text-red-400 no-underline">{error}</span>}
    </span>
  );
}
