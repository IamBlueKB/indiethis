/**
 * ShortcutHelpOverlay — modal listing keyboard shortcuts (step 29).
 *
 * Triggered by `?` (Shift+/). Pure additive UI — does not modify the
 * studio layout. Click backdrop or press Escape to close.
 */
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export interface ShortcutHelpOverlayProps {
  open: boolean;
  onClose(): void;
}

interface Row {
  keys:   string;
  action: string;
}

const ROWS: Row[] = [
  { keys: "Space",            action: "Play / Pause" },
  { keys: "Cmd / Ctrl + Z",   action: "Undo" },
  { keys: "Cmd + Shift + Z",  action: "Redo" },
  { keys: "1 – 9",            action: "Toggle mute on stem 1–9" },
  { keys: "Shift + 1 – 9",    action: "Toggle solo on stem 1–9" },
  { keys: "A",                action: "Toggle A/B reference" },
  { keys: "R",                action: "Toggle reference playback" },
  { keys: "S",                action: "Save snapshot" },
  { keys: "Cmd / Ctrl + S",   action: "Re-render" },
  { keys: "← / →",            action: "Seek ±5 seconds" },
  { keys: "↑ / ↓",            action: "Master volume ±0.5 dB" },
  { keys: "Tab",              action: "Cycle focus between strips" },
  { keys: "Esc",              action: "Deselect section" },
  { keys: "?",                action: "Show this help" },
];

export function ShortcutHelpOverlay({ open, onClose }: ShortcutHelpOverlayProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-help-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        backgroundColor: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "#1A1816",
          border: "1px solid #2A2824",
          borderRadius: 12,
          color: "#fff",
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,67,0.18)",
          padding: 24,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="shortcut-help-title"
            className="text-base font-bold"
            style={{ color: "#D4A843" }}
          >
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcut help"
            className="p-1 rounded transition-colors"
            style={{ color: "#888" }}
          >
            <X size={16} />
          </button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.keys} style={{ borderBottom: "1px solid #2A2824" }}>
                <td
                  style={{
                    padding: "8px 12px 8px 0",
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    fontSize: 11,
                    color: "#D4A843",
                    whiteSpace: "nowrap",
                    verticalAlign: "top",
                    width: "40%",
                  }}
                >
                  {r.keys}
                </td>
                <td
                  style={{
                    padding: "8px 0",
                    fontSize: 12,
                    color: "#D8D5CF",
                  }}
                >
                  {r.action}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p
          className="text-[10px] mt-4 leading-snug"
          style={{ color: "#666" }}
        >
          Shortcuts are disabled while typing in inputs. Press Esc or click outside to close.
        </p>
      </div>
    </div>
  );
}
