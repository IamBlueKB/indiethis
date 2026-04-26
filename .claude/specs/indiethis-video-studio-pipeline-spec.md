# IndieThis — Video Studio Pipeline Spec
_For Sonnet — Numbered Steps — Search Codebase First_

---

## CONTEXT

Video Studio has never produced a multi-shot video. Director Mode generates a shot list but only one clip has ever been produced — an 8-second animation of the uploaded photo. The multi-shot loop fix (using `vid.shotList` to fire parallel Kling i2v calls per scene) is ready but not deployed. This spec adds that fix plus a FLUX Kontext Pro keyframe generation step, and defines three distinct product flows: Canvas, Quick Mode, and Director Mode.

**Before coding anything:** Search the codebase for every file referenced in this spec. Understand the existing data flow before making changes.

---

## WHAT NOT TO DO

- Do NOT use `fal-ai/kling-video/v3/pro/text-to-video` with `elements` + `@Element1` in prompts — Kling's API rejects it. Confirmed broken.
- Do NOT leave `@Element1` in any Director prompt, system prompt, or context hint. Strip it everywhere.
- Do NOT make changes not explicitly listed in this spec.
- Do NOT use `onnxruntime-node`. Do NOT run audio analysis on Vercel serverless.

---

## THREE PRODUCTS

### 1. Canvas — $14.99
- Single shot, 3–9 second loop for Spotify Canvas
- No Director chat, no shot list, no approval step
- Artist uploads photo, picks a style from the 25 style options, sets duration (3–9s)
- Pipeline: style prompt → 1 FLUX Kontext Pro keyframe → 1 Kling i2v clip → loop output
- Output format: MP4 loop, 9:16 vertical (Spotify Canvas spec)
- Your cost: ~$1.38 max

### 2. Quick Mode
- No Director chat, no storyboard approval
- Auto-generates shot list from audio analysis data (BPM, key, energy, genre, mood) + selected style
- Artist uploads photo, picks a style, picks a tier, pays
- Pipeline: auto shot list → FLUX keyframes → Kling i2v per scene → Remotion assembly
- No Claude API cost in this flow

**Quick Mode Tiers:**
| Tier | Shots | Max Duration | Price |
|------|-------|-------------|-------|
| Quick 60 | 4 | 60s | $29.99 |
| Quick 120 | 6 | 120s | $49.99 |

### 3. Director Mode
- Full pipeline: Director chat with Claude → structured shot list → FLUX keyframes → artist approval (storyboard view) → Kling i2v per scene → Remotion assembly
- Claude API cost applies

**Director Mode Tiers:**
| Tier | Shots | Max Duration | Price |
|------|-------|-------------|-------|
| Director 60 | 4 | 60s | $39.99 |
| Director 120 | 6 | 120s | $59.99 |
| Director 240 | 10 | 240s | $89.99 |

---

## SUBSCRIPTION ALLOCATIONS

| Plan | Monthly Included Video | Value |
|------|----------------------|-------|
| Launch ($19/mo) | None | — |
| Push ($49/mo) | 1 Director video (4 shots / 60s) | $39.99 |
| Reign ($99/mo) | 1 Director video (6 shots / 120s) | $59.99 |
| Studio Pro ($49/mo) | None | — |
| Studio Elite ($99/mo) | None | — |

- Additional videos for subscribers are full price (no discount on Video Studio)
- Subscriber discounts will apply to other tools (Cover Art, Mix & Master, etc.) — defined separately

---

## PAYMENT GATE

**Step 1 in every flow.** No API calls fire until payment clears.

- Non-subscriber: Stripe payment must complete before anything runs
- Subscriber with included credit: verify plan + remaining allocation before anything runs
- Subscriber buying additional: Stripe payment must complete

The only free step is audio analysis at upload time (Replicate, ~$0.006/track, already runs at upload via `trigger/audio-features`).

---

## PIPELINE — DIRECTOR MODE (Full)

This is the complete pipeline. Canvas and Quick Mode are subsets.

### Step 1 — Payment
Stripe checkout for selected tier. Confirm payment before proceeding.

### Step 2 — Director Mode Chat
- Claude API call with `DIRECTOR_SYSTEM_PROMPT` + audio analysis context (`contextHint` with BPM, key, energy, `essentiaCtx` with genre/mood/instruments)
- `generateInitialGreeting()` runs — Claude states style + promptBase + audio findings, asks artist creative questions
- Conversation produces a structured shot list stored in `vid.shotList`
- Each shot in the list must contain: `description`, `cameraDirection`, `filmLook`, `duration`

### Step 3 — FLUX Keyframe Generation
- **Existing pattern:** `generateCharacterPortrait` in `generator.ts` already uses FLUX Kontext Pro. Follow the same pattern.
- For each shot in `vid.shotList`:
  - Call FLUX Kontext Pro (`fal-ai/flux-pro/kontext`) with:
    - `image_url`: artist's uploaded reference photo
    - `prompt`: combine shot description + camera direction + film look into a scene composition prompt. Example: "Place this person [shot description]. [camera direction]. [film look]."
  - Store the returned image URL on the shot: `shotList[i].keyframeUrl`
- Run up to 3 concurrent FLUX calls (same concurrency pattern as scene generation)
- Cost: $0.04 per keyframe

### Step 4 — Storyboard Approval (Director Mode Only)
- Display all keyframe images to the artist in a grid/list view
- Artist can:
  - **Accept** a keyframe (no action needed, it stays)
  - **Regenerate** a keyframe (fires a new FLUX call with the same inputs, replaces `keyframeUrl`)
  - **Accept All** to proceed to video generation
- **3 regenerations max per individual shot** — track count per shot on the shotList JSON: `shotList[i].redoCount` (default 0, max 3)
- After 3 redos on a shot, that shot's regenerate button is disabled
- Cost per redo: $0.04

### Step 5 — Video Generation (Multi-Shot Loop)
- This is the multi-shot fix: loop through all shots in `vid.shotList` and fire one fal.ai call per scene
- For each shot:
  - Call `fal-ai/kling-video/v3/pro/image-to-video` via `fal.queue.submit()` + webhook
  - `image_url`: use `shotList[i].keyframeUrl` (the FLUX-generated keyframe) — NOT the original artist photo
  - `prompt`: that shot's `description` + `cameraDirection` + `filmLook`
  - `duration`: that shot's specified duration (respect ≤15s chunking — if a shot is >15s, chunk it)
- Max 3 concurrent fal calls
- Each job tracked by `FalSceneJob` — one record per scene
- Delete stale `FalSceneJob` records before each retry (already fixed)
- Webhooks update `FalSceneJob` status per scene

### Step 6 — Assembly
- When all `FalSceneJob` records for this video are complete:
  - Collect all clip URLs in shot list order
  - Send to Remotion Lambda for final assembly with the original audio track
  - Output: MP4 at selected aspect ratio
- Remotion serve URL: `https://remotionlambda-useast1-cgsi0sjcmz.s3.us-east-1.amazonaws.com/sites/indiethis-lyric-video/index.html`
- 4 compositions already deployed

### Step 7 — Delivery
- Final video URL stored on the video record
- Artist can download or share

---

## PIPELINE — QUICK MODE

Same as Director Mode but:
- **Skip Step 2** — no Director chat. Instead, auto-generate a shot list:
  - Use audio analysis data (BPM, key, energy, genre, mood from DB) + selected style to build shot descriptions
  - This can be a simple template system, no Claude API call needed
  - Example: for a 4-shot/60s Quick video, generate 4 shots at 15s each with style-appropriate descriptions
- **Skip Step 4** — no storyboard approval. Keyframes go straight to Kling.
- Steps 1, 3, 5, 6, 7 remain the same

---

## PIPELINE — CANVAS

Same as Director Mode but:
- **Skip Step 2** — no Director chat
- **Step 3** — only 1 FLUX keyframe (single shot)
  - Use artist photo + selected style as the prompt
- **Skip Step 4** — no approval
- **Step 5** — only 1 Kling i2v call, duration 3–9s (artist-selected)
- **Step 6** — no Remotion assembly needed, output is the single clip as a loop
  - Output format: MP4 loop, 9:16 vertical
- Steps 1, 7 remain the same

---

## DATA MODEL CHANGES

### shotList JSON structure (per shot)
```json
{
  "description": "Artist standing on a rooftop at sunset, city skyline behind",
  "cameraDirection": "Slow dolly forward, slight low angle",
  "filmLook": "Golden hour warmth, shallow depth of field, lens flare",
  "duration": 15,
  "keyframeUrl": "https://fal.ai/...",
  "redoCount": 0
}
```

- `keyframeUrl` — new field, populated after FLUX generation
- `redoCount` — new field, tracks regeneration count per shot (max 3)
- No new Prisma migration needed — shotList is already a JSON field

---

## EXISTING CODE TO MODIFY

Search for and modify these files:

1. **`generator.ts`** — `generateCharacterPortrait` already uses FLUX Kontext Pro. Add a new function `generateSceneKeyframe(referencePhotoUrl, shotDescription, cameraDirection, filmLook)` following the same pattern.

2. **`generateAllScenes`** — modify the loop to:
   - First pass: generate FLUX keyframes for all shots (store on shotList)
   - Second pass (after approval in Director Mode, immediately in Quick/Canvas): fire Kling i2v calls using keyframe URLs instead of the original artist photo

3. **Director system prompt / context hint** — strip all references to `@Element1`

4. **`chat/route.ts`** — no changes to Director chat flow itself, but ensure the shot list output is structured with the fields listed above

5. **`fal.queue.submit()` calls** — change `image_url` parameter from artist's reference photo to `shotList[i].keyframeUrl`

6. **Pricing / Stripe** — update product prices and add new products for Canvas and Quick Mode tiers

7. **Explore page** — update from $19 to reflect new pricing structure

8. **Video Studio UI** — add:
   - Product selection (Canvas / Quick / Director)
   - Tier selection within each product
   - Style picker (shared across all three products)
   - Duration picker for Canvas (3–9s)
   - Storyboard approval view for Director Mode (grid of keyframe images with Accept/Regenerate/Accept All)

---

## COST BREAKDOWN PER PRODUCT

### Canvas ($14.99)
| Item | Cost |
|------|------|
| 1 FLUX keyframe | $0.04 |
| 1 Kling clip (5–9s) | $0.84–$1.51 |
| **Total** | **~$0.88–$1.55** |
| **Margin** | **~$13.44–$14.11** |

### Quick 60 ($29.99)
| Item | Cost |
|------|------|
| 4 FLUX keyframes | $0.16 |
| 4 Kling clips (60s total) | ~$10.08 |
| **Total** | **~$10.24** |
| **Margin** | **~$19.75** |

### Quick 120 ($49.99)
| Item | Cost |
|------|------|
| 6 FLUX keyframes | $0.24 |
| 6 Kling clips (120s total) | ~$20.16 |
| **Total** | **~$20.40** |
| **Margin** | **~$29.59** |

### Director 60 ($39.99)
| Item | Cost |
|------|------|
| Claude Director chat | ~$0.10–0.15 |
| 4 FLUX keyframes + up to 12 redos | $0.16–$0.64 |
| 4 Kling clips (60s total) | ~$10.08 |
| **Total** | **~$10.34–$10.87** |
| **Margin** | **~$29.12–$29.65** |

### Director 120 ($59.99)
| Item | Cost |
|------|------|
| Claude Director chat | ~$0.10–0.15 |
| 6 FLUX keyframes + up to 18 redos | $0.24–$0.96 |
| 6 Kling clips (120s total) | ~$20.16 |
| **Total** | **~$20.50–$21.27** |
| **Margin** | **~$38.72–$39.49** |

### Director 240 ($89.99)
| Item | Cost |
|------|------|
| Claude Director chat | ~$0.10–0.15 |
| 10 FLUX keyframes + up to 30 redos | $0.40–$1.60 |
| 10 Kling clips (240s total) | ~$40.32 |
| **Total** | **~$40.82–$42.07** |
| **Margin** | **~$47.92–$49.17** |

---

## KLING PRICING NOTE

Costs above use Kling Standard tier at $0.168/s on fal.ai. If using Pro tier ($0.392/s), costs roughly double. **Start with Standard tier.** Evaluate Pro quality after the pipeline is working end-to-end. If Standard quality is insufficient, prices may need adjustment.

---

## IMPLEMENTATION ORDER

1. **Deploy the multi-shot loop fix** — `vid.shotList` prompts, parallel Kling i2v calls, webhook tracking, Remotion assembly. Test with a real track and confirm a multi-clip video is produced (even with the same photo per scene).

2. **Add FLUX keyframe step** — `generateSceneKeyframe` function, insert before Kling calls, store `keyframeUrl` on shotList. Test that each scene now has a unique starting frame.

3. **Add storyboard approval UI** — keyframe grid, regenerate button with redoCount tracking, Accept All button. Director Mode only.

4. **Build Canvas flow** — single shot, style picker, duration picker, no chat, no approval, loop output.

5. **Build Quick Mode flow** — auto shot list generation from analysis data + style, no chat, no approval.

6. **Update pricing** — new Stripe products, explore page, product selection UI.

7. **Strip `@Element1`** — remove from Director system prompt, context hint, and any other references.

---

## VERIFICATION

After implementation, test with Razor's Edge (dark cinematic trap, ~140 BPM, F minor):

1. Director Mode: Does the chat produce a structured shot list with description/camera/filmLook/duration per shot?
2. Does each shot get a unique FLUX keyframe showing the artist in different scenes?
3. Does the storyboard display all keyframes for approval?
4. Does regeneration work and respect the 3-redo limit?
5. Does each approved keyframe get sent to Kling as the i2v source (not the original photo)?
6. Do all clips come back via webhooks and get tracked by FalSceneJob?
7. Does Remotion stitch all clips with the audio into a final MP4?
8. Does the final video have visible scene variety (different character poses, locations, framing per shot)?
9. Does payment gate block all API calls until Stripe confirms?
10. Does Canvas produce a single looping clip in 9:16?
