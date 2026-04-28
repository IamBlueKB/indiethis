/**
 * SnapshotsMenu — dropdown panel for named save points.
 *
 * Lives in the top bar next to Undo/Redo. Click the trigger to open a
 * popover listing every snapshot. Each row exposes:
 *   - name + relative timestamp
 *   - Recall button (replaces current state with the snapshot's state)
 *   - Delete button (hidden for protected snapshots — i.e. "AI Original")
 *
 * "Save current as…" at the bottom prompts for a name and pushes a new
 * snapshot containing the current global / sections / master state.
 *
 * Keeping snapshots in component state (StudioClient) for now; step 18
 * autosaves the whole studioState including snapshots back to MixJob.
 */

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";
import type { Snapshot } from "./types";

const GOLD = "#D4A843";

interface SnapshotsMenuProps {
  snapshots:    Snapshot[];
  onRecall:     (snap: Snapshot) => void;
  onSave:       (name: string) => void;
  onDelete:     (name: string) => void;
}

function relativeTime(iso: string): string {
  const t       = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60)      return "just now";
  if (diffSec < 3600)    return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400)   return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function SnapshotsMenu({ snapshots, onRecall, onSave, onDelete }: SnapshotsMenuProps) {
  const [open, setOpen]       = useState(false);
  const [naming, setNaming]   = useState(false);
  const [draft, setDraft]     = useState("");
  const wrapRef               = useRef<HTMLDivElement | null>(null);
  const triggerRef            = useRef<HTMLButtonElement | null>(null);
  const panelRef              = useRef<HTMLDivElement | null>(null);
  const inputRef              = useRef<HTMLInputElement | null>(null);
  const [pos, setPos]         = useState<{ top: number; right: number } | null>(null);

  // Recompute panel position whenever it opens or the window resizes.
  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      const t = triggerRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      const insideWrap  = wrapRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideWrap && !insidePanel) {
        setOpen(false);
        setNaming(false);
        setDraft("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Auto-focus the name input when entering naming mode.
  useEffect(() => {
    if (naming) inputRef.current?.focus();
  }, [naming]);

  function commitSave() {
    const name = draft.trim();
    if (!name) {
      setNaming(false);
      setDraft("");
      return;
    }
    onSave(name);
    setNaming(false);
    setDraft("");
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Snapshots"
        aria-label="Snapshots"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
        style={{
          backgroundColor: open ? "#1f1d1a" : "transparent",
          color:           open ? GOLD       : "#888",
          border:          `1px solid ${open ? GOLD : "#2A2824"}`,
        }}
      >
        <Camera size={11} />
        Snapshots
        <span style={{ color: "#666", fontWeight: 400 }}>{snapshots.length}</span>
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          className="rounded-lg"
          style={{
            position:        "fixed",
            top:             pos.top,
            right:           pos.right,
            width:           260,
            backgroundColor: "#0E0C0A",
            border:          "1px solid #2A2824",
            zIndex:          1000,
            boxShadow:       "0 12px 32px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.5)",
          }}
        >
          {/* List */}
          <div className="max-h-72 overflow-y-auto py-1">
            {snapshots.length === 0 ? (
              <div className="px-3 py-3 text-[11px]" style={{ color: "#666" }}>
                No snapshots yet.
              </div>
            ) : (
              snapshots.map((snap) => (
                <div
                  key={snap.name + snap.created_at}
                  className="flex items-center justify-between px-3 py-2 hover:bg-[#221F1B]"
                >
                  <div className="flex flex-col min-w-0 mr-2 flex-1">
                    <span
                      className="text-[12px] font-semibold truncate"
                      style={{ color: snap.protected ? GOLD : "#fff" }}
                    >
                      {snap.name}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider" style={{ color: "#666" }}>
                      {relativeTime(snap.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => { onRecall(snap); setOpen(false); }}
                      className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded transition-colors"
                      style={{
                        backgroundColor: GOLD,
                        color:           "#0A0A0A",
                      }}
                    >
                      Recall
                    </button>
                    {!snap.protected && (
                      <button
                        type="button"
                        onClick={() => onDelete(snap.name)}
                        title="Delete snapshot"
                        aria-label={`Delete ${snap.name}`}
                        className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                        style={{ color: "#888", border: "1px solid #2A2824" }}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Save current footer */}
          <div className="border-t" style={{ borderColor: "#2A2824" }}>
            {naming ? (
              <div className="flex items-center gap-1 p-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")  { e.preventDefault(); commitSave(); }
                    if (e.key === "Escape") { e.preventDefault(); setNaming(false); setDraft(""); }
                  }}
                  placeholder="Snapshot name"
                  maxLength={40}
                  className="flex-1 px-2 py-1 text-[11px] rounded outline-none"
                  style={{
                    backgroundColor: "#0F0D0B",
                    border:          "1px solid #2A2824",
                    color:           "#fff",
                  }}
                />
                <button
                  type="button"
                  onClick={commitSave}
                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded"
                  style={{ backgroundColor: GOLD, color: "#0A0A0A" }}
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNaming(true)}
                className="w-full text-left px-3 py-2 text-[11px] font-semibold transition-colors"
                style={{ color: GOLD }}
              >
                + Save current as…
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
