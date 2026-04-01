"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Loader2, Check, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";

type CrateSummary = {
  id: string;
  name: string;
};

type Props = {
  trackId: string;
};

export default function AddToCrateButton({ trackId }: Props) {
  const { data: session } = useSession();
  const [crates, setCrates] = useState<CrateSummary[]>([]);
  const [fetched, setFetched] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Only show button for logged-in users
  if (!session?.user) return null;

  async function handleOpen() {
    setError(null);
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right });
    }
    // Lazy-fetch crates on first open — prevents N concurrent requests on pages with many tracks
    if (!fetched && !fetching) {
      setFetching(true);
      try {
        const data = await fetch("/api/dashboard/dj/crates").then(r => r.json()) as { crates?: CrateSummary[] };
        setCrates(data.crates ?? []);
      } catch {
        // silently ignore
      } finally {
        setFetched(true);
        setFetching(false);
      }
    }
    setOpen(v => !v);
  }

  async function handleAdd(crateId: string) {
    setAdding(crateId);
    setError(null);
    const res = await fetch(`/api/dashboard/dj/crates/${crateId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed to add track.");
    } else {
      setAdded(crateId);
      setTimeout(() => setAdded(null), 2000);
    }
    setAdding(null);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
        style={{ backgroundColor: "rgba(212,168,67,0.08)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.2)" }}
        title="Add to Crate"
      >
        {added
          ? <Check size={11} />
          : <>
              <Plus size={11} />
              <span className="hidden sm:inline">Crate</span>
              <ChevronDown size={9} />
            </>
        }
      </button>

      {open && dropdownPos && typeof document !== "undefined" && createPortal(
        <div
          className="fixed rounded-xl border shadow-xl overflow-hidden min-w-[160px]"
          style={{ backgroundColor: "#141414", borderColor: "#2a2a2a", top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }}
        >
          {fetching ? (
            <div className="px-3 py-2 flex items-center gap-2 text-xs" style={{ color: "#888" }}>
              <Loader2 size={11} className="animate-spin" style={{ color: "#D4A843" }} />
              Loading…
            </div>
          ) : crates.length === 0 ? (
            <p className="px-3 py-2 text-xs" style={{ color: "#888" }}>No crates yet.</p>
          ) : (
            <div className="py-1">
              {crates.map(crate => (
                <button
                  key={crate.id}
                  onClick={() => handleAdd(crate.id)}
                  disabled={adding === crate.id}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-white hover:bg-white/5 disabled:opacity-50 transition-colors"
                >
                  {adding === crate.id
                    ? <Loader2 size={11} className="animate-spin shrink-0" style={{ color: "#D4A843" }} />
                    : <Plus size={11} className="shrink-0" style={{ color: "#D4A843" }} />
                  }
                  <span className="truncate">{crate.name}</span>
                </button>
              ))}
            </div>
          )}
          {error && (
            <p className="px-3 py-2 text-[10px]" style={{ color: "#ef4444", borderTop: "1px solid #2a2a2a" }}>
              {error}
            </p>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
