"use client";

import { useState, useEffect } from "react";
import type { SectionSharedProps } from "../ConfigRenderer";

export function StudioNav({ studio, slug }: Pick<SectionSharedProps, "studio" | "slug">) {
  const [scrolled, setScrolled] = useState(false);
  const A = "var(--studio-accent)";
  const logo = studio.logoUrl ?? studio.logo;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? "rgba(10,10,10,0.9)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href={`/${slug}`} className="flex items-center gap-3 no-underline">
          {logo && (
            <img src={logo} alt={studio.name} className="w-7 h-7 object-contain rounded-lg opacity-90" />
          )}
          <span className="font-bold text-sm">{studio.name}</span>
        </a>
        <div className="flex items-center gap-5">
          <a href="#services" className="text-xs font-semibold no-underline transition-opacity hover:opacity-70" style={{ color: "rgba(255,255,255,0.6)" }}>
            Services
          </a>
          <a href="#contact" className="text-xs font-semibold no-underline transition-opacity hover:opacity-70" style={{ color: "rgba(255,255,255,0.6)" }}>
            Contact
          </a>
          <a
            href={`/${slug}/intake`}
            className="px-4 py-2 rounded-lg text-xs font-bold no-underline hover:opacity-90 transition-opacity"
            style={{ backgroundColor: A, color: "#0A0A0A" }}
          >
            Book Now
          </a>
        </div>
      </div>
    </nav>
  );
}
