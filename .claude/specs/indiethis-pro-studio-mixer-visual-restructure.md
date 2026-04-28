# IndieThis — Pro Studio Mixer Visual Restructure Spec

_Layout restructure + design philosophy pass. No functionality changes. All existing state management, Web Audio API architecture, knob logic, undo/redo, snapshots, autosave, AI assist, AI polish, re-render pipeline — untouched. This is layout and styling only._

---

## WHAT THIS CHANGES

The Pro Studio Mixer moves from vertical channel strip columns with dead space to horizontal stem lanes where controls flow into waveforms. The scrub bar moves to the top. The master bus stays vertical on the right. The entire page receives a design philosophy pass that makes it feel like a premium studio console, not a web application.

## WHAT THIS DOES NOT CHANGE

- Component structure, file names, state management
- Web Audio API graph, analyser nodes, audio playback
- Knob/fader value logic, undo/redo stack, snapshot system
- API routes, autosave, re-render pipeline
- AI Assist and AI Polish functionality
- Any backend code

---

## LAYOUT RESTRUCTURE

### Overall structure (top to bottom)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TOP BAR: track name · genre · BPM · transport · controls · actions    │
├──────────────────────────────────────────────────────────────────────────┤
│  SCRUB BAR: master waveform + section markers + playhead (full width)  │
├─────────────────────────────────────────────────────────┬──────────────┤
│                                                         │              │
│  STEM LANES (stacked vertically)                        │   MASTER     │
│                                                         │   BUS        │
│  ┌─ Main Vocal (tallest lane) ────────────────────────┐ │   (vertical  │
│  │ [controls] ──── [fader] ──── [waveform ──────────] │ │    strip)    │
│  └────────────────────────────────────────────────────┘ │              │
│  ┌─ Ad-libs ──────────────────────────────────────────┐ │              │
│  │ [controls] ──── [fader] ──── [waveform ──────────] │ │              │
│  └────────────────────────────────────────────────────┘ │              │
│  ┌─ Doubles ──────────────────────────────────────────┐ │              │
│  │ [controls] ──── [fader] ──── [waveform ──────────] │ │              │
│  └────────────────────────────────────────────────────┘ │              │
│  ┌─ Harmonies ────────────────────────────────────────┐ │              │
│  │ [controls] ──── [fader] ──── [waveform ──────────] │ │              │
│  └────────────────────────────────────────────────────┘ │              │
│  ┌─ Beat (second tallest) ────────────────────────────┐ │              │
│  │ [controls] ──── [fader] ──── [waveform ──────────] │ │              │
│  └────────────────────────────────────────────────────┘ │              │
│                                                         │              │
└─────────────────────────────────────────────────────────┴──────────────┘
```

### Top bar

- Left: track name (actual name, not database ID — truncate with ellipsis at 25 chars) + genre badge + BPM
- Center: transport controls — play/pause (coral button), time counter, undo/redo arrows
- Right: SAVED timestamp, AI POLISH button, Simple/Advanced toggle, LINK, SNAPSHOTS, Re-render button, Export button
- PRO STUDIO badge with subtle gold gradient, not flat text

### Scrub bar

Full-width bar directly below the top bar. Contains:

- Master waveform rendered in muted gold (low opacity, not competing with stem waveforms)
- Section markers as subtle labeled blocks: Intro, Verse 1, Pre, Chorus 1, Verse 2, etc.
- Active section has a warm gold background glow, not just a border
- Playhead as a vertical line with subtle gold glow — this line extends downward through all stem lanes below
- Click anywhere on the scrub bar to seek
- Time position shown on the playhead or in the top bar transport

### Stem lanes

Each stem is a horizontal row spanning the full width (minus the master bus strip). All controls and the waveform sit on the same horizontal axis — everything flows left to right.

**Lane height hierarchy — the vocal is king:**
- Main Vocal: tallest lane (~20% more height than supporting stems)
- Beat: second tallest
- Ad-libs, Doubles, Harmonies, Ins & Outs: standard height (equal to each other)

If Beat Polish is active and Demucs separated the beat, show individual lanes for Kick, Bass, Drums Other, Melodics instead of a single Beat lane.

**Per lane layout (left to right):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Label] [M][S] [✦] [Pan] │ [━━━━━━━━ Fader ━━━━━━━━] │ [Waveform]│
│  Vocal                    │         ▓▓▓▓▓▓▓▓░░░░      │ ∿∿∿∿∿∿∿∿ │
│  ● EDITED                 │         ↑ gold marker      │           │
└─────────────────────────────────────────────────────────────────────┘
```

- **Control area** (~120px fixed width): stem label (color-coded, 11px, the stem's color), M/S buttons (small, stacked or inline), AI Assist sparkle button, pan indicator
- **Fader area** (~140px fixed width): horizontal fader with the gold reference marker showing AI's original position. Inline level meter running alongside or below the fader — smooth gradient green to amber to red
- **Waveform area** (fills remaining width): horizontal waveform in the stem's color, aligned to the scrub bar timeline above. The playhead line from the scrub bar drops through this waveform vertically

Each lane has a subtle left border accent in the stem's color (2px, muted) as the only color indicator on the control side. The waveform is where the color lives fully.

**Stem lane ordering (top to bottom):**
Main Vocal → Doubles → Harmonies → Ad-libs → Ins & Outs → Beat (or beat sub-stems)

### Advanced view expansion

When toggled to Advanced, each stem lane reveals a slim sub-row below it:

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Label] [M][S] [✦] [Pan] │ [━━━━ Fader ━━━━] │ [Waveform ∿∿∿∿∿∿] │
├───────────────────────────┼───────────────────┼────────────────────┤
│   [REV] [DLY] [CMP] [BRT] │ [DRY ━━━━━ WET]  │                    │
└─────────────────────────────────────────────────────────────────────┘
```

- Four effect knobs in a horizontal row: REV, DLY, CMP, BRT — smaller than in the current vertical strip layout
- Dry/wet slider horizontal, inline
- The sub-row appears with a smooth height reveal animation (200ms ease), not a hard jump
- Sub-row background is slightly darker than the main lane to create visual separation

### Master bus strip

Stays vertical on the right side. Visually separated from the stem lanes with a subtle warm divider line (#2A2824, 1px).

- MASTER label at top in gold, letter-spaced
- Frequency visualizer (small, muted until audio is playing)
- 5-band EQ knobs: Bass, Warm, Body, Pres, Air — properly spaced, each on its own line or clearly separated in a 2-3 layout. Labels in 8px muted text below each knob
- AI Intensity knob with percentage readout (appears on hover/touch only)
- Stereo width slider with percentage readout (appears on hover/touch only)
- Master fader — taller and more prominent than any stem fader. This is the biggest fader on the page. Stereo (L/R) level meter beside it — the brightest, most responsive element in the master strip
- dB readout below the fader (appears on touch only, otherwise shows just a muted +0.0)
- OUT label at bottom

The master strip should feel like the anchor of the page. Slightly lighter background than the stem lanes (subtle radial gradient — barely perceptible lighter center fading to edges) to draw the eye.

---

## DESIGN PHILOSOPHY

These are the principles that elevate the mixer from "web app" to "instrument." All are implemented through CSS, animation, and rendering — no functionality changes.

### 1. Waveforms are the brightest elements

The waveforms are the music. They should be the most vivid colored elements on the page. Controls (knobs, faders, buttons, labels) stay muted — dark gold, not bright gold. Muted stem colors on labels, not saturated. The waveform is where each stem's color lives at full intensity.

When nothing is playing, the page is calm and dark. When audio runs, the waveforms and meters bring it to life. The page responds to the music.

**Waveform rendering — DAW-style continuous fill, not bars:**

Stem-lane waveforms and the master scrub-bar waveform must render as **continuous filled waveforms** that show the actual audio shape with peaks, transients, gaps, and dynamic envelope — exactly like a standard DAW (Pro Tools, Logic, Ableton, Reaper).

- Pre-compute peak data from the decoded `AudioBuffer` once (min/max sample value per pixel column, mirrored vertically around the lane center). Cache per stem; do not recompute on every frame
- Render as a single filled `<path>` (SVG) or filled polygon on `<canvas>` — top edge is the positive envelope, bottom edge is the negative envelope (mirrored), interior fully filled in the stem's color
- Resolution: one peak pair per pixel column at the lane's rendered width. On resize, recompute peaks for the new width
- The shape must clearly show transients (drum hits punch up, vocal breaths dip, sustained notes hold steady, silence collapses to a thin line at center)
- **Do not** render as discrete vertical bars with gaps between them. **Do not** render as FFT/spectrum bins. **Do not** drive lane waveforms from the live `AnalyserNode` — that's spectrum data, not the audio shape over time
- The mini scrub-bar waveform at the top uses the same approach against the summed master buffer (or sum of stem peaks)

Played-vs-unplayed state is communicated by opacity only — the shape itself never changes between played and unplayed regions.

### 2. Controls feel physical

- Fader thumbs are wider gold bars with a subtle bevel — not small squares. They should feel like something you'd grab
- Knobs rotate with smooth animation. When released, they settle with a tiny ease-out (50ms overshoot then settle) — not a hard stop
- All control movements use a 150ms ease-out curve, not linear
- Touch targets are generous — minimum 36px on all interactive elements

### 3. Information on demand

- dB readouts on faders appear only when touching/hovering the fader. Otherwise hidden or very muted
- Knob tooltips ("Reverb: 12% wet — AI set 15%") show on hover, not always visible
- Pan position label appears on hover, otherwise just the knob position tells the story
- LUFS readout on master updates in real time but is small and secondary — the meter itself communicates visually
- Reduce visible text on screen by half compared to current. The page should feel visual, not textual

### 4. Visual hierarchy through lane height

- Main Vocal lane is the tallest. The eye hits it first. It's the star
- Beat lane is the second tallest. The foundation
- Supporting stems are slimmer — they serve the vocal and beat, and the visual hierarchy reflects this
- This mirrors how a mix engineer thinks and makes the page scannable instantly

### 5. Negative space is the room

- The dark background (#0D0B09) is not empty — it's the studio room
- Add a very subtle texture to panel backgrounds — not noise grain, more like faint horizontal lines at 2-3% opacity. The texture of a console faceplate
- Stem lane panels should feel slightly recessed — a very subtle inner shadow (1px, barely visible) creates depth
- Borders between lanes use warm dark (#2A2824), not pure dark — adds warmth without being visible as "lines"

### 6. Color communicates, not decorates

- Each stem has its assigned color (Coral, Gold, Purple, Green, Blue, etc.) but at full saturation only in the waveform
- Control-side elements (labels, pan dots, M/S borders) use the stem color at 50-60% opacity
- The gold accent (#D4AF37) is reserved for: AI-related elements, the playhead, fader reference markers, and the active section highlight
- Meters are the exception — green/amber/red at full intensity because they're communicating live data

---

## WHAT SHOULD FEEL ALIVE

Five elements and nothing else. Everything else stays solid and grounded.

### 1. Playhead glow

The playhead line has a subtle warm gold glow (box-shadow or filter) as it moves through the waveform lanes. It's the visual heartbeat of the page. Not a hard bright line — a soft presence moving through the music.

### 2. Waveform breathing

The portion of the waveform currently playing brightens slightly compared to the rest. Already-played portions dim back to base opacity. A warm pulse travels through the waveform with playback. Not a visualizer bounce — a gentle brightness shift. Implemented by tracking the playhead position and adjusting opacity of the waveform region near the playhead.

### 3. Solo brightening

When a stem is soloed, that lane's waveform brightens to full saturation and the lane background subtly lightens. All other lanes dim to 30% opacity on the waveform and controls grey out. Instant visual confirmation of what your ears are hearing. Transition: 200ms ease.

### 4. AI presence

- AI Assist sparkle button has a very subtle idle pulse — opacity oscillating between 0.6 and 1.0 on a 3-second cycle. Not bouncing or spinning. Breathing
- When AI Assist is processing, the pulse speeds up (1-second cycle) and the color shifts from gold to coral
- AI Assist explanation card appears gently (fade in 300ms, slight upward slide), stays for 5 seconds, fades unless hovered. It's a whisper from a collaborator, not a popup
- AI Polish button is muted until available, then has the same subtle breathing pulse

### 5. Responsive meters

Level meters on faders are smooth and fluid — not stepping in chunks. Continuous gradient fill from green (#2d6e2d) through amber (#e8c84a) to a brief red kiss (#c44) at peaks. The meter responds to actual audio energy from the Web Audio API analyser node. The master bus meter is the most responsive and brightest meter on the page.

---

## SECTION INTERACTION

When a section is selected in the scrub bar:

- The selected section block in the scrub bar gets a warm gold background glow
- A very faint vertical highlight band appears across all waveform lanes over that section's time range — not a harsh box, a gentle atmospheric glow behind the waveforms (rgba gold at 5-8% opacity)
- A small "Section: Chorus 1" badge appears in the top bar, muted, dismissible
- All control changes now apply to that section only (existing functionality, no change)

When "All" is selected (global mode), the section highlight clears and the scrub bar returns to neutral.

---

## RE-RENDER COMPLETION MOMENT

When a studio re-render completes:

- All waveforms pulse once with a brief gold wash — each waveform's color shifts momentarily toward gold, then settles back (400ms total)
- The re-render button transitions from processing state back to dormant with a satisfied settle animation
- The visual diff card (before/after frequency overlay + change summary) fades in gently below the scrub bar
- This is the equivalent of VU meters settling after a take — a moment of satisfaction

---

## RE-RENDER BUTTON STATES

- **No changes made:** dormant grey outline, not interactive
- **Changes pending:** gold outline, subtle warm glow, fully interactive. The glow says "I'm ready when you are"
- **Rendering:** gold fill with a smooth progress pulse, not interactive
- **Complete:** brief gold flash, then returns to dormant (changes have been applied)

---

## MUTE BEHAVIOR (VISUAL)

When a stem is muted:

- The waveform dims to 15% opacity
- The lane background darkens slightly
- The M button turns red
- The fader and controls grey out
- Transition: 150ms ease

When unmuted, the lane breathes back — waveform fades up, controls restore color. The visual space returns.

---

## SIMPLE VIEW VS ADVANCED VIEW

### Simple view (default)

Each stem lane shows: label, M/S, AI Assist sparkle, pan, horizontal fader, waveform. That's it. Clean, intentional, approachable. The lane height is used well — the fader and waveform have room to breathe. No knobs, no dry/wet, no sub-rows.

The simplicity is the feature. A non-engineer opens this and sees something they understand immediately.

### Advanced view

Each stem lane expands its sub-row below: REV, DLY, CMP, BRT knobs + dry/wet slider. The section timeline interaction, linked stems chain toggle, and reference overlay toggle become visible. The lane grows taller to accommodate without feeling cramped.

Toggle transition: smooth height animation (200ms ease). Not a jump cut.

---

## STEM COLOR REFERENCE

These colors are used at full saturation in waveforms only. Controls use these at 50-60% opacity.

| Stem | Color | Hex |
|------|-------|-----|
| Main Vocal | Coral | #E8735A |
| Ad-libs | Gold | #D4AF37 |
| Doubles | Purple | #7F77DD |
| Harmonies | Green | #1D9E75 |
| Ins & Outs | Pink | #D4537E |
| Beat / Kick | Blue | #378ADD |
| Bass | Teal | #37ADAD |
| Drums Other | Steel | #8A9AAD |
| Melodics | Amber | #AD8A37 |

---

## BACKGROUND AND SURFACE COLORS

| Element | Color |
|---------|-------|
| Page background | #0D0B09 |
| Lane panel background | #13110f |
| Lane sub-row (advanced) | #0f0d0b |
| Master bus background | #13110f with subtle radial gradient (center #161412) |
| Borders between lanes | #2A2824 (0.5px) |
| Master bus divider | #2A2824 (1px) |
| Control surfaces (knob bg, fader track) | #1a1816 |
| Active/hover control border | #333028 |

---

## TYPOGRAPHY

- Stem labels: 11px, font-weight 500, stem color at 60% opacity
- Value readouts (dB, %, pan): 9px, #666, shown on hover/touch only
- Section labels in scrub bar: 9px, #666 default, #D4AF37 when active
- MASTER label: 10px, #D4AF37, letter-spacing 1.5px
- PRO STUDIO badge: 10px, gold gradient background
- All text: system font stack matching rest of platform

---

## ANIMATIONS SUMMARY

| Element | Duration | Easing |
|---------|----------|--------|
| Fader/knob drag response | immediate | — |
| Fader/knob release settle | 50ms | ease-out with slight overshoot |
| Control hover state | 100ms | ease |
| Advanced view expand/collapse | 200ms | ease-in-out |
| Solo/mute visual transition | 200ms | ease |
| AI Assist card appear | 300ms | fade + slide up 8px |
| AI Assist card auto-dismiss | 5000ms hold, 300ms fade |
| AI sparkle idle pulse | 3000ms cycle | sine |
| AI sparkle processing pulse | 1000ms cycle | sine |
| Snapshot load (controls animate) | 300ms | ease-out |
| Undo/redo control animation | 100ms | ease |
| Re-render completion waveform pulse | 400ms | ease-in-out |
| Playhead glow | constant (CSS glow, no animation) |
| Waveform breathing | real-time (opacity shift tracks playhead) |

---

## IMPLEMENTATION ORDER

1. Restructure layout — move from vertical channel strips to horizontal stem lanes. Get the grid right: control area, fader area, waveform area per lane. Master bus on the right. Verify nothing broke
2. Move scrub bar to top — integrate section timeline into the scrub bar. Remove the bottom section bar
3. Implement lane height hierarchy — main vocal tallest, beat second, others standard
4. Switch faders from vertical to horizontal — maintain all value logic, just change orientation and styling
5. Wire playhead line from scrub bar through all waveform lanes vertically
6. Render horizontal waveforms per stem lane as **continuous filled DAW-style waveforms** computed from the decoded `AudioBuffer` peaks (min/max per pixel column, mirrored around lane center, filled path in stem color). Not vertical bars. Not FFT/analyser data. See Design Philosophy §1 for full requirements
7. Apply design philosophy — mute controls, brighten waveforms, add panel texture, inner shadows, warm borders
8. Information on demand — hide dB/percentage readouts until hover/touch
9. Implement alive elements — playhead glow, waveform breathing, solo brightening, AI sparkle pulse, responsive meters
10. Section interaction — gold glow on active section, faint highlight band across waveform lanes
11. Re-render completion moment — gold waveform pulse
12. Mute/unmute visual transitions
13. Advanced view sub-row expand/collapse animation
14. Simple view refinement — ensure it feels intentionally clean
15. Polish pass — verify all animations, transitions, color values, spacing

---

## FILES MODIFIED

No new files. These are styling and layout changes to existing components:

| File | Change |
|------|--------|
| `StudioClient.tsx` | Layout restructure — horizontal lanes, scrub bar at top, master on right |
| `ChannelStrip.tsx` | Refactor from vertical column to horizontal lane with sub-row expansion |
| `VolumeFader.tsx` | Orientation change from vertical to horizontal, new thumb styling |
| `PanKnob.tsx` | Repositioned inline within the horizontal lane control area |
| `EffectKnob.tsx` | Repositioned into horizontal sub-row, slightly smaller |
| `MasterStrip.tsx` | Styling pass — prominence, radial gradient, meter enhancement |
| `SectionTimeline.tsx` | Merged into scrub bar at top, section glow styling |
| `MiniVisualizer.tsx` | Repositioned within horizontal lane or master strip |
| `SnapshotManager.tsx` | No layout change, only top bar repositioning if needed |
| `useStudioAudio.ts` | No change |
| `useUndoRedo.ts` | No change |
| `types.ts` | No change |

---

## VERIFICATION

After implementation:

- All stems play with gain/pan/mute/solo working in real time (unchanged)
- Horizontal faders control the same values as the previous vertical faders
- Scrub bar seeks correctly, playhead tracks through all waveform lanes
- Section selection highlights correctly and controls scope to that section
- Advanced view expands/collapses smoothly without layout jank
- Simple view shows only fader/pan/M/S/AI Assist per lane
- AI Assist and AI Polish calls function identically
- Snapshots save/load all control positions correctly
- Autosave triggers on the same 30-second interval
- Re-render sends correct delta parameters to predict.py
- Undo/redo traverses the history stack correctly
- Keyboard shortcuts all function
- Master bus controls work identically
- No console errors introduced
