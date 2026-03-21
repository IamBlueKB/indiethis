"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Photo = {
  id:       string;
  imageUrl: string;
  caption:  string | null;
};

export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const close = useCallback(() => setLightboxIndex(null), []);

  const prev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);

  const next = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")     close();
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, close, prev, next]);

  if (photos.length === 0) return null;

  return (
    <section>
      {/* Section labels */}
      <p
        className="text-[10px] font-bold uppercase mb-[5px]"
        style={{ color: "#D4A843", letterSpacing: "1.5px" }}
      >
        GALLERY
      </p>
      <h2 className="text-[18px] font-semibold text-white leading-tight mb-3">Photos</h2>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => setLightboxIndex(i)}
            className="relative overflow-hidden rounded-[6px] focus:outline-none group"
            style={{ height: 80 }}
            aria-label={photo.caption ?? `Photo ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.imageUrl}
              alt={photo.caption ?? ""}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.90)" }}
          onClick={close}
        >
          {/* Stop click propagation on content so backdrop click closes */}
          <div
            className="relative flex items-center justify-center w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={close}
              className="absolute top-4 right-4 z-10 flex items-center justify-center rounded-full"
              style={{
                width:           36,
                height:          36,
                backgroundColor: "rgba(255,255,255,0.10)",
                color:           "#fff",
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {/* Prev */}
            {photos.length > 1 && (
              <button
                onClick={prev}
                className="absolute left-4 flex items-center justify-center rounded-full"
                style={{
                  width:           40,
                  height:          40,
                  backgroundColor: "rgba(255,255,255,0.10)",
                  color:           "#fff",
                }}
                aria-label="Previous"
              >
                <ChevronLeft size={22} />
              </button>
            )}

            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[lightboxIndex].imageUrl}
              alt={photos[lightboxIndex].caption ?? ""}
              className="max-h-screen max-w-full object-contain"
              style={{ maxHeight: "90vh", maxWidth: "90vw" }}
            />

            {/* Caption */}
            {photos[lightboxIndex].caption && (
              <p
                className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-xs text-white/60 px-4"
                style={{ maxWidth: 320 }}
              >
                {photos[lightboxIndex].caption}
              </p>
            )}

            {/* Next */}
            {photos.length > 1 && (
              <button
                onClick={next}
                className="absolute right-4 flex items-center justify-center rounded-full"
                style={{
                  width:           40,
                  height:          40,
                  backgroundColor: "rgba(255,255,255,0.10)",
                  color:           "#fff",
                }}
                aria-label="Next"
              >
                <ChevronRight size={22} />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
