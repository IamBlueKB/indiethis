import type { SectionSharedProps } from "../../ConfigRenderer";

export function HeroSplit({ content, studio, accent }: SectionSharedProps) {
  const {
    eyebrow,
    headline,
    tagline,
    ctaPrimary = "Book a Session",
    ctaSecondary = "View Our Work",
  } = content;
  const A = "var(--studio-accent)";
  const slug = studio.slug;
  const logo = studio.logoUrl ?? studio.logo;

  return (
    <section
      className="grid md:grid-cols-[3fr_2fr] min-h-screen"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      {/* Left (60%): content */}
      <div
        className="flex flex-col justify-center px-8 md:px-16 py-20 relative"
        style={{ background: "linear-gradient(160deg, #0d0d0d 0%, #0A0A0A 100%)", minHeight: "100svh" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 70% 80% at 20% 50%, ${accent}08 0%, transparent 70%)` }}
        />
        {logo && (
          <img src={logo} alt={studio.name} className="relative w-12 h-12 object-contain rounded-xl mb-10 opacity-90" />
        )}
        {eyebrow && (
          <p className="relative text-xs font-bold uppercase tracking-[0.35em] mb-5" style={{ color: A }}>
            {eyebrow}
          </p>
        )}
        <h1
          className="relative font-bold leading-tight mb-6"
          style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)" }}
        >
          {headline || studio.name}
        </h1>
        {(tagline || studio.tagline) && (
          <p className="relative max-w-sm mb-10 text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            {tagline || studio.tagline}
          </p>
        )}
        <div className="relative flex flex-wrap gap-4">
          <a
            href={`/${slug}/intake`}
            className="px-8 py-4 rounded-xl font-bold text-sm no-underline hover:opacity-90 transition-opacity"
            style={{ backgroundColor: A, color: "#0A0A0A" }}
          >
            {ctaPrimary}
          </a>
          {ctaSecondary && (
            <a
              href="#services"
              className="px-8 py-4 rounded-xl font-bold text-sm no-underline border transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#FAFAFA" }}
            >
              {ctaSecondary}
            </a>
          )}
        </div>
      </div>

      {/* Right (40%): image */}
      <div
        className="relative hidden md:block"
        style={{
          background: studio.heroImage
            ? `url(${studio.heroImage}) center/cover no-repeat`
            : "linear-gradient(160deg, #1a1a1a 0%, #0d0d0d 100%)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to left, transparent 60%, #0A0A0A 100%)" }}
        />
      </div>
    </section>
  );
}
