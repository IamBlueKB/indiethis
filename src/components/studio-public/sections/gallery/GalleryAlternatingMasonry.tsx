"use client";

import { Lightbox, useLightbox } from "../../shared/Lightbox";
import type { SectionSharedProps } from "../../ConfigRenderer";

function limitImages(studio: any, raw: string[]) {
  return raw.slice(0, studio.studioTier === "ELITE" ? 12 : 6);
}

export function GalleryAlternatingMasonry({ content, studio, galleryImages: rawImages }: SectionSharedProps) {
  const { eyebrow = "Inside the Studio", headline = "The Space" } = content;
  const A = "var(--studio-accent)";
  const images = limitImages(studio, rawImages);
  const lb = useLightbox(images);

  if (!images.length) return null;

  type Row = { images: string[]; startIdx: number; featuredFirst: boolean };
  const rows: Row[] = [];
  let idx = 0;
  let featuredFirst = true;
  while (idx < images.length) {
    rows.push({ images: images.slice(idx, idx + 3), startIdx: idx, featuredFirst });
    idx += 3;
    featuredFirst = !featuredFirst;
  }

  return (
    <section className="py-24 px-6">
      {lb.activeIdx !== null && (
        <Lightbox images={images} index={lb.activeIdx} onClose={lb.close} onPrev={lb.prev} onNext={lb.next} />
      )}
      <div className="max-w-6xl mx-auto">
        <div className="border-b mb-16 pb-12" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: A }}>{eyebrow}</p>}
          <h2 className="font-bold" style={{ fontSize: "clamp(3rem,7vw,5rem)", letterSpacing: "-0.02em" }}>{headline}</h2>
        </div>
        <div className="space-y-3">
          {rows.map((row, ri) => {
            if (row.images.length === 1) {
              return (
                <img
                  key={ri}
                  src={row.images[0]}
                  alt="Studio"
                  className="rounded-xl object-cover w-full h-64 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => lb.open(row.startIdx)}
                />
              );
            }
            const [a, b, c] = row.images;
            return (
              <div key={ri} className="grid grid-cols-3 gap-3">
                {row.featuredFirst ? (
                  <>
                    <img src={a} alt="Studio" className="col-span-2 rounded-xl object-cover w-full h-64 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => lb.open(row.startIdx)} />
                    {b && <img src={b} alt="Studio" className="rounded-xl object-cover w-full h-64 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => lb.open(row.startIdx + 1)} />}
                    {c && <img src={c} alt="Studio" className="col-span-3 rounded-xl object-cover w-full h-48 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => lb.open(row.startIdx + 2)} />}
                  </>
                ) : (
                  <>
                    {b && <img src={b} alt="Studio" className="rounded-xl object-cover w-full h-64 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => lb.open(row.startIdx + 1)} />}
                    <img src={a} alt="Studio" className="col-span-2 rounded-xl object-cover w-full h-64 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => lb.open(row.startIdx)} />
                    {c && <img src={c} alt="Studio" className="col-span-3 rounded-xl object-cover w-full h-48 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => lb.open(row.startIdx + 2)} />}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
