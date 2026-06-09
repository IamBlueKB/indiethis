# Phase 1.2 — IDOR Severity Audit (deep read)

_Read every RISKY + REVIEW route from idor_recon.md and scored by data-sensitivity dimensions: FILES, MONEY, PII, MUTATES_STATE, AI_COST, ADMIN_ACTION, UPLOADS, ID_ONLY_LOOKUP._

## Severity legend

| Tier | Score | Action |
|---|---|---|
| **S0_CRITICAL** | ≥9 | Stop-the-presses — money / privileged / multi-vector exposure |
| **S1_HIGH** | 6–8 | Fix before launch — sensitive single-vector exposure |
| **S2_MEDIUM** | 3–5 | Fix in P1.2; not launch-blocking on its own |
| **S3_LOW** | 0–2 | Verify intent; likely fine |
| **S4_LIKELY_OK** | <0 | Has auth + owner check; likely a REVIEW false positive |

## Summary

| Tier | Count |
|---|---|
| S0_CRITICAL | 22 |
| S1_HIGH | 11 |
| S2_MEDIUM | 19 |
| S3_LOW | 5 |
| S4_LIKELY_OK | 2 |
| UNKNOWN | 0 |
| **TOTAL** | **59** |

## S0_CRITICAL (22)

| Route | Methods | Dimensions | Score | Has auth? | Has owner check? |
|---|---|---|---|---|---|
| `/api/ambassador/[code]/payout/route.ts` | POST | MONEY, PII, MUTATES_STATE, NO_AUTH_NO_OWNER | 18 | ✗ | ✗ |
| `/api/intake/[token]/route.ts` | GET, POST | MONEY, PII, MUTATES_STATE, ADMIN_ACTION | 16 | ✗ | ✓ |
| `/api/studio/[studioId]/book-request/route.ts` | POST | PII, MUTATES_STATE, ADMIN_ACTION, NO_AUTH_NO_OWNER | 16 | ✗ | ✗ |
| `/api/studio/[studioId]/contact/route.ts` | POST | PII, MUTATES_STATE, ADMIN_ACTION, NO_AUTH_NO_OWNER | 16 | ✗ | ✗ |
| `/api/video-studio/[id]/checkout/route.ts` | POST | MONEY, PII, AI_COST, ADMIN_ACTION | 16 | ✓ | ✗ |
| `/api/video-studio/[id]/keyframe/regen/route.ts` | POST | MUTATES_STATE, AI_COST, ID_ONLY_LOOKUP, NO_AUTH_NO_OWNER | 16 | ✗ | ✗ |
| `/api/video-studio/director/[id]/chat/route.ts` | POST | MUTATES_STATE, AI_COST, ID_ONLY_LOOKUP, NO_AUTH_NO_OWNER | 16 | ✗ | ✗ |
| `/api/video-studio/director/[id]/shot-list/route.ts` | POST | MUTATES_STATE, AI_COST, ID_ONLY_LOOKUP, NO_AUTH_NO_OWNER | 16 | ✗ | ✗ |
| `/api/public/support/[artistSlug]/route.ts` | POST | MONEY, PII, NO_AUTH_NO_OWNER | 14 | ✗ | ✗ |
| `/api/invoice/[id]/notify-payment/route.ts` | POST | MONEY, PII, MUTATES_STATE | 13 | ✗ | ✓ |
| `/api/invoice/[id]/stripe-checkout/route.ts` | POST | MONEY, ID_ONLY_LOOKUP, NO_AUTH_NO_OWNER | 13 | ✗ | ✗ |
| `/api/public/booking-inquiry/[artistSlug]/route.ts` | POST | PII, MUTATES_STATE, NO_AUTH_NO_OWNER | 13 | ✗ | ✗ |
| `/api/public/shows/[showId]/waitlist/route.ts` | POST | PII, MUTATES_STATE, NO_AUTH_NO_OWNER | 13 | ✗ | ✗ |
| `/api/studio/invoices/[id]/pay/route.ts` | POST | MONEY, PII, MUTATES_STATE | 13 | ✗ | ✓ |
| `/api/studio/invoices/[id]/route.ts` | GET, PATCH, DELETE | MONEY, PII, MUTATES_STATE | 13 | ✓ | ✗ |
| `/api/video-studio/director/[id]/shot-list/patch/route.ts` | PATCH | MUTATES_STATE, AI_COST, NO_AUTH_NO_OWNER | 13 | ✗ | ✗ |
| `/api/ambassador/[code]/route.ts` | GET | MONEY, PII, ADMIN_ACTION | 12 | ✗ | ✗ |
| `/api/splits/review/[token]/reject/route.ts` | POST | PII, MUTATES_STATE, ADMIN_ACTION | 11 | ✗ | ✓ |
| `/api/video-studio/[id]/feedback/route.ts` | POST | ADMIN_ACTION, ID_ONLY_LOOKUP, NO_AUTH_NO_OWNER | 11 | ✗ | ✗ |
| `/api/admin/promo-popups/[id]/analytics/route.ts` | POST | MUTATES_STATE, NO_AUTH_NO_OWNER | 9 | ✗ | ✗ |
| `/api/invoice/[id]/route.ts` | GET | MONEY, PII | 9 | ✗ | ✗ |
| `/api/video-studio/[id]/download/route.ts` | GET | FILES, ADMIN_ACTION, ID_ONLY_LOOKUP | 9 | ✗ | ✗ |

## S1_HIGH (11)

| Route | Methods | Dimensions | Score | Has auth? | Has owner check? |
|---|---|---|---|---|---|
| `/api/ai-jobs/[id]/route.ts` | GET | MONEY, ADMIN_ACTION | 8 | ✓ | ✗ |
| `/api/dj/[djSlug]/book/route.ts` | POST | PII, MUTATES_STATE | 8 | ✗ | ✓ |
| `/api/public/fan-contact/[artistSlug]/route.ts` | POST | PII, MUTATES_STATE | 8 | ✗ | ✓ |
| `/api/splits/review/[token]/agree/route.ts` | POST | PII, MUTATES_STATE | 8 | ✗ | ✓ |
| `/api/video-studio/director/[id]/scene-regen/route.ts` | POST | MONEY, AI_COST, ADMIN_ACTION, HAS_OWNER_CHECK | 7 | ✓ | ✓ |
| `/api/cover-art/[id]/status/route.ts` | GET | ADMIN_ACTION, ID_ONLY_LOOKUP | 6 | ✗ | ✗ |
| `/api/video-studio/[id]/brief/lock/route.ts` | POST | MUTATES_STATE, AI_COST, ADMIN_ACTION, HAS_OWNER_CHECK | 6 | ✓ | ✓ |
| `/api/video-studio/[id]/generate/route.ts` | POST | MUTATES_STATE, AI_COST, ADMIN_ACTION, HAS_OWNER_CHECK | 6 | ✓ | ✓ |
| `/api/video-studio/[id]/refs/route.ts` | POST | MUTATES_STATE, AI_COST, ADMIN_ACTION, HAS_OWNER_CHECK | 6 | ✓ | ✓ |
| `/api/video-studio/[id]/shots/route.ts` | GET, PUT | MUTATES_STATE, AI_COST, ADMIN_ACTION, HAS_OWNER_CHECK | 6 | ✓ | ✓ |
| `/api/video-studio/[id]/status/route.ts` | GET | ADMIN_ACTION, ID_ONLY_LOOKUP | 6 | ✗ | ✗ |

## S2_MEDIUM (19)

| Route | Methods | Dimensions | Score | Has auth? | Has owner check? |
|---|---|---|---|---|---|
| `/api/dashboard/dj/bookings/[id]/route.ts` | PATCH | MUTATES_STATE | 4 | ✓ | ✗ |
| `/api/dashboard/dj/crates/[id]/items/route.ts` | GET, POST | MUTATES_STATE | 4 | ✓ | ✗ |
| `/api/dashboard/dj/events/[id]/route.ts` | PATCH, DELETE | MUTATES_STATE | 4 | ✓ | ✗ |
| `/api/dashboard/dj/mixes/[id]/identify/route.ts` | POST | MUTATES_STATE | 4 | ✓ | ✗ |
| `/api/dashboard/dj/mixes/[id]/route.ts` | PATCH, DELETE | MUTATES_STATE | 4 | ✓ | ✗ |
| `/api/dashboard/dj/mixes/[id]/tracklist/[itemId]/route.ts` | PATCH, DELETE | MUTATES_STATE | 4 | ✓ | ✗ |
| `/api/dashboard/dj/mixes/[id]/tracklist/route.ts` | GET, POST | MUTATES_STATE | 4 | ✓ | ✗ |
| `/api/dashboard/dj/sets/[id]/route.ts` | PATCH, DELETE | MUTATES_STATE | 4 | ✓ | ✗ |
| `/api/dashboard/merch/[id]/feature/route.ts` | PATCH | MUTATES_STATE | 4 | ✓ | ✗ |
| `/api/video-studio/director/[id]/route.ts` | GET | AI_COST | 4 | ✗ | ✗ |
| `/api/ai-jobs/[id]/approve-lyrics/route.ts` | POST | ADMIN_ACTION | 3 | ✓ | ✗ |
| `/api/ai-jobs/[id]/approve-video/route.ts` | POST | ADMIN_ACTION | 3 | ✓ | ✗ |
| `/api/ai-jobs/[id]/press-kit-pdf/route.ts` | GET | ADMIN_ACTION | 3 | ✓ | ✗ |
| `/api/ai-jobs/[id]/receipt/route.ts` | GET | ADMIN_ACTION | 3 | ✓ | ✗ |
| `/api/ai-jobs/[id]/regenerate-clip/route.ts` | POST | ADMIN_ACTION | 3 | ✓ | ✗ |
| `/api/splits/review/[token]/route.ts` | GET | ADMIN_ACTION | 3 | ✗ | ✗ |
| `/api/tracks/[id]/card-detail/route.ts` | GET | ID_ONLY_LOOKUP | 3 | ✗ | ✗ |
| `/api/tracks/[id]/overlay/route.ts` | GET | ID_ONLY_LOOKUP | 3 | ✗ | ✗ |
| `/api/video-studio/[id]/brief/route.ts` | GET, POST | MUTATES_STATE, AI_COST, HAS_OWNER_CHECK | 3 | ✓ | ✓ |

## S3_LOW (5)

| Route | Methods | Dimensions | Score | Has auth? | Has owner check? |
|---|---|---|---|---|---|
| `/api/video-studio/[id]/publish/route.ts` | POST | MUTATES_STATE, ADMIN_ACTION, HAS_OWNER_CHECK | 2 | ✓ | ✓ |
| `/api/video-studio/[id]/regenerate/route.ts` | POST | MUTATES_STATE, ADMIN_ACTION, HAS_OWNER_CHECK | 2 | ✓ | ✓ |
| `/api/audio-features/[id]/route.ts` | GET | — | 0 | ✗ | ✗ |
| `/api/audio-features/studio/[slug]/route.ts` | GET | — | 0 | ✗ | ✓ |
| `/api/public/artist-qr/[artistSlug]/route.ts` | GET | — | 0 | ✗ | ✗ |

## S4_LIKELY_OK (2)

| Route | Methods | Dimensions | Score | Has auth? | Has owner check? |
|---|---|---|---|---|---|
| `/api/dashboard/tracks/[id]/route.ts` | PATCH, DELETE | MUTATES_STATE, HAS_OWNER_CHECK | -1 | ✓ | ✓ |
| `/api/dashboard/stream-lease-beat-download/[beatId]/route.ts` | GET | ADMIN_ACTION, HAS_OWNER_CHECK | -2 | ✓ | ✓ |

