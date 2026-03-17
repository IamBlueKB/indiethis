"use client";

import { useState, useEffect, useCallback } from "react";
import { Quote, ChevronLeft, ChevronRight } from "lucide-react";
import type { SectionSharedProps } from "../../ConfigRenderer";

export function TestimonialsCarousel({ content, testimonials }: SectionSharedProps) {
  const { eyebrow = "What Artists Say", headline = "Testimonials" } = content;
  const A = "var(--studio-accent)";
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  const go = useCallback((next: number) => {
    setVisible(false);
    setTimeout(() => { setIdx(next); setVisible(true); }, 220);
  }, []);

  const prev = () => go((idx - 1 + testimonials.length) % testimonials.length);
  const next = () => go((idx + 1) % testimonials.length);

  useEffect(() => {
    if (testimonials.length <= 1) return;
    const t = setInterval(() => { go((idx + 1) % testimonials.length); }, 5000);
    return () => clearInterval(t);
  }, [idx, go, testimonials.length]);

  if (!testimonials.length) return null;
  const t = testimonials[idx];

  return (
    <section className="py-24 px-6" style={{ backgroundColor: "#0d0d0d" }}>
      <div className="max-w-3xl mx-auto text-center">
        <div className="mb-14">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>
          )}
          <h2 className="font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{headline}</h2>
        </div>

        <div className="relative" style={{ minHeight: 180 }}>
          <div className="transition-opacity duration-200 px-12" style={{ opacity: visible ? 1 : 0 }}>
            <Quote size={32} className="mx-auto mb-6" style={{ color: A, opacity: 0.5 }} />
            <blockquote
              className="text-xl md:text-2xl font-medium leading-relaxed mb-8"
              style={{ color: "rgba(255,255,255,0.85)", fontStyle: "italic" }}
            >
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <p className="font-bold" style={{ color: A }}>{t.author}</p>
            {t.track && <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{t.track}</p>}
          </div>

          {testimonials.length > 1 && (
            <>
              <button
                className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center border transition-colors hover:border-white/40"
                style={{ borderColor: "rgba(255,255,255,0.18)", color: "#FAFAFA" }}
                onClick={prev} aria-label="Previous"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center border transition-colors hover:border-white/40"
                style={{ borderColor: "rgba(255,255,255,0.18)", color: "#FAFAFA" }}
                onClick={next} aria-label="Next"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>

        {testimonials.length > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ backgroundColor: i === idx ? A : "rgba(255,255,255,0.2)" }}
                aria-label={`Go to ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
