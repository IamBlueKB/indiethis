"use client";

import { useState } from "react";
import {
  Plus, Trash2, Download, CheckCircle, AlertCircle, RefreshCw,
  FileText, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contributor {
  name:              string;
  role:              string;
  publishingPercent: number | "";
  masterPercent:     number | "";
  pro:               string;
  ipi:               string;
  email:             string;
}

const ROLES = ["Writer", "Producer", "Featured Artist", "Engineer", "Mixer", "Other"];
const PROS  = ["ASCAP", "BMI", "SESAC", "SOCAN", "PRS", "N/A"];

function emptyContributor(): Contributor {
  return { name: "", role: "Writer", publishingPercent: "", masterPercent: "", pro: "N/A", ipi: "", email: "" };
}

// ─── Percentage Gauge ─────────────────────────────────────────────────────────

function PctGauge({ label, total }: { label: string; total: number }) {
  const pct   = Math.min(total, 100);
  const over  = total > 100;
  const done  = Math.abs(total - 100) < 0.01;
  const color = done ? "#34C759" : over ? "#E85D4A" : "#D4A843";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold whitespace-nowrap" style={{ color }}>
        {label}: {total.toFixed(0)}% / 100%
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Result {
  fileUrl:  string;
  fileName: string;
  vaultId:  string;
}

export default function SplitSheetGenerator() {
  // Track info
  const [trackTitle,    setTrackTitle]    = useState("");
  const [recordingDate, setRecordingDate] = useState("");
  const [sampleUsed,    setSampleUsed]    = useState(false);
  const [sampleDetails, setSampleDetails] = useState("");
  const [notes,         setNotes]         = useState("");
  const [showNotes,     setShowNotes]     = useState(false);

  // Contributors
  const [contributors, setContributors] = useState<Contributor[]>([
    emptyContributor(),
    emptyContributor(),
  ]);

  // State
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<Result | null>(null);

  // Totals
  const pubTotal    = contributors.reduce((s, c) => s + (Number(c.publishingPercent) || 0), 0);
  const masterTotal = contributors.reduce((s, c) => s + (Number(c.masterPercent)    || 0), 0);

  function updateContributor(i: number, field: keyof Contributor, value: string | number) {
    setContributors(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }

  function addContributor() {
    if (contributors.length >= 10) return;
    setContributors(prev => [...prev, emptyContributor()]);
  }

  function removeContributor(i: number) {
    if (contributors.length <= 2) return;
    setContributors(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-tools/split-sheet", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackTitle,
          recordingDate,
          contributors: contributors.map(c => ({
            ...c,
            publishingPercent: Number(c.publishingPercent) || 0,
            masterPercent:     Number(c.masterPercent)     || 0,
          })),
          sampleUsed,
          sampleDetails,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Generation failed."); return; }
      setResult(data as Result);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setTrackTitle("");
    setRecordingDate("");
    setContributors([emptyContributor(), emptyContributor()]);
    setSampleUsed(false);
    setSampleDetails("");
    setNotes("");
  }

  // ── Result view ──────────────────────────────────────────────────────────

  if (result) {
    return (
      <div className="space-y-5 max-w-2xl">
        <div
          className="rounded-2xl border p-6 space-y-4"
          style={{ borderColor: "rgba(52,199,89,0.3)", background: "rgba(52,199,89,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <CheckCircle size={22} style={{ color: "#34C759" }} />
            <div>
              <p className="text-base font-bold text-foreground">Split Sheet Generated</p>
              <p className="text-xs mt-0.5" style={{ color: "#888" }}>{result.fileName}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Download */}
            <a
              href={result.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: "#E85D4A", color: "#fff" }}
            >
              <Download size={14} />
              Download PDF
            </a>

            {/* View in Vault */}
            <a
              href="/dashboard/vault"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: "rgba(212,168,67,0.12)", color: "#D4A843" }}
            >
              <ExternalLink size={14} />
              View in Vault
            </a>
          </div>

          <div
            className="rounded-xl p-3 text-xs"
            style={{ background: "rgba(255,255,255,0.04)", color: "#888" }}
          >
            ✓ Saved to your License Vault automatically. You can find it under License Vault in your sidebar.
          </div>
        </div>

        {/* PDF preview embed */}
        <div
          className="rounded-xl overflow-hidden border"
          style={{ borderColor: "rgba(255,255,255,0.08)", height: 500 }}
        >
          <iframe
            src={`${result.fileUrl}#toolbar=0`}
            width="100%"
            height="100%"
            title="Split Sheet Preview"
            style={{ border: "none", background: "#fff" }}
          />
        </div>

        <button onClick={handleReset} className="text-xs" style={{ color: "#666" }}>
          ← Generate another split sheet
        </button>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleGenerate} className="space-y-6 max-w-3xl">

      {/* Track Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>
            Track Title <span style={{ color: "#E85D4A" }}>*</span>
          </label>
          <input
            type="text"
            value={trackTitle}
            onChange={e => setTrackTitle(e.target.value)}
            placeholder="e.g. Midnight Vibes"
            required
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>Recording Date</label>
          <input
            type="date"
            value={recordingDate}
            onChange={e => setRecordingDate(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
          />
        </div>
      </div>

      {/* Percentage gauges */}
      <div className="space-y-2">
        <PctGauge label="Publishing" total={pubTotal} />
        <PctGauge label="Master"     total={masterTotal} />
      </div>

      {/* Contributors */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: "#555" }}>
            Contributors ({contributors.length}/10)
          </p>
          {contributors.length < 10 && (
            <button type="button" onClick={addContributor}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
              <Plus size={12} /> Add Contributor
            </button>
          )}
        </div>

        {contributors.map((c, i) => (
          <div
            key={i}
            className="rounded-xl border p-4 space-y-3"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold" style={{ color: "#D4A843" }}>Contributor {i + 1}</p>
              {contributors.length > 2 && (
                <button type="button" onClick={() => removeContributor(i)}>
                  <Trash2 size={13} style={{ color: "#E85D4A" }} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "#666" }}>Full Name *</label>
                <input
                  value={c.name}
                  onChange={e => updateContributor(i, "name", e.target.value)}
                  placeholder="e.g. Jay Nova"
                  required
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "#666" }}>Role *</label>
                <select
                  value={c.role}
                  onChange={e => updateContributor(i, "role", e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Publishing % */}
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "#666" }}>Publishing %</label>
                <input
                  type="number"
                  min="0" max="100" step="0.1"
                  value={c.publishingPercent}
                  onChange={e => updateContributor(i, "publishingPercent", e.target.value === "" ? "" : parseFloat(e.target.value))}
                  placeholder="0"
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                />
              </div>

              {/* Master % */}
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "#666" }}>Master %</label>
                <input
                  type="number"
                  min="0" max="100" step="0.1"
                  value={c.masterPercent}
                  onChange={e => updateContributor(i, "masterPercent", e.target.value === "" ? "" : parseFloat(e.target.value))}
                  placeholder="0"
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                />
              </div>

              {/* PRO */}
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "#666" }}>PRO</label>
                <select
                  value={c.pro}
                  onChange={e => updateContributor(i, "pro", e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                >
                  {PROS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* IPI */}
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: "#666" }}>IPI/CAE Number</label>
                <input
                  value={c.ipi}
                  onChange={e => updateContributor(i, "ipi", e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: "#666" }}>Email *</label>
              <input
                type="email"
                value={c.email}
                onChange={e => updateContributor(i, "email", e.target.value)}
                placeholder="contributor@email.com"
                required
                className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Sample Declaration */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => setSampleUsed(v => !v)}
            className="w-10 h-6 rounded-full relative transition-all"
            style={{ background: sampleUsed ? "#D4A843" : "rgba(255,255,255,0.12)" }}
          >
            <span
              className="absolute top-1 w-4 h-4 rounded-full transition-all"
              style={{ background: "#fff", left: sampleUsed ? "calc(100% - 18px)" : "2px" }}
            />
          </button>
          <label className="text-xs font-semibold" style={{ color: "#888" }}>
            This recording contains samples
          </label>
        </div>

        {sampleUsed && (
          <textarea
            value={sampleDetails}
            onChange={e => setSampleDetails(e.target.value)}
            placeholder="Describe the samples used (e.g. Drake - God's Plan interpolation, Splice loop pack #XYZ)"
            rows={2}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(212,168,67,0.3)", color: "#fff" }}
          />
        )}
      </div>

      {/* Notes (collapsible) */}
      <div>
        <button
          type="button"
          onClick={() => setShowNotes(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: "#666" }}
        >
          {showNotes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showNotes ? "Hide" : "Add"} additional terms / notes (optional)
        </button>
        {showNotes && (
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional terms, conditions, or notes to include in the agreement..."
            rows={3}
            className="w-full mt-3 rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl p-3 text-xs"
          style={{ background: "rgba(232,93,74,0.1)", color: "#E85D4A" }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !trackTitle.trim() || Math.abs(pubTotal - 100) > 0.01 || Math.abs(masterTotal - 100) > 0.01}
        className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
        style={{
          background: (loading || !trackTitle.trim() || Math.abs(pubTotal - 100) > 0.01 || Math.abs(masterTotal - 100) > 0.01)
            ? "rgba(212,168,67,0.3)" : "#D4A843",
          color: (loading || !trackTitle.trim()) ? "rgba(10,10,10,0.5)" : "#0A0A0A",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? (
          <><RefreshCw size={14} className="animate-spin" /> Generating PDF...</>
        ) : (
          <><FileText size={14} /> Generate Split Sheet PDF</>
        )}
      </button>

      {(Math.abs(pubTotal - 100) > 0.01 || Math.abs(masterTotal - 100) > 0.01) && trackTitle && (
        <p className="text-xs text-center" style={{ color: "#E85D4A" }}>
          Percentages must total 100% before you can generate
        </p>
      )}
    </form>
  );
}
