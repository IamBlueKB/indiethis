import type { SectionSharedProps } from "../../ConfigRenderer";

export function BookingCtaDramatic({ content, studio, accent }: SectionSharedProps) {
  const {
    eyebrow = "Ready to Record?",
    headline = `Book Your Session\nToday`,
    subtext = "Fill out our quick intake form — we'll confirm your booking within the hour.",
    ctaLabel = "Start Your Booking →",
  } = content;
  const A = "var(--studio-accent)";
  const slug = studio.slug;
  const headlineParts = headline.split("\n");

  return (
    <section
      className="relative py-40 px-6 text-center overflow-hidden"
      style={{ background: "linear-gradient(160deg, #130d00 0%, #0A0A0A 50%, #0d0d0d 100%)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 60% 70% at 50% 50%, ${accent}14 0%, transparent 70%)` }}
      />
      <div className="relative max-w-2xl mx-auto">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.3em] mb-6" style={{ color: A }}>{eyebrow}</p>
        )}
        <h2 className="font-bold mb-6" style={{ fontSize: "clamp(2.5rem,7vw,5rem)", lineHeight: 1.1 }}>
          {headlineParts.map((line, i) => (
            <span key={i}>
              {line}
              {i < headlineParts.length - 1 && <br />}
            </span>
          ))}
        </h2>
        {subtext && (
          <p className="text-lg mb-12 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{subtext}</p>
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
              className="px-10 py-4 rounded-xl font-bold text-base no-underline border transition-colors hover:border-white/30"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#FAFAFA" }}
            >
              Call {studio.phone}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
