/**
 * useA11yAnnounce — module-level pub/sub for screen-reader announcements
 * driven by the studio's <A11yLiveRegion /> (step 31).
 *
 * Pattern: a singleton subscriber list. `announce("Vocal Main muted")`
 * pushes the string to every active listener; the live region listens
 * once and updates its text content, which triggers an aria-live polite
 * announcement.
 *
 * Why a singleton (not React context)? The producers are scattered across
 * many useEffects and event handlers in StudioClient. A plain export keeps
 * the wiring tiny — no provider, no .Consumer / .Provider boilerplate.
 */

type Listener = (msg: string) => void;

const listeners = new Set<Listener>();

/** Announce a message to every mounted live region. */
export function announce(message: string): void {
  if (!message) return;
  for (const fn of listeners) {
    try { fn(message); } catch { /* noop */ }
  }
}

/** Subscribe to announcements. Returns an unsubscribe function. */
export function subscribeAnnouncements(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Hook wrapper — components call `useA11yAnnounce()` to get the announcer. */
export function useA11yAnnounce(): (message: string) => void {
  return announce;
}
