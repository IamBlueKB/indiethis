# IndieThis — Pro Studio Mixer Layout Rebuild

_For 4.7 — This replaces the current vertical channel strip layout entirely. Delete the old layout. Build horizontal track rows. Every dimension, color, and position is specified. Do not interpret — implement exactly as written._

---

## SITE HEADER

Use the exact same header component every other IndieThis page uses. Do not create a custom header. Do not modify it. Import the existing site header and render it at the top. The header has:
- IndieThis logo on the left linking to home
- Nav links: Explore, AI Mix Console
- Dashboard button on the right (for subscribers)

This is NOT the studio transport bar. The header is the standard site navigation. The studio transport bar is a separate element below it.

---

## PAGE STRUCTURE — TOP TO BOTTOM

**The entire studio must fit in a single viewport on a 1080p screen (1920x1080) with NO vertical scrolling.** Every dimension below is calibrated for this. The site header (~56px) + transport bar (44px) + track rows area (flexible, fills remaining) + section timeline (48px) = 100vh.

```
┌─────────────────────────────────────────────────────────────────────┐
│ [IndieThis logo]    Explore    AI Mix Console              [Dashboard] │  ← Standard site header (existing component, unchanged) ~56px
├─────────────────────────────────────────────────────────────────────┤
│ Track Name  PRO STUDIO  ▶ 0:00/3:26  ⟲⟳  ✦AI POLISH  Simple|Adv  │
│                              SNAPSHOTS  LINK  Re-render  Export     │  ← Studio transport bar (sticky) 44px
├──────────────────────────────────────────────────────┬──────────────┤
│                                                      │              │
│  [Main Vocal]  ▊▊▊▋▊▊▊▊▋▊▊▊▊▊▊▊▋▊▊▊▊▊▊▊▊▊▊▊▊▊    │   MASTER     │
│  [Ad-libs]     ▊▊▋▊▊▊▊▊▊▊▋▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊    │              │  ← Track rows + master fill remaining height
│  [Doubles]     ▊▊▊▊▊▋▊▊▊▊▊▊▊▊▊▊▋▊▊▊▊▊▊▊▊▊▊▊▊▊    │   [controls] │     Uses flex-1 / calc(100vh - header - transport - timeline)
│  [Harmonies]   ▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▋▊▊▊▊▊▊▊    │              │
│  [Beat]        ▊▊▊▊▊▊▊▊▋▊▊▊▊▊▊▊▊▊▊▋▊▊▊▊▊▊▊▊▊▊    │              │
│                                                      │              │
├──────────────────────────────────────────────────────┴──────────────┤
│ GLOBAL MIX │ Intro │ Verse 1 │ Chorus 1 │                          │  ← Section timeline 48px
│ ▊▊▊▊▊▊▋▊▊▊▊▊▊▊▊▊▊▊▋▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊▊  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## STUDIO TRANSPORT BAR

Sits directly below the site header. Sticky — stays visible when scrolling track rows. Height: 44px. Background: `rgba(20,18,16,0.95)` with `backdrop-filter: blur(12px)`. Bottom border: `1px solid rgba(212,175,55,0.08)`. Box-shadow: `0 4px 12px rgba(0,0,0,0.3)`.

All contents in a single row, vertically centered, everything on one line:
- Track title (from prettifyFilename applied to the original uploaded vocal filename — NOT the job ID, NOT the Supabase path, NOT any UUID or hash. Read from `job.mainVocalFiles[0].filename` or `job.inputFiles[0].filename`. If no filename found, show "Untitled Track"). 13px, weight 500, primary text color. Max-width 180px, truncate with ellipsis.
- PRO STUDIO badge — gold outline pill, 9px, "PRO STUDIO"
- 16px gap
- Play button — 32px circle, coral `#E8735A` fill, white play/pause icon. `box-shadow: 0 0 24px rgba(232,115,90,0.35)`. When playing: `box-shadow: 0 0 32px rgba(232,115,90,0.5)`.
- Time counter — `0:00 / 3:26`, 11px mono, muted color. 6px left of play button.
- 16px gap
- Undo/Redo — two icon buttons, gold when stack has entries, grey when empty. 18px icons.
- 12px gap
- AI POLISH button — coral outline pill with sparkle icon. `box-shadow: 0 0 14px rgba(232,115,90,0.25)`. 11px text.
- 12px gap
- Simple | Advanced toggle — two segments, active segment has gold background `#D4AF37` with dark text, inactive has transparent background with muted text. 11px text. 200ms transition.
- Right side (flex end):
  - SNAPSHOTS — icon + count, 10px, muted
  - 10px gap
  - LINK — chain icon, 10px, muted
  - 10px gap
  - Re-render — gold outline pill when dirty, grey outline when clean. 11px text. `box-shadow: 0 0 10px rgba(212,175,55,0.2)` when active.
  - 6px gap
  - Export — icon + text, 11px, muted

---

## TRACK ROWS AREA

Below transport bar. The track rows area uses `flex: 1` to fill all remaining viewport height between the transport bar and the section timeline. No scrolling for up to 8 stems. If more than 8 stems, the area scrolls internally.

Track rows area takes full width minus the master strip (200px on right).

### EACH TRACK ROW

Full width of the track area. One per stem. Ordered: Main Vocal → Ad-libs → Ins & Outs → Doubles → Harmonies → Beat (or beat sub-stems if Beat Polish).

**Row height: calculated dynamically.** Available height = viewport height - site header (56px) - transport bar (44px) - section timeline (48px). Divide equally among stem count. For 5 stems on 1080p: ~186px each. For 7 stems: ~133px each. Minimum row height: 56px. If rows would be shorter than 56px, enable vertical scrolling.

**Simple view:** rows use the calculated height, no change.
**Advanced view:** rows use the calculated height. The effect knobs overlay at the bottom of the waveform area — they don't increase the row height.

Background: `#1a1816`. Border-radius: 8px. Margin-bottom: 4px. Left border: 4px solid in the stem's color. Border rest: `1px solid rgba(212,175,55,0.06)`. Box-shadow: `0 0 12px rgba(212,175,55,0.04)`.

Hover: border brightens to `rgba(212,175,55,0.12)`, box-shadow to `0 0 16px rgba(212,175,55,0.08)`.

#### LEFT COLUMN — 160px wide, fixed, flex column, vertically centered, padding 8px 12px

**Compact mode:** When row height is below 120px (8+ stems), hide the download icon and the Claude/Edited badge to save vertical space. Keep stem name, volume slider, pan knob, mute/solo, and AI assist — those are essential controls that never hide regardless of row height.

Simple view contents (vertically stacked, 4px gap):
- Row 1: Stem name (12px, weight 500, stem color) + Claude/Edited badge (gold dot + "Claude" or dim dot + "Edited", 9px, right of name)
- Row 2: Vertical volume fader (60px tall, gold thumb on dark track, center tick at 0dB = AI position) + dB readout beside it (9px mono)
- Row 3: Pan knob (28px wide horizontal arc, gold AI-position dot) + pan readout (C, L20, R35 etc, 9px) + Mute button (M, 22px, red when active) + Solo button (S, 22px, yellow when active) + AI Assist sparkle (18px, gold, coral pulse when busy) + Download icon (14px, appears on hover)

Advanced view adds below the simple view contents:
- Row 4: 4 effect knobs inline — REV, DLY, CMP, BRT. Each 34px diameter. Gold arc fill with recessed background circle `rgba(255,255,255,0.04)`. Gold indicator dot with `filter: drop-shadow(0 0 3px rgba(212,175,55,0.3))`. Dragging: `drop-shadow(0 0 6px rgba(212,175,55,0.6))`. Labels below each in 8px muted text. + Dry/Wet horizontal slider (60px wide, stem color fill)

Stem color assignments:
- Main Vocal: `#E8735A` (coral)
- Ad-libs: `#D4AF37` (gold)
- Vocal Insouts: `#D4537E` (pink)
- Doubles: `#7F77DD` (purple)
- Harmonies: `#1D9E75` (green)
- Beat: `#378ADD` (blue)
- Kick: `#378ADD`
- Bass: `#37ADAD` (teal)
- Drums Other: `#8A9AAD` (steel)
- Melodics: `#AD8A37` (amber)

#### RIGHT SIDE — WAVEFORM (remaining width)

The waveform canvas fills ALL remaining width after the left column and the FULL height of the row. This is the dominant visual element of each track row. The waveform IS the track.

Waveform rendering:
- Vertical bars with 1px gaps between bars (same style as mastering preview player — NOT a continuous filled area)
- Each bar width: 2px, gap: 1px
- Bar color — played portion (left of playhead): stem color at 85% opacity
- Bar color — unplayed portion (right of playhead): stem color at 25% opacity
- Background: `rgba(255,255,255,0.02)`
- Playhead: 2px wide vertical line, gold `#D4AF37`, full height of row, with `box-shadow: 0 0 6px rgba(212,175,55,0.4)` glow
- All track row playheads are visually aligned — same X position across all rows at all times
- Click anywhere on any waveform to seek to that position
- Drag horizontally on any waveform to scrub — all rows follow
- The waveform data comes from `getPeaks()` on the stem's AudioBuffer

---

## MASTER STRIP

Right side of the page, full height from below the transport bar to above the section timeline. Width: 200px. Fixed position (does not scroll with track rows). Background: `#1a1816`. Border-radius: 8px. Border: `1px solid rgba(212,175,55,0.15)`. Box-shadow: `0 0 16px rgba(212,175,55,0.08)`.

Layout top to bottom, padding 16px 12px:

1. **MASTER** header — gold `#D4AF37`, 11px, weight 600, letter-spacing 1px, centered

2. 12px space

3. **Level meter + Volume fader** — side by side
   - Level meter: 16px wide, 100px tall, vertical bars green→yellow→red from bottom to top, fed by master analyser node
   - Volume fader: 100px tall, immediately right of meter, gold thumb on dark track, 0dB gold center tick
   - dB readout below: "+0.0 DB", 10px mono, centered

4. 12px space + 1px divider `rgba(212,175,55,0.15)`

5. **5 EQ bands** — stacked vertically, each on its own row:
   ```
   Bass      [━━━━━━●━━━━━━]
   Warmth    [━━━━━━●━━━━━━]
   Body      [━━━━━━●━━━━━━]
   Presence  [━━━━━━●━━━━━━]
   Sparkle   [━━━━━━●━━━━━━]
   ```
   - Each row: 20px height, 3px gap between rows
   - Label: left-aligned, 44px wide, 9px, muted color, fixed width
   - Slider: fills remaining width (~140px), gold fill from center, dark track, gold center tick at 0dB
   - Range: ±6dB
   - Tooltip on hover: "Bass (60Hz): +1.5dB"

6. 12px space + 1px divider

7. **AI Intensity** — centered
   - Knob: 44px diameter, gold arc, recessed background
   - Label below: "AI", 9px, muted
   - Value readout: percentage, 9px

8. 8px space

9. **Stereo Width** — horizontal slider, full width minus padding
   - Gold fill from left
   - "WIDTH 85%" readout below, 9px, muted

10. 12px space + 1px divider

11. **OUT** label — bottom, centered, 9px, muted

---

## SECTION TIMELINE — BOTTOM BAR

Full width of the viewport (spans under both track rows area and master strip). Height: 48px. Background: `#0D0B09`. Border-top: `1px solid rgba(212,175,55,0.06)`.

**Combined waveform canvas** fills the full width and 28px of the height (top portion). This waveform is the sum of all stems combined. Rendering:
- Vertical bars, 2px wide, 1px gaps
- Unplayed: `rgba(255,255,255,0.12)`
- Played (left of playhead): gold `rgba(212,175,55,0.5)`
- Playhead: gold 2px line with glow, synced with all track row playheads
- Click/drag anywhere to seek — all tracks follow

**Section labels** sit in a row below the waveform (bottom 20px):
- Each section is a pill/button: 8px border-radius, 10px text, 6px 12px padding
- Active section: gold background `rgba(212,175,55,0.15)`, gold border `1px solid rgba(212,175,55,0.4)`, gold text
- Inactive: `rgba(255,255,255,0.05)` background, `rgba(255,255,255,0.1)` border, muted text
- "GLOBAL MIX" is always the first button — selecting it applies changes globally
- Full section names: "Intro", "Verse 1", "Chorus 1", etc. — no truncation. If too many sections to fit, the row scrolls horizontally.

---

## GLOW EFFECTS SUMMARY

Every glow effect specified above in one reference list:

| Element | Default | Active/Hover/Playing |
|---------|---------|---------------------|
| Play button | `box-shadow: 0 0 24px rgba(232,115,90,0.35)` | `0 0 32px rgba(232,115,90,0.5)` |
| Track row | `box-shadow: 0 0 12px rgba(212,175,55,0.04)` | hover: `0 0 16px rgba(212,175,55,0.08)` |
| Master strip | `box-shadow: 0 0 16px rgba(212,175,55,0.08)` | — |
| AI Polish button | `box-shadow: 0 0 14px rgba(232,115,90,0.25)` | — |
| Playhead (all waveforms) | `box-shadow: 0 0 6px rgba(212,175,55,0.4)` | — |
| Gold buttons (Re-render, Export) | `box-shadow: 0 0 10px rgba(212,175,55,0.2)` | — |
| Effect knob indicator dot | `drop-shadow(0 0 3px rgba(212,175,55,0.3))` | dragging: `drop-shadow(0 0 6px rgba(212,175,55,0.6))` |
| Transport bar | `box-shadow: 0 4px 12px rgba(0,0,0,0.3)` | — |

---

## FILES TO MODIFY/CREATE

| Action | File |
|--------|------|
| DELETE | `ChannelStrip.tsx` — replaced entirely |
| CREATE | `TrackRow.tsx` — horizontal track row component |
| CREATE | `TrackWaveform.tsx` — full-width waveform canvas with bars + playhead |
| REWRITE | `StudioClient.tsx` — horizontal layout, track rows left, master strip right, section timeline bottom |
| REWRITE | `MasterStrip.tsx` — 200px wide, vertical EQ layout with labels, proper spacing |
| UPDATE | `useStudioAudio.ts` — add `getPeaks(bins)` for waveform rendering per stem + combined |
| KEEP | `useStudioHistory.ts` — no changes |
| KEEP | `useStudioAutosave.ts` — no changes |
| KEEP | `EffectKnob.tsx` — update glow effects only |
| KEEP | `VolumeFader.tsx` — keep for master strip, convert to horizontal slider variant for track rows |
| KEEP | `PanKnob.tsx` — keep, make compact for inline use |
| KEEP | `StemWaveform.tsx` — replace with TrackWaveform.tsx |
| UPDATE | `SectionTimeline.tsx` — add combined waveform canvas behind section labels |
| UPDATE | studio `page.tsx` — use standard site header component, fix track title to read actual filename |

---

## DO NOT

- Do not allow the page to scroll vertically for vocal+beat mode (typically 5-7 stems) — the entire studio fits in one viewport on 1080p (1920x1080). Use `height: 100vh` on the outer container and flex layout to distribute space. For tracked-out stems mode (2-16 stems), the track rows area scrolls internally when more than 8 stems are present — the transport bar, master strip, and section timeline remain fixed. The page itself never scrolls — only the track rows area.
- Do not keep any vertical channel strip layout
- Do not create a custom site header — use the existing one
- Do not show UUIDs, hashes, or Supabase paths as the track title
- Do not leave dead space in the track rows — the waveform fills all available space
- Do not use continuous filled waveforms — use vertical bars with 1px gaps (matches mastering player style)
- Do not make the EQ labels horizontal in the master strip — they are vertical rows with labels on the left
