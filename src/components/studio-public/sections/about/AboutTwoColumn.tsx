import { HoursBlock, PhotoStack } from "./_helpers";
import type { SectionSharedProps } from "../../ConfigRenderer";

export function AboutTwoColumn({ content, studio, accent, galleryImages }: SectionSharedProps) {
  const { eyebrow = "Our Story", headline = "About the Studio", bio, showHours = true } = content;
  const A = "var(--studio-accent)";
  const displayBio = bio || studio.bio || studio.description;

  return (
    <section className="py-24 px-6" style={{ backgroundColor: "#0d0d0d" }}>
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <div>
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>}
          <h2 className="font-bold mb-6" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>{headline}</h2>
          {displayBio && (
            <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.85 }}>
              {displayBio}
            </p>
          )}
          {showHours && <HoursBlock studio={studio} accent={accent} />}
        </div>
        <PhotoStack images={galleryImages} />
      </div>
    </section>
  );
}
