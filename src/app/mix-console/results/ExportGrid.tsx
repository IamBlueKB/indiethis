"use client";

/**
 * ExportGrid — 6-format download picker + primary download button.
 *
 * Renders six selectable cards (WAV 24/44.1, WAV 24/48, WAV 16/44.1, MP3 320,
 * FLAC 24, AIFF 24). User picks one; the gold pill button below downloads
 * the currently-selected mix version in that format.
 *
 * Download mechanics:
 *   • All six formats hit the same route: `/api/mix-console/job/[id]/download`
 *     with `?version={selectedVersion}&format={fmt}` and the optional
 *     `access_token` for guest sessions.
 *   • The route already proxies the file with Content-Disposition: attachment,
 *     so we just navigate the browser to the URL — no blob juggling, no
 *     window.open popup blocker, the browser saves it.
 *   • While the request is in flight we lock the button + show a spinner so
 *     the artist knows something happened (signed-URL fetch + Supabase pull
 *     can take 1-2s for a 24-bit master).
 *
 * Standard tier: `version` cycles between clean/polished/aggressive based on
 *   the VersionSelector above. Each card downloads the chosen variant.
 * Premium/Pro: `version="mix"` always (single AI-recommended mix).
 *
 * Note on file existence: a guest job may only have the chosen variant
 * encoded by the engine — if the user picks "FLAC" but the engine only wrote
 * WAV, the download route returns 404 and we surface that as a toast inline
 * (no full-page error). Future revision: cache an availability map per job.
 */

import { useState } from "react";

const GOLD = "#D4AF37";

interface FormatDef {
  id:    string;
  label: string;
  sub:   string;
}

const FORMATS: FormatDef[] = [
  { id: "wav_24_44", label: "WAV 24-bit", sub: "44.1kHz · Studio"  },
  { id: "wav_24_48", label: "WAV 24-bit", sub: "48kHz · Video"     },
  { id: "wav_16_44", label: "WAV 16-bit", sub: "CD quality"        },
  { id: "mp3_320",   label: "MP3 320kbps", sub: "Streaming"        },
  { id: "flac",      label: "FLAC 24-bit", sub: "Lossless archive" },
  { id: "aiff",      label: "AIFF 24-bit", sub: "Apple / Logic"    },
];

const FORMAT_LABEL_FOR_BUTTON: Record<string, string> = {
  wav_24_44: "WAV 24-bit",
  wav_24_48: "WAV 24-bit · 48kHz",
  wav_16_44: "WAV 16-bit",
  mp3_320:   "MP3 320kbps",
  flac:      "FLAC",
  aiff:      "AIFF",
};

export interface ExportGridProps {
  jobId:        string;
  /** Active version key — "clean" | "polished" | "aggressive" | "mix" */
  version:      string;
  /** Optional MixAccessToken for guest downloads */
  accessToken?: string;
}

export function ExportGrid({ jobId, version, accessToken }: ExportGridProps) {
  const [selectedFmt, setSelectedFmt] = useState<string>("wav_24_44");
  const [busy, setBusy]               = useState(false);
  const [err, setErr]                 = useState<string | null>(null);

  async function handleDownload() {
    setBusy(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ version, format: selectedFmt });
      if (accessToken) qs.set("access_token", accessToken);
      const url = `/api/mix-console/job/${jobId}/download?${qs.toString()}`;

      // HEAD the route first so we can show an inline error if the server
      // returns 404 (e.g. format not encoded), instead of a broken download.
      const probe = await fetch(url, { method: "GET" });
      if (!probe.ok) {
        const body = await probe.json().catch(() => ({}));
        setErr(body?.error ?? `Download failed (${probe.status}).`);
        return;
      }
      // Stream the body to a blob so the browser saves the proxied file.
      const blob = await probe.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;
      const ext = selectedFmt.startsWith("wav") ? "wav"
                : selectedFmt === "mp3_320"     ? "mp3"
                : selectedFmt;
      a.download = `mix_${version}_${selectedFmt}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Free memory after a tick — Safari needs the URL alive briefly.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (e) {
      console.error("[ExportGrid] download failed", e);
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const versionLabel = version === "mix"
    ? "mix"
    : version.charAt(0).toUpperCase() + version.slice(1);

  return (
    <section aria-label="Export formats">
      <p
        className="mb-2"
        style={{ fontSize: 10, color: GOLD, letterSpacing: "0.5px", fontWeight: 600 }}
      >
        EXPORT
      </p>

      <div role="radiogroup" aria-label="Download format" className="grid grid-cols-2 gap-2">
        {FORMATS.map((fmt, i) => {
          const active = fmt.id === selectedFmt;
          return (
            <button
              key={fmt.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              data-export-fmt={fmt.id}
              onClick={() => setSelectedFmt(fmt.id)}
              onKeyDown={(e) => {
                let next = i;
                if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % FORMATS.length;
                if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   next = (i - 1 + FORMATS.length) % FORMATS.length;
                if (next !== i) {
                  e.preventDefault();
                  setSelectedFmt(FORMATS[next].id);
                  // Move focus to the newly active radio so SR announces it
                  (document.querySelector(`[data-export-fmt="${FORMATS[next].id}"]`) as HTMLElement | null)?.focus();
                }
              }}
              className="rounded-lg px-3 py-2.5 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2"
              style={{
                backgroundColor: "#1a1816",
                border: active ? `1px solid ${GOLD}` : "0.5px solid #2A2824",
                boxShadow: active ? "0 0 0 1px rgba(212,175,55,0.20)" : "none",
              }}
            >
              <p
                style={{
                  fontSize:   12,
                  fontWeight: 500,
                  color:      active ? GOLD : "#ccc",
                }}
              >
                {fmt.label}
              </p>
              <p style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                {fmt.sub}
              </p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="w-full mt-3 py-3.5 rounded-xl text-[13px] font-bold transition-opacity flex items-center justify-center gap-2"
        style={{
          backgroundColor: GOLD,
          color:           "#0A0A0A",
          opacity:         busy ? 0.6 : 1,
          cursor:          busy ? "wait" : "pointer",
        }}
      >
        {busy ? (
          <>
            <Spinner />
            <span>Preparing…</span>
          </>
        ) : (
          <span>
            Download {versionLabel} · {FORMAT_LABEL_FOR_BUTTON[selectedFmt] ?? selectedFmt}
          </span>
        )}
      </button>

      {err && (
        <p
          role="alert"
          className="text-center mt-2"
          style={{ fontSize: 11, color: "#E8735A" }}
        >
          {err}
        </p>
      )}
    </section>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      data-mix-export-spinner=""
      className="inline-block rounded-full"
      style={{
        width:        12,
        height:       12,
        border:       "2px solid rgba(10,10,10,0.25)",
        borderTopColor: "#0A0A0A",
        animation:    "mixExportSpin 0.8s linear infinite",
      }}
    />
  );
}

// Keyframes injected once on first import (no global CSS file needed)
if (typeof window !== "undefined" && !document.getElementById("mix-export-spin-style")) {
  const style = document.createElement("style");
  style.id = "mix-export-spin-style";
  style.textContent = `
    @keyframes mixExportSpin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      [data-mix-export-spinner] { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}
