import MiniPlayer from "@/components/audio/MiniPlayer";
import type { ReactNode } from "react";

export default function ArtistsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <MiniPlayer />
    </>
  );
}
