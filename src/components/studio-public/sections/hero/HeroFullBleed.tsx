import type { SectionSharedProps } from "../../ConfigRenderer";

export function HeroFullBleed({ content, studio, accent }: SectionSharedProps) {
  const {
    eyebrow,
    headline,
    tagline,
    ctaPrimary = "Book a Session",
    ctaSecondary = "View Our Work",
    showScrollIndicator = true,
  } = content;
  const A = "var(--studio-accent)";
  const slug = studio.slug;
  const logo = studio.logoUrl ?? studio.logo;

  return (
    <section
      className="relative flex flex-col justify-end px-6 pb-20 overflow-hidden"
      style={{
        minHeight: "100svh",
        background: studio.heroImage
          ? `linear-gradient(to top, #0A0A0A 0%, rgba(10,10,10,0.4) 50%, rgba(10,10,10,0.1) 100%), url(${studio.heroImage}) center/cover no-repeat fixed`
          : `linear-gradient(160deg, #151515 0%, #0A0A0A 100%)`,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 70%, ${accent}0a 0%, transparent 70%)` }}
      />

      <div className="relative max-w-6xl mx-auto w-full">
        {logo && (
          <img
            src={logo}
            alt={studio.name}
            className="w-14 h-14 object-contain rounded-xl mb-8 opacity-90"
          />
        )}

        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.35em] mb-5" style={{ color: A }}>
            {eyebrow}
          </p>
        )}

        <h1
          className="font-bold leading-none mb-6"
          style={{ fontSize: "clamp(3rem, 9vw, 7.5rem)", textShadow: "0 4px 60px rgba(0,0,0,0.8)", letterSpacing: "-0.02em" }}
        >
          {headline || studio.name}
        </h1>

        {(tagline || studio.tagline) && (
          <p className="max-w-xl mb-10 text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            {tagline || studio.tagline}
          </p>
        )}

        <div className="flex flex-wrap gap-4">
          <a
            href={`/${slug}/intake`}
            className="px-9 py-4 rounded-xl font-bold text-sm no-underline hover:opacity-90 transition-opacity"
            style={{ backgroundColor: A, color: "#0A0A0A" }}
          >
            {ctaPrimary}
          </a>
          {ctaSecondary && (
            <a
              href="#portfolio"
              className="px-9 py-4 rounded-xl font-bold text-sm no-underline border transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.18)", color: "#FAFAFA", backdropFilter: "blur(8px)" }}
            >
              {ctaSecondary}
            </a>
          )}
        </div>
      </div>

      {showScrollIndicator && (
        <div className="absolute bottom-8 right-12 flex flex-col items-center gap-2" style={{ opacity: 0.35 }}>
          <div className="w-px h-14" style={{ background: `linear-gradient(to bottom, transparent, ${accent})` }} />
          <p className="text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: A }}>Scroll</p>
        </div>
      )}
    </section>
  );
}
