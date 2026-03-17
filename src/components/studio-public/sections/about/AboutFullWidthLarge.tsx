import { HoursBlock } from "./_helpers";
import type { SectionSharedProps } from "../../ConfigRenderer";

export function AboutFullWidthLarge({ content, studio, accent, galleryImages }: SectionSharedProps) {
  const { eyebrow = "Our Story", headline = "About the Studio", bio, showHours = true } = content;
  const A = "var(--studio-accent)";
  const displayBio = bio || studio.bio || studio.description;

  return (
    <section className="py-28 px-6" style={{ backgroundColor: "#0d0d0d" }}>
      <div className="max-w-6xl mx-auto">
        <div className="border-b pb-16 mb-16" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.3em] mb-4" style={{ color: A }}>{eyebrow}</p>}
          <h2 className="font-bold" style={{ fontSize: "clamp(3rem,8vw,6rem)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            {headline}
          </h2>
        </div>
        <div className="grid md:grid-cols-[2fr_1fr] gap-16 items-start">
          <div>
            {displayBio && (
              <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.8 }}>
                {displayBio}
              </p>
            )}
          </div>
          <div>
            {showHours && <HoursBlock studio={studio} accent={accent} />}
            {galleryImages.length > 0 && (
              <img
                src={galleryImages[0]}
                alt="Studio"
                className="rounded-2xl object-cover w-full mt-6"
                style={{ maxHeight: 320 }}
              />
            )}
          </div>
        </div>
        {galleryImages.length > 1 && (
          <div className="grid grid-cols-3 gap-3 mt-12">
            {galleryImages.slice(1, 4).map((url, i) => (
              <img key={i} src={url} alt="Studio" className="rounded-xl object-cover w-full h-36" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
