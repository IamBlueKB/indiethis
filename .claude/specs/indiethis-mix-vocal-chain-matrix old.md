# IndieThis — AI Mix Console: Genre + Role Vocal Chain Matrix
_For Sonnet — Update predict.py mix chains to use this matrix. Each vocal role gets different processing based on genre. Replace the current generic per-role chains._

---

## HOW IT WORKS

1. Claude detects genre (from analysis or user selection)
2. Engine classifies each vocal stem by role (lead, double, ad-lib, backing/harmony, ins/outs)
3. Engine looks up the chain: `CHAIN_MATRIX[genre][role]` → gets specific DSP parameters
4. Pedalboard applies the chain per stem

The artist doesn't see this matrix. They see a simple "Vocal style preset" dropdown:
- **Auto** — Claude picks based on genre (default)
- **Clean and natural** — minimal processing, preserve raw character
- **Lo-fi and gritty** — telephone filters, saturation, tape feel
- **Airy and spacious** — wide reverb, open, ethereal
- **Raw and upfront** — dry, compressed, in-your-face

If Auto is selected, use the genre matrix below. If a preset is selected, it overrides the genre defaults with that vibe applied across all roles.

Premium/Pro custom textarea can override specific roles: "keep ad-libs clean" → Claude removes the telephone effect from ad-libs only.

---

## GENRE LIST (add Afrobeats)

Update the genre enum everywhere it appears:

```
HIP_HOP | TRAP | RNB | POP | ROCK | ELECTRONIC | ACOUSTIC | LO_FI | AFROBEATS | LATIN | COUNTRY | GOSPEL
```

---

## CHAIN MATRIX

### HIP-HOP / TRAP

| Role | High-pass | EQ | Compression | Saturation | Reverb | Delay | Pan | Detune | Special |
|------|-----------|-----|-------------|------------|--------|-------|-----|--------|---------|
| **Lead** | 80Hz 12dB/oct | +3dB at 3kHz presence, -2dB at 300Hz mud cut | Ratio 4:1, attack 2ms, release 80ms → stage 2: ratio 2.5:1, attack 15ms, release 200ms | Light tube 3% | Short plate, 15% wet, 0.8s decay | None (delay throws from Claude) | Center | None | De-esser 4-8kHz, vocal rider |
| **Ad-libs** | 300Hz 12dB/oct (bandpass low cut) | Low-pass at 3kHz (telephone bandpass), +2dB at 1kHz | Ratio 5:1, fast attack 1ms, release 60ms — squash it | Medium drive 8-12%, gritty | Slapback room, 10% wet, 0.3s decay | Slapback 1/16 note, 1 repeat, -8dB | Alternate L20/R20 per phrase | None | This is the telephone/lo-fi effect |
| **Doubles** | 100Hz 12dB/oct | Gentle presence +1.5dB at 4kHz, cut -3dB at 2kHz (stay behind lead) | Ratio 4:1, attack 3ms, release 100ms | Light 2% | Same as lead but 20% wet | None | Hard pan L35/R35 | ±12 cents (one copy +12, one copy -12) | Blend -4dB below lead |
| **Ins & Outs** | 200Hz 12dB/oct | Slight telephone tilt — less extreme than ad-libs, -3dB below 500Hz, -2dB above 4kHz | Ratio 3:1, attack 5ms, release 120ms | Light 4% | Short room, 12% wet | Short pre-delay 30ms, 1 repeat | Alternate L15/R15 | None | Blend -6dB below lead, tighter timing |
| **Harmonies** | 120Hz 12dB/oct | Wide presence +2dB at 5kHz, warmth +1dB at 200Hz | Ratio 5:1, flatten dynamics | Light 3% | Plate, 25% wet, 1.2s decay | None | Wide L50/R50 spread | ±8 cents per layer | Blend -6 to -8dB below lead, heavy de-ess |

### R&B

| Role | High-pass | EQ | Compression | Saturation | Reverb | Delay | Pan | Detune | Special |
|------|-----------|-----|-------------|------------|--------|-------|-----|--------|---------|
| **Lead** | 80Hz 12dB/oct | +2dB warm shelf at 200Hz, +2dB silky air at 12kHz, -1.5dB at 400Hz | Ratio 3:1, attack 5ms, release 150ms — gentle, preserve dynamics | Warm tube 2% | Plate, 20% wet, 1.5s decay, high damping | Dotted eighth, subtle, -12dB | Center | None | De-esser gentle, vocal rider |
| **Ad-libs** | 100Hz 12dB/oct | Clean — no telephone. Air boost +2dB at 10kHz | Ratio 3:1, attack 8ms, release 200ms | None | Hall, 25% wet, 2s decay — airy and spacious | Quarter note, 2 repeats, -10dB | L15/R15 alternating | None | Blend -5dB below lead, keep clean |
| **Doubles** | 100Hz 12dB/oct | Match lead EQ but pull back presence -1dB | Ratio 3:1, same as lead | Warm 2% | Same as lead, 22% wet | None | L25/R25 | ±7 cents — tighter than hip-hop | Blend -3dB below lead |
| **Harmonies** | 100Hz 12dB/oct | Warm +2dB at 250Hz, air +3dB at 10kHz | Ratio 4:1, smooth | Light 2% | Lush plate, 30% wet, 2s decay, high damping | None | Wide L45/R45 | ±5 cents per layer | Prominent — only -4dB below lead, this is R&B |

### AFROBEATS

| Role | High-pass | EQ | Compression | Saturation | Reverb | Delay | Pan | Detune | Special |
|------|-----------|-----|-------------|------------|--------|-------|-----|--------|---------|
| **Lead** | 80Hz 12dB/oct | Bright presence +3dB at 4-5kHz, air +2dB at 12kHz, gentle warmth +1dB at 200Hz — vocals should be bright and forward | Ratio 3:1, attack 8ms, release 180ms — lighter compression, preserve natural dynamics and energy | Light 2% | Room, 15% wet, 0.6s decay — tight, not washy | Dotted eighth tempo-synced, subtle, -10dB | Center | None | De-esser moderate, vocal rider with wider tolerance (allow more dynamic range) |
| **Ad-libs** | 120Hz 12dB/oct | Bright +3dB at 5kHz, clean and percussive — no telephone effect | Ratio 3:1, attack 3ms, release 100ms — keep transients for percussive feel | None | Short room, 10% wet, 0.4s decay | Short slapback 1/32 note, 1 repeat — call-and-response feel | Alternate L25/R25 | None | Blend -4dB below lead — ad-libs more prominent in Afrobeats |
| **Doubles** | 100Hz 12dB/oct | Match lead brightness | Ratio 3:1, match lead | Light 1% | Same as lead | None | L20/R20 | ±8 cents | Blend -3dB below lead — doubles are energy builders |
| **Harmonies** | 100Hz 12dB/oct | Warm +2dB at 250Hz, bright +3dB at 5kHz | Ratio 4:1, smooth leveling | Light 2% | Plate, 25% wet, 1.5s decay | None | Wide L40/R40 | ±6 cents per layer | Prominent — harmonies are a signature of Afrobeats, blend -3 to -4dB below lead. Stack multiple layers wide. |
| **Chants/Group vocals** | 150Hz 12dB/oct | Mid-forward +2dB at 1-2kHz, roll off highs above 8kHz | Ratio 5:1, heavy — glue the group together | Medium 5% | Room, 20% wet, 0.8s decay | None | Wide stereo spread L50/R50 | ±10 cents per layer for thickness | Common in Afrobeats — treat like a percussive group element |

### POP

| Role | High-pass | EQ | Compression | Saturation | Reverb | Delay | Pan | Detune | Special |
|------|-----------|-----|-------------|------------|--------|-------|-----|--------|---------|
| **Lead** | 80Hz 12dB/oct | Bright presence +3dB at 4kHz, air +2.5dB at 12kHz, cut mud -2dB at 300Hz | Ratio 4:1, attack 3ms, release 100ms → stage 2: ratio 2:1, attack 20ms, release 250ms | Light tube 3% | Plate, 18% wet, 1.2s decay | Dotted eighth, -10dB, 2 repeats | Center | None | Heavy de-essing, vocal rider tight |
| **Ad-libs** | 120Hz 12dB/oct | Clean, bright, match lead tone | Ratio 4:1, tight | Light 2% | Same as lead | Eighth note, 1 repeat | L20/R20 | None | Blend -5dB below lead, tight timing |
| **Doubles** | 100Hz 12dB/oct | Match lead, pull back 1dB at presence | Ratio 4:1, match lead | Light 2% | Same as lead, slight more wet 20% | None | Classic L30/R30 | ±10 cents | Blend -3dB below lead |
| **Harmonies** | 100Hz 12dB/oct | Warm +1.5dB at 250Hz, air +2dB at 10kHz | Ratio 5:1, flatten for blend | Light 2% | Hall, 30% wet, 2s decay | None | Wide L45/R45 | ±5 cents per layer | Choir-like stacking, blend -5dB below lead |

### ROCK

| Role | High-pass | EQ | Compression | Saturation | Reverb | Delay | Pan | Detune | Special |
|------|-----------|-----|-------------|------------|--------|-------|-----|--------|---------|
| **Lead** | 100Hz 12dB/oct | Aggressive presence +4dB at 3kHz, grit +2dB at 1kHz, cut mud -3dB at 300Hz | Ratio 4:1, attack 2ms, release 60ms — punchy, aggressive | Medium drive 5-8% | Room, 12% wet, 0.5s decay — tight | Slapback, 1 repeat | Center | None | De-esser aggressive, vocal rider |
| **Ad-libs** | 150Hz 12dB/oct | Mid-forward +3dB at 2kHz | Ratio 5:1, squash | Heavy drive 10% | Short room, 8% wet | Slapback 1/16 | L30/R30 | None | Blend -6dB, raw and gritty |
| **Doubles** | 100Hz 12dB/oct | Match lead aggression | Ratio 4:1 | Medium 6% | Same as lead | None | Hard pan L40/R40 | ±15 cents — wider detune for rock thickness | Blend -3dB |
| **Harmonies** | 120Hz 12dB/oct | Dark — cut above 8kHz, warm +2dB at 250Hz | Ratio 5:1, heavy | Medium 6% | Plate, 20% wet, 1s decay | None | L50/R50 | ±8 cents | Blend -5dB, thick and dark |

### ELECTRONIC / EDM

| Role | High-pass | EQ | Compression | Saturation | Reverb | Delay | Pan | Detune | Special |
|------|-----------|-----|-------------|------------|--------|-------|-----|--------|---------|
| **Lead** | 100Hz 18dB/oct — steep cut, stay out of bass range | Bright +3dB at 5kHz, air +3dB at 12kHz, aggressive mud cut -3dB at 300Hz | Ratio 5:1, attack 1ms, release 50ms — tight, controlled | Light 3% | Large hall, 25% wet, 2.5s decay — spacious | Ping-pong dotted eighth, 3 repeats, -8dB | Center | None | Heavy de-ess, side-chain duck from kick |
| **Ad-libs** | 200Hz 12dB/oct | Filtered — bandpass 500Hz-4kHz for processed feel | Ratio 6:1, squash | Heavy 12%, bitcrusher-style if available | Shimmer reverb, 30% wet, 3s decay | Ping-pong eighth, 4 repeats | Wide L40/R40 | None | Blend -6dB, heavily processed, part of the texture |
| **Doubles** | 120Hz 12dB/oct | Match lead | Ratio 5:1 | Medium 5% | Same as lead | None | L30/R30 | ±15 cents | Blend -4dB |
| **Harmonies** | 120Hz 12dB/oct | Ethereal — boost 8kHz+ air, cut mids | Ratio 4:1, smooth | Light 2% | Shimmer/hall, 35% wet, 3s+ decay | None | Wide L50/R50 | ±5 cents | Pad-like, blend -6dB, part of the atmosphere |

### ACOUSTIC / SINGER-SONGWRITER

| Role | High-pass | EQ | Compression | Saturation | Reverb | Delay | Pan | Detune | Special |
|------|-----------|-----|-------------|------------|--------|-------|-----|--------|---------|
| **Lead** | 80Hz 6dB/oct — gentle slope, keep warmth | Gentle air +1.5dB at 10kHz, warmth +1dB at 200Hz — minimal sculpting | Ratio 2:1, attack 15ms, release 250ms — barely there, preserve dynamics | None — keep it clean | Room or small hall, 12% wet, 1s decay — intimate | None or very subtle eighth, -15dB | Center | None | Light de-ess only, vocal rider with wide tolerance |
| **Harmonies** | 80Hz 6dB/oct | Match lead, slight air boost | Ratio 2.5:1, gentle | None | Same room, 15% wet | None | L30/R30 | ±5 cents — subtle | Blend -4dB, natural and close |

### LO-FI

| Role | High-pass | EQ | Compression | Saturation | Reverb | Delay | Pan | Detune | Special |
|------|-----------|-----|-------------|------------|--------|-------|-----|--------|---------|
| **Lead** | 100Hz 12dB/oct | Roll highs above 8kHz (-3dB shelf), boost mids +2dB at 1kHz — vintage, warm | Ratio 3:1, slow attack 20ms, release 300ms — relaxed pumping | Medium tape saturation 6% | Room, 15% wet, 0.8s decay — lo-fi room | Eighth note, filtered repeats (each repeat loses more highs), 2 repeats | Center | None | Subtle vinyl noise floor if possible, gentle de-ess |
| **Ad-libs** | 200Hz 12dB/oct | Heavy telephone — bandpass 400-2.5kHz | Ratio 5:1, squash | Heavy 10% | Short room, 10% wet | Slapback, filtered | L25/R25 | None | Very lo-fi, part of the texture |
| **Doubles** | 120Hz 12dB/oct | Match lead warmth | Ratio 3:1 | Medium 5% | Same as lead | None | L20/R20 | ±10 cents — slightly wonky | Blend -3dB |

### LATIN

| Role | High-pass | EQ | Compression | Saturation | Reverb | Delay | Pan | Detune | Special |
|------|-----------|-----|-------------|------------|--------|-------|-----|--------|---------|
| **Lead** | 80Hz 12dB/oct | Bright presence +3dB at 4kHz, warmth +2dB at 200Hz — warm and present | Ratio 3:1, attack 5ms, release 150ms | Light tube 3% | Plate, 20% wet, 1.5s decay | Dotted eighth, tempo-synced, -10dB | Center | None | Moderate de-ess, vocal rider |
| **Ad-libs** | 120Hz 12dB/oct | Clean, bright, energetic | Ratio 3:1 | Light 2% | Short plate, 15% wet | Slapback 1/16 | L20/R20 | None | Blend -4dB, keep energy |
| **Harmonies** | 100Hz 12dB/oct | Warm +2dB at 250Hz, air +2dB at 10kHz | Ratio 4:1, smooth | Light 2% | Hall, 25% wet, 2s decay | None | Wide L40/R40 | ±6 cents | Prominent harmonies, blend -3dB |

### GOSPEL

| Role | High-pass | EQ | Compression | Saturation | Reverb | Delay | Pan | Detune | Special |
|------|-----------|-----|-------------|------------|--------|-------|-----|--------|---------|
| **Lead** | 80Hz 12dB/oct | Warm presence +2dB at 3kHz, body +2dB at 250Hz, air +1.5dB at 10kHz | Ratio 3:1, attack 8ms, release 200ms — preserve emotional dynamics, let the performance breathe | Warm tube 3% | Large hall, 25% wet, 2.5s decay — cathedral feel | None | Center | None | Light de-ess, vocal rider with WIDE tolerance — gospel is dynamic |
| **Ad-libs** | 100Hz 12dB/oct | Match lead warmth | Ratio 3:1 | Light 2% | Same hall, 28% wet | Short eighth, -12dB | L15/R15 | None | Blend -4dB |
| **Harmonies / Choir** | 100Hz 12dB/oct | Warm +3dB at 250Hz, air +2dB at 8kHz | Ratio 4:1, glue the choir | Light 2% | Large hall, 35% wet, 3s decay — big, spacious | None | Very wide L50/R50 | ±4 cents per layer — tight for clarity | Prominent — choir is the backbone. Blend -2 to -3dB below lead. Multiple layers spread across stereo field. |

### COUNTRY

| Role | High-pass | EQ | Compression | Saturation | Reverb | Delay | Pan | Detune | Special |
|------|-----------|-----|-------------|------------|--------|-------|-----|--------|---------|
| **Lead** | 80Hz 12dB/oct | Natural presence +2dB at 3kHz, warmth +1.5dB at 200Hz, air +1dB at 10kHz | Ratio 3:1, attack 10ms, release 200ms — natural, not squashed | Light tape 2% | Room/plate, 15% wet, 1s decay — natural space | Slapback (classic country), 1 repeat, -8dB | Center | None | Moderate de-ess, vocal rider |
| **Harmonies** | 80Hz 12dB/oct | Match lead, slight warmth boost | Ratio 3:1, gentle | Light 2% | Same plate, 18% wet | None | L30/R30 (classic country harmony panning) | ±5 cents | Blend -3dB, tight and close — country harmonies are upfront |

---

## VOCAL STYLE PRESET OVERRIDES

When the artist selects a vocal style preset instead of Auto, it overrides the genre matrix with these global adjustments:

### Clean and natural
- All roles: reduce compression ratios by 1 point, increase attack by 5ms
- All roles: remove saturation
- All roles: reduce reverb wet by 30%
- Ad-libs: remove any telephone/bandpass effects, keep clean

### Lo-fi and gritty
- All roles: add saturation +5%
- All roles: roll off highs above 8kHz
- All roles: add tape warmth
- Lead: boost mids +2dB at 1kHz
- Ad-libs: apply telephone bandpass regardless of genre

### Airy and spacious
- All roles: increase reverb wet by 50%, increase decay by 0.5s
- All roles: boost air +2dB at 12kHz
- Lead: add shimmer reverb layer
- Ad-libs: clean, spacious, no telephone

### Raw and upfront
- All roles: cut reverb wet by 50%
- All roles: increase compression ratio by 1 point
- Lead: boost presence +2dB at 3-4kHz
- All roles: reduce panning spread by 30%
- Ad-libs: dry, close, barely processed

---

## IMPLEMENTATION

### In predict.py

```python
CHAIN_MATRIX = {
    "HIP_HOP": {
        "lead": { "hp": 80, "hp_slope": 12, "eq": [...], "comp_ratio": 4, ... },
        "adlib": { "hp": 300, "hp_slope": 12, "eq": [...], "comp_ratio": 5, "bandpass": [300, 3000], "drive": 0.1, ... },
        "double": { "hp": 100, "hp_slope": 12, "eq": [...], "detune_cents": 12, "pan": 0.35, ... },
        ...
    },
    "AFROBEATS": { ... },
    ...
}

def get_chain_for_stem(genre, role, vocal_style_preset=None):
    chain = CHAIN_MATRIX.get(genre, CHAIN_MATRIX["HIP_HOP"]).get(role, CHAIN_MATRIX[genre]["lead"])
    
    if vocal_style_preset == "clean_natural":
        chain["comp_ratio"] = max(1.5, chain["comp_ratio"] - 1)
        chain["saturation"] = 0
        chain["reverb_wet"] *= 0.7
        if "bandpass" in chain:
            del chain["bandpass"]
    elif vocal_style_preset == "lofi_gritty":
        chain["saturation"] = min(0.15, chain.get("saturation", 0) + 0.05)
        chain["high_shelf_cut"] = 8000
        if role == "adlib":
            chain["bandpass"] = [300, 3000]
    elif vocal_style_preset == "airy_spacious":
        chain["reverb_wet"] *= 1.5
        chain["reverb_decay"] += 0.5
        chain["air_boost"] = 2
        if "bandpass" in chain:
            del chain["bandpass"]
    elif vocal_style_preset == "raw_upfront":
        chain["reverb_wet"] *= 0.5
        chain["comp_ratio"] = min(8, chain["comp_ratio"] + 1)
        chain["pan"] = chain.get("pan", 0) * 0.7
    
    return chain
```

### In decisions.ts (Claude prompt)

Claude should still generate the per-stem JSON, but instead of inventing parameters from scratch, it should reference the genre + role matrix and only deviate when the input analysis suggests something unusual (e.g., already bright vocal doesn't need more presence boost, or very dynamic performance needs gentler compression).

Claude's custom direction parsing should be able to override individual roles:
- "keep ad-libs clean" → remove bandpass/drive from ad-lib chain
- "more reverb on harmonies" → increase reverb wet on harmony chain
- "telephone effect on everything" → apply bandpass to all roles

### New dropdown in frontend configure step

Add after the existing `mixVibe` dropdown:

```
vocalStylePreset: Dropdown
  - Auto (genre-based) ← default
  - Clean and natural
  - Lo-fi and gritty  
  - Airy and spacious
  - Raw and upfront
```

### Schema update

Add to `MixJob`:
```prisma
vocalStylePreset  String?  // AUTO | CLEAN_NATURAL | LOFI_GRITTY | AIRY_SPACIOUS | RAW_UPFRONT
```

---

## COST IMPACT

None. Same Pedalboard processing, just different parameter values per chain. No new libraries needed. The bandpass filter for telephone effect is just a high-pass + low-pass in series, already available in Pedalboard.
