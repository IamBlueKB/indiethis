import { create } from "zustand";

export type TrackCardData = {
  id: string;
  title: string;
  coverArtUrl: string | null;
  canvasVideoUrl?: string | null;
  fileUrl: string;
  genre: string | null;
  bpm: number | null;
  musicalKey: string | null;
  mood?: string | null;
  plays?: number;
  artist: {
    id: string;
    name: string;
    artistSlug: string | null;
    artistSite?: { isPublished: boolean } | null;
  };
};

type OverlayStore = {
  // Canvas video — which card's canvas is currently playing
  activeCanvasId: string | null;
  setActiveCanvas: (id: string | null) => void;

  // Track detail overlay
  overlayData: TrackCardData | null;
  open: (data: TrackCardData) => void;
  close: () => void;
};

export const useExpandedCard = create<OverlayStore>((set) => ({
  activeCanvasId: null,
  setActiveCanvas: (id) => set({ activeCanvasId: id }),

  overlayData: null,
  open: (data) => set({ overlayData: data }),
  close: () => set({ overlayData: null }),
}));
