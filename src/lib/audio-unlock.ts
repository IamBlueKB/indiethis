/**
 * audio-unlock.ts
 *
 * Provides a single shared HTMLAudioElement that is touched synchronously
 * inside every user-gesture callstack that triggers audio playback.
 *
 * Mobile browsers (iOS Safari, Chrome Android) block async audio.play()
 * calls that happen inside WaveSurfer's "ready" callback (which fires after
 * a network fetch — well outside the gesture window). By:
 *   1. Setting media.src = url  \
 *   2. Calling media.play()      } synchronously in the event handler
 *   3. Passing the SAME element to WaveSurfer via the `media` option
 *
 * ...WaveSurfer picks up the already-unlocked element. Its setSrc() early-
 * returns when it sees the src is unchanged, so it never pauses/resets the
 * element. Audio plays immediately on tap/click.
 */

let _media: HTMLAudioElement | null = null;

/** Return (or create) the shared audio element. Client-side only. */
export function getSharedMedia(): HTMLAudioElement {
  if (!_media) {
    _media = document.createElement("audio");
    _media.preload = "auto";
  }
  return _media;
}

/**
 * Convert a URL to absolute form. Required because HTMLAudioElement.src always
 * returns an absolute URL, while WaveSurfer receives the original (possibly
 * relative) string. Normalising to absolute ensures WaveSurfer's setSrc()
 * finds a match and skips resetting the already-playing element.
 */
export function toAbsoluteUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (typeof window === "undefined") return url;
  return window.location.origin + (url.startsWith("/") ? url : "/" + url);
}
