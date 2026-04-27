/**
 * useStudioAutosave — debounced POST to /api/mix-console/job/[id]/studio/save.
 *
 * Watches the studio state + snapshots and persists them whenever a user
 * change leaves the document in a "dirty" state. Debounced 1200ms so a
 * fader drag isn't 200 round-trips. Also flushes on tab close via
 * sendBeacon so a quick navigation doesn't lose the last edit.
 *
 * Returns { status, lastSavedAt, saveNow } so the UI can render
 * "Saving…" / "Saved 5s ago" and offer a manual save button.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot, StudioState } from "./types";

const DEBOUNCE_MS = 1200;

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface UseStudioAutosaveArgs {
  jobId:     string;
  state:     StudioState;
  snapshots: Snapshot[];
  /** Skip autosave when true (e.g. guest mode, or feature flag off). */
  disabled?: boolean;
}

interface UseStudioAutosaveReturn {
  status:       AutosaveStatus;
  lastSavedAt:  string | null;
  saveNow:      () => Promise<void>;
}

export function useStudioAutosave(args: UseStudioAutosaveArgs): UseStudioAutosaveReturn {
  const { jobId, state, snapshots, disabled } = args;

  const [status,      setStatus]      = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(state.lastSavedAt ?? null);

  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<AbortController | null>(null);

  // Latest values held in refs so the close-flush path always sees current.
  const stateRef     = useRef(state);
  const snapshotsRef = useRef(snapshots);
  stateRef.current     = state;
  snapshotsRef.current = snapshots;

  function buildBody() {
    const s = stateRef.current;
    return {
      global:       s.global,
      sections:     s.sections,
      master:       s.master,
      linkedGroups: s.linkedGroups ?? {},
      snapshots:    snapshotsRef.current,
    };
  }

  const saveNow = useCallback(async () => {
    if (disabled) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (inflightRef.current) inflightRef.current.abort();

    const ctl = new AbortController();
    inflightRef.current = ctl;
    setStatus("saving");
    try {
      const res = await fetch(`/api/mix-console/job/${jobId}/studio/save`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(buildBody()),
        signal:  ctl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { lastSavedAt?: string };
      if (data.lastSavedAt) setLastSavedAt(data.lastSavedAt);
      setStatus("saved");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setStatus("error");
    } finally {
      inflightRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, disabled]);

  // Debounced save on every state / snapshots change while dirty.
  useEffect(() => {
    if (disabled) return;
    if (!state.isDirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void saveNow();
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, snapshots, disabled]);

  // Flush on tab close via sendBeacon — fire-and-forget, no awaits possible.
  useEffect(() => {
    if (disabled) return;
    function onUnload() {
      try {
        const body = new Blob([JSON.stringify(buildBody())], { type: "application/json" });
        navigator.sendBeacon(`/api/mix-console/job/${jobId}/studio/save`, body);
      } catch { /* noop */ }
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, disabled]);

  return { status, lastSavedAt, saveNow };
}
