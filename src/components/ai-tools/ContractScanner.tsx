"use client";

import { useState, useEffect, useRef } from "react";
import {
  Shield, Upload, AlertTriangle, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, RefreshCw, FileText, ExternalLink,
} from "lucide-react";
import { PRICING_DEFAULTS } from "@/lib/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = "low" | "medium" | "high" | "critical";
type RiskLevel = "low" | "medium" | "high" | "critical";

interface RedFlag {
  title:          string;
  severity:       Severity;
  clause:         string;
  explanation:    string;
  recommendation: string;
}

interface ScanResult {
  summary:          string;
  riskLevel:        RiskLevel;
  redFlags:         RedFlag[];
  positives:        string[];
  negotiationTips:  string[];
  disclaimer:       string;
}

interface UsageInfo {
  usedToday:      number;
  dailyFreeLimit: number;
  remainingFree:  number;
  hasActiveSub:   boolean;
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<Severity, { bg: string; text: string; border: string }> = {
  critical: { bg: "rgba(232,93,74,0.12)",  text: "#E85D4A", border: "rgba(232,93,74,0.3)"  },
  high:     { bg: "rgba(255,149,0,0.12)",  text: "#FF9500", border: "rgba(255,149,0,0.3)"  },
  medium:   { bg: "rgba(212,168,67,0.12)", text: "#D4A843", border: "rgba(212,168,67,0.3)" },
  low:      { bg: "rgba(255,255,255,0.06)",text: "#888",    border: "rgba(255,255,255,0.1)" },
};

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: "#E85D4A",
  high:     "#FF9500",
  medium:   "#D4A843",
  low:      "#34C759",
};

// ─── RedFlag Card ─────────────────────────────────────────────────────────────

function RedFlagCard({ flag }: { flag: RedFlag }) {
  const [expanded, setExpanded] = useState(false);
  const colors = SEVERITY_COLORS[flag.severity] ?? SEVERITY_COLORS.medium;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: colors.border, background: colors.bg }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle size={14} style={{ color: colors.text, flexShrink: 0 }} />
          <span className="text-sm font-semibold truncate" style={{ color: "#fff" }}>
            {flag.title}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: colors.border, color: colors.text }}
          >
            {flag.severity}
          </span>
          {expanded ? <ChevronUp size={14} style={{ color: "#666" }} /> : <ChevronDown size={14} style={{ color: "#666" }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: colors.border }}>
          {/* Clause */}
          <div className="mt-3">
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "#666" }}>Clause</p>
            <p className="text-xs leading-relaxed italic" style={{ color: "#aaa" }}>
              &ldquo;{flag.clause}&rdquo;
            </p>
          </div>

          {/* Explanation */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "#666" }}>Why It&apos;s a Problem</p>
            <p className="text-xs leading-relaxed" style={{ color: "#ccc" }}>{flag.explanation}</p>
          </div>

          {/* Recommendation */}
          <div
            className="rounded-lg p-3"
            style={{ background: "rgba(52,199,89,0.08)", border: "1px solid rgba(52,199,89,0.2)" }}
          >
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "#34C759" }}>Recommendation</p>
            <p className="text-xs leading-relaxed" style={{ color: "#ccc" }}>{flag.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Results Panel ────────────────────────────────────────────────────────────

function ScanResults({ result, onReset }: { result: ScanResult; onReset: () => void }) {
  const [showPositives, setShowPositives] = useState(false);
  const [showTips,      setShowTips]      = useState(true);

  const riskColor = RISK_COLORS[result.riskLevel] ?? "#D4A843";

  return (
    <div className="space-y-5">
      {/* Risk level banner */}
      <div
        className="rounded-2xl p-5 flex items-start gap-4"
        style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${riskColor}30` }}
      >
        <Shield size={32} style={{ color: riskColor, flexShrink: 0 }} />
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <p className="font-bold text-lg text-foreground">Risk Level</p>
            <span
              className="text-sm font-bold uppercase px-3 py-1 rounded-full"
              style={{ background: `${riskColor}22`, color: riskColor }}
            >
              {result.riskLevel}
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "#aaa" }}>{result.summary}</p>
        </div>
      </div>

      {/* Red flags count */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">
          {result.redFlags.length} Red Flag{result.redFlags.length !== 1 ? "s" : ""} Found
        </p>
        <button onClick={onReset} className="flex items-center gap-1.5 text-xs" style={{ color: "#666" }}>
          <RefreshCw size={12} />
          Scan another
        </button>
      </div>

      {/* Red flags */}
      {result.redFlags.length > 0 ? (
        <div className="space-y-2">
          {result.redFlags.map((flag, i) => (
            <RedFlagCard key={i} flag={flag} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: "rgba(52,199,89,0.08)", border: "1px solid rgba(52,199,89,0.2)" }}
        >
          <CheckCircle size={18} style={{ color: "#34C759" }} />
          <p className="text-sm" style={{ color: "#34C759" }}>No major red flags detected.</p>
        </div>
      )}

      {/* Positives */}
      {result.positives.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={() => setShowPositives(v => !v)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-2">
              <CheckCircle size={14} style={{ color: "#34C759" }} />
              <span className="text-sm font-semibold text-foreground">Favorable Terms ({result.positives.length})</span>
            </div>
            {showPositives ? <ChevronUp size={14} style={{ color: "#666" }} /> : <ChevronDown size={14} style={{ color: "#666" }} />}
          </button>
          {showPositives && (
            <ul
              className="px-4 pb-4 space-y-2 border-t"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              {result.positives.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-xs mt-3" style={{ color: "#aaa" }}>
                  <span style={{ color: "#34C759", marginTop: 2 }}>✓</span>
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Negotiation tips */}
      {result.negotiationTips.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={() => setShowTips(v => !v)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-2">
              <FileText size={14} style={{ color: "#D4A843" }} />
              <span className="text-sm font-semibold text-foreground">Negotiation Tips</span>
            </div>
            {showTips ? <ChevronUp size={14} style={{ color: "#666" }} /> : <ChevronDown size={14} style={{ color: "#666" }} />}
          </button>
          {showTips && (
            <ol
              className="px-4 pb-4 space-y-2 border-t"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              {result.negotiationTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs mt-3" style={{ color: "#aaa" }}>
                  <span className="font-bold shrink-0" style={{ color: "#D4A843" }}>{i + 1}.</span>
                  {tip}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[11px] leading-relaxed" style={{ color: "#555" }}>
        ⚠ {result.disclaimer}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContractScanner() {
  const [usage,         setUsage]         = useState<UsageInfo | null>(null);
  const [result,        setResult]        = useState<ScanResult | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [selectedFile,  setSelectedFile]  = useState<File | null>(null);
  const [contractType,  setContractType]  = useState("music contract");
  const [checkoutUrl,   setCheckoutUrl]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Price from defaults (loaded live on page — this is the static fallback)
  const priceDisplay = PRICING_DEFAULTS.AI_CONTRACT_SCANNER.display;

  useEffect(() => {
    // Load usage stats
    fetch("/api/ai-tools/contract-scanner")
      .then(r => r.json())
      .then(d => setUsage(d))
      .catch(() => {});

    // Check for post-payment redirect
    const params = new URLSearchParams(window.location.search);
    const paid       = params.get("paid");
    const sessionId  = params.get("session_id");
    const jobId      = params.get("jobId");

    if (paid === "1" && sessionId && jobId) {
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      // Resume job
      setLoading(true);
      fetch("/api/ai-tools/contract-scanner", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ stripeSessionId: sessionId, jobId }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.result) setResult(d.result as ScanResult);
          else setError(d.error ?? "Analysis failed after payment.");
        })
        .catch(() => setError("Network error resuming analysis."))
        .finally(() => setLoading(false));
    }
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please select a PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("PDF must be under 10 MB.");
      return;
    }
    setSelectedFile(file);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setCheckoutUrl(null);

    const form = new FormData();
    form.append("pdfFile", selectedFile);
    form.append("contractType", contractType);

    try {
      const res = await fetch("/api/ai-tools/contract-scanner", {
        method: "POST",
        body:   form,
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.requiresUpgrade) {
          setError("An active subscription is required to use the Contract Scanner.");
        } else {
          setError(data.error ?? "Something went wrong.");
        }
        return;
      }

      if (data.checkoutUrl) {
        // Needs payment — redirect
        setCheckoutUrl(data.checkoutUrl);
        return;
      }

      if (data.result) {
        setResult(data.result as ScanResult);
        // Refresh usage
        fetch("/api/ai-tools/contract-scanner")
          .then(r => r.json())
          .then(d => setUsage(d))
          .catch(() => {});
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setSelectedFile(null);
    setCheckoutUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const freeRemaining = usage?.remainingFree ?? 0;
  const hasActiveSub  = usage?.hasActiveSub ?? true;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Usage indicator */}
      {usage && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2">
            <Shield size={14} style={{ color: "#D4A843" }} />
            <span className="text-xs font-semibold text-foreground">Contract Scanner</span>
          </div>
          <div className="text-right">
            {freeRemaining > 0 ? (
              <span className="text-xs" style={{ color: "#34C759" }}>
                {freeRemaining} free scan{freeRemaining !== 1 ? "s" : ""} remaining today
              </span>
            ) : (
              <span className="text-xs" style={{ color: "#888" }}>
                Free scans used · {priceDisplay} per scan
              </span>
            )}
          </div>
        </div>
      )}

      {/* PPU checkout redirect prompt */}
      {checkoutUrl && (
        <div
          className="rounded-2xl p-5 space-y-3 border"
          style={{ background: "rgba(212,168,67,0.06)", borderColor: "rgba(212,168,67,0.2)" }}
        >
          <p className="text-sm font-bold text-foreground">Ready to scan — {priceDisplay}</p>
          <p className="text-xs" style={{ color: "#888" }}>
            You&apos;ve used your free scans for today. A one-time payment of {priceDisplay} will unlock this scan.
          </p>
          <a
            href={checkoutUrl}
            className="flex items-center gap-2 w-fit px-4 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: "#D4A843", color: "#0A0A0A" }}
          >
            <ExternalLink size={14} />
            Pay {priceDisplay} &amp; Scan
          </a>
          <button onClick={handleReset} className="text-xs" style={{ color: "#666" }}>Cancel</button>
        </div>
      )}

      {/* Results */}
      {result ? (
        <ScanResults result={result} onReset={handleReset} />
      ) : !checkoutUrl && (
        // Upload form
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contract type */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>
              Contract Type
            </label>
            <select
              value={contractType}
              onChange={e => setContractType(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border:     "1px solid rgba(255,255,255,0.08)",
                color:      "#fff",
              }}
            >
              <option value="music contract">Music Contract (General)</option>
              <option value="record deal">Record Deal / Label Agreement</option>
              <option value="music distribution agreement">Distribution Agreement</option>
              <option value="producer agreement">Producer Agreement</option>
              <option value="beat lease agreement">Beat Lease Agreement</option>
              <option value="sync licensing agreement">Sync Licensing Agreement</option>
              <option value="music publishing deal">Publishing Deal</option>
              <option value="management agreement">Management Agreement</option>
              <option value="booking agreement">Booking Agreement</option>
              <option value="collaboration agreement">Collaboration Agreement</option>
            </select>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>
              Contract PDF <span style={{ color: "#E85D4A" }}>*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors"
              style={{
                borderColor: selectedFile ? "#D4A843" : "rgba(255,255,255,0.12)",
                background:  selectedFile ? "rgba(212,168,67,0.04)" : "rgba(255,255,255,0.02)",
              }}
            >
              <Upload size={24} style={{ color: selectedFile ? "#D4A843" : "#555" }} />
              {selectedFile ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">{selectedFile.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                    {(selectedFile.size / 1024).toFixed(0)} KB · Click to change
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: "#888" }}>
                    Click to upload your contract PDF
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#555" }}>Max 10 MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 rounded-xl p-3 text-xs"
              style={{ background: "rgba(232,93,74,0.1)", color: "#E85D4A" }}
            >
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Not subscribed warning */}
          {usage && !hasActiveSub && (
            <div
              className="rounded-xl p-3 text-xs"
              style={{ background: "rgba(255,149,0,0.08)", color: "#FF9500", border: "1px solid rgba(255,149,0,0.2)" }}
            >
              Active subscription required to use the Contract Scanner.{" "}
              <a href="/pricing" className="underline font-semibold">Upgrade now</a>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !selectedFile || (usage !== null && !hasActiveSub)}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
            style={{
              background: (loading || !selectedFile) ? "rgba(212,168,67,0.3)" : "#D4A843",
              color:      (loading || !selectedFile) ? "rgba(10,10,10,0.5)" : "#0A0A0A",
              cursor:     (loading || !selectedFile) ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Analyzing contract...
              </>
            ) : (
              <>
                <Shield size={14} />
                {freeRemaining > 0
                  ? "Scan for Red Flags (Free)"
                  : `Scan for Red Flags (${priceDisplay})`}
              </>
            )}
          </button>

          <p className="text-[11px] text-center" style={{ color: "#555" }}>
            {freeRemaining > 0
              ? `${freeRemaining} free scan${freeRemaining !== 1 ? "s" : ""} remaining today`
              : `Pay-per-use · ${priceDisplay} · No subscription required`}
          </p>
        </form>
      )}
    </div>
  );
}
