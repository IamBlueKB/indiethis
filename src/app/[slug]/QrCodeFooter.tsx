"use client";

import { useState } from "react";

export default function QrCodeFooter({
  artistSlug,
}: {
  artistSlug: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const src = `/api/public/artist-qr/${artistSlug}?format=png&size=200`;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Scan to save"
        width={80}
        height={80}
        onLoad={() => setLoaded(true)}
        className={`rounded-xl transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      />
      {loaded && (
        <p className="text-[10px] text-white/25 tracking-wide">Scan to save</p>
      )}
    </div>
  );
}
