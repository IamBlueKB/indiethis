"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import type { ChurnRisk } from "@/app/api/admin/churn/route";

const RISK_COLOR = { High: "#E85D4A", Medium: "#FF9F0A", Low: "#D4A843" };

function daysSince(d: string | null): string {
  if (!d) return "Never";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export default function ChurnTableClient({ risks: initial }: { risks: ChurnRisk[] }) {
  const [rows, setRows] = useState<ChurnRisk[]>(initial);
  const [rating, setRating] = useState<Record<string, boolean>>({});

  const rate = useCallback(async (logId: string, accuracy: boolean, userId: string) => {
    if (rating[logId] !== undefined) return; // already rating
    setRating((r) => ({ ...r, [logId]: accuracy }));

    // Optimistically update UI
    setRows((prev) =>
      prev.map((r) => r.id === userId ? { ...r, accuracy } : r)
    );

    try {
      await fetch(`/api/admin/ai-insights-log/${logId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accuracy }),
      });
    } catch {
      // Revert on failure
      setRows((prev) =>
        prev.map((r) => r.id === userId ? { ...r, accuracy: undefined } : r)
      );
      setRating((r) => {
        const next = { ...r };
        delete next[logId];
        return next;
      });
    }
  }, [rating]);

  if (rows.length === 0) return null;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="text-sm font-semibold text-foreground">At-Risk Users</p>
          <p className="text-[11px] text-muted-foreground">AI churn prediction · thumbs to rate accuracy</p>
        </div>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}
        >
          {rows.filter((r) => r.riskLevel === "High").length} high risk
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              {["User", "Plan", "Last Active", "Sessions", "Risk", "Reason", "Accurate?"].map((h) => (
                <th
                  key={h}
                  className="text-left px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((risk) => (
              <tr
                key={risk.id}
                className="border-b last:border-b-0 hover:bg-white/3 transition-colors"
                style={{ borderColor: "var(--border)" }}
              >
                {/* User */}
                <td className="px-5 py-3">
                  <Link href={`/admin/users/${risk.id}`} className="no-underline hover:underline">
                    <p className="font-medium text-foreground">{risk.name}</p>
                    <p className="text-xs text-muted-foreground">{risk.email}</p>
                  </Link>
                </td>

                {/* Plan */}
                <td className="px-5 py-3">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
                  >
                    {risk.tier}
                  </span>
                </td>

                {/* Last Active */}
                <td className="px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                  {daysSince(risk.lastLoginAt)}
                </td>

                {/* Sessions */}
                <td className="px-5 py-3 text-center text-muted-foreground text-sm">
                  {risk.sessionCount}
                </td>

                {/* Risk */}
                <td className="px-5 py-3">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: `${RISK_COLOR[risk.riskLevel]}18`,
                      color: RISK_COLOR[risk.riskLevel],
                    }}
                  >
                    {risk.riskLevel}
                  </span>
                </td>

                {/* Reason */}
                <td className="px-5 py-3 text-xs text-muted-foreground max-w-xs">
                  {risk.reasoning}
                </td>

                {/* Accuracy thumbs */}
                <td className="px-5 py-3">
                  {risk.accuracy !== undefined ? (
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: risk.accuracy ? "rgba(52,199,89,0.12)" : "rgba(232,93,74,0.12)",
                        color: risk.accuracy ? "#34C759" : "#E85D4A",
                      }}
                    >
                      {risk.accuracy ? "✓ Accurate" : "✗ Wrong"}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => rate(risk.logId, true, risk.id)}
                        disabled={rating[risk.logId] !== undefined}
                        className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-green-400 transition-colors disabled:opacity-50"
                        title="Prediction was accurate"
                      >
                        {rating[risk.logId] === true
                          ? <Loader2 size={13} className="animate-spin" />
                          : <ThumbsUp size={13} />
                        }
                      </button>
                      <button
                        onClick={() => rate(risk.logId, false, risk.id)}
                        disabled={rating[risk.logId] !== undefined}
                        className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Prediction was wrong"
                      >
                        {rating[risk.logId] === false
                          ? <Loader2 size={13} className="animate-spin" />
                          : <ThumbsDown size={13} />
                        }
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
