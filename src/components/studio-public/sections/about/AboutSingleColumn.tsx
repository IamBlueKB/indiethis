import { HoursBlock } from "./_helpers";
import type { SectionSharedProps } from "../../ConfigRenderer";

export function AboutSingleColumn({ content, studio, accent, galleryImages }: SectionSharedProps) {
  const { eyebrow = "About", headline = "About the Studio", bio, showHours = true } = content;
  const A = "var(--studio-accent)";
  const displayBio = bio || studio.bio || studio.description;

  return (
    <section className="py-24 px-6" style={{ backgroundColor: "#0d0d0d" }}>
      <div className="max-w-3xl mx-auto text-center">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>}
        <h2 className="font-bold mb-8" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{headline}</h2>
        {displayBio && (
          <p className="text-base leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.85 }}>
            {displayBio}
          </p>
        )}
        {showHours && <HoursBlock studio={studio} accent={accent} />}
      </div>
    </section>
  );
}
