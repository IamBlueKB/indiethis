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
  plays?: number;
  artist: {
    id: string;
    name: string;
    artistSlug: string | null;
    artistSite?: { isPublished: boolean } | null;
  };
};

type ExpandedCardStore = {
  // Canvas video — which card's canvas is playing right now
  activeCanvasId: string | null;
  setActiveCanvas: (id: string | null) => void;

  // Expanded card — the card showing full detail
  expandedId: string | null;
  expandedData: TrackCardData | null;
  open: (data: TrackCardData) => void;
  close: () => void;
};

export const useExpandedCard = create<ExpandedCardStore>((set) => ({
  activeCanvasId: null,
  setActiveCanvas: (id) => set({ activeCanvasId: id }),

  expandedId: null,
  expandedData: null,
  open: (data) => set({ expandedId: data.id, expandedData: data }),
  close: () => set({ expandedId: null, expandedData: null }),
}));
