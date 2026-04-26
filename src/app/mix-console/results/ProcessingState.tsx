"use client";

/**
 * ProcessingState — full-page loading shell shown when a MixJob hasn't
 * reached COMPLETE yet (or when the artist requested a revision and the
 * engine is rerunning).
 *
 * Why this exists:
 *   The two server pages (guest token + dashboard) used to render an emoji
 *   + "Still processing" line and stop there — no auto-refresh, no stage
 *   indicator, no signal that anything was happening. The artist had to
 *   hit reload manually, which feels broken even when it's working.
 *
 * What it does:
 *   • Shows a 4-stage stepper (Analyze → Direction → Mix → Ready) with the
 *     current stage highlighted in gold and earlier stages dimmed.
 *   • Renders a plain-English explanation of what's happening + a rough
 *     time estimate per stage.
 *   • Polls GET /api/mix-console/job/[id] every 5 seconds.
 *   • When the polled status flips to COMPLETE, calls router.refresh()
 *     so the parent server page re-renders into the real results layout.
 *   • Handles FAILED with a clear error block + retry CTA.
 *   • Handles REVISING distinctly: same stepper but explicit "We're applying
 *     your notes" copy so the artist knows their feedback was received.
 *
 * Why we render this for REVISING instead of the prior results:
 *   The previous mix files would still play, but the engine is about to
 *   overwrite them. Letting the artist download an in-flight mix is bad —
 *   wait for the new one, then unlock everything at once.
 *
 * Polling cadence note:
 *   5s is conservative. Mix jobs typically run 60–180s end-to-end on
 *   Replicate; tighter polling adds load without changing perceived speed.
 *   When the user comes back from another tab, the visibilitychange
 *   listener fires an immediate poll so the UI catches up instantly.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const GOLD  = "#D4AF37";
const CORAL = "#E8735A";

type JobStatus =
  | "PENDING_PAYMENT"
  | "ANALYZING"
  | "AWAITING_DIRECTION"
  | "MIXING"
  | "REVISING"
  | "COMPLETE"
  | "FAILED"
  | string;

interface StageDef {
  key:   "analyze" | "direction" | "mix" | "done";
  label: string;
}

const STAGES: StageDef[] = [
  { key: "analyze",   label: "Analyzing"  },
  { key: "direction", label: "Direction"  },
  { key: "mix",       label: "Mixing"     },
  { key: "done",      label: "Ready"      },
];

function stageIndexFor(status: JobStatus): number {
  switch (status) {
    case "PENDING_PAYMENT":    return 0;
    case "ANALYZING":          return 0;
    case "AWAITING_DIRECTION": return 1;
    case "MIXING":             return 2;
    case "REVISING":           return 2; // same column as Mixing
    case "COMPLETE":           return 3;
    default:                   return 0;
  }
}

interface CopyDef {
  title: string;
  body:  string;
  eta:   string;
}

function copyFor(status: JobStatus): CopyDef {
  switch (status) {
    case "PENDING_PAYMENT":
      return {
        title: "Waiting on payment",
        body:  "Once payment confirms we'll start analysis automatically.",
        eta:   "Usually instant",
      };
    case "ANALYZING":
      return {
        title: "Analyzing your stems",
        body:  "Reading levels, key, BPM, and frequency balance so Claude can make smart calls.",
        eta:   "~30 seconds",
      };
    case "AWAITING_DIRECTION":
      return {
        title: "Almost ready",
        body:  "Claude has a recommended direction. Open the wizard to confirm or tweak it.",
        eta:   "Waiting on you",
      };
    case "MIXING":
      return {
        title: "Mixing your track",
        body:  "Per-stem comp, EQ, panning, reverb, and a final bus chain. We'll email you when it's done.",
        eta:   "1–3 minutes",
      };
    case "REVISING":
      return {
        title: "Applying your revision",
        body:  "Claude is adjusting the mix based on your notes. The new version will replace the current one.",
        eta:   "1–3 minutes",
      };
    case "FAILED":
      return {
        title: "Something went wrong",
        body:  "The engine couldn't finish this mix. We've logged the failure and refunded if applicable.",
        eta:   "",
      };
    default:
      return {
        title: "Working on it",
        body:  "Hang tight — we'll have your mix ready shortly.",
        eta:   "",
      };
  }
}

export interface ProcessingStateProps {
  jobId:         string;
  initialStatus: JobStatus;
  /** Optional MixAccessToken — required for guest polling on a fresh device. */
  accessToken?:  string;
}

export function ProcessingState({
  jobId,
  initialStatus,
  accessToken,
}: ProcessingStateProps) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus>(initialStatus);
  const [pollErr, setPollErr] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const qs = accessToken ? `?access_token=${encodeURIComponent(accessToken)}` : "";
      const res = await fetch(`/api/mix-console/job/${jobId}${qs}`, { cache: "no-store" });
      if (!res.ok) {
        // 401/403 → token expired or auth lost; surface but keep polling
        if (res.status === 401 || res.status === 403) {
          setPollErr("Lost access while polling. Refresh the page.");
        }
        return;
      }
      const body = await res.json() as { status?: JobStatus };
      if (body.status && body.status !== status) {
        setStatus(body.status);
        if (body.status === "COMPLETE") {
          // Server page will re-render with real results
          router.refresh();
        }
      }
      setPollErr(null);
    } catch {
      // Network blip — silently retry next tick
    }
  }, [jobId, accessToken, status, router]);

  useEffect(() => {
    // Don't poll once we've reached a terminal state
    if (status === "COMPLETE" || status === "FAILED") return;
    const id = window.setInterval(poll, 5000);

    // Catch up immediately when tab regains focus
    const onVis = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll, status]);

  const idx  = stageIndexFor(status);
  const copy = copyFor(status);
  const failed = status === "FAILED";

  return (
    <div className="max-w-md mx-auto px-6 py-16 sm:py-24">
      {/* Stage stepper */}
      <ol
        aria-label="Mix progress"
        className="flex items-center justify-between gap-2 mb-10"
      >
        {STAGES.map((s, i) => {
          const reached = i <= idx && !failed;
          const active  = i === idx && !failed;
          return (
            <li key={s.key} className="flex-1 flex flex-col items-center">
              <span
                aria-current={active ? "step" : undefined}
                className="rounded-full"
                style={{
                  width:           active ? 12 : 8,
                  height:          active ? 12 : 8,
                  backgroundColor: reached ? GOLD : "#2A2824",
                  boxShadow:       active ? "0 0 0 4px rgba(212,175,55,0.18)" : "none",
                  transition:      "all 200ms ease",
                }}
              />
              <span
                className="mt-2 text-center"
                style={{
                  fontSize:   10,
                  color:      reached ? "#ddd" : "#555",
                  fontWeight: active ? 600 : 400,
                  letterSpacing: "0.3px",
                }}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Headline + body */}
      <div className="text-center" aria-live="polite">
        {!failed && (
          <Spinner />
        )}
        <h1
          className="mt-5 mb-2"
          style={{
            fontSize:   20,
            fontWeight: 600,
            color:      failed ? CORAL : "#fff",
          }}
        >
          {copy.title}
        </h1>
        <p
          className="mx-auto"
          style={{ fontSize: 13, color: "#888", lineHeight: 1.6, maxWidth: 360 }}
        >
          {copy.body}
        </p>
        {copy.eta && (
          <p
            className="mt-3"
            style={{
              fontSize:      10,
              color:         "#666",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            {copy.eta}
          </p>
        )}
      </div>

      {/* Failure CTA */}
      {failed && (
        <div className="mt-8 text-center">
          <a
            href="/mix-console"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl no-underline transition-opacity hover:opacity-90"
            style={{
              backgroundColor: GOLD,
              color:           "#0A0A0A",
              fontSize:        13,
              fontWeight:      700,
            }}
          >
            Start a new mix
          </a>
          <p className="mt-3" style={{ fontSize: 11, color: "#555" }}>
            Need help? <a href="mailto:support@indiethis.com" style={{ color: "#888", textDecoration: "underline" }}>support@indiethis.com</a>
          </p>
        </div>
      )}

      {pollErr && (
        <p
          role="alert"
          className="text-center mt-6"
          style={{ fontSize: 11, color: CORAL }}
        >
          {pollErr}
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      data-mix-proc-spinner=""
      className="inline-block rounded-full"
      style={{
        width:          28,
        height:         28,
        border:         "2px solid rgba(212,175,55,0.18)",
        borderTopColor: GOLD,
        animation:      "mixProcSpin 1s linear infinite",
      }}
    />
  );
}

if (typeof window !== "undefined" && !document.getElementById("mix-proc-spin-style")) {
  const style = document.createElement("style");
  style.id = "mix-proc-spin-style";
  style.textContent = `
    @keyframes mixProcSpin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      [data-mix-proc-spinner] { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}
