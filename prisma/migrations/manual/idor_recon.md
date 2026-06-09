# IDOR / Ownership Audit — Recon

_Generated from `src/app/api/**/[*]/route.ts` — 182 dynamic-segment routes._

## Summary

| Bucket | Count | Meaning |
|---|---|---|
| 🔴 RISKY | 10 | No auth, no token, no admin guard — most likely IDOR exposure |
| 🟡 REVIEW | 49 | Has auth but no obvious ownership check OR public/webhook missing gates |
| 🟢 SAFE | 122 | Auth + ownership compare, or admin route + admin guard, or token-validated |
| ⚪ EXEMPT | 1 | Webhook (signed), cron, OG image, NextAuth |
| **TOTAL** | **182** | |

## RISKY (10)

| Route | Reason |
|---|---|
| `C:/Users/brian/Documents/indiethis/src/app/api/invoice/[id]/notify-payment/route.ts` | MUTATION (POST) with ID-only access — IDOR risk |
| `C:/Users/brian/Documents/indiethis/src/app/api/invoice/[id]/stripe-checkout/route.ts` | MUTATION (POST) with ID-only access — IDOR risk |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/[studioId]/book-request/route.ts` | MUTATION (POST) with ID-only access — IDOR risk |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/[studioId]/contact/route.ts` | MUTATION (POST) with ID-only access — IDOR risk |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/invoices/[id]/pay/route.ts` | MUTATION (POST) with ID-only access — IDOR risk |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/[id]/feedback/route.ts` | MUTATION (POST) with ID-only access — IDOR risk |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/[id]/keyframe/regen/route.ts` | MUTATION (POST) with ID-only access — IDOR risk |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/director/[id]/chat/route.ts` | MUTATION (POST) with ID-only access — IDOR risk |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/director/[id]/shot-list/patch/route.ts` | MUTATION (PATCH) with ID-only access — IDOR risk |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/director/[id]/shot-list/route.ts` | MUTATION (POST) with ID-only access — IDOR risk |

## REVIEW (49)

| Route | Reason |
|---|---|
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/promo-popups/[id]/analytics/route.ts` | explicitly marked public — confirm intent + verify data exposed isn't sensitive |
| `C:/Users/brian/Documents/indiethis/src/app/api/ai-jobs/[id]/approve-lyrics/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/ai-jobs/[id]/approve-video/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/ai-jobs/[id]/press-kit-pdf/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/ai-jobs/[id]/receipt/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/ai-jobs/[id]/regenerate-clip/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/ai-jobs/[id]/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/ambassador/[code]/payout/route.ts` | URL segment is a token (mutation — verify entropy + freshness) |
| `C:/Users/brian/Documents/indiethis/src/app/api/ambassador/[code]/route.ts` | explicitly marked public — confirm intent + verify data exposed isn't sensitive |
| `C:/Users/brian/Documents/indiethis/src/app/api/audio-features/[id]/route.ts` | explicitly marked public — confirm intent + verify data exposed isn't sensitive |
| `C:/Users/brian/Documents/indiethis/src/app/api/audio-features/studio/[slug]/route.ts` | explicitly marked public — confirm intent + verify data exposed isn't sensitive |
| `C:/Users/brian/Documents/indiethis/src/app/api/cover-art/[id]/status/route.ts` | ID-only read; verify data exposed isn't sensitive (entropy ≠ confidentiality) |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/dj/bookings/[id]/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/dj/crates/[id]/items/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/dj/events/[id]/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/dj/mixes/[id]/identify/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/dj/mixes/[id]/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/dj/mixes/[id]/tracklist/[itemId]/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/dj/mixes/[id]/tracklist/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/dj/sets/[id]/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/merch/[id]/feature/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/stream-lease-beat-download/[beatId]/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/tracks/[id]/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/dj/[djSlug]/book/route.ts` | URL segment is a token (mutation — verify entropy + freshness) |
| `C:/Users/brian/Documents/indiethis/src/app/api/intake/[token]/route.ts` | URL segment is a token (mutation — verify entropy + freshness) |
| `C:/Users/brian/Documents/indiethis/src/app/api/invoice/[id]/route.ts` | ID-only read; verify data exposed isn't sensitive (entropy ≠ confidentiality) |
| `C:/Users/brian/Documents/indiethis/src/app/api/public/artist-qr/[artistSlug]/route.ts` | public route — verify intent |
| `C:/Users/brian/Documents/indiethis/src/app/api/public/booking-inquiry/[artistSlug]/route.ts` | public route — verify intent |
| `C:/Users/brian/Documents/indiethis/src/app/api/public/fan-contact/[artistSlug]/route.ts` | public route — verify intent |
| `C:/Users/brian/Documents/indiethis/src/app/api/public/shows/[showId]/waitlist/route.ts` | public route — verify intent |
| `C:/Users/brian/Documents/indiethis/src/app/api/public/support/[artistSlug]/route.ts` | public route — verify intent |
| `C:/Users/brian/Documents/indiethis/src/app/api/splits/review/[token]/agree/route.ts` | explicitly marked public — confirm intent + verify data exposed isn't sensitive |
| `C:/Users/brian/Documents/indiethis/src/app/api/splits/review/[token]/reject/route.ts` | explicitly marked public — confirm intent + verify data exposed isn't sensitive |
| `C:/Users/brian/Documents/indiethis/src/app/api/splits/review/[token]/route.ts` | explicitly marked public — confirm intent + verify data exposed isn't sensitive |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/invoices/[id]/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/tracks/[id]/card-detail/route.ts` | explicitly marked public — confirm intent + verify data exposed isn't sensitive |
| `C:/Users/brian/Documents/indiethis/src/app/api/tracks/[id]/overlay/route.ts` | explicitly marked public — confirm intent + verify data exposed isn't sensitive |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/[id]/brief/lock/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/[id]/brief/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/[id]/checkout/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/[id]/download/route.ts` | ID-only read; verify data exposed isn't sensitive (entropy ≠ confidentiality) |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/[id]/generate/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/[id]/publish/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/[id]/refs/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/[id]/regenerate/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/[id]/shots/route.ts` | auth but no ownership compare detected |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/[id]/status/route.ts` | ID-only read; verify data exposed isn't sensitive (entropy ≠ confidentiality) |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/director/[id]/route.ts` | ID-only read; verify data exposed isn't sensitive (entropy ≠ confidentiality) |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/director/[id]/scene-regen/route.ts` | auth but no ownership compare detected |

## SAFE (122)

| Route | Reason |
|---|---|
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/affiliates/[id]/approve/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/affiliates/[id]/commission/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/affiliates/[id]/reject/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/affiliates/[id]/suspend/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/ai-insights-log/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/ambassadors/[id]/payout/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/ambassadors/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/content/[type]/[id]/request-docs/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/dj-verification/[applicationId]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/explore/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/mastering/presets/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/moderation/[studioId]/approve/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/moderation/[studioId]/scan/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/moderation/flags/[flagId]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/promo-codes/[id]/redemptions/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/promo-codes/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/promo-popups/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/reference-library/genre/[genre]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/revenue-report/alerts/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/revenue-report/goals/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/revenue-report/history/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/studios/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/studios/[id]/tier/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/studios/[id]/unpublish/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/team/[id]/deactivate/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/team/[id]/reactivate/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/team/[id]/reset-password/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/team/[id]/role/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/users/[id]/comp/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/users/[id]/dj-verify/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/users/[id]/impersonate/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/users/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/users/[id]/suspend/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/video-studio/presets/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/admin/video-studio/styles/[id]/route.ts` | admin route + admin guard |
| `C:/Users/brian/Documents/indiethis/src/app/api/ai-tools/vocal-remover/status/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/ambassador/[code]/stripe-connect/route.ts` | URL segment is a token (high-entropy lookup) |
| `C:/Users/brian/Documents/indiethis/src/app/api/beats/licenses/[id]/pdf/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/beats/previews/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/ai/[toolType]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/ai/cover-art/[id]/refine/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/ai/cover-art/[id]/select/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/ai/track-shield/[scanId]/pdf/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/ai/track-shield/[scanId]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/avatar/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/avatar/[id]/set-profile/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/digital-products/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/dj/crates/[id]/collaborators/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/dj/crates/[id]/items/[trackId]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/dj/crates/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/dj/mixes/canvas/[mixId]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/license-documents/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/merch/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/merch/orders/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/music/canvas/[trackId]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/notifications/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/presave/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/references/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/release-plans/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/release-plans/[id]/tasks/[taskId]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/release-plans/[id]/tasks/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/releases/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/sample-packs/[id]/previews/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/sample-packs/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/session-notes/[id]/feedback/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/shows/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/splits/[id]/agree/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/splits/[id]/reject/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/splits/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/stream-leases/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/tracks/[id]/lease-settings/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/vault/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dashboard/videos/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dj/crates/[id]/accept-invite/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dj/crates/[id]/decline-invite/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dj/crates/[id]/invite/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/dl/[token]/download/route.ts` | URL segment is a token (high-entropy lookup) |
| `C:/Users/brian/Documents/indiethis/src/app/api/dl/[token]/route.ts` | URL segment is a token (high-entropy lookup) |
| `C:/Users/brian/Documents/indiethis/src/app/api/dl/digital/[token]/route.ts` | URL segment is a token (high-entropy lookup) |
| `C:/Users/brian/Documents/indiethis/src/app/api/intake/[token]/deposit-status/route.ts` | URL segment is a token (high-entropy lookup) |
| `C:/Users/brian/Documents/indiethis/src/app/api/mastering/album/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mastering/job/[id]/confirm-direction/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mastering/job/[id]/download/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mastering/job/[id]/email-results/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mastering/job/[id]/revision/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mastering/job/[id]/select-version/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mastering/job/[id]/status/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mix-console/job/[id]/confirm-direction/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mix-console/job/[id]/download/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mix-console/job/[id]/email-results/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mix-console/job/[id]/preview-url/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mix-console/job/[id]/revise/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mix-console/job/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mix-console/job/[id]/select/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mix-console/job/[id]/studio/ai-assist/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mix-console/job/[id]/studio/ai-polish/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mix-console/job/[id]/studio/extra-render-checkout/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mix-console/job/[id]/studio/render/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/mix-console/job/[id]/studio/save/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/public/artist-pageview/[artistSlug]/route.ts` | public route w/ auth call |
| `C:/Users/brian/Documents/indiethis/src/app/api/receipts/[id]/pdf/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/samples/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/booking-requests/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/bookings/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/canvas/[trackId]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/contacts/[id]/cancel-sequence/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/contacts/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/credits/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/engineers/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/equipment/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/inbox/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/intake-submissions/[id]/analyze/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/intake-submissions/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/invoices/[id]/pdf/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/invoices/[id]/send/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/pageview/[studioId]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/portfolio/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/quick-send/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/studio/session-notes/[id]/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/director/[id]/approve/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/video-studio/director/[id]/shot-list/update/route.ts` | auth + ownership compare |
| `C:/Users/brian/Documents/indiethis/src/app/api/year-in-review/[year]/route.ts` | auth + ownership compare |

## EXEMPT (1)

| Route | Reason |
|---|---|
| `C:/Users/brian/Documents/indiethis/src/app/api/auth/[...nextauth]/route.ts` | auth flow |

