/**
 * smart-links.ts
 *
 * Device detection + streaming platform ordering for the artist public page.
 * No configuration required — reordering is automatic based on UA.
 *
 * Priority rules:
 *   iOS (iPhone / iPad)  → Apple Music first, Spotify second
 *   Android              → Spotify first, Apple Music second
 *   Desktop / unknown    → original insertion order (Spotify → Apple → YouTube → SoundCloud)
 */

// ─── Device type ──────────────────────────────────────────────────────────────

export type DeviceType = "ios" | "android" | "desktop";

/**
 * Detect the visitor's device from navigator.userAgent.
 * Returns "desktop" in SSR environments where navigator is unavailable.
 */
export function detectDevice(): DeviceType {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

// ─── Platform descriptor ──────────────────────────────────────────────────────

export type StreamingLink = {
  /** Stable key used as React key and for sort priority lookup. */
  key: "spotify" | "apple" | "youtube" | "soundcloud";
  label: string;
  href: string;
  bg: string;
  color: string;
};

// ─── Priority tables ──────────────────────────────────────────────────────────

const IOS_PRIORITY: Record<StreamingLink["key"], number> = {
  apple:      0,   // Apple Music first on iPhone/iPad
  spotify:    1,
  youtube:    2,
  soundcloud: 3,
};

const ANDROID_PRIORITY: Record<StreamingLink["key"], number> = {
  spotify:    0,   // Spotify first on Android
  apple:      1,
  youtube:    2,
  soundcloud: 3,
};

const DESKTOP_PRIORITY: Record<StreamingLink["key"], number> = {
  spotify:    0,
  apple:      1,
  youtube:    2,
  soundcloud: 3,
};

// ─── Ordering function ────────────────────────────────────────────────────────

/**
 * Returns a new array of StreamingLink objects sorted by device priority.
 * The original array is not mutated.
 */
export function orderByDevice(links: StreamingLink[], device: DeviceType): StreamingLink[] {
  const table =
    device === "ios"     ? IOS_PRIORITY :
    device === "android" ? ANDROID_PRIORITY :
                           DESKTOP_PRIORITY;

  return [...links].sort((a, b) => table[a.key] - table[b.key]);
}

// ─── Builder helper ───────────────────────────────────────────────────────────

/**
 * Build the ordered StreamingLink array from nullable artist URL fields.
 * Only platforms that have a URL are included. Order is determined by device.
 */
export function buildStreamingLinks(
  {
    spotifyUrl,
    appleMusicUrl,
    youtubeChannel,
    soundcloudUrl,
  }: {
    spotifyUrl?:    string | null;
    appleMusicUrl?: string | null;
    youtubeChannel?: string | null;
    soundcloudUrl?: string | null;
  },
  device: DeviceType,
): StreamingLink[] {
  const candidates: StreamingLink[] = [
    spotifyUrl    ? { key: "spotify",    label: "Spotify",     href: spotifyUrl,    bg: "#1DB954", color: "#000" } : null,
    appleMusicUrl ? { key: "apple",      label: "Apple Music", href: appleMusicUrl, bg: "#FA243C", color: "#fff" } : null,
    youtubeChannel ? { key: "youtube",  label: "YouTube",     href: youtubeChannel, bg: "#FF0000", color: "#fff" } : null,
    soundcloudUrl ? { key: "soundcloud", label: "SoundCloud", href: soundcloudUrl,  bg: "#FF5500", color: "#fff" } : null,
  ].filter((x): x is StreamingLink => x !== null);

  return orderByDevice(candidates, device);
}
