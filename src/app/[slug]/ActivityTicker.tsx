"use client";

import { useEffect, useState, useRef } from "react";

interface Props {
  artistSlug: string;
}

export default function ActivityTicker({ artistSlug }: Props) {
  const [items, setItems]               = useState<string[]>([]);
  const [totalListening, setTotal]      = useState(0);
  const [visible, setVisible]           = useState(false);
  const [tickerText, setTickerText]     = useState("");
  const intervalRef                     = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchActivity() {
      try {
        const res  = await fetch(`/api/public/artist-activity?slug=${encodeURIComponent(artistSlug)}`);
        const data = await res.json() as { items: string[]; totalListening: number };
        if (cancelled) return;

        const allItems: string[] = [];
        if (data.totalListening > 0) {
          allItems.push(`${data.totalListening} ${data.totalListening === 1 ? "person" : "people"} listening now`);
        }
        allItems.push(...(data.items ?? []));

        if (allItems.length > 0) {
          setItems(allItems);
          setTotal(data.totalListening);
          setVisible(true);
          setTickerText(allItems.join(" · ") + " · " + allItems.join(" · "));
        }
      } catch {
        // silently hide if fetch fails
      }
    }

    fetchActivity();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [artistSlug]);

  if (!visible || items.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 rounded-[8px] overflow-hidden"
      style={{ backgroundColor: "#111", padding: "8px 14px" }}
    >
      {/* Green dot */}
      <div
        className="shrink-0 rounded-full animate-pulse"
        style={{ width: 6, height: 6, backgroundColor: "#4CAF50" }}
      />

      {/* Scrolling text */}
      <div className="flex-1 overflow-hidden">
        <div
          className="whitespace-nowrap text-[11px] text-[#999]"
          style={{
            animation: "ticker-scroll 30s linear infinite",
            display:   "inline-block",
          }}
        >
          {tickerText}
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
