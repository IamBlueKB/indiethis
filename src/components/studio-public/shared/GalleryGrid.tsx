"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  images: string[];
  accent: string;
};

export function GalleryGrid({ images, accent }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const close = useCallback(() => setLightbox(null), []);
  const prev = useCallback(() =>
    setLightbox((i) => (i === null ? null : (i - 1 + images.length) % images.length)), [images.length]);
  const next = useCallback(() =>
    setLightbox((i) => (i === null ? null : (i + 1) % images.length)), [images.length]);

  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, close, prev, next]);

  if (images.length === 0) return null;

  const [first, ...allRest] = images;
  const rest = allRest.slice(0, 3); // max 3 on the right so large image spans exactly 3 rows

  return (
    <>
      {/* Desktop grid */}
      <div
        className="hidden md:grid gap-3"
        style={{
          gridTemplateColumns: "2fr 1fr",
          gridTemplateRows: "160px 160px 160px",
        }}
      >
        {/* Primary — spans all 3 rows */}
        <img
          src={first}
          alt="Studio — 1"
          onClick={() => setLightbox(0)}
          className="object-cover rounded-2xl cursor-zoom-in transition-transform hover:scale-[1.01]"
          style={{ gridColumn: 1, gridRow: "1 / 4", width: "100%", height: "100%", minHeight: 0 }}
        />
        {/* Secondaries — each takes one row in column 2 */}
        {rest.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`Studio — ${i + 2}`}
            onClick={() => setLightbox(i + 1)}
            className="object-cover rounded-2xl cursor-zoom-in transition-transform hover:scale-[1.01]"
            style={{ gridColumn: 2, gridRow: i + 1, width: "100%", height: "100%", minHeight: 0 }}
          />
        ))}
      </div>

      {/* Mobile — vertical stack */}
      <div className="flex flex-col gap-3 md:hidden">
        {images.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`Studio — ${i + 1}`}
            onClick={() => setLightbox(i)}
            className="w-full object-cover rounded-2xl cursor-zoom-in"
            style={{ aspectRatio: "4/3" }}
          />
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
          onClick={close}
        >
          {/* Close */}
          <button
            onClick={close}
            className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center border transition-colors hover:border-white/40"
            style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
          >
            <X size={18} />
          </button>

          {/* Prev */}
          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 w-11 h-11 rounded-full flex items-center justify-center border transition-colors hover:border-white/40"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {/* Image */}
          <img
            src={images[lightbox]}
            alt={`Studio — ${lightbox + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl"
            style={{ boxShadow: `0 0 80px rgba(0,0,0,0.6)` }}
          />

          {/* Next */}
          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-4 w-11 h-11 rounded-full flex items-center justify-center transition-colors"
              style={{ backgroundColor: accent, color: "#080808" }}
            >
              <ChevronRight size={20} />
            </button>
          )}

          {/* Counter */}
          <p className="absolute bottom-5 text-xs font-bold tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
            {lightbox + 1} / {images.length}
          </p>
        </div>
      )}
    </>
  );
}
