import type { SectionSharedProps } from "../../ConfigRenderer";

export function ServicesCardGrid({ content, studio, services }: SectionSharedProps) {
  const { eyebrow = "Services & Pricing", headline = "What We Do", showDescriptions = true } = content;
  const A = "var(--studio-accent)";
  const slug = studio.slug;

  return (
    <section className="py-24 px-6" id="services">
      <div className="max-w-6xl mx-auto">
        <div className="mb-14">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>
          )}
          <h2 className="font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{headline}</h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
          {services.map((s, i) => (
            <div
              key={i}
              className="rounded-2xl p-7 border flex flex-col gap-4 group hover:border-opacity-30 transition-all"
              style={{ backgroundColor: "#0f0f0f", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <p className="font-bold text-lg">{s.name}</p>
              {showDescriptions && s.description && (
                <p className="text-sm leading-relaxed flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>{s.description}</p>
              )}
              <a
                href={`/${slug}/intake`}
                className="mt-auto text-xs font-bold no-underline opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: A }}
              >
                Book this service →
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
