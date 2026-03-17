"use client";

import { Lightbox, useLightbox } from "../../shared/Lightbox";
import type { SectionSharedProps } from "../../ConfigRenderer";

function limitImages(studio: any, raw: string[]) {
  return raw.slice(0, studio.studioTier === "ELITE" ? 12 : 6);
}

export function GalleryAsymmetricGrid({ content, studio, galleryImages: rawImages }: SectionSharedProps) {
  const { eyebrow = "Inside the Studio", headline = "The Space" } = content;
  const A = "var(--studio-accent)";
  const images = limitImages(studio, rawImages);
  const lb = useLightbox(images);

  if (!images.length) return null;

  const featured = images[0];
  const stacked = images.slice(1, 3);
  const rest = images.slice(3);

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

        <div className="grid grid-cols-3 gap-3" style={{ height: 500 }}>
          <img
            src={featured}
            alt="Studio"
            className="col-span-2 h-full w-full object-cover rounded-2xl cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => lb.open(0)}
          />
          <div className="flex flex-col gap-3 h-full">
            {stacked.map((url, i) => (
              <img
                key={i}
                src={url}
                alt="Studio"
                className="flex-1 w-full object-cover rounded-2xl cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => lb.open(i + 1)}
              />
            ))}
            {stacked.length === 0 && <div className="flex-1 rounded-2xl" style={{ backgroundColor: "#111" }} />}
          </div>
        </div>

        {rest.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            {rest.map((url, i) => (
              <img
                key={i}
                src={url}
                alt="Studio"
                className="rounded-2xl object-cover w-full h-48 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => lb.open(i + 3)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
