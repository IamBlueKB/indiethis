import { create } from "zustand";

export type AudioTrack = {
  id: string;
  title: string;
  artist: string;
  src: string;
  coverArt?: string;
  duration?: number;
};

type AudioState = {
  currentTrack: AudioTrack | null;
  queue: AudioTrack[];
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  isMinimized: boolean;
  /** Non-null when a seek has been requested externally. AudioPlayer clears it after seeking. */
  pendingSeek: number | null;
};

type AudioActions = {
  play: (track: AudioTrack) => void;
  /** Play a track and load its siblings into the queue for next/prev navigation. */
  playInContext: (track: AudioTrack, context: AudioTrack[]) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  /** Seek to an absolute position in seconds. AudioPlayer watches pendingSeek to act on it. */
  seekTo: (seconds: number) => void;
  clearPendingSeek: () => void;
  addToQueue: (track: AudioTrack) => void;
  clearQueue: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  toggleMute: () => void;
  toggleMinimize: () => void;
};

export const useAudioStore = create<AudioState & AudioActions>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  isMuted: false,
  isMinimized: false,
  pendingSeek: null,

  play: (track) => set({ currentTrack: track, isPlaying: true, currentTime: 0 }),

  playInContext: (track, context) =>
    set({ currentTrack: track, queue: context, isPlaying: true, currentTime: 0 }),
  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),
  stop: () => set({ currentTrack: null, isPlaying: false, currentTime: 0 }),

  next: () => {
    const { queue, currentTrack } = get();
    const idx = queue.findIndex((t) => t.id === currentTrack?.id);
    const next = queue[idx + 1];
    if (next) set({ currentTrack: next, isPlaying: true, currentTime: 0 });
  },

  prev: () => {
    const { queue, currentTrack, currentTime } = get();
    if (currentTime > 3) return set({ currentTime: 0 });
    const idx = queue.findIndex((t) => t.id === currentTrack?.id);
    const prev = queue[idx - 1];
    if (prev) set({ currentTrack: prev, isPlaying: true, currentTime: 0 });
  },

  seekTo: (seconds) =>
    set((state) => ({
      pendingSeek: Math.max(0, Math.min(seconds, state.duration)),
      currentTime: Math.max(0, Math.min(seconds, state.duration)),
    })),

  clearPendingSeek: () => set({ pendingSeek: null }),

  addToQueue: (track) =>
    set((state) => ({
      queue: state.queue.some((t) => t.id === track.id)
        ? state.queue
        : [...state.queue, track],
    })),

  clearQueue: () => set({ queue: [] }),
  setVolume: (volume) => set({ volume }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),
}));
