"use client";

import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";

type ArtistResult = { id: string; name: string; slug: string; photo: string | null };

type Props = {
  name: string;
  slug: string | null;
  onChange: (name: string, slug: string | null) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export function ArtistSearchInput({
  name,
  slug,
  onChange,
  placeholder = "Artist name",
  required,
  className,
  style,
}: Props) {
  const [query, setQuery] = useState(name);
  const [results, setResults] = useState<ArtistResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const isFocused = useRef(false);

  // Sync query when parent resets the form (name changes to "" or a new value externally)
  useEffect(() => {
    if (!isFocused.current) setQuery(name);
  }, [name]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleChange(q: string) {
    setQuery(q);
    // Typing clears the linked slug
    onChange(q, null);
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/studio/artist-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen((data.results ?? []).length > 0);
      } catch {
        // ignore
      }
    }, 300);
  }

  function select(r: ArtistResult) {
    setQuery(r.name);
    onChange(r.name, r.slug);
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          className={className}
          style={style}
          placeholder={placeholder}
          required={required}
          value={query}
          autoComplete="off"
          onFocus={() => {
            isFocused.current = true;
            if (results.length > 0) setOpen(true);
          }}
          onBlur={() => { isFocused.current = false; }}
          onChange={(e) => handleChange(e.target.value)}
        />
        {slug && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-semibold pointer-events-none"
            style={{ color: "#D4A843" }}
          >
            <Check size={10} /> linked
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 rounded-xl border overflow-hidden shadow-lg"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={() => select(r)}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
            >
              {r.photo ? (
                <img src={r.photo} alt={r.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}
                >
                  {r.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                <p className="text-[10px] text-muted-foreground">/{r.slug}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
