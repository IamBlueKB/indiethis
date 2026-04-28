/**
 * useKeyboardShortcuts — central keyboard shortcut wiring for the
 * Pro Studio Mixer (step 29).
 *
 * Bindings (per spec):
 *   Space             → play / pause
 *   Cmd/Ctrl+Z        → undo
 *   Cmd/Ctrl+Shift+Z  → redo  (also Ctrl+Y)
 *   1–9               → toggle mute on stem at index N-1
 *   Shift+1–9         → toggle solo on stem at index N-1
 *   A                 → toggle A/B reference
 *   R                 → toggle reference playback (same handler as A)
 *   S                 → save snapshot prompt
 *   Cmd/Ctrl+S        → re-render (preventDefault always)
 *   ←/→               → seek ±5s
 *   ↑/↓               → master volume ±0.5dB
 *   Esc               → deselect section
 *   ? (Shift+/)       → open help overlay
 *
 * The hook skips when an <input>, <textarea>, or contenteditable element
 * has focus so form fields / shortcut menus don't get hijacked.
 *
 * IMPORTANT: This hook is purely additive. It does not modify any of the
 * callbacks it receives — it only invokes them.
 */
import { useEffect } from "react";
import type { StemRole } from "./types";

export interface KeyboardShortcutCallbacks {
  /** Toggle play/pause (Space). */
  onTogglePlay?:        () => void;
  /** Undo (Cmd/Ctrl+Z). */
  onUndo?:              () => void;
  /** Redo (Cmd/Ctrl+Shift+Z, Ctrl+Y). */
  onRedo?:              () => void;
  /** Toggle mute on stem at index. */
  onToggleMuteAt?:      (index: number) => void;
  /** Toggle solo on stem at index. */
  onToggleSoloAt?:      (index: number) => void;
  /** Toggle A/B reference (A or R). */
  onToggleReference?:   () => void;
  /** Save snapshot — typically opens the Save prompt. */
  onSaveSnapshot?:      () => void;
  /** Re-render (Cmd/Ctrl+S). */
  onRerender?:          () => void;
  /** Seek by delta seconds. */
  onSeekDelta?:         (deltaSeconds: number) => void;
  /** Master volume by dB delta. */
  onMasterVolumeDelta?: (deltaDb: number) => void;
  /** Deselect current section (Escape). */
  onDeselectSection?:   () => void;
  /** Open the shortcut help overlay (Shift+/). */
  onOpenHelp?:          () => void;
  /**
   * Stem roles in stable index order; the index keys 1–9 use this list to
   * resolve which stem to mute/solo. Pass an empty array to disable index-keys.
   */
  stemRoles?:           StemRole[];
  /** Master kill-switch — set false to detach all listeners. */
  enabled?:             boolean;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!t) return false;
  const el = t as HTMLElement;
  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(cbs: KeyboardShortcutCallbacks): void {
  // Pull every callback into deps so React re-binds when handlers identity changes.
  // Listing them explicitly keeps the dep array stable + lint-clean.
  const {
    onTogglePlay, onUndo, onRedo,
    onToggleMuteAt, onToggleSoloAt,
    onToggleReference, onSaveSnapshot, onRerender,
    onSeekDelta, onMasterVolumeDelta, onDeselectSection, onOpenHelp,
    stemRoles, enabled = true,
  } = cbs;

  useEffect(() => {
    if (!enabled) return;

    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      const meta  = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key   = e.key;

      // Cmd/Ctrl combos first so single-letter handlers don't swallow them.
      if (meta && (key === "s" || key === "S")) {
        e.preventDefault();
        onRerender?.();
        return;
      }
      if (meta && (key === "z" || key === "Z")) {
        e.preventDefault();
        if (shift) onRedo?.();
        else       onUndo?.();
        return;
      }
      if (meta && (key === "y" || key === "Y")) {
        e.preventDefault();
        onRedo?.();
        return;
      }
      // Once a meta combo doesn't match anything specific, bail so we don't
      // hijack browser shortcuts (Cmd+C, Cmd+V, Cmd+R, etc.).
      if (meta) return;

      // Space → play/pause. Prevent page scroll.
      if (key === " " || key === "Spacebar") {
        e.preventDefault();
        onTogglePlay?.();
        return;
      }

      // Number row → mute/solo by index.
      if (/^[1-9]$/.test(key)) {
        const idx = parseInt(key, 10) - 1;
        if (stemRoles && idx < stemRoles.length) {
          e.preventDefault();
          if (shift) onToggleSoloAt?.(idx);
          else       onToggleMuteAt?.(idx);
        }
        return;
      }

      // Arrow keys.
      if (key === "ArrowLeft") {
        e.preventDefault();
        onSeekDelta?.(-5);
        return;
      }
      if (key === "ArrowRight") {
        e.preventDefault();
        onSeekDelta?.(+5);
        return;
      }
      if (key === "ArrowUp") {
        e.preventDefault();
        onMasterVolumeDelta?.(+0.5);
        return;
      }
      if (key === "ArrowDown") {
        e.preventDefault();
        onMasterVolumeDelta?.(-0.5);
        return;
      }

      // Escape — deselect.
      if (key === "Escape") {
        onDeselectSection?.();
        return;
      }

      // Single-letter shortcuts (case-insensitive).
      const lower = key.length === 1 ? key.toLowerCase() : key;
      if (lower === "a") {
        e.preventDefault();
        onToggleReference?.();
        return;
      }
      if (lower === "r") {
        e.preventDefault();
        onToggleReference?.();
        return;
      }
      if (lower === "s") {
        e.preventDefault();
        onSaveSnapshot?.();
        return;
      }
      if (key === "?" || (shift && key === "/")) {
        e.preventDefault();
        onOpenHelp?.();
        return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    enabled,
    onTogglePlay, onUndo, onRedo,
    onToggleMuteAt, onToggleSoloAt,
    onToggleReference, onSaveSnapshot, onRerender,
    onSeekDelta, onMasterVolumeDelta, onDeselectSection, onOpenHelp,
    // Use a serialized identity for the role array so re-orders re-bind.
    stemRoles?.join("|"),
  ]);
}
