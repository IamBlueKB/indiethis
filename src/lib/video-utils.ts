/**
 * video-utils.ts
 *
 * URL parsing helpers for the artist video section.
 * Supports YouTube, Vimeo, and direct video file URLs.
 */

export type VideoType = "youtube" | "vimeo" | "direct";

export type ParsedVideo = {
  type:         VideoType;
  /** Video platform ID (null for direct file URLs). */
  videoId:      string | null;
  /** Ready-to-use thumbnail URL. Null for Vimeo (fetched client-side) and direct files. */
  thumbnailUrl: string | null;
  /** src used inside the lazy-loaded iframe / video element. */
  embedUrl:     string;
  /** The raw URL the artist entered. */
  originalUrl:  string;
};

// ─── YouTube ──────────────────────────────────────────────────────────────────
// Handles:
//   https://www.youtube.com/watch?v=VIDEO_ID
//   https://youtu.be/VIDEO_ID
//   https://www.youtube.com/shorts/VIDEO_ID
//   https://www.youtube.com/embed/VIDEO_ID

const YT_REGEX =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function parseYouTube(url: string): ParsedVideo | null {
  const match = url.match(YT_REGEX);
  if (!match) return null;
  const videoId = match[1];
  return {
    type:         "youtube",
    videoId,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    embedUrl:     `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`,
    originalUrl:  url,
  };
}

// ─── Vimeo ────────────────────────────────────────────────────────────────────
// Handles:
//   https://vimeo.com/VIDEO_ID
//   https://player.vimeo.com/video/VIDEO_ID
//   https://vimeo.com/channels/staff/VIDEO_ID (channel pages)

const VIMEO_REGEX = /vimeo\.com\/(?:video\/|channels\/\w+\/)?(\d+)/;

function parseVimeo(url: string): ParsedVideo | null {
  const match = url.match(VIMEO_REGEX);
  if (!match) return null;
  const videoId = match[1];
  return {
    type:         "vimeo",
    videoId,
    thumbnailUrl: null, // fetched client-side via Vimeo oEmbed
    embedUrl:     `https://player.vimeo.com/video/${videoId}?autoplay=1`,
    originalUrl:  url,
  };
}

// ─── Direct video file ────────────────────────────────────────────────────────

const DIRECT_REGEX = /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i;

function parseDirect(url: string): ParsedVideo | null {
  if (!DIRECT_REGEX.test(url)) return null;
  return {
    type:         "direct",
    videoId:      null,
    thumbnailUrl: null,
    embedUrl:     url,
    originalUrl:  url,
  };
}

// ─── Public parser ────────────────────────────────────────────────────────────

/**
 * Parse a raw video URL into a structured descriptor.
 * Returns null if the URL is not a recognised video format.
 */
export function parseVideoUrl(url: string): ParsedVideo | null {
  const trimmed = url.trim();
  return parseYouTube(trimmed) ?? parseVimeo(trimmed) ?? parseDirect(trimmed);
}

/**
 * Returns a human-readable platform label for a given video type.
 */
export function videoPlatformLabel(type: VideoType): string {
  switch (type) {
    case "youtube": return "YouTube";
    case "vimeo":   return "Vimeo";
    case "direct":  return "Video";
  }
}
