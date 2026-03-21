import type { SectionSharedProps } from "../../ConfigRenderer";

export function HeroCentered({ content, studio, accent }: SectionSharedProps) {
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
      className="relative flex flex-col items-center justify-center text-center px-6 overflow-hidden"
      style={{
        minHeight: "60vh",
        background: studio.heroImage
          ? `linear-gradient(to bottom, rgba(10,10,10,0.35) 0%, rgba(10,10,10,0.7) 60%, #0A0A0A 100%), url(${studio.heroImage}) center/cover no-repeat fixed`
          : "linear-gradient(160deg, #0f0f0f 0%, #0A0A0A 40%, #100c00 100%)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 70% 55% at 50% 40%, ${accent}0f 0%, transparent 70%)` }}
      />

      {logo && (
        <img
          src={logo}
          alt={studio.name}
          className="relative z-10 w-16 h-16 object-contain rounded-2xl mb-8 opacity-90"
        />
      )}

      {eyebrow && (
        <p className="relative z-10 text-xs font-bold uppercase tracking-[0.35em] mb-4" style={{ color: A }}>
          {eyebrow}
        </p>
      )}

      <h1
        className="relative z-10 font-bold leading-none mb-5"
        style={{ fontSize: "clamp(2.8rem, 8vw, 6.5rem)", textShadow: "0 4px 40px rgba(0,0,0,0.6)" }}
      >
        {headline || studio.name}
      </h1>

      {(tagline || studio.tagline) && (
        <p
          className="relative z-10 max-w-lg mx-auto mb-10 text-lg leading-relaxed"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          {tagline || studio.tagline}
        </p>
      )}

      <div className="relative z-10 flex flex-wrap gap-4 justify-center">
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
            style={{ borderColor: "rgba(255,255,255,0.18)", color: "#FAFAFA" }}
          >
            {ctaSecondary}
          </a>
        )}
      </div>

      {showScrollIndicator && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" style={{ opacity: 0.35 }}>
          <div className="w-px h-14" style={{ background: `linear-gradient(to bottom, transparent, ${accent})` }} />
          <p className="text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: A }}>Scroll</p>
        </div>
      )}
    </section>
  );
}
