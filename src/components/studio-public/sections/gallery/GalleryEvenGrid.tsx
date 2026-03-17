"use client";

import { Lightbox, useLightbox } from "../../shared/Lightbox";
import type { SectionSharedProps } from "../../ConfigRenderer";

function limitImages(studio: any, raw: string[]) {
  return raw.slice(0, studio.studioTier === "ELITE" ? 12 : 6);
}

export function GalleryEvenGrid({ content, studio, galleryImages: rawImages }: SectionSharedProps) {
  const { eyebrow = "Inside the Studio", headline = "The Space" } = content;
  const A = "var(--studio-accent)";
  const images = limitImages(studio, rawImages);
  const lb = useLightbox(images);

  if (!images.length) return null;

  return (
    <section className="py-24 px-6">
      {lb.activeIdx !== null && (
        <Lightbox images={images} index={lb.activeIdx} onClose={lb.close} onPrev={lb.prev} onNext={lb.next} />
      )}
      <div className="max-w-6xl mx-auto">
        <div className="mb-14">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>}
          <h2 className="font-bold" style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}>{headline}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`Studio photo ${i + 1}`}
              className="rounded-2xl object-cover w-full aspect-square cursor-pointer transition-opacity hover:opacity-90"
              onClick={() => lb.open(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
