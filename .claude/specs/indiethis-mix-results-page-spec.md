# IndieThis — Mix Results Page Spec

_For Sonnet — New page. Reuses design DNA from mastering preview player (logo player, coral/gold palette, console stats). Do not modify mastering player. This is a separate component for the mix console results._

---

## OVERVIEW

The mix results page is where artists hear their finished mix for the first time. It must do three things: prove the mix is better than the raw input (A/B toggle), show what the engine did to each stem (transparency), and let the artist give precise feedback if something's wrong (revision markers). The page is the moment the artist decides if IndieThis is worth $59.99. Every element exists to build confidence in that decision.

---

## PAGE URL

- Subscriber: `/dashboard/ai/mix-console/[jobId]`
- Guest: `/mix-console/results?token=[accessToken]`

Both render the same component. Guest route validates the MixAccessToken before rendering.

---

## LAYOUT (TOP TO BOTTOM)

### 1. Header

Track title (from filename or metadata if available) + badges.

```
Vibe Check                          Hip-Hop · Premium
```

Left: track name in 18px, weight 500.
Right: genre badge + tier badge. Genre badge uses the gold outline pill style. Tier badge uses coral fill for Premium/Pro, grey outline for Standard.

If Beat Polish was purchased, show a small indicator below the title:

```
Beat polished — drums, bass, and melodics processed individually
```

12px, muted color. Only appears when `beatPolish: true` on the job. This tells the artist what they paid the extra $19.99 for.

---

### 2. Logo Player

**Identical to mastering preview player.** Same rounded-square shape, same coral play button (#E8735A) centered with idle pulse animation, same gold progress sweep (#D4AF37) starting from top center sweeping clockwise (6px thick).

Below the logo shape:
- Track time: `1:24 / 3:42` in 12px muted
- Play/pause state synced to audio element

Single hidden `<audio>` element drives all playback. Switching between A/B or versions changes `src` and preserves playback position.

---

### 3. Frequency Visualizer (THE CENTERPIECE)

Full-width canvas element inside a dark card (`#0D0B09` background, `border-radius: 12px`, 24px padding).

**What it shows:** Three colored lines tracing frequency band energy in real time as the audio plays. Each line has dots at each frequency band point, with one larger glowing dot that flows along the line continuously.

| Line | Color | What it represents |
|------|-------|--------------------|
| Mix output | Gold (#D4AF37) | The combined mixed signal |
| Vocals | Coral (#E8735A) | Vocal stem energy |
| Beat | Purple (#7F77DD) | Beat/instrumental energy |

**Frequency bands on X-axis (10 points):** Sub, 60Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz

**Y-axis:** Normalized energy (0-1), no visible labels. The visual shape tells the story — artists don't need dB numbers on a visualizer.

**Technical implementation:**
- Use Web Audio API `AnalyserNode` connected to the `<audio>` element
- `fftSize: 2048`, split into 10 logarithmic bands matching the X-axis labels
- Update at 60fps via `requestAnimationFrame`
- Canvas renders at 2x device pixel ratio for crisp lines on retina
- Lines are 1.5px with `lineJoin: round`
- Static dots at each band point: 2.5px radius
- Flowing dot: 5px radius with 8px radius halo at 15% opacity
- Flowing dot speed: roughly 3.5-4.5% of the line length per frame, each line at slightly different speed so they don't sync up (creates organic movement)
- Lines lerp toward target values at 0.03 rate for smooth movement, no jitter

**A/B behavior — this is the visual proof:**
- **Mixed mode:** Lines are smooth, balanced, controlled. Vocals and beat lines are well-separated in the mid-range (2-5kHz). The mix line sits as a clean sum. This shows the frequency carving worked.
- **Original mode:** Lines are messier, overlapping, unbalanced. Vocal and beat lines compete in the same frequency range (visual mud). The mix line is peaky and uneven. This is the raw stems summed at unity gain with no processing.
- When switching A/B, the lines transition smoothly (lerp over 500ms) from one state to the other. The artist sees the difference in real time — "oh, the processed version has the vocal and beat separated, the original has them fighting."

**When audio is paused:** Lines hold their last position, dots stop flowing. No animation. Clean static state.

**When audio hasn't played yet (initial state):** Show the lines at a flat neutral position (all bands at 0.3) with a subtle breathing animation (very slow, 2-3px vertical oscillation). Dots are stationary. This signals "press play to see it come alive."

**Legend:** Below the canvas, centered, 3 items with color dots + labels. 11px muted text.

```
● Mix    ● Vocals    ● Beat
```

**Revision markers on the visualizer:**
- Artist taps/clicks anywhere on the canvas during playback
- A vertical coral line drops at that X position spanning the full height of the canvas
- A small coral pill appears above the line showing the timestamp: `1:42`
- A text input appears below the canvas, pre-filled with the timestamp, cursor in the text field
- Artist types their note: "too much reverb here"
- Press Enter or tap a checkmark to confirm — marker is saved
- Multiple markers can be placed. Each appears as a coral vertical line on the canvas with its timestamp pill
- Markers persist across play/pause and A/B switching
- On mobile: long-press instead of tap (tap is for scrubbing). Haptic feedback on marker drop if available.

**Scrubbing:** Click/drag horizontally on the canvas to scrub playback position. The gold sweep on the logo player syncs. This is separate from marker dropping — a quick tap drops a marker, a drag scrubs.

---

### 4. A/B Toggle

Directly below the visualizer canvas, inside the same dark card.

```
[ Original ]  [ ■ Mixed ]
```

Two segments in a rounded container. Active segment has gold background (#D4AF37) with dark text. Inactive segment has transparent background with muted text.

- Switching preserves playback position (same `currentTime` on audio element)
- Volume matching: normalize both sources to same LUFS so "louder ≠ better" bias is eliminated
- "Original" is the raw stems summed at unity gain, no processing — generated during mix-full as a reference bounce
- The visualizer lines change shape on switch (smooth 500ms lerp transition)

---

### 5. Version Selector (STANDARD TIER ONLY)

Only visible when `tier === "STANDARD"`. Premium/Pro see the AI-recommended single mix — no selector, but a note: "AI-selected mix — Claude chose Polished based on your genre and input analysis."

Three version cards in a horizontal row (stack 1-column on mobile below 480px):

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    Clean     │  │  ● Polished │  │  Aggressive  │
│  Transparent │  │  Radio-ready│  │   Forward    │
│   reference  │  │             │  │   punchy     │
└─────────────┘  └─────────────┘  └─────────────┘
```

- Each card: dark background (`#1a1816`), 0.5px border, 12px radius
- Selected card: gold border (#D4AF37), small gold dot indicator
- Card content: version name (13px, weight 500), one-line description (11px, muted)
- Clicking a card switches the audio source and the visualizer data
- If Claude recommends a version, that card has a small "AI pick" badge in gold

---

### 6. What We Did (Stem Breakdown)

Dark card (`#1a1816`), 12px radius. Header: "WHAT WE DID" in 10px gold, letter-spacing 0.5px.

One row per processed vocal layer. Only shows layers that were uploaded and processed — empty slots don't appear. Each row has:

- Colored dot (6px) matching the visualizer line color for that stem type
- Stem name (12px, primary text color)
- Processing summary (11px, muted, right-aligned)

```
● Main vocal          Cleaned, 2-stage comp, presence +3dB, de-essed
● Ad-libs             Telephone lo-fi, slapback delay, panned L/R
● Doubles             ±12¢ pitch widened, hard pan L35/R35
● Harmonies           Wide stereo L50/R50, lush reverb, -7dB blend
```

Color assignments:
- Main vocal: Coral (#E8735A)
- Ad-libs: Gold (#D4AF37)
- Doubles: Purple (#7F77DD)
- Harmonies: Green (#1D9E75)
- Ins & Outs: Pink (#D4537E)
- Beat: Blue (#378ADD) — only shows if Beat Polish was used

The processing summary text comes from Claude's `referenceNotes` and `stemParams` — the engine knows what it did to each stem. Format as plain English, not technical parameters. "2-stage comp" not "ratio 4:1, attack 2ms, release 80ms → ratio 2.5:1, attack 15ms, release 200ms."

---

### 7. Reference Track Note (PREMIUM/PRO ONLY)

Only visible when a reference track was uploaded and analyzed. Small card or inline note below the stem breakdown:

```
Reference applied — Asake, Terminator
Targeting -14.6 LUFS with strong sub presence and controlled highs.
```

10px gold label "Reference applied", 12px muted description from `referenceNotes` field. Shows the artist that Claude actually used their reference to shape the mix.

---

### 8. Console Stats Bar

Four metric cells in a horizontal row. Same pattern as mastering preview player.

```
   LUFS        Peak       Range      Width
  -14.2       -1.0        8.4        82%
```

Each cell: dark background (`#1a1816`), 8px radius, centered. Label in 10px muted, value in 15px weight 500 primary text.

Values come from the output analysis stored on the MixJob record. Update when switching versions (Standard) or A/B (stats reflect whichever source is active).

---

### 9. Export Format Grid

Header: "EXPORT" in 10px gold.

2-column grid of format cards:

```
┌─────────────────┐  ┌─────────────────┐
│ WAV 24-bit       │  │ WAV 24-bit       │
│ 44.1kHz · Studio │  │ 48kHz · Video    │
├─────────────────┤  ├─────────────────┤
│ WAV 16-bit       │  │ MP3 320kbps      │
│ CD quality       │  │ Streaming        │
├─────────────────┤  ├─────────────────┤
│ FLAC 24-bit      │  │ AIFF 24-bit      │
│ Lossless archive │  │ Apple / Logic    │
└─────────────────┘  └─────────────────┘
```

- Selected format has gold border + subtle gold background tint
- Default selection: WAV 24-bit 44.1kHz (studio master)
- Cards: 0.5px border, 8px radius, 10-12px padding

Below the grid, full-width gold download button:

```
[ Download Clean · WAV 24-bit ]
```

Button text updates with selected version name + format. Download route generates a fresh signed URL from the stored raw path (not expired signed URLs).

For Standard tier: button shows the currently selected version name (Clean/Polished/Aggressive).
For Premium/Pro: button shows "Download mix" (single AI-recommended version).

Dithering is applied automatically on 16-bit exports — no user-facing toggle needed.

---

### 10. Revision Section (PREMIUM/PRO ONLY)

Only visible when `tier !== "STANDARD"` and `revisionCount < maxRevisions`.

Header: "REVISION NOTES" in 10px gold. Right side: "2 remaining" in 12px muted.

Lists all markers the artist has placed on the visualizer, sorted by timestamp:

```
● 1:42 — too much reverb here
● 2:18 — ad-libs too quiet in verse 2
```

Each marker: coral dot (6px), timestamp in coral (12px), note in muted (12px).

Below the markers, a general notes textarea for non-timestamped feedback: "Overall the mix feels too compressed" — for artists who want to give general direction without pinpointing specific moments.

Below that, a coral submit button:

```
[ Submit revision ]
```

**Data sent to backend:**

```json
{
  "markers": [
    { "time": 102, "note": "too much reverb here" },
    { "time": 138, "note": "ad-libs too quiet in verse 2" }
  ],
  "generalNotes": "Overall the mix feels too compressed"
}
```

Claude receives the structured markers with timestamps and can make targeted adjustments per section instead of guessing what the artist means.

After submitting, the page shows a processing state. When the revision completes, the page reloads with the new mix and the revision count decrements.

If all revisions are used: hide the section entirely. Show a small note: "Need more changes? Additional revisions are $9.99 each." with a payment link.

---

### 11. Mastering Cross-Sell

Bottom of the page. Dark card with coral accent.

```
Ready to master?
Take your mix to release-ready with 4 mastered versions.     [ Master for $7.99 → ]
```

Left: title (14px, primary) + subtitle (12px, muted).
Right: coral button.

Clicking pre-loads the mixed file into the mastering wizard — the artist doesn't need to download and re-upload. The mix file path is passed directly.

---

## MOBILE LAYOUT (BELOW 480px)

- Logo player scales to 64px (from 72px)
- Frequency visualizer: canvas height reduces to 140px (from 200px). Band labels alternate visibility (show Sub, 250, 1k, 4k, 16k — hide 60, 125, 500, 2k, 8k) to prevent label crowding
- Version selector cards stack single column
- Export format grid stays 2-column (cards are small enough)
- Console stats: 2x2 grid instead of 4-column row
- Revision markers: long-press on canvas to drop a marker (tap is for play/pause on mobile). Show a brief toast: "Long-press the visualizer to mark a moment" on first visit
- Stem breakdown rows wrap — name on top, description below (not side by side)
- Cross-sell card stacks vertically (text above, button below full-width)

---

## LOADING STATE (MIX STILL PROCESSING)

When the job status is `MIXING` or `PREVIEWING` (not yet `COMPLETE`):

- Logo player shows with idle pulse animation (coral button breathing)
- Frequency visualizer shows flat lines at neutral position with slow breathing animation
- A progress indicator below the player: "Mixing your track... this takes 1-3 minutes"
- Rotating tips (same pattern as mastering processing step):
  - "We're applying genre-specific processing to each of your vocal layers"
  - "Claude is analyzing your beat to carve space for your vocals"
  - "Your ad-libs are getting that signature lo-fi treatment"
  - "We're balancing 10 frequency bands to match professional references"
  - "Almost there — running quality checks on the final mix"
- Tips rotate every 6 seconds with opacity fade transition
- When status hits `COMPLETE`, the page transitions: lines animate from flat to real data, player becomes active, all sections populate

---

## AUDIO IMPLEMENTATION

### Source Files

The mix engine generates and stores:

| File | Purpose | When generated |
|------|---------|---------------|
| `original_preview.wav` | Raw stems summed at unity gain, no processing | During mix-full, before any DSP |
| `clean_preview.wav` | Standard: Clean variation 30s preview | During preview-mix |
| `polished_preview.wav` | Standard: Polished variation 30s preview | During preview-mix |
| `aggressive_preview.wav` | Standard: Aggressive variation 30s preview | During preview-mix |
| `mix_preview.wav` | Premium/Pro: AI-recommended mix 30s preview | During preview-mix |
| `clean_full.wav` | Standard: Clean full-length | During mix-full |
| `polished_full.wav` | Standard: Polished full-length | During mix-full |
| `aggressive_full.wav` | Standard: Aggressive full-length | During mix-full |
| `mix_full.wav` | Premium/Pro: Full-length mix | During mix-full |

### Preview vs Full

The A/B toggle and visualizer use the 30-second preview clips (highest-energy window, same window across all versions for fair comparison). The download button delivers the full-length file.

A "Play full track" toggle below the A/B toggle switches from preview to full-length playback. Default is preview mode for quick comparison.

```
[ Preview (30s) ]  [ Full track ]
```

### Volume Matching

Both original and mixed previews are LUFS-normalized to the same target before serving. This prevents "louder = better" bias on the A/B toggle. The normalization happens during preview generation, not client-side.

---

## DATA DEPENDENCIES

The component needs these fields from the MixJob record:

```typescript
interface MixResultsData {
  id: string;
  tier: "STANDARD" | "PREMIUM" | "PRO";
  status: string;
  genre: string;
  beatPolish: boolean;
  
  // Audio files (raw storage paths, signed URLs generated on demand)
  originalPreviewPath: string;
  cleanPreviewPath?: string;
  polishedPreviewPath?: string;
  aggressivePreviewPath?: string;
  mixPreviewPath?: string;
  cleanFilePath?: string;
  polishedFilePath?: string;
  aggressiveFilePath?: string;
  mixFilePath?: string;
  
  // Analysis output
  outputAnalysis: {
    lufs: number;
    truePeak: number;
    loudnessRange: number;
    stereoWidth: number;
  };
  
  // Claude's decisions (for stem breakdown display)
  stemProcessingSummary: Array<{
    role: string;
    description: string;
  }>;
  
  // Reference
  referenceFileName?: string;
  referenceNotes?: string;
  
  // Revision tracking
  revisionCount: number;
  maxRevisions: number;
  
  // Waveform data (for fallback if Web Audio API unavailable)
  previewWaveformOriginal: number[];
  previewWaveformMixed: number[];
}
```

---

## ACCESSIBILITY

- `<audio>` element has `aria-label="Mix preview player"`
- Logo player button: `aria-label="Play"` / `aria-label="Pause"` toggling with state
- A/B toggle: `role="radiogroup"`, each option `role="radio"` with `aria-checked`
- Version selector cards: `role="radiogroup"` with keyboard arrow key navigation
- Canvas visualizer: `role="img"`, `aria-label="Real-time frequency analysis showing vocal, beat, and mix energy across 10 frequency bands"`
- Keyboard: Space = play/pause, Left/Right arrows = scrub 5 seconds, M = toggle A/B
- Revision marker text inputs: auto-focus on creation, Escape to cancel
- All interactive elements have visible focus rings
- Screen reader announces version changes and A/B switches

---

## FILES TO CREATE/MODIFY

| File | Change |
|------|--------|
| `src/app/mix-console/results/MixResultsClient.tsx` | New — main results page component |
| `src/app/mix-console/results/FrequencyVisualizer.tsx` | New — canvas visualizer with Web Audio API |
| `src/app/mix-console/results/LogoPlayer.tsx` | New — reuses mastering logo player pattern |
| `src/app/mix-console/results/VersionSelector.tsx` | New — Standard tier version cards |
| `src/app/mix-console/results/StemBreakdown.tsx` | New — "what we did" per-stem display |
| `src/app/mix-console/results/RevisionMarkers.tsx` | New — marker management + submission |
| `src/app/mix-console/results/ExportGrid.tsx` | New — format selection + download |
| `src/app/mix-console/results/page.tsx` | New — server component, loads job data |
| `src/app/dashboard/ai/mix-console/[id]/page.tsx` | New — subscriber route wrapping results |
| `src/lib/mix-console/audio-utils.ts` | New — Web Audio API setup, analyser node, band splitting |

---

## IMPLEMENTATION ORDER

1. `page.tsx` server component — load MixJob, validate access
2. `MixResultsClient.tsx` — shell layout with all sections
3. `LogoPlayer.tsx` — reuse mastering player pattern, wire `<audio>` element
4. `FrequencyVisualizer.tsx` — canvas, Web Audio API analyser, 3-line rendering, dot animation
5. A/B toggle with volume matching and visualizer line transition
6. `VersionSelector.tsx` — Standard tier card switching
7. `StemBreakdown.tsx` — render from stemProcessingSummary
8. Console stats bar
9. `ExportGrid.tsx` — format selection, download with fresh signed URLs from stored paths
10. `RevisionMarkers.tsx` — tap-to-mark on canvas, text input, submission to revise endpoint
11. Loading/processing state
12. Mobile responsive adjustments
13. Reference note display
14. Cross-sell CTA
15. Accessibility pass
