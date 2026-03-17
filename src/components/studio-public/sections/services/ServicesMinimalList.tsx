"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SectionSharedProps } from "../../ConfigRenderer";

export function ServicesMinimalList({ content, studio, services }: SectionSharedProps) {
  const { eyebrow = "Services", headline = "What We Offer" } = content;
  const A = "var(--studio-accent)";
  const slug = studio.slug;
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const toggle = (i: number) => setOpenIdx((prev) => (prev === i ? null : i));

  return (
    <section className="py-24 px-6" id="services">
      <div className="max-w-6xl mx-auto grid md:grid-cols-[1fr_2fr] gap-16 items-start">
        <div>
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>
          )}
          <h2 className="font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{headline}</h2>
        </div>
        <div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            {services.map((s, i) => (
              <div key={i}>
                <button
                  className="w-full py-5 flex items-center gap-3 text-left group"
                  onClick={() => toggle(i)}
                  aria-expanded={openIdx === i}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors" style={{ backgroundColor: A }} />
                  <p className="font-semibold flex-1">{s.name}</p>
                  {s.description && (
                    <ChevronDown
                      size={16}
                      className="shrink-0 transition-transform duration-200"
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        transform: openIdx === i ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  )}
                </button>
                {s.description && openIdx === i && (
                  <div className="pb-5 pl-4">
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{s.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <a
            href={`/${slug}/intake`}
            className="inline-block mt-10 px-8 py-3 rounded-xl font-bold text-sm no-underline hover:opacity-90 transition-opacity"
            style={{ backgroundColor: A, color: "#0A0A0A" }}
          >
            Book a Session →
          </a>
        </div>
      </div>
    </section>
  );
}
