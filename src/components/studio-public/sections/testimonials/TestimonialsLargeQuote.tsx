"use client";

import { useState, useEffect, useCallback } from "react";
import { Quote } from "lucide-react";
import type { SectionSharedProps } from "../../ConfigRenderer";

export function TestimonialsLargeQuote({ content, testimonials, accent }: SectionSharedProps) {
  const { eyebrow = "What Artists Say", headline = "Testimonials" } = content;
  const A = "var(--studio-accent)";
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  const go = useCallback((next: number) => {
    setVisible(false);
    setTimeout(() => { setIdx(next); setVisible(true); }, 300);
  }, []);

  useEffect(() => {
    if (testimonials.length <= 1) return;
    const t = setInterval(() => { go((idx + 1) % testimonials.length); }, 6000);
    return () => clearInterval(t);
  }, [idx, go, testimonials.length]);

  if (!testimonials.length) return null;
  const featured = testimonials[idx];
  const rest = testimonials.filter((_, i) => i !== idx);

  return (
    <section className="py-24 px-6" style={{ backgroundColor: "#0d0d0d" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>
          )}
          <h2 className="font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{headline}</h2>
        </div>

        <div
          className="relative rounded-2xl p-10 md:p-16 border mb-8 text-center overflow-hidden cursor-pointer"
          style={{ backgroundColor: "#111", borderColor: "rgba(255,255,255,0.07)" }}
          onClick={() => go((idx + 1) % testimonials.length)}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse 60% 80% at 50% 50%, ${accent}0c 0%, transparent 70%)` }}
          />
          <div
            className="absolute top-6 left-8 select-none pointer-events-none"
            style={{ fontSize: "8rem", lineHeight: 1, color: A, opacity: 0.06, fontFamily: "Georgia, serif" }}
            aria-hidden
          >
            &ldquo;
          </div>
          <div className="transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }}>
            <blockquote
              className="relative text-xl md:text-2xl font-medium leading-relaxed mb-8"
              style={{ color: "rgba(255,255,255,0.85)", fontStyle: "italic" }}
            >
              &ldquo;{featured.quote}&rdquo;
            </blockquote>
            <p className="relative font-bold" style={{ color: A }}>{featured.author}</p>
            {featured.track && (
              <p className="relative text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{featured.track}</p>
            )}
          </div>
          {testimonials.length > 1 && (
            <p className="relative text-xs mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>
              {idx + 1} / {testimonials.length} — click to advance
            </p>
          )}
        </div>

        {rest.length > 0 && (
          <div className="grid md:grid-cols-3 gap-5">
            {rest.slice(0, 3).map((t, i) => (
              <div
                key={i}
                className="rounded-2xl p-6 border flex flex-col gap-4"
                style={{ backgroundColor: "#111", borderColor: "rgba(255,255,255,0.07)" }}
              >
                <Quote size={18} style={{ color: A, opacity: 0.5 }} />
                <p className="text-sm leading-relaxed flex-1" style={{ color: "rgba(255,255,255,0.65)", fontStyle: "italic" }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="font-bold text-sm">{t.author}</p>
                  {t.track && <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{t.track}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
