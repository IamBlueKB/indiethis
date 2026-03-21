"use client";

import { useState } from "react";
import { DollarSign, Save, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface PriceRow {
  id: string;
  key: string;
  label: string;
  value: number;
  display: string;
  category: string;
  sortOrder: number;
  updatedAt: string | Date;
  updatedBy: string | null;
}

interface Props {
  initialPricing: PriceRow[];
}

const CATEGORY_LABELS: Record<string, string> = {
  subscriptions:  "Subscription Plans",
  ai_tools:       "AI Tools — Pay Per Use",
  platform_cuts:  "Platform Revenue Cuts",
};

const CATEGORY_ORDER = ["subscriptions", "ai_tools", "platform_cuts"];

export default function PricingSettingsContent({ initialPricing }: Props) {
  const [pricing, setPricing] = useState<PriceRow[]>(initialPricing);
  const [edits, setEdits]     = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const grouped = CATEGORY_ORDER.reduce<Record<string, PriceRow[]>>((acc, cat) => {
    acc[cat] = pricing.filter((r) => r.category === cat);
    return acc;
  }, {});

  const isDirty = Object.keys(edits).length > 0;

  function handleChange(key: string, raw: string) {
    setEdits((prev) => ({ ...prev, [key]: raw }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const updates = Object.entries(edits)
      .map(([key, raw]) => {
        const num = parseFloat(raw);
        if (isNaN(num) || num < 0) return null;
        return { key, value: num };
      })
      .filter(Boolean) as Array<{ key: string; value: number }>;

    if (updates.length === 0) {
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/settings/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Save failed");
      }

      const { pricing: updated } = await res.json() as { pricing: PriceRow[] };

      // Merge updates back into state
      setPricing((prev) =>
        prev.map((r) => {
          const u = updated.find((u) => u.key === r.key);
          return u ?? r;
        })
      );
      setEdits({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function displayedValue(row: PriceRow): string {
    if (row.key in edits) return edits[row.key];
    return String(row.value);
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={20} className="text-accent" />
            <h1 className="text-xl font-bold text-foreground">Pricing Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            All platform prices are stored in the database. Changes take effect within 5 minutes — no redeploy needed.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          {saving ? (
            <><Loader2 size={14} className="animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle2 size={14} /> Saved!</>
          ) : (
            <><Save size={14} /> Save Changes</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 mb-6 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Cache note */}
      <div className="flex items-center gap-2 mb-6 p-3 rounded-xl bg-muted/30 border border-border text-muted-foreground text-xs">
        <RefreshCw size={12} />
        Prices are cached for 5 minutes. After saving, the site reflects changes automatically within 5 minutes.
      </div>

      {/* Categories */}
      <div className="space-y-8">
        {CATEGORY_ORDER.map((cat) => {
          const rows = grouped[cat] ?? [];
          if (rows.length === 0) return null;
          return (
            <div key={cat}>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border">
                {CATEGORY_LABELS[cat] ?? cat}
              </h2>
              <div className="space-y-2">
                {rows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border bg-card hover:border-accent/30 transition-colors"
                  >
                    {/* Label + key */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{row.label}</div>
                      <div className="text-xs text-muted-foreground font-mono">{row.key}</div>
                    </div>

                    {/* Current display */}
                    <div className="text-sm text-muted-foreground w-20 text-right">
                      {row.display}
                    </div>

                    {/* Edit field */}
                    <div className="flex items-center gap-1.5">
                      {!row.key.startsWith("CUT_") && (
                        <span className="text-sm text-muted-foreground">$</span>
                      )}
                      <input
                        type="number"
                        step={row.key.startsWith("CUT_") ? "1" : "0.01"}
                        min="0"
                        value={displayedValue(row)}
                        onChange={(e) => handleChange(row.key, e.target.value)}
                        className="w-24 px-2 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      {row.key.startsWith("CUT_") && (
                        <span className="text-sm text-muted-foreground">%</span>
                      )}
                      {row.key.includes("PLAN_") || row.key.includes("STUDIO_") ? (
                        <span className="text-xs text-muted-foreground">/mo</span>
                      ) : null}
                    </div>

                    {/* Dirty indicator */}
                    {row.key in edits && (
                      <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                    )}

                    {/* Last updated */}
                    {row.updatedBy && (
                      <div className="text-xs text-muted-foreground hidden lg:block w-32 text-right">
                        by {row.updatedBy}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom save bar */}
      {isDirty && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl disabled:opacity-50 transition-all"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "Saving…" : `Save ${Object.keys(edits).length} change${Object.keys(edits).length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
