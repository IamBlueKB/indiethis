/**
 * Parses a YouTube, Vimeo, or direct video URL into a normalized embed shape.
 */

export interface ParsedVideo {
  type: "youtube" | "vimeo" | "direct";
  embedUrl: string;
  thumbnailUrl: string | null;
}

export function parseVideoUrl(url: string | null | undefined): ParsedVideo | null {
  if (!url) return null;

  // YouTube
  const yt =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/) ||
    url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
  if (yt) {
    const id = yt[1];
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    };
  }

  // Vimeo
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    const id = vimeo[1];
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1`,
      thumbnailUrl: null,
    };
  }

  // Direct video file
  if (/\.(mp4|mov|webm)(\?|$)/i.test(url)) {
    return {
      type: "direct",
      embedUrl: url,
      thumbnailUrl: null,
    };
  }

  return null;
}

/**
 * Detects the platform from a URL string.
 */
export function detectVideoPlatform(url: string): "youtube" | "vimeo" | "unknown" {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/vimeo\.com/.test(url)) return "vimeo";
  return "unknown";
}
