"use client";

/**
 * RevisionMarkers — Premium/Pro tap-to-mark revision flow.
 *
 * The artist taps the visualizer during playback (handled by the parent —
 * MixResultsClient passes our imperative `addMarker(timeSec)` to the
 * FrequencyVisualizer's onTap prop). Each tap creates a chip showing the
 * timestamp; the artist can attach a one-line note to each chip and/or
 * write overall freeform feedback. On submit we serialize everything to
 * a single `feedback` string and POST to the existing /revise route,
 * which already handles quotas + Claude param adjustment + re-firing the
 * engine.
 *
 * Why imperative ref instead of controlled state in the parent: the parent
 * already juggles selectedVersion, abMode, audio controller, srcLoading,
 * and volume-matching effects. Owning marker state inside this card keeps
 * MixResultsClient lean and makes the contract explicit — the parent only
 * shovels timestamps in via ref.current.addMarker(t).
 *
 * Serialization format sent to /revise:
 *   "At 0:14 — too loud on the vocal\nAt 0:32 — more reverb\n\n{freeform}"
 * Empty notes still post the timestamp ("At 0:14") so Claude knows *where*
 * the artist felt something off even if they couldn't articulate it.
 *
 * After successful submit:
 *   • Markers + freeform clear
 *   • Card collapses to "Revision in progress…"
 *   • The parent page should refresh shortly (status moves COMPLETE →
 *     REVISING → COMPLETE on its own poll cadence elsewhere).
 *
 * Tier gating is handled by the parent — we don't render at all unless
 * `revisionsRemaining > 0`. Standard tier never reaches this component.
 */

import {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
} from "react";
import { fmtTime } from "@/lib/mix-console/audio-utils";

const GOLD  = "#D4AF37";
const CORAL = "#E8735A";

interface Marker {
  /** Internal id; not sent to backend. */
  id:      number;
  /** Playback time in seconds when the artist tapped. */
  timeSec: number;
  /** Optional one-line note attached to this marker. */
  note:    string;
}

export interface RevisionMarkersHandle {
  /** Called by parent when the visualizer canvas is tapped during playback. */
  addMarker: (timeSec: number) => void;
}

export interface RevisionMarkersProps {
  jobId:                string;
  revisionsRemaining:   number;
  /** Optional MixAccessToken for guest-cookie-less revision. The /revise
   *  route doesn't currently accept token auth, so this is a placeholder
   *  for symmetry with other endpoints; for now subscriber-only flow. */
  accessToken?:         string;
  /** Called after a successful submit so the parent can refresh + show
   *  processing state. */
  onSubmitted?:         () => void;
}

export const RevisionMarkers = forwardRef<
  RevisionMarkersHandle,
  RevisionMarkersProps
>(function RevisionMarkers(
  { jobId, revisionsRemaining, onSubmitted },
  ref,
) {
  const [markers,  setMarkers]  = useState<Marker[]>([]);
  const [freeform, setFreeform] = useState("");
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [done,     setDone]     = useState(false);

  // Stable id counter — avoids Date.now() collisions on rapid taps
  const nextId = useCallback(() => Math.floor(Math.random() * 1e9), []);

  const addMarker = useCallback((timeSec: number) => {
    if (done || busy) return;
    setMarkers(curr => {
      // Dedupe within ±0.5s — accidental double-taps shouldn't pile up
      if (curr.some(m => Math.abs(m.timeSec - timeSec) < 0.5)) return curr;
      // Keep sorted ascending so the artist sees them in song order
      const next = [...curr, { id: nextId(), timeSec, note: "" }];
      next.sort((a, b) => a.timeSec - b.timeSec);
      // Cap at 8 markers — beyond that, freeform is more useful than chips
      return next.slice(0, 8);
    });
  }, [busy, done, nextId]);

  useImperativeHandle(ref, () => ({ addMarker }), [addMarker]);

  function updateNote(id: number, note: string) {
    setMarkers(curr => curr.map(m => (m.id === id ? { ...m, note } : m)));
  }

  function removeMarker(id: number) {
    setMarkers(curr => curr.filter(m => m.id !== id));
  }

  function buildFeedback(): string {
    const lines = markers.map(m => {
      const ts = fmtTime(m.timeSec);
      return m.note.trim()
        ? `At ${ts} — ${m.note.trim()}`
        : `At ${ts}`;
    });
    if (freeform.trim()) {
      lines.push("", freeform.trim());
    }
    return lines.join("\n");
  }

  const canSubmit =
    !busy && !done && (markers.length > 0 || freeform.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      const feedback = buildFeedback();
      if (feedback.length > 1000) {
        setErr("Feedback is too long — trim some markers or shorten notes.");
        return;
      }
      const res = await fetch(`/api/mix-console/job/${jobId}/revise`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ feedback }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body?.error ?? `Failed to submit (${res.status}).`);
        return;
      }
      setDone(true);
      setMarkers([]);
      setFreeform("");
      onSubmitted?.();
    } catch (e) {
      console.error("[RevisionMarkers] submit failed", e);
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section
        className="rounded-xl p-4 text-center"
        style={{ backgroundColor: "#1a1816", border: `1px solid ${GOLD}` }}
        aria-live="polite"
      >
        <p style={{ fontSize: 12, color: GOLD, fontWeight: 600 }}>
          Revision in progress
        </p>
        <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
          Claude is adjusting the mix based on your notes. We'll email you when
          it's ready.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Revision feedback"
      className="rounded-xl p-4"
      style={{ backgroundColor: "#1a1816", border: "1px solid #2A2824" }}
    >
      <header className="flex items-center justify-between mb-2">
        <p
          style={{
            fontSize:      10,
            color:         GOLD,
            letterSpacing: "0.5px",
            fontWeight:    600,
          }}
        >
          REVISION NOTES
        </p>
        <p style={{ fontSize: 12, color: "#888" }}>
          {revisionsRemaining} remaining
        </p>
      </header>

      <p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
        Tap the visualizer during playback to mark a moment, then add a quick
        note. You can also write overall feedback below.
      </p>

      {/* Marker chips */}
      {markers.length > 0 && (
        <ul className="space-y-2 mb-3" aria-label="Marked moments">
          {markers.map(m => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              style={{ backgroundColor: "#0F0E0C", border: "0.5px solid #2A2824" }}
            >
              <span
                className="shrink-0 px-2 py-0.5 rounded-full"
                style={{
                  fontSize:        11,
                  fontWeight:      600,
                  color:           GOLD,
                  border:          `1px solid ${GOLD}`,
                  backgroundColor: "rgba(212,175,55,0.06)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtTime(m.timeSec)}
              </span>
              <input
                type="text"
                value={m.note}
                onChange={e => updateNote(m.id, e.target.value)}
                placeholder="too loud, more reverb, harsh…"
                aria-label={`Note for marker at ${fmtTime(m.timeSec)}`}
                maxLength={120}
                className="flex-1 bg-transparent border-0 outline-none focus:outline-none"
                style={{ fontSize: 12, color: "#ddd" }}
              />
              <button
                type="button"
                onClick={() => removeMarker(m.id)}
                aria-label={`Remove marker at ${fmtTime(m.timeSec)}`}
                className="shrink-0 px-1.5 rounded hover:opacity-100 opacity-60 transition-opacity"
                style={{ fontSize: 14, color: "#888", lineHeight: 1 }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Freeform overall feedback */}
      <textarea
        value={freeform}
        onChange={e => setFreeform(e.target.value)}
        aria-label="Overall revision feedback"
        placeholder={
          markers.length > 0
            ? "Anything else? (optional)"
            : "Describe what you'd like changed — e.g. cleaner mids, more punch in the chorus."
        }
        maxLength={800}
        rows={3}
        className="w-full rounded-lg p-2.5 bg-transparent outline-none focus:outline-none resize-none"
        style={{
          fontSize:        12,
          color:           "#ddd",
          backgroundColor: "#0F0E0C",
          border:          "0.5px solid #2A2824",
          lineHeight:      1.5,
        }}
      />

      {err && (
        <p
          role="alert"
          className="mt-2"
          style={{ fontSize: 11, color: CORAL }}
        >
          {err}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full mt-3 py-2.5 rounded-xl font-bold transition-opacity"
        style={{
          backgroundColor: canSubmit ? GOLD : "#2A2824",
          color:           canSubmit ? "#0A0A0A" : "#666",
          fontSize:        13,
          opacity:         busy ? 0.7 : 1,
          cursor:          canSubmit ? "pointer" : "not-allowed",
        }}
      >
        {busy ? "Submitting…" : "Request revision"}
      </button>
    </section>
  );
});
