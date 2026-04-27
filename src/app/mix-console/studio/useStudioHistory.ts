/**
 * useStudioHistory — undo/redo wrapper around the studio state.
 *
 * Wraps `useState<StudioState>` with two stacks. Snapshotting is debounced
 * so a fader drag (hundreds of onChange ticks) collapses into one history
 * entry instead of 200, but committing immediately on the first change of a
 * "fresh" interaction keeps the very first move recoverable.
 *
 * Contract:
 *   - setState(updater) — same signature as React's; pushes the BEFORE-value
 *     onto the undo stack (debounced) and clears the redo stack.
 *   - undo() — pops undo, pushes current state onto redo, replaces state.
 *   - redo() — pops redo, pushes current state onto undo, replaces state.
 *
 * Replace-without-history is also supported via `setStateNoHistory(s)` —
 * used during the initial seed effect so loading the page doesn't burn an
 * undo entry.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StudioState } from "./types";

const SNAP_DEBOUNCE_MS = 220;
const MAX_HISTORY      = 60;

interface UseStudioHistoryReturn {
  state:               StudioState;
  setState:            (updater: StudioState | ((prev: StudioState) => StudioState)) => void;
  setStateNoHistory:   (next: StudioState) => void;
  undo:                () => void;
  redo:                () => void;
  canUndo:             boolean;
  canRedo:             boolean;
}

export function useStudioHistory(initial: StudioState): UseStudioHistoryReturn {
  const [state, setRawState] = useState<StudioState>(initial);

  // Stacks of past + future snapshots. We never put `state` itself on a
  // stack — only the value at the time of the previous "commit".
  const undoRef     = useRef<StudioState[]>([]);
  const redoRef     = useRef<StudioState[]>([]);

  // The state value at the time of the LAST committed snapshot. Used to
  // know whether a debounced commit should actually push (no-op if state
  // hasn't really changed since the last commit).
  const lastSnapRef = useRef<StudioState>(initial);

  // Pending debounce timer + the value that was current when the timer was
  // armed (= the value to push onto undo when the timer fires).
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBeforeRef = useRef<StudioState | null>(null);

  // Force re-render of canUndo / canRedo flags.
  const [, bumpFlags] = useState(0);
  function refreshFlags() { bumpFlags((n) => n + 1); }

  function commitNow() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const before = pendingBeforeRef.current;
    pendingBeforeRef.current = null;
    if (!before || before === lastSnapRef.current) return;
    undoRef.current.push(before);
    if (undoRef.current.length > MAX_HISTORY) undoRef.current.shift();
    redoRef.current = [];
    lastSnapRef.current = before;
    refreshFlags();
  }

  const setState = useCallback(
    (updater: StudioState | ((prev: StudioState) => StudioState)) => {
      setRawState((prev) => {
        // Capture BEFORE-value for the next debounced commit. Only the first
        // change in a debounce window arms it — subsequent changes (drag
        // ticks) extend the window without overwriting the captured
        // BEFORE-value.
        if (!timerRef.current) {
          pendingBeforeRef.current = prev;
        }
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          commitNow();
        }, SNAP_DEBOUNCE_MS);

        return typeof updater === "function" ? updater(prev) : updater;
      });
    },
    []
  );

  const setStateNoHistory = useCallback((next: StudioState) => {
    setRawState(next);
    lastSnapRef.current = next;
  }, []);

  const undo = useCallback(() => {
    // Flush any pending commit so we undo to a stable point.
    commitNow();
    const stack = undoRef.current;
    if (stack.length === 0) return;
    const target = stack.pop()!;
    setRawState((curr) => {
      redoRef.current.push(curr);
      if (redoRef.current.length > MAX_HISTORY) redoRef.current.shift();
      lastSnapRef.current = target;
      return target;
    });
    refreshFlags();
  }, []);

  const redo = useCallback(() => {
    commitNow();
    const stack = redoRef.current;
    if (stack.length === 0) return;
    const target = stack.pop()!;
    setRawState((curr) => {
      undoRef.current.push(curr);
      if (undoRef.current.length > MAX_HISTORY) undoRef.current.shift();
      lastSnapRef.current = target;
      return target;
    });
    refreshFlags();
  }, []);

  // Cleanup pending timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    state,
    setState,
    setStateNoHistory,
    undo,
    redo,
    canUndo: undoRef.current.length > 0,
    canRedo: redoRef.current.length > 0,
  };
}
