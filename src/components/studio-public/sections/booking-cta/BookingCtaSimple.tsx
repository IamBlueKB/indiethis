import type { SectionSharedProps } from "../../ConfigRenderer";

export function BookingCtaSimple({ content, studio }: SectionSharedProps) {
  const {
    eyebrow = "Ready to Record?",
    headline = "Book a Session",
    subtext = "Fill out our intake form and we'll confirm your booking.",
    ctaLabel = "Book a Session →",
  } = content;
  const A = "var(--studio-accent)";
  const slug = studio.slug;

  return (
    <section
      className="py-28 px-6 text-center"
      style={{ background: "linear-gradient(135deg, #130d00 0%, #0A0A0A 100%)" }}
    >
      <div className="max-w-xl mx-auto">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.3em] mb-4" style={{ color: A }}>{eyebrow}</p>
        )}
        <h2 className="font-bold mb-5" style={{ fontSize: "clamp(2.2rem,5vw,3.5rem)" }}>{headline}</h2>
        {subtext && (
          <p className="text-base mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{subtext}</p>
        )}
        <div className="flex flex-wrap gap-4 justify-center">
          <a
            href={`/${slug}/intake`}
            className="px-10 py-4 rounded-xl font-bold text-base no-underline hover:opacity-90 transition-opacity"
            style={{ backgroundColor: A, color: "#0A0A0A" }}
          >
            {ctaLabel}
          </a>
          {studio.phone && (
            <a
              href={`tel:${studio.phone}`}
              className="px-10 py-4 rounded-xl font-bold text-base no-underline border transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#FAFAFA" }}
            >
              {studio.phone}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
