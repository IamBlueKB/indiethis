"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback } from "react";

type Props = {
  images: string[];
  accent: string;
};

export function GalleryCarousel({ images, accent }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (images.length === 0) return null;

  return (
    <div className="relative">
      <div ref={emblaRef} className="overflow-hidden rounded-2xl">
        <div className="flex gap-3">
          {images.map((url, i) => (
            <div key={i} className="flex-[0_0_80%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%]">
              <img
                src={url}
                alt={`Gallery ${i + 1}`}
                className="w-full h-72 object-cover rounded-2xl"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3 mt-5 justify-end">
        <button
          onClick={scrollPrev}
          className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors hover:border-current"
          style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={scrollNext}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: accent, color: "#080808" }}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
