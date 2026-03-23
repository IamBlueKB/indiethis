import MiniPlayer from "@/components/audio/MiniPlayer";
import type { ReactNode } from "react";

export default function BeatsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <MiniPlayer />
    </>
  );
}
