import { Quote } from "lucide-react";
import type { SectionSharedProps } from "../../ConfigRenderer";

export function TestimonialsStaggered({ content, testimonials }: SectionSharedProps) {
  const { eyebrow = "What Artists Say", headline = "Testimonials" } = content;
  const A = "var(--studio-accent)";

  if (!testimonials.length) return null;

  return (
    <section className="py-24 px-6" style={{ backgroundColor: "#0d0d0d" }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-14">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>
          )}
          <h2 className="font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{headline}</h2>
        </div>
        <div className="space-y-6">
          {testimonials.map((t, i) => {
            const isLeft = i % 2 === 0;
            const isLarge = i % 3 === 0;
            return (
              <div
                key={i}
                className={`rounded-2xl p-7 border flex flex-col gap-4 ${isLeft ? "ml-0 mr-auto" : "ml-auto mr-0"}`}
                style={{
                  backgroundColor: "#111",
                  borderColor: "rgba(255,255,255,0.07)",
                  maxWidth: isLarge ? "100%" : "88%",
                  textAlign: isLeft ? "left" : "right",
                }}
              >
                <div className={`flex ${isLeft ? "justify-start" : "justify-end"}`}>
                  <Quote size={isLarge ? 24 : 18} style={{ color: A, opacity: 0.55 }} />
                </div>
                <p
                  className={`leading-relaxed ${isLarge ? "text-lg" : "text-base"}`}
                  style={{ color: "rgba(255,255,255,0.75)", fontStyle: "italic" }}
                >
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="font-bold text-sm">{t.author}</p>
                  {t.track && <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{t.track}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
