"use client";

/**
 * MasteringCrossSell — final card on the Mix Results page.
 *
 * Goal: convert a finished mix into a paid mastering job. The hook differs
 * by data:
 *   • If we have the mix's measured LUFS, lead with the loudness gap. A mix
 *     sitting at −17 LUFS reads quiet on Spotify next to mastered tracks at
 *     −14, and the most persuasive sentence we can write is "we measured
 *     your mix at −17 LUFS; mastering brings it to −14." This tells the
 *     artist *why* mastering matters, in their own data.
 *   • Otherwise fall back to the generic deliverables hook (4 versions,
 *     streaming/video/vinyl).
 *
 * Visual treatment:
 *   Coral accent (matches the "primary action" color from the Mix wizard)
 *   with a subtle inner gradient so it stands apart from the gold-themed
 *   AI-decision cards above it. Sparkles icon to differentiate from
 *   mix-related sections (which use Music / waveform iconography).
 *
 * Pricing copy is intentionally specific ("$7.99 · ~2 min") so the CTA
 * answers both questions an artist asks before clicking: how much, how
 * fast. Vague CTAs like "Master your track" lose to specific ones in
 * checkout funnels every time.
 */

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

const CORAL = "#E8735A";

export interface MasteringCrossSellProps {
  /** Measured output LUFS, if QA gate has run. Drives the data-led hook. */
  outputLufs?: number | null;
}

function buildHook(outputLufs: number | null | undefined): {
  headline: string;
  body:     string;
} {
  if (typeof outputLufs === "number" && outputLufs < -15.5) {
    const gap = (-14 - outputLufs).toFixed(1);
    return {
      headline: "Master this mix",
      body:     `Your mix sits at ${outputLufs.toFixed(1)} LUFS — mastering brings it up ${gap} dB to streaming-ready loudness, with 4 release-ready versions.`,
    };
  }
  return {
    headline: "Master this mix",
    body:     "4 release-ready versions for streaming, video, and vinyl. Usually finishes in about 2 minutes.",
  };
}

export function MasteringCrossSell({ outputLufs }: MasteringCrossSellProps) {
  const { headline, body } = buildHook(outputLufs);

  return (
    <section
      aria-label="Master this mix — paid upgrade"
      className="rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 relative overflow-hidden"
      style={{
        // Soft coral gradient washes the upper-left so the card reads as
        // an offer, not just another data panel
        background:
          "linear-gradient(135deg, rgba(232,115,90,0.10) 0%, rgba(232,115,90,0.02) 50%, #1a1816 100%)",
        border: `1px solid ${CORAL}40`,
      }}
    >
      {/* Sparkles avatar */}
      <span
        aria-hidden="true"
        className="shrink-0 inline-flex items-center justify-center rounded-full"
        style={{
          width:           36,
          height:          36,
          backgroundColor: `${CORAL}1A`, // ~10% coral
          border:          `1px solid ${CORAL}55`,
        }}
      >
        <Sparkles size={16} style={{ color: CORAL }} />
      </span>

      {/* Hook copy */}
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 14, fontWeight: 600, color: "#eee" }}>
          {headline}
        </p>
        <p
          className="mt-0.5"
          style={{ fontSize: 12, color: "#999", lineHeight: 1.5 }}
        >
          {body}
        </p>
      </div>

      {/* CTA — price + button stacked on desktop, stacked on mobile too */}
      <div className="shrink-0 w-full sm:w-auto flex flex-col items-stretch sm:items-end gap-1">
        <Link
          href="/master"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl no-underline transition-all hover:opacity-90 hover:translate-x-px"
          style={{
            backgroundColor: CORAL,
            color:           "#fff",
            fontSize:        13,
            fontWeight:      700,
          }}
        >
          Continue to mastering
          <ArrowRight size={14} />
        </Link>
        <p
          className="text-center sm:text-right"
          style={{ fontSize: 11, color: "#888", letterSpacing: "0.3px" }}
        >
          $7.99 · ~2 min
        </p>
      </div>
    </section>
  );
}
