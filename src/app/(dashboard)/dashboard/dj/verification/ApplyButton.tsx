"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ApplyButton({
  allMet,
  isReapply,
}: {
  allMet: boolean;
  isReapply: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/dj/verification/apply", {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={handleApply}
        disabled={!allMet || loading}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        style={{
          backgroundColor: allMet ? "#D4A843" : "rgba(212,168,67,0.2)",
          color: allMet ? "#0A0A0A" : "#D4A843",
        }}
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {isReapply ? "Re-Apply for Verification" : "Apply for Verification"}
      </button>
      {!allMet && !loading && (
        <p className="text-xs text-muted-foreground mt-2">
          Complete all requirements below to apply.
        </p>
      )}
      {error && (
        <p className="text-xs mt-2" style={{ color: "#E85D4A" }}>
          {error}
        </p>
      )}
    </div>
  );
}
