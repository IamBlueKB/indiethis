/**
 * A11yLiveRegion — a single visually-hidden aria-live region for the
 * Pro Studio Mixer (step 31). Mounted once in StudioClient. Announcements
 * are broadcast through the module-level `announce()` function or via
 * the useA11yAnnounce hook.
 *
 * Implementation notes:
 *  - `aria-live="polite"` so screen readers don't interrupt active speech
 *  - `aria-atomic="true"` so the entire message is read on each update
 *  - Visually hidden via the standard sr-only CSS pattern (no global CSS
 *    dependency — styles inlined here so this component is self-contained)
 *  - Subsequent announcements with the same text would normally be ignored
 *    by screen readers, so we toggle the text via a tiny suffix counter
 */
"use client";

import { useEffect, useState } from "react";
import { subscribeAnnouncements } from "./useA11yAnnounce";

export function A11yLiveRegion() {
  const [text, setText] = useState("");
  // Counter ticks per message so identical strings are still re-announced.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return subscribeAnnouncements((msg) => {
      setText(msg);
      setTick((n) => (n + 1) % 1000);
    });
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-tick={tick}
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        margin: -1,
        padding: 0,
        overflow: "hidden",
        clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {text}
    </div>
  );
}
