"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ArtistNavProps {
  displayName: string;
  hasMusic:    boolean;
  hasVideos:   boolean;
  hasShows:    boolean;
  hasMerch:    boolean;
  hasAbout:    boolean;
}

export default function ArtistNav({
  displayName,
  hasMusic,
  hasVideos,
  hasShows,
  hasMerch,
  hasAbout,
}: ArtistNavProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      // Show after scrolling 300px (past hero)
      setVisible(window.scrollY > 300);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const offset = 64; // nav height
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  const links = [
    hasMusic  && { label: "Music",   id: "music" },
    hasVideos && { label: "Videos",  id: "videos" },
    hasShows  && { label: "Shows",   id: "shows" },
    hasMerch && { label: "Merch",   id: "merch" },
    hasAbout && { label: "About",   id: "about" },
    { label: "Booking", id: "booking" },
  ].filter(Boolean) as { label: string; id: string }[];

  return (
    <nav
      aria-label="Artist site navigation"
      className="fixed top-0 left-0 right-0 z-40 transition-all duration-300"
      style={{
        backgroundColor: visible ? "rgba(10,10,10,0.92)" : "transparent",
        backdropFilter:   visible ? "blur(12px)" : "none",
        borderBottom:     visible ? "1px solid rgba(255,255,255,0.06)" : "none",
        transform:        visible ? "translateY(0)" : "translateY(-100%)",
        pointerEvents:    visible ? "auto" : "none",
      }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Artist name */}
        <span
          className="font-bold text-white truncate text-sm"
          style={{ fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)" }}
        >
          {displayName}
        </span>

        {/* Section links */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <Link
            href="/explore"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors hover:bg-white/10"
            style={{ color: "#D4A843" }}
          >
            Explore
          </Link>
          {links.map(({ label, id }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
