"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export function Lightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.96)" }}
      onClick={onClose}
    >
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center border transition-colors hover:border-white/40"
        style={{ borderColor: "rgba(255,255,255,0.18)", color: "#FAFAFA" }}
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
      >
        <ChevronLeft size={22} />
      </button>

      <img
        src={images[index]}
        alt={`Photo ${index + 1}`}
        className="max-h-[88vh] max-w-[88vw] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center border transition-colors hover:border-white/40"
        style={{ borderColor: "rgba(255,255,255,0.18)", color: "#FAFAFA" }}
        onClick={(e) => { e.stopPropagation(); onNext(); }}
      >
        <ChevronRight size={22} />
      </button>

      <button
        className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center border transition-colors hover:border-white/40"
        style={{ borderColor: "rgba(255,255,255,0.18)", color: "#FAFAFA" }}
        onClick={onClose}
      >
        <X size={18} />
      </button>

      <p
        className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs font-bold"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        {index + 1} / {images.length}
      </p>
    </div>
  );
}

export function useLightbox(images: string[]) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const open = (i: number) => setActiveIdx(i);
  const close = () => setActiveIdx(null);
  const prev = () => setActiveIdx((i) => i !== null ? (i - 1 + images.length) % images.length : 0);
  const next = () => setActiveIdx((i) => i !== null ? (i + 1) % images.length : 0);
  return { activeIdx, open, close, prev, next };
}
