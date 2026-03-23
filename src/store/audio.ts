import { create } from "zustand";
import { getSharedMedia, toAbsoluteUrl } from "@/lib/audio-unlock";

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
  /** Load a track into the player (shows in MiniPlayer) without starting playback. */
  load: (track: AudioTrack, queue?: AudioTrack[]) => void;
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
  /** Explicitly set muted state (vs. toggling). */
  setMuted: (muted: boolean) => void;
  toggleMinimize: () => void;
};

/**
 * Prepare the shared audio element synchronously within a user-gesture
 * callstack. This is the key to mobile autoplay: the element is touched
 * (src set + play called) before any async work happens, so the browser
 * considers it user-activated. WaveSurfer later receives the same element
 * via the `media` option and continues playing without re-triggering the
 * policy check.
 */
function unlockMedia(src: string, volume: number): void {
  if (typeof window === "undefined") return;
  const absoluteSrc = toAbsoluteUrl(src);
  const media = getSharedMedia();
  media.volume = volume;
  media.src = absoluteSrc;
  media.play().catch(() => {
    // Blocked even synchronously (e.g. data-saver mode) — AudioPlayer's
    // resume() path (direct tap on MiniPlayer ▶) will still work.
  });
}

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

  play: (track) => {
    const { volume, isMuted } = get();
    // Normalise src to absolute so WaveSurfer's setSrc() comparison matches
    // and skips resetting the already-activated media element.
    const src =
      typeof window !== "undefined" ? toAbsoluteUrl(track.src) : track.src;
    unlockMedia(src, isMuted ? 0 : volume);
    set({ currentTrack: { ...track, src }, isPlaying: true, currentTime: 0 });
  },

  playInContext: (track, context) => {
    const { volume, isMuted } = get();
    const src =
      typeof window !== "undefined" ? toAbsoluteUrl(track.src) : track.src;
    unlockMedia(src, isMuted ? 0 : volume);
    set({
      currentTrack: { ...track, src },
      queue: context,
      isPlaying: true,
      currentTime: 0,
    });
  },

  load: (track, queue) =>
    set({ currentTrack: track, queue: queue ?? [track], isPlaying: false, currentTime: 0 }),

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
  setMuted: (muted) => set({ isMuted: muted }),
  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),
}));
