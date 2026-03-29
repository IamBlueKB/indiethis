"use client";

import { useState, useEffect } from "react";
import { Sparkles, Copy, Check, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BioResult {
  short:  string;
  medium: string;
  full:   string;
}

interface UsageInfo {
  usedToday:      number;
  dailyLimit:     number;
  remainingToday: number;
}

type BioTab = "short" | "medium" | "full";

const TAB_LABELS: Record<BioTab, string> = {
  short:  "Short Bio",
  medium: "Medium Bio",
  full:   "Full Bio",
};

const TAB_HINTS: Record<BioTab, string> = {
  short:  "50–80 words · Social media profiles",
  medium: "120–200 words · Streaming platforms & press",
  full:   "300–500 words · EPK & website About page",
};

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
      style={{
        background: copied ? "rgba(52,199,89,0.12)" : "rgba(255,255,255,0.06)",
        color:      copied ? "#34C759" : "#888",
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Results Panel ───────────────────────────────────────────────────────────

function BioResults({ bios, onReset }: { bios: BioResult; onReset: () => void }) {
  const [activeTab, setActiveTab] = useState<BioTab>("medium");

  const currentText = bios[activeTab];

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
        {(Object.keys(TAB_LABELS) as BioTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: activeTab === tab ? "#D4A843" : "transparent",
              color:      activeTab === tab ? "#0A0A0A" : "#888",
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Hint */}
      <p className="text-[11px]" style={{ color: "#666" }}>{TAB_HINTS[activeTab]}</p>

      {/* Bio text */}
      <div
        className="rounded-xl p-4 text-sm leading-relaxed"
        style={{ background: "rgba(255,255,255,0.04)", color: "#E0E0E0", whiteSpace: "pre-wrap" }}
      >
        {currentText}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <CopyButton text={currentText} />
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: "#666" }}
        >
          <RefreshCw size={13} />
          Generate another
        </button>
      </div>

      {/* Copy all */}
      <div
        className="rounded-xl p-3 border"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        <p className="text-[11px] font-semibold mb-2" style={{ color: "#666" }}>Copy all three versions</p>
        <div className="flex gap-2">
          {(Object.keys(TAB_LABELS) as BioTab[]).map(tab => (
            <CopyButton key={tab} text={bios[tab]} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BioGeneratorProps {
  isStudio?: boolean;
}

export default function BioGenerator({ isStudio = false }: BioGeneratorProps) {
  const [usage,    setUsage]    = useState<UsageInfo | null>(null);
  const [result,   setResult]   = useState<BioResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showExtra, setShowExtra] = useState(false);

  // Form fields
  const [name,         setName]         = useState("");
  const [genre,        setGenre]        = useState("");
  const [vibe,         setVibe]         = useState("");
  const [location,     setLocation]     = useState("");
  const [influences,   setInfluences]   = useState("");
  const [achievements, setAchievements] = useState("");
  const [extra,        setExtra]        = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [studioServices, setStudioServices] = useState("");

  useEffect(() => {
    fetch("/api/ai-tools/bio-generator")
      .then(r => r.json())
      .then(d => setUsage(d))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai-tools/bio-generator", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name, genre, vibe, location, influences, achievements, extra,
          ...(isStudio ? { studioServices } : { targetAudience }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setResult(data.bios);
      setUsage(prev => prev ? {
        ...prev,
        usedToday:      data.usedToday,
        remainingToday: data.remainingToday,
      } : null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
  }

  const remaining = usage?.remainingToday ?? 5;
  const limitReached = remaining <= 0;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Usage indicator */}
      {usage && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.15)" }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: "#D4A843" }} />
            <span className="text-xs font-semibold" style={{ color: "#D4A843" }}>Free Tool</span>
          </div>
          <span className="text-xs" style={{ color: "#888" }}>
            {remaining} / {usage.dailyLimit} generations remaining today
          </span>
        </div>
      )}

      {/* Results */}
      {result ? (
        <BioResults bios={result} onReset={handleReset} />
      ) : (
        // Form
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>
              {isStudio ? "Studio Name" : "Artist / Stage Name"} <span style={{ color: "#E85D4A" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isStudio ? "e.g. Studio 12" : "e.g. Lil Waves"}
              required
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
              style={{
                background:   "rgba(255,255,255,0.05)",
                border:       "1px solid rgba(255,255,255,0.08)",
                color:        "#fff",
              }}
            />
          </div>

          {/* Genre / Style */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>
              {isStudio ? "Specialization / Genre Focus" : "Genre / Style"}
            </label>
            <input
              type="text"
              value={genre}
              onChange={e => setGenre(e.target.value)}
              placeholder={isStudio ? "e.g. Hip-Hop, R&B, Trap" : "e.g. Melodic Drill, Afrobeats"}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border:     "1px solid rgba(255,255,255,0.08)",
                color:      "#fff",
              }}
            />
          </div>

          {/* Vibe */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>
              {isStudio ? "Studio Atmosphere / Vibe" : "Sound / Vibe"}
            </label>
            <input
              type="text"
              value={vibe}
              onChange={e => setVibe(e.target.value)}
              placeholder={isStudio ? "e.g. professional, intimate, high-energy" : "e.g. dark, melodic, introspective"}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border:     "1px solid rgba(255,255,255,0.08)",
                color:      "#fff",
              }}
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Atlanta, GA"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border:     "1px solid rgba(255,255,255,0.08)",
                color:      "#fff",
              }}
            />
          </div>

          {/* Extra fields toggle */}
          <button
            type="button"
            onClick={() => setShowExtra(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: "#666" }}
          >
            {showExtra ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showExtra ? "Hide" : "Add"} more details (optional)
          </button>

          {showExtra && (
            <div className="space-y-4 pt-1">
              {/* Influences */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>
                  {isStudio ? "Notable Clients / Artists" : "Influences / Inspired By"}
                </label>
                <input
                  type="text"
                  value={influences}
                  onChange={e => setInfluences(e.target.value)}
                  placeholder={isStudio ? "e.g. Worked with Lil Baby, Gunna" : "e.g. Lil Baby, Rod Wave, NBA YoungBoy"}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border:     "1px solid rgba(255,255,255,0.08)",
                    color:      "#fff",
                  }}
                />
              </div>

              {/* Achievements */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>
                  Achievements / Highlights
                </label>
                <textarea
                  value={achievements}
                  onChange={e => setAchievements(e.target.value)}
                  placeholder="e.g. 500k streams on debut EP, opened for [Artist], Billboard placement"
                  rows={2}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border:     "1px solid rgba(255,255,255,0.08)",
                    color:      "#fff",
                  }}
                />
              </div>

              {/* Studio-only: services */}
              {isStudio && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>
                    Services Offered
                  </label>
                  <input
                    type="text"
                    value={studioServices}
                    onChange={e => setStudioServices(e.target.value)}
                    placeholder="e.g. Recording, Mixing, Mastering, Beat Production"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border:     "1px solid rgba(255,255,255,0.08)",
                      color:      "#fff",
                    }}
                  />
                </div>
              )}

              {/* Artist-only: target audience */}
              {!isStudio && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>
                    Target Audience
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={e => setTargetAudience(e.target.value)}
                    placeholder="e.g. young adults, hip-hop heads, club crowd"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border:     "1px solid rgba(255,255,255,0.08)",
                      color:      "#fff",
                    }}
                  />
                </div>
              )}

              {/* Extra */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#888" }}>
                  Anything Else?
                </label>
                <textarea
                  value={extra}
                  onChange={e => setExtra(e.target.value)}
                  placeholder="Any other context you want included in your bio..."
                  rows={2}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border:     "1px solid rgba(255,255,255,0.08)",
                    color:      "#fff",
                  }}
                />
              </div>
            </div>
          )}

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

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !name.trim() || limitReached}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
            style={{
              background:  (loading || limitReached) ? "rgba(212,168,67,0.3)" : "#D4A843",
              color:       (loading || limitReached) ? "rgba(10,10,10,0.5)" : "#0A0A0A",
              cursor:      (loading || limitReached) ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Generating your bio...
              </>
            ) : limitReached ? (
              "Daily limit reached — try again tomorrow"
            ) : (
              <>
                <Sparkles size={14} />
                Generate Bio
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
