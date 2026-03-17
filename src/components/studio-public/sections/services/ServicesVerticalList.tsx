import type { SectionSharedProps } from "../../ConfigRenderer";

export function ServicesVerticalList({ content, studio, services }: SectionSharedProps) {
  const { eyebrow = "Services", headline = "What We Offer", showDescriptions = true } = content;
  const A = "var(--studio-accent)";
  const slug = studio.slug;

  return (
    <section className="py-24 px-6" id="services">
      <div className="max-w-4xl mx-auto">
        <div className="mb-14">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>
          )}
          <h2 className="font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{headline}</h2>
        </div>
        <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {services.map((s, i) => (
            <div key={i} className="py-7 flex flex-col sm:flex-row sm:items-start gap-4 group">
              <span className="text-xs font-bold uppercase tracking-widest mt-1 shrink-0 w-8" style={{ color: A }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <p className="font-bold text-lg mb-2">{s.name}</p>
                {showDescriptions && s.description && (
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{s.description}</p>
                )}
              </div>
              <a
                href={`/${slug}/intake`}
                className="text-xs font-bold no-underline opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1"
                style={{ color: A }}
              >
                Book →
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
