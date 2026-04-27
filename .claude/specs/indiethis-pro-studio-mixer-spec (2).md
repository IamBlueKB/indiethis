# IndieThis — Pro Studio Mixer Spec

_For Sonnet/4.7 — New feature. Pro tier only ($99.99). Builds on existing mix console pipeline. Appears as a new view after the AI mix is complete. Does not modify the existing mix engine or results page. This is an additive layer on top of the AI's output._

---

## OVERVIEW

The Pro Studio Mixer is an interactive, browser-based mixing console that lets Pro tier artists fine-tune the AI's mix before final export. The AI gets the mix to 80% — the studio lets the artist close the gap with hands-on controls they can understand without being an engineer.

This is NOT a DAW. No timeline editing, no MIDI, no recording, no warp markers. It's a simplified mixer that non-engineers can use: volume faders, pan knobs, effect amounts, mute/solo, and an AI assist button when they're stuck.

The audio preview is real-time via Web Audio API — gain, pan, mute/solo, and EQ approximations happen instantly in the browser. Effects (reverb, delay, compression, saturation) are preview approximations only. The actual DSP happens server-side when the artist hits Re-render.

### Why Pro Only

Standard gets 3 variations and picks one. Premium gets an AI-recommended mix with revision markers. Pro gets everything Premium has plus the studio mixer — full control. This justifies the $40 price gap between Standard and Pro and gives artists a reason to upgrade beyond "more revisions."

---

## ACCESS

- URL: `/dashboard/ai/mix-console/[id]/studio`
- Also accessible from results page via "Open Studio" button (only visible for Pro tier jobs with status COMPLETE)
- Guest Pro users: `/mix-console/studio?token=[accessToken]`
- Minimum viewport: 768px. Below that, show: "The Studio Mixer works best on a larger screen. Switch to desktop or tablet for the full experience."

---

## LAYOUT

The mixer is a single-screen horizontal layout. No scrolling on desktop — everything visible at once. Think simplified Ableton mixer, not FL Studio channel rack.

### Top Bar

Left: track title + genre badge + "PRO STUDIO" badge in gold
Center: master transport — play/pause button (same coral logo player style), time counter, BPM display
Right: "Re-render" gold button (disabled until changes are made) + "Export" button + snapshot controls

### Main Area — Channel Strips

Horizontal row of vertical channel strips, one per stem. Each strip is a narrow vertical column (~80px wide) containing controls stacked vertically. Stems are ordered: Main Vocal → Doubles → Harmonies → Ad-libs → Ins & Outs → Beat (or Beat sub-stems if Beat Polish).

If Beat Polish is active and Demucs separated the beat, show individual channel strips for Kick, Bass, Drums Other, and Melodics instead of a single Beat strip.

Color coding per strip (matches the frequency visualizer and stem breakdown):
- Main Vocal: Coral (#E8735A)
- Ad-libs: Gold (#D4AF37)
- Doubles: Purple (#7F77DD)
- Harmonies: Green (#1D9E75)
- Ins & Outs: Pink (#D4537E)
- Beat / Kick: Blue (#378ADD)
- Bass: Teal (#37ADAD)
- Drums Other: Steel (#8A9AAD)
- Melodics: Amber (#AD8A37)

### Right Side — Master Bus Strip

Wider strip (~120px) with master controls. Visually separated from stem strips with a subtle divider.

### Bottom Bar — Section Timeline

Horizontal bar showing detected song sections (intro, verse 1, chorus 1, verse 2, chorus 2, bridge, outro). Clickable to select a section for section-specific adjustments. Active section highlighted in gold. "All" button to apply changes globally.

---

## CHANNEL STRIP CONTROLS (PER STEM)

Each channel strip contains these controls, stacked top to bottom:

### 1. Mini Frequency Visualizer

5-band mini spectrum (sub, low, mid, high-mid, air) — 40px tall, updates in real time from Web Audio API analyser node per stem. Uses the stem's color. Shows the artist where the energy lives in that stem. When they turn the brightness knob, they see the highs light up.

### 2. Effect Knobs

Four circular knobs in a 2x2 grid. Each knob is a simple arc from 0-100%. Knob value is relative to what the AI set — 50% means "keep the AI's setting," 0% means "remove this effect," 100% means "double it."

| Knob | What it controls | Web Audio preview | Server-side DSP |
|------|-----------------|-------------------|-----------------|
| Reverb | Wet/dry amount | ✅ ConvolverNode with IR approximation — directional preview, labeled "preview quality" | Pedalboard reverb with exact wet level |
| Delay | Wet/dry amount | ✅ DelayNode with feedback — near-identical to server-side | BPM-synced delay with feedback loop |
| Compression | Light to heavy | ❌ Visual only — "Applied on re-render" label | Pedalboard compressor with full params |
| Brightness | Dark to bright tilt EQ | ✅ Biquad filter high shelf — real-time | Pedalboard EQ high shelf boost/cut |

Default position for all knobs: 50% (AI's original setting).

Tooltip on hover shows the actual parameter: "Reverb: 12% wet (AI set 15%, you reduced to 12%)"

### 3. Dry/Wet Slider

Single horizontal slider from "Dry" (0%) to "Processed" (100%). At 0%, the stem plays the original unprocessed audio. At 100%, fully processed. Default: 100%. This is the "Remove FX" equivalent from Suno — but as a gradient, not binary.

### 4. Volume Fader

Vertical slider, 120px tall. Range: -inf to +6dB relative to the AI's gain setting. Center position (0dB) = AI's original level. Gold indicator line at center showing the AI's position. Real-time level meter alongside the fader — green bars, yellow at -6dB, red at -1dB.

### 5. Pan Knob

Horizontal arc knob. Range: L100 to R100. Default: whatever the AI set (centered for lead, L35/R35 for doubles, etc.). Gold dot indicator showing the AI's original pan position so the artist can always see what Claude decided.

### 6. Mute / Solo Buttons

Two small buttons at the bottom of each strip.
- **M** — mutes the stem. Grey when inactive, red when active.
- **S** — solos the stem. Grey when inactive, yellow when active.
- Multiple solos: only soloed stems play. If no stems are soloed, all unmuted stems play.
- Keyboard shortcut: number keys 1-9 toggle mute on stems in order. Shift+number toggles solo.

### 7. AI Assist Button

Small sparkle icon button below M/S. Clicking it asks Claude to analyze this specific stem in the context of the current mix state and auto-adjust the knobs. 

What happens:
1. Current mixer state (all fader positions, knob values, pan settings) is sent to Claude
2. Claude receives: "The artist is struggling with the ad-libs stem. The current mix state is [JSON]. The original analysis showed [frequency data]. What adjustments would improve this stem in context?"
3. Claude returns specific knob/fader values
4. The knobs animate to Claude's suggested positions over 300ms
5. A small card appears: "Pulled reverb back to 8% — the room reverb from your recording was stacking with the added reverb. Boosted brightness to cut through the beat."
6. Artist can undo (Cmd+Z) if they don't like it

Cost: one Haiku call per stem assist, ~$0.005. Negligible.

### 8. Stem Label

Bottom of the strip: stem name (11px, color-coded) + "AI" indicator showing the AI's original settings are preserved (dims when the artist changes anything).

---

## SIMPLE / ADVANCED VIEW TOGGLE

A toggle in the top bar: `[ Simple ]  [ Advanced ]` — same styled toggle as the A/B switch.

### Simple View (DEFAULT)

Each channel strip shows only:
- Volume fader with level meter
- Pan knob
- Mute / Solo buttons
- AI Assist sparkle button
- Stem label

That's 4 controls per strip. A non-engineer opens the studio and immediately understands: "I can make things louder/quieter, move them left/right, and mute/solo them." No knobs, no sliders they don't understand, no intimidation.

The AI Assist button is visible in simple view — this is critical. The artist doesn't need to know what compression or reverb does. They hit the sparkle button and Claude handles the effects for them. When Claude adjusts effect knobs the artist can't see, show the explanation card ("Pulled reverb back to 8%, boosted brightness") but do NOT auto-switch to advanced view. Let them stay in simple mode and trust Claude. If they want to see what changed, they toggle to advanced themselves.

The master bus strip in simple view shows only: master volume fader, AI intensity slider, and the mini frequency visualizer. No EQ bands, no stereo width.

Section timeline is hidden in simple view. All changes apply globally.

### Advanced View

Everything described in the channel strip controls section above: volume fader, pan knob, 4 effect knobs, dry/wet slider, mute/solo, AI assist, mini visualizer, stem label.

Master bus shows all controls: volume, stereo width, 5-band EQ, AI intensity, frequency visualizer, console stats.

Section timeline visible at the bottom.

### Persistence

The view preference is saved per user (localStorage). Artists who switch to advanced stay in advanced next time they open the studio. First-time users always start in simple.

### Transition

Switching from simple to advanced: controls animate in from below with a 200ms staggered reveal (knobs first, then dry/wet, then visualizer). Switching from advanced to simple: controls fade out over 150ms. The layout reflow is smooth — channel strips narrow/widen gracefully.

---

## MASTER BUS STRIP

Wider strip on the right side. Contains:

### 1. Master Volume Fader

Same as stem faders but controls overall output. Range: -inf to +6dB. Level meter showing combined output.

### 2. Master Stereo Width

Horizontal slider from Mono (0%) to Wide (150%). Default: 100% (AI's setting). Below 100% narrows the stereo field. Above 100% widens using M/S processing.

### 3. 5-Band Master EQ

Five horizontal sliders stacked vertically, one per band:

| Band | Frequency | Range |
|------|-----------|-------|
| Sub | 60Hz | ±6dB |
| Low | 250Hz | ±6dB |
| Mid | 1kHz | ±6dB |
| High-mid | 4kHz | ±6dB |
| Air | 12kHz | ±6dB |

Default: all at 0dB (flat). Gold center line showing neutral. Matches the frequency visualizer bands so the artist can see the impact.

Web Audio preview: 5 biquad filter nodes in series.
Server-side: Pedalboard parametric EQ.

### 4. AI Intensity Slider

Master slider from "Minimal" (0%) to "Full" (100%). This globally scales how much of the AI's processing is applied.

- At 100%: full AI processing (default)
- At 50%: every effect on every stem is at half the AI's values
- At 0%: raw stems summed with only gain and pan — essentially unprocessed

This is the "how much AI do I want" control. Artists who think the AI over-processed can pull it back. Artists who want more can push it up.

Implementation: multiplier on all effect knob values. If the AI set reverb at 15% wet and the intensity slider is at 50%, effective reverb is 7.5%.

### 5. Frequency Visualizer

The same 3-line frequency visualizer from the results page (gold mix, coral vocal, purple beat) rendered in the master strip area, but smaller (180px wide, 80px tall). Updates in real time as the artist adjusts controls. This is the "are my changes helping?" indicator.

### 6. Console Stats

LUFS / Peak displayed below the master fader, updating in real time from the Web Audio API output. These are approximations — the re-rendered version may differ slightly, but they give the artist real-time feedback on loudness.

---

## SECTION-AWARE ADJUSTMENTS

### Section Timeline Bar

Horizontal bar at the bottom of the mixer. Shows detected sections as labeled blocks:

```
[ Intro ] [ Verse 1 ] [ Chorus 1 ] [ Verse 2 ] [ Chorus 2 ] [ Bridge ] [ Outro ]
```

Each block is proportionally sized by duration. Active section highlighted with gold border + subtle gold fill.

### How It Works

1. By default, "All" is selected — changes apply to the entire track
2. Artist clicks a section (e.g., "Chorus 1") — the section highlights
3. Any knob/fader changes now only apply to that section
4. The mixer shows the current values for that section — if no section-specific changes exist, shows the global values
5. A small "Section: Chorus 1" badge appears in the top bar
6. Artist can click "All" to return to global editing

### Visual Indicator

When a stem has section-specific overrides, a small colored dot appears on that stem's channel strip for each section that has custom values. The artist can see at a glance: "I boosted vocals on the chorus and pulled reverb back on the verse."

### Data Structure

```json
{
  "global": {
    "main_vocal": { "gain_db": 0, "pan": 0, "reverb": 50, "delay": 50, "comp": 50, "brightness": 50, "dryWet": 100 },
    "adlibs": { ... }
  },
  "sections": {
    "chorus_1": {
      "main_vocal": { "gain_db": 1.5, "reverb": 65 }
    },
    "verse_2": {
      "adlibs": { "gain_db": -2 }
    }
  }
}
```

Only overridden values are stored per section. Everything else inherits from global.

---

## LINKED STEMS

Doubles (left and right copies) and harmony stacks should optionally move together. A small chain-link icon between paired stems toggles linking.

When linked:
- Moving one fader moves the other by the same amount
- Pan moves mirror (if you pan left copy further left, right copy pans further right proportionally)
- Effect knobs sync

Link is on by default for doubles. Off by default for harmonies (they often need individual control). Artist can toggle freely.

---

## REFERENCE COMPARISON

If the artist uploaded a reference track, a "Reference" toggle button appears in the top bar next to the transport controls.

When active:
- A reference audio element plays the reference track alongside (or instead of) the mix
- The frequency visualizer shows the reference as a white/grey overlay line
- The artist can flip between "My Mix" and "Reference" to compare
- Volume is LUFS-matched so the comparison is fair

This lets the artist see: "My mix has too much low-mid compared to my reference" and adjust the master EQ accordingly. No other platform offers this inside a mixer view.

---

## PRESET SNAPSHOTS

### Save/Load

Top bar has a snapshots dropdown. Artist can:
- **Save** current state as a named snapshot (auto-named "Snapshot 1", "Snapshot 2", etc., editable)
- **Load** a previous snapshot — all controls animate to the saved positions over 300ms
- **A/B Compare** — toggle between current state and a selected snapshot. The A/B button flips all controls instantly (with 200ms lerp for visual feedback)
- **Delete** unwanted snapshots

Maximum 10 snapshots per job.

### Auto-Save

The initial AI mix is always saved as "AI Original" — a protected snapshot that can't be deleted or overwritten. The artist can always get back to where they started.

### Data Structure

```json
{
  "snapshots": [
    {
      "name": "AI Original",
      "protected": true,
      "created_at": "2026-04-26T...",
      "state": {
        "global": { ... },
        "sections": { ... },
        "master": { "volume": 0, "stereoWidth": 100, "eq": [0,0,0,0,0], "aiIntensity": 100 }
      }
    },
    {
      "name": "Brighter chorus",
      "protected": false,
      "created_at": "2026-04-26T...",
      "state": { ... }
    }
  ]
}
```

Stored in the MixJob record as JSON.

---

## UNDO / REDO

Every control change pushes to a history stack. Maximum 100 entries.

- **Cmd+Z** (Ctrl+Z on Windows): undo last change
- **Cmd+Shift+Z** (Ctrl+Shift+Z): redo
- Each undo/redo animates the affected control(s) to their previous/next values over 100ms

The stack tracks: which control, which stem, old value, new value, timestamp. Group changes that happen within 200ms of each other (e.g., dragging a fader generates many change events — treat the drag as one undo step).

---

## SOLO'D STEM EXPORT

If the artist solos a single stem and likes how it sounds processed, they can export just that stem.

An "Export Stem" button appears in the channel strip when soloed. Clicking it downloads the processed version of that stem only — the WAV file that was rendered during mix-full.

Use case: producer wants the processed vocal to drop into their own DAW. They solo the vocal, like the compression and EQ the AI applied, and export just that stem. This is a small feature with big value for the Pro audience.

Available formats: WAV 24-bit only (stems are studio assets, not consumer files).

---

## AI POLISH BUTTON (GLOBAL)

In addition to per-stem AI assist, there's a global "AI Polish" button in the top bar.

What it does:
1. Takes the current mixer state (all faders, knobs, pans, section overrides)
2. Takes the output analysis (current LUFS, frequency balance, stereo width)
3. If a reference track exists, takes the reference profile
4. Sends everything to Claude (Opus with thinking for Pro tier)
5. Claude analyzes the gap between current state and professional/reference targets
6. Claude returns adjustments for multiple stems and master
7. All affected controls animate to Claude's suggested positions
8. A summary card appears: "Boosted vocal presence +1.5dB, widened harmonies, pulled back beat at 300Hz to reduce mud, matched reference LUFS within 0.5dB"
9. Undo reverts all changes from the polish as a single step

Cost: one Opus call, ~$0.15-0.30. Still negligible against $99.99 price.

This is the "I made some changes but I'm not sure they're right — Claude, clean this up" button. Nobody else has this.

---

## RE-RENDER

When the artist is happy with their adjustments, the "Re-render" button sends the modified parameters back to the Python engine.

### What Gets Sent

```json
{
  "action": "mix-full",
  "base_params": "original Claude stemParams + busParams",
  "studio_deltas": {
    "global": {
      "main_vocal": { "gain_db_delta": +1.5, "reverb_multiplier": 0.8, "brightness_db_delta": +2 },
      "beat": { "gain_db_delta": -1 }
    },
    "sections": {
      "chorus_1": {
        "main_vocal": { "gain_db_delta": +2, "reverb_multiplier": 1.3 }
      }
    },
    "master": {
      "volume_db_delta": 0,
      "stereo_width_multiplier": 1.1,
      "eq_deltas": [0, -1, 0, +1.5, +0.5],
      "ai_intensity": 0.85
    },
    "dry_wet": {
      "main_vocal": 1.0,
      "adlibs": 0.7
    }
  }
}
```

### How predict.py Applies Deltas

1. Load original Claude stemParams as base
2. Apply AI intensity multiplier to all effect values
3. Apply per-stem dry/wet blend (mix between dry input and processed)
4. Apply per-stem gain/effect deltas on top of Claude's values
5. Apply section-specific overrides at section boundaries (with 50ms crossfade)
6. Apply master bus deltas (EQ, stereo width, volume)
7. Render single output: `studio_mix.wav`
8. No variations — the studio mix IS the artist's version

### Status Flow

```
COMPLETE -> STUDIO_RENDERING -> STUDIO_COMPLETE
```

New status values for studio re-renders. The original mix files are preserved — the studio render is an additional output, not a replacement. The artist can always go back to the AI's original via the "AI Original" snapshot.

### Visual Diff on Re-render

After a studio re-render completes, don't just serve the new file — show the artist what changed. Display a before/after comparison card:

```
┌─────────────────────────────────────────────────┐
│  Studio Re-render Complete                       │
│                                                   │
│  ┌─── Before ───┐    ┌─── After ────┐            │
│  │  [freq curve] │    │  [freq curve] │           │
│  └──────────────┘    └──────────────┘            │
│                                                   │
│  Changes applied:                                 │
│  · Vocal gain +1.5dB (chorus sections only)       │
│  · Beat low-mid cut -2dB at 300Hz                 │
│  · Reverb reduced 15% → 10% on main vocal         │
│  · Master stereo width 100% → 110%                │
│  · LUFS: -14.8 → -14.2 (closer to reference)     │
│                                                   │
│  [ ◀ Play Before ]     [ Play After ▶ ]           │
└─────────────────────────────────────────────────┘
```

Implementation:
1. After re-render, run a quick analysis on the new studio_mix.wav (LUFS, frequency balance, stereo width)
2. Compare against the original mix analysis stored on the job
3. Generate a plain-English summary of the deltas: what moved, by how much, in which direction
4. Show a mini frequency curve overlay: grey line for before, gold line for after
5. A/B playback buttons let the artist flip between old and new immediately

This closes the feedback loop — the artist knows exactly what their changes did to the actual rendered output, not just what the Web Audio approximation sounded like.

### Cost

Same Replicate compute as a single-variation render (~$0.03-0.05). No Claude calls during re-render — the parameters are already decided.

---

## AUTOSAVE

The working mixer state autosaves every 30 seconds when changes exist. This prevents loss of work from browser crashes, tab closes, or accidental navigation.

Implementation:
- `useEffect` with 30-second interval in `StudioClient.tsx`
- Checks a `isDirty` flag (set true on any control change, reset on save)
- If dirty, `POST /api/mix-console/job/[id]/studio/save` with current state
- Silent — no toast, no UI feedback. The save is invisible.
- On page load, if `studioState` exists on the job, restore all controls to saved positions
- The "AI Original" snapshot is never overwritten by autosave — it's a separate protected entity
- Last autosave timestamp shown in a subtle footer: "Last saved 12 seconds ago"

Edge cases:
- If the artist opens the studio in two tabs, last-write-wins. No conflict resolution — this is a single-user tool.
- If autosave fails (network error), retry once after 5 seconds. If still failing, show a small amber warning: "Changes not saved — check your connection." Don't block the artist from working.

---

## WEB AUDIO API ARCHITECTURE

### Audio Graph

```
                    ┌────────────────────────────────────────────────────────┐
                    │                    AudioContext                        │
                    │                                                        │
Stem 1 ──→ [Source] → [Gain] → [Pan] → [BiquadHiShelf] → [Convolver] → [Delay] ──┤
Stem 2 ──→ [Source] → [Gain] → [Pan] → [BiquadHiShelf] → [Convolver] → [Delay] ──┤──→ [MasterGain] → [5x Biquad EQ] → [Analyser] → [Destination]
Stem 3 ──→ [Source] → [Gain] → [Pan] → [BiquadHiShelf] → [Convolver] → [Delay] ──┤
  ...                                                                               │
Beat   ──→ [Source] → [Gain] → [Pan] → [BiquadHiShelf] → [Convolver] → [Delay] ──┘
                    │                                                        │
                    │  Per-stem Analyser nodes ←─────────────────────────────┤
                    └────────────────────────────────────────────────────────┘
```

- Each stem loads its processed WAV from Supabase (fresh signed URL)
- Dry/original WAVs are NOT loaded on page mount — lazy-loaded only when the artist moves the dry/wet slider on that specific stem. Most artists never touch dry/wet on most stems, so typical memory stays at 12 files, not 24. When the dry/wet slider is first touched, fetch the dry stem URL, load it into a second audio element, and wire it into the parallel gain structure. Show a brief loading indicator on that strip ("Loading dry track...") during fetch.
- `MediaElementAudioSourceNode` per stem (same WeakMap caching pattern from results page)
- Gain node: controlled by volume fader
- Stereo panner: controlled by pan knob
- Biquad high shelf: controlled by brightness knob (approximate preview)
- Per-stem AnalyserNode: feeds the mini frequency visualizer
- Master gain → master EQ (5 biquad nodes) → master analyser → destination
- Mute: set stem gain to 0. Solo: set all non-soloed stems to 0.

### Reverb Preview (Web Audio Approximation)

Per-stem ConvolverNode loaded with a short impulse response (hall, plate, room — bundled as 3 small WAV files, ~50KB each). The reverb knob controls the wet/dry send level via a parallel gain node:

```
[Source] ──→ [DryGain] ────────────────────────→ [SumGain] → [next in chain]
         └─→ [ConvolverNode + IR] → [WetGain] ──┘
```

- Knob at 50% (AI default): wet gain matches AI's reverb_wet value
- Knob at 0%: wet gain = 0 (dry only)
- Knob at 100%: wet gain = 2x AI's value
- IR selection based on reverbStyle setting (Hall → hall IR, Plate → plate IR, Room → room IR)
- Label below knob: "Preview — final render uses studio-quality reverb" so artists know this is approximate
- The approximation won't match Pedalboard's reverb exactly but gives directional feedback — "more reverb" or "less reverb" sounds correct even if the tail character differs

### Delay Preview (Web Audio)

Per-stem DelayNode with feedback loop. Cheap to run and sounds close to the real DSP:

```
[Source] ──→ [DryGain] ──────────────────────────────→ [SumGain] → [next in chain]
         └─→ [DelayNode] → [FeedbackGain] → [back to DelayNode]
                         └─→ [WetGain] ──────────────┘
```

- Delay time synced to BPM: `60 / bpm * delayMultiplier` (1/4 note, dotted eighth, etc. based on delayStyle)
- Feedback gain: 0.3 default (2-3 repeats that decay naturally)
- Knob at 50% (AI default): wet gain matches AI's delay send
- Knob at 0%: wet gain = 0
- Knob at 100%: wet gain = 2x AI's value
- No label needed — Web Audio delay sounds nearly identical to the server-side implementation

### Compression Preview

Compression remains visual-only. Web Audio's DynamicsCompressorNode doesn't expose the same controls as Pedalboard (no parallel compression, no two-stage, no threshold-from-signal logic). A bad browser compressor preview would mislead the artist more than no preview at all.

- Show the knob position visually
- Label: "Applied on re-render"
- The compression knob still controls the parameter sent to predict.py

### Playback Sync

All stem audio elements share the same `currentTime`. A master clock drives all playback. When play is pressed, all stems start simultaneously. Seeking on any stem seeks all of them.

### Performance

- Limit to 12 simultaneous audio elements (stems + beat sub-stems)
- Monitor AudioContext state — if it suspends (browser tab hidden), resume on focus
- Lazy-load stem audio — don't download all stems on page load. Load the first 4 (vocal + beat), then load others as the artist scrolls or clicks

---

## MOBILE / TABLET BEHAVIOR

### Below 768px (phone)

Don't render the mixer. Show:
```
"The Pro Studio Mixer is designed for larger screens.
Open this page on your desktop or tablet for the full mixing experience."
```

With a link to the standard results page (which is fully mobile-responsive).

### 768px - 1024px (tablet)

Render the mixer but with modifications:
- Channel strips are narrower (60px instead of 80px)
- Effect knobs are touch-friendly (44px minimum tap target)
- Section timeline scrolls horizontally
- Master strip is full-width below the channel strips instead of beside them
- Faders respond to vertical swipe gestures

### Above 1024px (desktop)

Full layout as described. Channel strips at 80px, master strip on the right side.

---

## KEYBOARD SHORTCUTS

| Shortcut | Action |
|----------|--------|
| Space | Play / Pause |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| 1-9 | Toggle mute on stem 1-9 |
| Shift+1-9 | Toggle solo on stem 1-9 |
| A | Toggle A/B snapshot comparison |
| R | Toggle reference playback |
| S | Save snapshot |
| Cmd+S | Re-render |
| Left/Right arrows | Seek ±5 seconds |
| Up/Down arrows | Master volume ±0.5dB |
| Tab | Cycle focus between channel strips |
| Escape | Deselect section (return to All) |

Shortcuts shown in a "?" help overlay accessible from the top bar.

---

## SCHEMA ADDITIONS

```prisma
// Add to MixJob model
studioState       Json?     // Current mixer state (faders, knobs, sections, master)
studioSnapshots   Json?     // Array of saved snapshots
studioFilePath    String?   // Path to studio re-rendered mix
studioStatus      String?   // null | STUDIO_RENDERING | STUDIO_COMPLETE
studioRenderedAt  DateTime?
```

---

## API ROUTES

```
GET  /api/mix-console/job/[id]/studio          — Load studio state + stem URLs
POST /api/mix-console/job/[id]/studio/save      — Save mixer state + snapshots
POST /api/mix-console/job/[id]/studio/render    — Submit re-render with deltas
POST /api/mix-console/job/[id]/studio/ai-assist — Per-stem Claude assist
POST /api/mix-console/job/[id]/studio/ai-polish — Global Claude polish
GET  /api/mix-console/job/[id]/studio/stem/[role] — Fresh signed URL for individual stem
```

All routes require Pro tier verification + standard auth (session owner / guest token).

---

## COG CHANGES

### New action: studio-render

`predict.py` gets a new `_studio_render` method:

1. Load all processed stems from Supabase
2. Load dry stems from Supabase (for dry/wet blending)
3. Apply deltas from studio state on top of original parameters
4. Apply section-specific overrides with 50ms crossfades
5. Apply master bus adjustments
6. Render single `studio_mix.wav`
7. Generate preview waveform
8. Upload to Supabase, return paths + signed URLs

Input: `studio_deltas_json` (string, same as mix_params_json pattern)

---

## FILES TO CREATE

| File | Purpose |
|------|---------|
| `src/app/mix-console/studio/page.tsx` | Guest route with token validation |
| `src/app/dashboard/ai/mix-console/[id]/studio/page.tsx` | Subscriber route |
| `src/app/mix-console/studio/StudioClient.tsx` | Main studio component |
| `src/app/mix-console/studio/ChannelStrip.tsx` | Per-stem channel strip |
| `src/app/mix-console/studio/MasterStrip.tsx` | Master bus controls |
| `src/app/mix-console/studio/EffectKnob.tsx` | Circular knob component |
| `src/app/mix-console/studio/VolumeFader.tsx` | Vertical fader with meter |
| `src/app/mix-console/studio/PanKnob.tsx` | Pan control |
| `src/app/mix-console/studio/SectionTimeline.tsx` | Section selector bar |
| `src/app/mix-console/studio/MiniVisualizer.tsx` | Per-strip 5-band visualizer |
| `src/app/mix-console/studio/SnapshotManager.tsx` | Save/load/A-B compare |
| `src/app/mix-console/studio/ReferenceOverlay.tsx` | Reference comparison toggle |
| `src/app/mix-console/studio/StemExport.tsx` | Solo'd stem download |
| `src/app/mix-console/studio/useStudioAudio.ts` | Web Audio API graph setup |
| `src/app/mix-console/studio/useUndoRedo.ts` | History stack hook |
| `src/app/mix-console/studio/types.ts` | Shared interfaces |
| `src/app/api/mix-console/job/[id]/studio/route.ts` | Load studio state |
| `src/app/api/mix-console/job/[id]/studio/save/route.ts` | Save state |
| `src/app/api/mix-console/job/[id]/studio/render/route.ts` | Submit re-render |
| `src/app/api/mix-console/job/[id]/studio/ai-assist/route.ts` | Per-stem Claude call |
| `src/app/api/mix-console/job/[id]/studio/ai-polish/route.ts` | Global Claude polish |

---

## IMPLEMENTATION ORDER

1. Schema additions + `prisma db push`
2. `useStudioAudio.ts` — Web Audio API graph with per-stem gain/pan/mute/solo + master chain
3. `VolumeFader.tsx` + `PanKnob.tsx` — basic controls with level meters
4. `ChannelStrip.tsx` — assemble controls into a strip
5. `StudioClient.tsx` — shell layout, load stems, wire audio graph
6. Test: stems play with individual gain/pan/mute/solo working in real time
7. `EffectKnob.tsx` — circular knob component (reverb, delay, comp, brightness)
8. Wire brightness knob to biquad filter in audio graph (real-time preview)
9. Wire reverb knob to ConvolverNode with impulse response (approximate real-time preview)
10. Wire delay knob to DelayNode with feedback loop (real-time preview)
11. Wire compression knob as visual-only (label "Applied on re-render")
12. `MasterStrip.tsx` — master volume, stereo width, 5-band EQ, AI intensity
13. Wire master EQ to biquad chain in audio graph (real-time preview)
14. `MiniVisualizer.tsx` — per-stem 5-band analyser display
15. `SectionTimeline.tsx` — section selector with per-section state management
16. `useUndoRedo.ts` — history stack with grouped changes
17. `SnapshotManager.tsx` — save/load/A-B compare, "AI Original" protected snapshot
18. Autosave — 30-second interval, isDirty flag, silent POST, restore on load, amber warning on failure
19. Dry/wet slider per stem — blend between processed and original audio
20. AI Assist per stem — Haiku call, animate knobs to Claude's suggestion
21. AI Polish global — Opus call, animate all affected controls
22. `ReferenceOverlay.tsx` — reference playback + frequency overlay
23. Linked stems — chain-link toggle between doubles/harmony pairs
24. Solo'd stem export
25. API routes — save, load, render, ai-assist, ai-polish
26. `_studio_render` Cog action — apply deltas, render studio_mix.wav
27. Visual diff on re-render — before/after frequency overlay + plain-English change summary + A/B playback
28. Cog push + SHA update
29. Keyboard shortcuts
30. Mobile/tablet responsive handling
31. Accessibility pass — focus management, aria labels, screen reader announcements
32. Bundle impulse response WAV files for reverb preview

---

## VISUAL DESIGN

- Background: same dark palette as results page (#0D0B09 base, #1a1816 panels)
- Channel strips: #1a1816 background, 0.5px #2A2824 borders, 4px radius
- Active controls: gold (#D4AF37) for selected, coral (#E8735A) for play/active states
- Knobs: dark circular arc with gold fill showing the value. Thin gold line from center indicating position. Gold dot at the AI's original position for reference.
- Faders: vertical track in dark grey, gold thumb. Level meter bars beside it in green/yellow/red gradient.
- Mute button: grey default, red when active. Solo: grey default, yellow when active.
- AI Assist sparkle icon: gold, subtle pulse when available. Coral during processing.
- Re-render button: gold fill, disabled (grey outline) when no changes. Gold pulse when changes are pending.
- Section timeline: dark blocks with light text, gold border + fill on active section, connected by thin lines.
- Typography: same system font stack as rest of platform. 10-12px for labels, 9px for value readouts on knobs.
- Animations: all control movements lerp at 300ms. Undo/redo at 100ms. Snapshot load at 300ms. AI assist knob animation at 300ms with slight overshoot easing for natural feel.

---

## COMPETITIVE ADVANTAGES OVER SUNO STUDIO & MOISES

| Feature | IndieThis Pro Studio | Suno Studio | Moises AI Studio |
|---------|---------------------|-------------|------------------|
| AI-assisted knob adjustment per stem | ✅ Claude analyzes and auto-adjusts | ❌ Manual only | ❌ Manual only |
| Global AI Polish with reference matching | ✅ Opus + reference profile | ❌ | ❌ Genre presets only |
| Section-aware mixing (per-section overrides) | ✅ Full per-section control | ❌ Section regeneration only | ❌ |
| Reference comparison inside mixer | ✅ Overlay frequency analysis | ❌ | ❌ |
| Timestamped revision markers | ✅ From results page | ❌ | ❌ |
| Real-time frequency visualizer per stem | ✅ 5-band per channel | ❌ Static waveform | ❌ |
| Dry/wet blend per stem | ✅ Gradient slider | ❌ Binary Remove FX | ❌ |
| AI intensity master control | ✅ | ❌ | ❌ |
| Solo'd stem export | ✅ | ✅ (up to 12 stems) | ✅ |
| Undo/redo with grouped changes | ✅ 100-step stack | ❌ | ❌ |
| Linked stems (doubles/harmonies) | ✅ | ❌ | ❌ |
| Snapshot A/B comparison | ✅ | ❌ | ❌ |

---

## COST IMPACT

| Component | Cost per use |
|-----------|-------------|
| Web Audio API (client-side preview) | $0 |
| AI Assist per stem (Haiku) | ~$0.005 |
| AI Polish global (Opus + thinking) | ~$0.15-0.30 |
| Studio re-render (Replicate) | ~$0.03-0.05 |
| Supabase storage (studio mix file) | < $0.001 |
| Total (one re-render + one polish) | ~$0.20-0.40 |

At $99.99 Pro tier pricing: 99.6%+ margin even with heavy studio usage.

---

## BUNDLED ASSETS

### Impulse Response Files (for reverb preview)

Three small WAV files bundled in `/public/audio/ir/`:

| File | Type | Size | Use |
|------|------|------|-----|
| `hall.wav` | Large hall IR | ~50KB | reverbStyle = HALL or CATHEDRAL |
| `plate.wav` | Plate reverb IR | ~40KB | reverbStyle = PLATE |
| `room.wav` | Small room IR | ~30KB | reverbStyle = ROOM or DRY |

Loaded once on studio mount, cached in memory. The ConvolverNode swaps IR buffers when reverbStyle changes.

Source: generate synthetically via `scipy.signal` offline (exponential decay with frequency-dependent damping), or use royalty-free IRs from OpenAIR project. Do not use commercial IRs.

---

## MARKETING NOTE

The competitive advantage table in this spec is marketing-ready content. Use it directly on the IndieThis website as a comparison page or section on the Pro tier landing page. It's factual, specific, and positions IndieThis against the two closest competitors with feature-by-feature superiority.

Suggested placement: `/pricing` page under the Pro tier card, or a dedicated `/pro-studio` feature page. The table sells the upgrade from Premium to Pro better than any paragraph of copy could.

Additional marketing angles from this spec:
- "AI that listens to your feedback" — the AI Assist and AI Polish buttons are unique selling points
- "Your mix, your way" — the studio gives control without requiring engineering knowledge
- "See the difference" — the frequency visualizer and before/after re-render diff are visual proof
- "Never lose your work" — autosave + snapshots + undo/redo + protected AI Original
- "Export any stem" — producers can pull processed stems for their DAW
