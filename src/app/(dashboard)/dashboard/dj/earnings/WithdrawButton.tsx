"use client";

import { useState } from "react";
import { ArrowDownToLine, Loader2 } from "lucide-react";

type Props = {
  disabled: boolean;
  disabledReason?: string;
  balanceCents: number;
};

export default function WithdrawButton({ disabled, disabledReason, balanceCents }: Props) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleWithdraw() {
    if (disabled || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/dj/withdrawals", { method: "POST" });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Withdrawal failed. Please try again.");
      } else {
        setDone(true);
        // Reload page after short delay so balance updates
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
      >
        Withdrawal requested — pending review
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleWithdraw}
        disabled={disabled || loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        title={disabledReason}
      >
        {loading
          ? <Loader2 size={14} className="animate-spin" />
          : <ArrowDownToLine size={14} />
        }
        Request Withdrawal (${(balanceCents / 100).toFixed(2)})
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {disabled && disabledReason && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
    </div>
  );
}
