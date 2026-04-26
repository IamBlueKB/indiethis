# IndieThis — Video Studio Pricing & Configuration Update
_For Sonnet — Search codebase before coding_

---

## NEW VIDEO STUDIO PRICING

### Canvas
- **$14.99** — single shot, 3–9s loop (Spotify Canvas, 9:16 vertical)

### Quick Mode (no Director chat, no storyboard approval)
- **$39.99** — 8 shots / 60s max
- **$59.99** — 12 shots / 120s max

### Director Mode (Claude chat, storyboard approval, 3 redos per shot)
- **$69.99** — 8 shots / 60s max
- **$99.99** — 12 shots / 120s max

---

## SHOT DURATION

- Max scene duration: 10 seconds
- Min scene duration: 5 seconds
- Director/auto-generator should vary pacing based on audio analysis — faster cuts (5-6s) on choruses and high-energy sections, longer holds (8-10s) on verses and mood shots
- 60s tier: 8 shots × ~7.5s avg = 60s
- 120s tier: 12 shots × ~10s avg = 120s

---

## TIER LOGIC

- Artists buy a tier, not seconds. If their song is 30 seconds, the 60s tier still applies — 8 shots fill it with shorter scenes
- No 30s tier needed — Canvas covers the short clip use case
- 60s is the minimum for Quick and Director modes
- No 240s tier at launch — cap at 120s max

---

## SUBSCRIBER ALLOCATIONS

| Plan | Monthly Included Video | Value |
|------|----------------------|-------|
| Launch ($19/mo) | None | — |
| Push ($49/mo) | 1 Director video (8 shots / 60s) | $69.99 |
| Reign ($99/mo) | 1 Director video (12 shots / 120s) | $99.99 |
| Studio Pro ($49/mo) | None | — |
| Studio Elite ($99/mo) | None | — |

- Additional videos at full price — no subscriber discount on Video Studio
- Subscriber discounts apply to other tools (Cover Art, Mix & Master, etc.) — defined separately

---

## COST BREAKDOWN

### Canvas ($14.99)
| Item | Cost |
|------|------|
| 1 FLUX keyframe | $0.04 |
| 1 Kling clip (3–9s) | $0.50–$1.51 |
| **Total** | **~$0.54–$1.55** |
| **Margin** | **~$13.44–$14.45** |

### Quick 60s ($39.99)
| Item | Cost |
|------|------|
| 8 FLUX keyframes | $0.32 |
| 8 Kling clips (~60s total) | ~$13.44 |
| **Total** | **~$13.76** |
| **Margin** | **~$26.23** |

### Quick 120s ($59.99)
| Item | Cost |
|------|------|
| 12 FLUX keyframes | $0.48 |
| 12 Kling clips (~120s total) | ~$20.16 |
| **Total** | **~$20.64** |
| **Margin** | **~$39.35** |

### Director 60s ($69.99)
| Item | Cost |
|------|------|
| Claude Director chat | ~$0.10–0.15 |
| 8 FLUX keyframes + up to 24 redos | $0.32–$1.28 |
| 8 Kling clips (~60s total) | ~$13.44 |
| **Total** | **~$13.86–$14.87** |
| **Margin** | **~$55.12–$56.13** |

### Director 120s ($99.99)
| Item | Cost |
|------|------|
| Claude Director chat | ~$0.10–0.15 |
| 12 FLUX keyframes + up to 36 redos | $0.48–$1.92 |
| 12 Kling clips (~120s total) | ~$20.16 |
| **Total** | **~$20.74–$22.23** |
| **Margin** | **~$77.76–$79.25** |

---

## WHAT TO UPDATE

### 1. Explore Page
- Change "create yours from $19" to "create yours from $14.99"
- Search codebase for any other references to old pricing ($19, $14.99-24.99, $24.99-39.99)

### 2. Stripe Products
- Create new Stripe products and prices for each tier:
  - Canvas: $14.99
  - Quick 60s: $39.99
  - Quick 120s: $59.99
  - Director 60s: $69.99
  - Director 120s: $99.99
- Update env vars with new Stripe price IDs
- Remove any old Video Studio price references

### 3. Video Studio Landing Page
- Update pricing display to reflect new tiers
- Update mode selection UI with correct prices per tier
- Remove any references to 240s/4-minute tier

### 4. Shot Count Configuration
- 60s tiers: 8 shots max
- 120s tiers: 12 shots max
- Canvas: 1 shot
- Update any hardcoded shot limits in the generate route, Director prompt, and shot list generator

### 5. Duration Configuration
- Max scene duration: 10 seconds
- Min scene duration: 5 seconds
- Remove 240s option from any duration pickers or tier selectors
- Max total video duration: 120 seconds

### 6. Subscriber Credit Check
- Push plan: check for 1 included Director 60s video per month
- Reign plan: check for 1 included Director 120s video per month
- Additional videos charge full price via Stripe

---

## DO NOT CHANGE

- The webhook pipeline (FLUX → Kling → Remotion) — it's working, don't touch it
- The fal.ai endpoints or parameters — they're correct
- `generate_audio: false` on all Kling calls — keep it
- `framesPerLambda: 200` on Remotion renders — keep it
- The Director Mode chat flow — it works
- Ken Burns scale, easing curves, crossfade timing — leave alone
