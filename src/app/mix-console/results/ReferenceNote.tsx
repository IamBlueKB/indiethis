"use client";

/**
 * ReferenceNote — "REFERENCE APPLIED" card showing how the reference track
 * the artist uploaded actually shaped the mix.
 *
 * Why this exists:
 *   The reference track is a Premium/Pro tier upload — it travels through
 *   analyze → Claude → engine, but historically the artist saw zero feedback
 *   that it was actually used. This card closes that loop by surfacing both
 *   the filename (so they know which reference Claude saw) and the human-
 *   readable notes Claude wrote about what was carried over (loudness target,
 *   tonal direction, energy curve).
 *
 * Display rules:
 *   • Render whenever EITHER `fileName` or `notes` exists. Tier-gating is
 *     handled by the parent — we don't make assumptions here.
 *   • If only `fileName` is present: show a compact one-liner card.
 *     The reference was used but Claude didn't write a verbose explanation.
 *   • If `notes` is present: full card with the notes as the body, filename
 *     as a small caption underneath.
 *
 * Visual treatment:
 *   Subtle 2px gold left rail (replacing a full border) so the card reads as
 *   "an influence on the mix" rather than just another panel. The gold rail
 *   matches the gold accent used everywhere else (header tags, AI PICK pill,
 *   stat dots in spec) so the artist's eye groups it with the rest of the
 *   "Claude did something on your behalf" surfaces.
 */

import { Music } from "lucide-react";

const GOLD = "#D4AF37";

export interface ReferenceNoteProps {
  fileName: string | null;
  notes:    string | null;
}

export function ReferenceNote({ fileName, notes }: ReferenceNoteProps) {
  if (!fileName && !notes) return null;

  return (
    <section
      aria-label="Reference track applied to this mix"
      className="rounded-xl px-4 py-3 relative overflow-hidden"
      style={{
        backgroundColor: "#1a1816",
        border:          "1px solid #2A2824",
      }}
    >
      {/* Gold left rail */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0"
        style={{ width: 2, backgroundColor: GOLD }}
      />

      <header className="flex items-center gap-1.5 mb-1.5">
        <Music size={11} style={{ color: GOLD }} aria-hidden="true" />
        <p
          style={{
            fontSize:      10,
            color:         GOLD,
            letterSpacing: "0.5px",
            fontWeight:    600,
          }}
        >
          REFERENCE APPLIED
        </p>
      </header>

      {notes ? (
        <>
          <p
            style={{
              fontSize:   13,
              color:      "#ccc",
              lineHeight: 1.55,
            }}
          >
            {notes}
          </p>
          {fileName && (
            <p
              className="mt-2 truncate"
              style={{ fontSize: 11, color: "#666" }}
              title={fileName}
            >
              From: {fileName}
            </p>
          )}
        </>
      ) : (
        // Filename-only fallback — Claude didn't write notes but the
        // reference was still used by analyze. Don't lie about why.
        <p
          className="truncate"
          style={{ fontSize: 12, color: "#999" }}
          title={fileName ?? undefined}
        >
          {fileName}
        </p>
      )}
    </section>
  );
}
