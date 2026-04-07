# BUILD-STATUS.md — IndieThis
_Last updated: 2026-04-07 (session 14)_

---

## BUILD STATE

- **Framework:** Next.js 16.1.6 App Router, TypeScript strict
- **Database:** Supabase PostgreSQL via Prisma 5.22.0
- **Auth:** NextAuth v5 beta (`src/proxy.ts`, not middleware) — Google ✅ + Facebook ⏳ (pending Meta business verification)
- **Last clean build:** ✅ passes `npx next build` with zero errors
- **Deployment:** Vercel (auto-deploy on push to `master`)
- **Company:** Clear Ear Corp — `info@indiethis.com`

---

## TECH STACK

### Core
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.6 | App Router framework |
| `typescript` | strict | Type checking |
| `prisma` + `@prisma/client` | 5.22.0 | ORM + type-safe DB client |
| `next-auth` | v5 beta | Authentication (credentials + OAuth) |
| `tailwindcss` | latest | Utility CSS |
| `zustand` | latest | Global audio player state |
| `framer-motion` | latest | Animations, AnimatePresence cross-fades |

### Payments & Commerce
| Package | Version | Purpose |
|---------|---------|---------|
| `stripe` | latest | Server-side Stripe SDK |
| `@stripe/stripe-js` | latest | Client-side Stripe.js |

### AI & Media
| Package | Version | Purpose |
|---------|---------|---------|
| `@anthropic-ai/sdk` | latest | Claude API (bio, A&R, press kit, contract scan) |
| `replicate` | latest | Demucs vocal removal + Whisper transcription |
| `@remotion/lambda` | 4.0.436 | Lyric video rendering on AWS Lambda |
| `fast-average-color` | latest | Dominant color extraction (canvas glow) |
| `node-id3` | latest | ID3 tag embedding on digital downloads |
| `pdf-parse` | latest | Contract PDF text extraction |

### Email, Files & Analytics
| Package | Version | Purpose |
|---------|---------|---------|
| `@uploadthing/react` | v6+ | File upload (audio, images, PDFs) |
| `posthog-js` | ^1.364.7 | Client-side analytics + error tracking |
| `posthog-node` | ^5.28.11 | Server-side event capture |

### UI & Charts
| Package | Version | Purpose |
|---------|---------|---------|
| `lucide-react` | latest | Icons throughout |
| `recharts` | latest | DJ analytics charts |
| `react-joyride` | v3 | Onboarding product tour |
| `date-fns` | latest | Date formatting and arithmetic |
| `bcryptjs` | latest | Password hashing (12 rounds) |
| `compromise` | latest | NLP for explore search intent parsing |

### Fonts
- **DM Sans** — body text, UI labels (Google Fonts)
- **font-display** — headings (`font-display` Tailwind class)

---

## KEY FILES

| File | Purpose |
|------|---------|
| `src/proxy.ts` | Auth middleware — all protected route redirects. Add new public routes to `PUBLIC_PATHS` array here |
| `src/store/audio.ts` | Zustand audio store — `currentTrack`, `currentTime`, `isPlaying`, `duration`. All player state flows through this |
| `src/lib/db.ts` | Prisma client singleton — import `db` from here in all API routes |
| `src/lib/stripe.ts` | Stripe client + `PLAN_PRICES` map. Update price IDs here when switching Stripe accounts |
| `src/lib/brevo.ts` | All transactional email + SMS functions (`sendBrandedEmail`, `buildEmailTemplate`) |
| `src/lib/printful.ts` | Printful API client — order creation, catalog, webhooks, defect claims |
| `src/lib/posthog.ts` | PostHog server-side singleton (`getPostHogClient()`) — use in API routes, always call `await posthog.shutdown()` after capture |
| `src/lib/agents/` | All AI agent files — one file per agent |
| `instrumentation-client.ts` | PostHog client-side init (Next.js 15.3+ pattern) — auto-captures pageviews + interactions |
| `prisma/schema.prisma` | Database schema — source of truth for all models |
| `vercel.json` | Cron job schedule — all 12 cron routes listed here |
| `src/app/api/stripe/webhook/route.ts` | Central Stripe webhook handler — all event types handled here |
| `src/app/api/agents/master-cron/route.ts` | Agent orchestrator — routes to all agents on schedule |
| `src/components/artist-page/HeroCanvasDisplay.tsx` | Canvas video ambient panel on artist public page |
| `src/components/artist-page/LyricsDisplay.tsx` | Auto-scrolling lyrics synced to audio playback |
| `src/components/OnboardingTour.tsx` | react-joyride v3 tour component — 5-step artist tour + 5-step studio tour |
| `src/components/dashboard/DashboardTourWrapper.tsx` | Client wrapper — manages `showTour` state, calls `/api/dashboard/onboarding-complete` on finish/skip |
| `src/components/InstallPrompt.tsx` | PWA install banner — `beforeinstallprompt` event, dismiss stored in localStorage |
| `src/components/shared/PWARegister.tsx` | Service worker registration (production only) |
| `public/manifest.json` | PWA web app manifest — name, icons, theme_color, start_url |
| `public/sw.js` | Service worker — network-first caching, precaches `/`, `/explore`, `/pricing` |
| `public/icons/` | PWA icons: `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (generated from brand icon) |
| `src/app/[slug]/page.tsx` | Artist public page — two-column layout, canvas + lyrics left, content right |
| `src/lib/avatar/styles.ts` | Client-safe `AVATAR_STYLES` export (no server imports) — prevents sharp from bundling into client |
| `src/lib/avatar/generator.ts` | Avatar generation engine — fal.ai FLUX, dominant color extraction, saves to `ArtistAvatar` model |
| `src/components/avatar/AvatarPicker.tsx` | Reusable avatar picker — compact/standard, `onSelect(AvatarSelectPayload)` + `onUploadUrl(url)` callbacks |
| `src/lib/video-studio/generator.ts` | Scene generation engine — `GeneratedSceneOutput` type, `generateSceneClip`, `qaReviewScene`, `generateSceneWithFallback`, `generateAllScenes` |
| `src/lib/release-board/auto-link.ts` | Fire-and-forget `autoLinkToRelease(trackId, assetType, assetId)` — wired into music video, cover art, lyric video pipelines |
| `src/app/(dashboard)/dashboard/releases/ReleasesClient.tsx` | Release Board list — `CreateReleaseModal`, asset dots, release cards |
| `src/app/(dashboard)/dashboard/releases/[id]/ReleaseBoardClient.tsx` | Individual release board — 5 asset cards, inline title edit, track carousel, date picker |

---

## ARCHITECTURE NOTES

### Auth Pattern
- Auth is handled in `src/proxy.ts`, **NOT** `middleware.ts`
- Any route that needs to skip auth (screenshots, public API, etc.) must be added to `PUBLIC_PATHS` in `proxy.ts` AND have the layout redirect commented out
- `/api/dev` prefix is in PUBLIC_PATHS for email preview routes

### Signup Flow (PendingSignup → User)
1. User fills `/signup` → `POST /api/auth/signup-init` → creates `PendingSignup` record, returns `pendingId`
2. User selects plan on `/pricing` → `POST /api/stripe/checkout` → creates Stripe Checkout session, stores `stripeSessionId` on PendingSignup
3. Stripe payment completes → `checkout.session.completed` webhook → `POST /api/auth/complete-signup` → creates `User` from PendingSignup
4. `agreedToTerms: true` + `agreedToTermsAt` timestamp stored on PendingSignup at step 1

### Audio Player State
- All player state lives in Zustand at `src/store/audio.ts`
- `AudioTrack` type includes: `id`, `title`, `artist`, `src`, `coverArt`, `canvasVideoUrl`, `lyrics`, `description`, `duration`, `previewOnly`
- `HeroCanvasDisplay` and `LyricsDisplay` subscribe to the store — they only activate when a track from the current artist is playing

### Canvas Video on Artist Page
- `HeroCanvasDisplay` checks `artistTrackIds.includes(currentTrack.id)` — only shows for this artist's tracks
- When nothing playing: shows `latestCanvasVideo` (latest track's canvas) or `latestCoverArt` as static fallback
- `fast-average-color` extracts dominant color → radial glow behind panel (transitions 1s ease)
- `AnimatePresence mode="wait"` handles cross-fade on track change — `animate={{ opacity: 0.7 }}` (NOT 1, which overrides the style prop)
- 280px left column on desktop, full-width stacked on mobile

### Lyrics Scroll
- `overflow-y: hidden` + direct `container.scrollTop = (scrollHeight - clientHeight) * (currentTime / duration)`
- Do NOT use `scrollTo` (rapid calls interrupt each other) or `scrollIntoView` (scrolls whole page)

### Canvas Video Opacity Bug (documented)
- Framer Motion `animate={{ opacity: 1 }}` overrides `style.opacity`. Always set the final opacity in `animate`, not `style`, for Framer-controlled elements

### Prisma on Windows Dev
- `prisma generate` requires stopping the dev server first — Next.js holds a DLL lock on the generated client
- Dev server: always start with `preview_start "IndieThis"` (port 3456) — if blocked, delete `.next/dev/lock`

### Platform Fees Summary
| Transaction | Artist Gets | Platform Gets |
|------------|------------|---------------|
| Digital music sale | 90% | 10% |
| Sample pack sale | 90% | 10% |
| Beat license | 70% | 30% |
| Stream lease | 70% (producer) | 30% |
| POD merch | (retail − base) × 85% | 15% of profit |
| Self-fulfilled merch | retail × 85% + shipping | 15% of retail |
| DJ attribution | 90% of artist's cut | DJ gets 10% of artist's cut |

---

## PAGES — (auth)

| Route | Description |
|-------|-------------|
| `/login` | Email/password + Google/Facebook social login |
| `/signup` | New account creation with path selection (artist/producer/studio) — social OAuth pre-fill mode |
| `/signup/setup` | Post-checkout onboarding wizard (social links, bio, location) |
| `/signup/complete` | Checkout completion handler, creates user from PendingSignup |
| `/forgot-password` | Send password reset email via Brevo |
| `/reset-password` | Token-gated password reset form |
| `/pricing` | Plan selection — artist and studio tabs, pulls from PRICING_DEFAULTS |

---

## PAGES — (dashboard) — Artist

| Route | Description |
|-------|-------------|
| `/dashboard` | Home — stats, quick actions, recent activity |
| `/dashboard/music` | Track management, releases, split sheets, pre-save campaigns |
| `/dashboard/merchandise` | Merch product CRUD and order list |
| `/dashboard/marketplace` | Browse/purchase beat licenses from producers |
| `/dashboard/sessions` | Studio booking session history |
| `/dashboard/site` | Artist mini-site builder and preview |
| `/dashboard/notifications` | Notification center |
| `/dashboard/analytics` | Fan/revenue/play analytics |
| `/dashboard/ai/video` | AI music video generation tool |
| `/dashboard/avatar` | Artist Avatar Studio — generate, manage, and set profile AI avatars |
| `/dashboard/ai/mastering` | AI audio mastering tool |
| `/dashboard/ai/lyric-video` | AI lyric video generator |
| `/dashboard/ai/ar-report` | A&R analytics report generator |
| `/dashboard/ai/cover-art` | AI cover art generator |
| `/dashboard/ai/press-kit` | AI press kit builder |
| `/dashboard/ai/split-sheet` | Split sheet generator (free) |
| `/dashboard/ai/bio-generator` | Bio generator (free, Claude) |
| `/dashboard/ai/contract-scanner` | Contract scanner (Claude + pdf-parse) |
| `/dashboard/ai/track-shield` | Track Shield — PPU internet scan for unauthorized music use |
| `/dashboard/vault` | Secure file storage vault |
| `/dashboard/shows` | Artist shows and events |
| `/dashboard/fans` | Fan database, segmentation, automations |
| `/dashboard/qr` | QR code generator |
| `/dashboard/upgrade` | Tier upgrade flow |
| `/dashboard/settings` | Profile, billing, password, social links |
| `/dashboard/splits` | Royalty split sheet management |
| `/dashboard/stream-leases` | Stream lease catalog |
| `/dashboard/release-planner` | Release planning dashboard |
| `/dashboard/release-planner/[id]` | Individual release plan editor |
| `/dashboard/videos` | Upload and manage artist videos |
| `/dashboard/referrals` | User referral program tracking |
| `/dashboard/affiliate` | Affiliate program dashboard |
| `/dashboard/broadcasts` | SMS broadcast campaigns |
| `/dashboard/year-in-review/[year]` | Annual year-in-review stats |
| `/dashboard/producer/beats` | Producer beat listing and management |
| `/dashboard/producer/analytics` | Producer analytics dashboard |
| `/dashboard/producer/stream-leases` | Producer stream lease management |
| `/dashboard/producer/earnings` | Producer earnings projections |
| `/dashboard/music/sales` | Digital product sales — Singles, EPs, Albums (price-per-unit) |
| `/dashboard/dj-activity` | Artist view — DJs who have their tracks in crates |
| `/dashboard/dj/booking-report` | DJ booking report page |
| `/dashboard/producer/sample-packs` | Producer sample packs management |
| `/dashboard/samples` | Artist samples page |
| `/dashboard/dj/analytics` | DJ analytics — fans attributed, revenue, 12-week chart |
| `/dashboard/dj/settings` | DJ profile settings — bio, genres, city, social links |
| `/dashboard/dj/earnings` | DJ earnings — balance, withdrawals, attribution history |
| `/dashboard/dj/verification` | DJ verification application flow |
| `/dashboard/dj/crates` | DJ crate management |
| `/dashboard/dj/mixes` | DJ mix uploads with ACRCloud tracklist identification |
| `/dashboard/dj/sets` | DJ set management (YouTube-linked) |
| `/dashboard/dj/events` | DJ event listings |
| `/dashboard/dj/bookings` | DJ booking requests |
| `/dashboard/dj/merch` | DJ merch product + order management |
| `/dashboard/merch` | Artist merch dashboard — products, orders, defect claims, earnings |
| `/dashboard/earnings` | Artist earnings — merch balance, withdrawal history, earnings projector |
| `/dashboard/releases` | Release Board — list of all releases with asset status dots and cover art thumbnails |
| `/dashboard/releases/[id]` | Individual release board — 5 asset cards (Cover Art, Music Video, Lyric Video, Mastered Track, Canvas Video), track carousel, inline title + date editing |

---

## PAGES — (studio)

| Route | Description |
|-------|-------------|
| `/studio` | Studio dashboard home |
| `/studio/bookings` | Booking request management |
| `/studio/contacts` | CRM contact list |
| `/studio/contacts/[id]` | Individual contact detail + activity log |
| `/studio/inbox` | Inquiry/message inbox |
| `/studio/deliver` | QuickSend file delivery interface |
| `/studio/invoices` | Invoice builder and tracker |
| `/studio/email` | Email blast campaign builder |
| `/studio/ai-tools` | AI tool access (Vocal Remover, Contract Scanner, Bio, Split Sheet, Track Shield) |
| `/studio/analytics` | Studio business analytics |
| `/studio/payments` | Payment history |
| `/studio/artists` | Artist roster management |
| `/studio/credits` | Team/credits listing |
| `/studio/quick-send` | Quick file send without booking |
| `/studio/setup` | Studio account setup wizard |
| `/studio/onboarding` | Post-signup onboarding flow |
| `/studio/settings` | Studio profile settings |
| `/studio/settings/public-page` | Public studio page editor |
| `/studio/settings/portfolio` | Portfolio track management |
| `/studio/settings/credits` | Studio credits and attributions |
| `/studio/settings/engineers` | Engineer profile management |
| `/studio/settings/equipment` | Equipment list editor |
| `/studio/preview-frame` | Public page iframe preview |
| `/studio/merch` | Studio merch product + order management |

---

## PAGES — (admin)

| Route | Description |
|-------|-------------|
| `/admin/login` | Admin authentication |
| `/admin/change-password` | Admin password change |
| `/admin` | Admin dashboard home — user/revenue KPIs |
| `/admin/studios` | Studio management list |
| `/admin/studios/[id]` | Studio detail + actions (tier, unpublish) |
| `/admin/users` | User management list |
| `/admin/users/[id]` | User detail + comp/suspend/impersonate |
| `/admin/moderation` | Studio content moderation queue |
| `/admin/ai-usage` | AI job log and usage analytics |
| `/admin/ai-usage/[jobId]` | Individual AI job detail |
| `/admin/affiliates` | Affiliate program management |
| `/admin/ambassadors` | Ambassador program management |
| `/admin/ambassadors/[id]` | Ambassador detail + payout |
| `/admin/team` | Admin team members |
| `/admin/promo-codes` | Promo code CRUD |
| `/admin/promo-analytics` | Promo redemption analytics |
| `/admin/lead-tracking/leads` | Lead capture list |
| `/admin/lead-tracking/value` | Lead value attribution |
| `/admin/settings/pricing` | PlatformPricing live editor |
| `/admin/analytics/funnel` | Conversion funnel analytics |
| `/admin/dj-verification` | DJ verification queue (approve/deny applications) |
| `/admin/video-studio` | Music video metrics dashboard, video list table, VideoStyle CRUD |
| `/admin/revenue-report` | Revenue report preview, Send Now button, alert config UI |

---

## PAGES — Public

| Route | Description |
|-------|-------------|
| `/` | Homepage (hero, AI demo, features) |
| `/explore` | Discover artists/beats/studios with NLP search + radar filter |
| `/about` | About IndieThis |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/artists` | Artist directory |
| `/studios` | Studio directory |
| `/beats` | Beat marketplace |
| `/redeem` | Promo code redemption |
| `/pricing` | Public pricing page |
| `/affiliate/apply` | Affiliate application |
| `/ambassador/[code]` | Ambassador referral landing |
| `/ref/[customSlug]` | Custom referral link |
| `/[slug]` | Artist public site (dynamic) — with Store section (digital products) and "Picked by X DJs" badge |
| `/[slug]/merch` | Artist public merch storefront |
| `/[slug]/intake/[token]` | Studio intake submission form |
| `/[slug]/book` | Artist booking page (public) |
| `/dl/[token]` | File download by token |
| `/invoice/[id]` | Public invoice view and Stripe payment |
| `/order/[orderId]` | Public order status tracking page |
| `/splits/review/[token]` | Split sheet review and e-sign |
| `/dj/[djSlug]` | Public DJ profile — sets, mixes, crates, events |
| `/dj/[djSlug]/crate/[crateName]` | Public DJ crate page |
| `/lyric-video` | Public Lyric Video Studio — gate screen (email/Google OAuth), mode picker (Quick / Director), wizard, post-Stripe return handler |
| `/video-studio` | Public Music Video Studio — hero landing with DemoReel, mode picker (Quick / Director), non-subscriber gate, `?start=1` opens wizard |
| `/video-studio/[id]/generating` | Generating progress page — polls job status, animated progress bar, step labels |
| `/video-studio/[id]/preview` | Completed video preview — video player, download, share, upsell |
| `/video-studio/director/[id]` | Director Mode session page — shot list, scene editor, character refs, brief lock |
| `/cover-art` | Public Cover Art Studio — gate screen (email/Google OAuth), wizard, post-Stripe return, conversion drip |

---

## API ROUTES

### Auth
| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/[...nextauth]` | NextAuth.js handler (sign in, sign out, session) — credentials + Google + Facebook |
| `POST /api/auth/signup-init` | Create PendingSignup record (step 1 of signup flow) |
| `POST /api/auth/forgot-password` | Send password reset email |
| `POST /api/auth/reset-password` | Complete password reset with token |
| `GET /api/auth/complete-signup` | Finalize PendingSignup → User after checkout |
| `POST /api/auth/facebook-data-deletion` | Facebook data deletion callback (Meta requirement) |
| `POST /api/admin/auth/login` | Admin session login |
| `POST /api/admin/auth/logout` | Admin session logout |
| `POST /api/admin/auth/change-password` | Admin password update |

### Stripe & Payments
| Endpoint | Description |
|----------|-------------|
| `POST /api/stripe/checkout` | Create subscription Checkout session (new signup + upgrade) |
| `POST /api/stripe/pay-per-use` | Create one-time PPU Checkout session for AI tools |
| `POST /api/stripe/portal` | Open Stripe billing portal for existing subscriber |
| `POST /api/stripe/subscription/cancel` | Cancel active subscription |
| `POST /api/stripe/webhook` | Receive and process all Stripe events |

### AI Tools — Unified Queue
| Endpoint | Description |
|----------|-------------|
| `POST /api/dashboard/ai/[toolType]` | Create AI job (credit check → deduct/charge → queue) |
| `GET /api/dashboard/ai/[toolType]` | Fetch job history + credit status for tool |
| `GET /api/ai-jobs/[id]` | Poll individual job status |
| `GET /api/ai-jobs/[id]/press-kit-pdf` | Download completed press kit PDF |
| `GET/POST /api/dashboard/ai/booking-report` | Generate AI booking report |
| `POST /api/dashboard/ai/booking-report/checkout` | Stripe checkout for booking report |
| `POST /api/dashboard/ai/creative-prompt` | Creative prompt nudge |
| `GET/POST /api/dashboard/ai/producer-match` | Producer-artist AI matching |
| `POST /api/dashboard/ai/producer-match/checkout` | Stripe checkout for producer match |
| `GET/POST /api/dashboard/ai/release-bundle/checkout` | Release bundle coordination checkout |
| `GET/POST /api/dashboard/ai/trend-report` | Trend forecasting report |
| `POST /api/dashboard/ai/trend-report/checkout` | Stripe checkout for trend report |

### Track Shield
| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboard/ai/track-shield` | List past scans and results |
| `POST /api/dashboard/ai/track-shield/checkout` | Create Stripe Checkout for selected package |
| `POST /api/dashboard/ai/track-shield/scan` | Trigger AudD scans after payment |
| `GET /api/dashboard/ai/track-shield/[scanId]` | Detailed results for one scan |
| `GET /api/dashboard/ai/track-shield/[scanId]/pdf` | Download scan report as PDF |

### AI Tools — Standalone (no credit queue)
| Endpoint | Description |
|----------|-------------|
| `POST /api/ai-tools/vocal-remover` | Submit vocal removal job (Replicate) |
| `GET /api/ai-tools/vocal-remover/status/[id]` | Poll vocal removal status |
| `POST /api/ai-tools/contract-scanner` | Scan PDF contract with Claude |
| `POST /api/ai-tools/split-sheet` | Generate split sheet PDF |
| `POST /api/ai-tools/bio-generator` | Generate artist bio with Claude |

### Digital Products
| Endpoint | Description |
|----------|-------------|
| `GET/POST /api/dashboard/digital-products` | Digital product CRUD (Singles, EPs, Albums) |
| `POST /api/dashboard/digital-products/checkout` | Stripe Checkout for digital product purchase |
| `GET /api/explore/digital-products` | Public listing of published digital products |
| `GET /api/dl/[token]` | Buyer download by token (ID3-tagged MP3) |

### DJ Platform
| Endpoint | Description |
|----------|-------------|
| `POST /api/dj/attribute` | Set attribution cookie for a DJ's page/crate/mix visit |
| `GET/PUT /api/dj/profile` | Get or update DJ profile (bio, genres, city, social links) |
| `GET /api/dj/earnings` | DJ balance, total earnings, attributions, withdrawals |
| `POST /api/dj/withdraw` | Request payout via Stripe Connect transfer |
| `GET /api/dashboard/dj/analytics` | DJ analytics — fans, revenue, 12-week chart data |
| `GET /api/admin/dj-verification` | Admin: list PENDING verification applications |
| `POST /api/admin/dj-verification/[id]/approve` | Admin: approve DJ verification |
| `POST /api/admin/dj-verification/[id]/deny` | Admin: deny DJ verification |
| `POST /api/admin/audio-fingerprints/backfill` | Admin: backfill fingerprints for existing tracks |
| `POST /api/dj/[djSlug]/book` | Book DJ from public profile |
| `POST /api/dj/crates/[id]/accept-invite` | Accept crate collaboration invite |
| `POST /api/dj/crates/[id]/decline-invite` | Decline crate collaboration invite |
| `POST /api/dj/crates/[id]/invite` | Invite collaborator to crate |
| `POST /api/dashboard/dj/activate` | Activate DJ mode |
| `POST /api/dashboard/dj/deactivate` | Deactivate DJ mode |
| `GET/POST /api/dashboard/dj/bookings` | DJ booking management |
| `GET/PUT/DELETE /api/dashboard/dj/bookings/[id]` | Individual DJ booking |
| `GET/POST /api/dashboard/dj/crates` | DJ crate CRUD |
| `GET/PUT/DELETE /api/dashboard/dj/crates/[id]` | Individual crate management |
| `GET/POST /api/dashboard/dj/crates/[id]/collaborators` | Crate collaborator management |
| `GET/POST /api/dashboard/dj/crates/[id]/items` | Crate item management |
| `DELETE /api/dashboard/dj/crates/[id]/items/[trackId]` | Remove track from crate |
| `GET/POST /api/dashboard/dj/events` | DJ event management |
| `GET/PUT/DELETE /api/dashboard/dj/events/[id]` | Individual DJ event |
| `GET/POST /api/dashboard/dj/invites` | Crate collaboration invites |
| `GET/POST /api/dashboard/dj/mixes` | DJ mix CRUD |
| `GET/PUT/DELETE /api/dashboard/dj/mixes/[id]` | Individual mix management |
| `POST /api/dashboard/dj/mixes/[id]/identify` | ACRCloud track identification for mix |
| `GET/POST /api/dashboard/dj/mixes/[id]/tracklist` | Mix tracklist management |
| `GET/PUT/DELETE /api/dashboard/dj/mixes/[id]/tracklist/[itemId]` | Individual tracklist item |
| `POST /api/dashboard/dj/mixes/canvas/[mixId]` | Canvas video for specific mix |
| `POST /api/dashboard/dj/mixes/canvas/checkout` | Canvas video Stripe checkout |
| `POST /api/dashboard/dj/mixes/canvas/generate` | Generate canvas video for mix |
| `POST /api/dashboard/dj/mixes/canvas/upload` | Upload canvas video for mix |
| `GET/POST /api/dashboard/dj/sets` | DJ set management |
| `GET/PUT/DELETE /api/dashboard/dj/sets/[id]` | Individual DJ set |
| `POST /api/dashboard/dj/verification/apply` | DJ verification application |
| `GET /api/dashboard/dj/withdrawals` | DJ withdrawal history |

### Merch
| Endpoint | Description |
|----------|-------------|
| `GET/POST /api/dashboard/merch` | Merch product CRUD |
| `GET/PUT/DELETE /api/dashboard/merch/[id]` | Individual product management |
| `GET /api/dashboard/merch/orders` | List artist's merch orders |
| `GET /api/dashboard/merch/orders/[id]` | Order detail |
| `PATCH /api/dashboard/merch/orders/[id]` | Update fulfillment status/tracking + send shipped/delivered emails |
| `POST /api/dashboard/merch/orders/defect-claim` | Submit defect/replacement claim to Printful |
| `GET /api/dashboard/merch/balance` | Artist merch balance + earnings summary |
| `GET/POST /api/dashboard/merch/withdrawal` | Withdrawal history + request payout via Stripe Connect |
| `GET /api/merch/catalog` | Public: Printful curated catalog with base prices |
| `POST /api/merch/checkout` | Create Stripe Checkout session for merch purchase |
| `POST /api/merch/printful-webhook` | Receive Printful fulfillment webhooks (status, tracking, shipping) |
| `GET/POST /api/dashboard/merch/[id]/feature` | Feature/unfeature product in storefront |
| `POST /api/dashboard/merch/platform-setup` | Platform-level merch setup |
| `POST /api/dashboard/sample-packs/upload` | Sample pack ZIP upload |
| `GET/POST /api/dashboard/sample-packs/[id]/previews` | Sample pack preview management |
| `GET /api/dashboard/sample-packs` | Sample pack listings |

### Dashboard — Artist Content
| Endpoint | Description |
|----------|-------------|
| `GET/POST /api/dashboard/music` | Track CRUD |
| `GET/POST /api/dashboard/shows` | Artist show management |
| `GET/POST /api/dashboard/splits` | Split sheet management |
| `POST /api/dashboard/splits/[id]/agree` | Agree to split |
| `POST /api/dashboard/splits/[id]/reject` | Reject split |
| `GET/POST /api/dashboard/presave` | Pre-save campaign management |
| `GET/POST /api/dashboard/referrals` | Referral program data |
| `GET/POST /api/dashboard/broadcasts` | SMS broadcast campaigns |
| `GET/POST /api/dashboard/stream-leases` | Stream lease CRUD |
| `GET/POST /api/dashboard/release-planner` | Release plan management |
| `POST /api/dashboard/settings/password` | Change account password |
| `POST /api/dashboard/stripe-connect` | Create Stripe Express account + return onboarding link |
| `GET /api/dashboard/stripe-connect/refresh` | Refresh expired Stripe Connect account link |
| `GET /api/dashboard/fan-scores` | Fan engagement scores |
| `GET /api/dashboard/supporters` | Top supporter list |
| `GET /api/dashboard/producer/analytics` | Producer revenue analytics |
| `GET /api/dashboard/analytics` | User analytics dashboard data |
| `GET/POST /api/dashboard/artist-collaborators` | Manage artist collaborators |
| `GET/POST /api/dashboard/artist-photos` | Manage artist photos |
| `GET/POST /api/dashboard/artist-press-items` | Manage press kit items |
| `GET/POST /api/dashboard/artist-testimonials` | Manage artist testimonials |
| `POST /api/dashboard/beats/describe` | AI description generation for beats |
| `POST /api/dashboard/earnings-projection` | Project artist earnings |
| `POST /api/dashboard/fan-funding` | Fan funding stats for dashboard |
| `GET/POST /api/dashboard/fans` | Fan management |
| `GET/POST /api/dashboard/license-documents/[id]` | License document CRUD |
| `GET /api/dashboard/release-timing` | Release timing recommendations |
| `GET /api/dashboard/setup` | Dashboard initial setup data |
| `GET /api/dashboard/session-notes` | Session notes (artist side) |
| `GET /api/dashboard/sessions` | Booking sessions view for artists |
| `GET /api/dashboard/references` | Artist references/credits |
| `GET /api/dashboard/references/[id]` | Individual reference/credit detail |
| `GET /api/dashboard/stream-lease-beat-download/[beatId]` | Download beat via stream lease |
| `GET/POST /api/dashboard/stream-lease-bookmarks` | Bookmark stream leases |
| `GET /api/dashboard/stream-lease-earnings` | Stream lease earnings summary |
| `POST /api/dashboard/session-notes/[id]/feedback` | Session note feedback |
| `GET/POST /api/dashboard/producer/licensing` | Producer licensing settings |
| `GET/POST /api/dashboard/producer/settings` | Producer profile settings |

### Dashboard — Canvas & Videos
| Endpoint | Description |
|----------|-------------|
| `POST /api/dashboard/music/canvas/[trackId]` | Canvas video management for track |
| `POST /api/dashboard/music/canvas/checkout` | Canvas video Stripe checkout |
| `POST /api/dashboard/music/canvas/generate` | Generate canvas video for track |
| `POST /api/dashboard/music/canvas/upload` | Upload canvas video for track |
| `GET /api/dashboard/videos/[id]` | Individual video detail |
| `GET /api/dashboard/videos/products` | Videos associated with products |
| `POST /api/dashboard/videos/reorder` | Reorder video display order |
| `POST /api/dashboard/videos/upload-url` | Get presigned upload URL |
| `POST /api/dashboard/videos/youtube/connect` | Connect YouTube account |
| `POST /api/dashboard/videos/youtube/disconnect` | Disconnect YouTube account |
| `GET /api/dashboard/videos/youtube/status` | YouTube sync status |
| `POST /api/dashboard/videos/youtube/sync` | Manually trigger YouTube sync |

### Dashboard — Notifications
| Endpoint | Description |
|----------|-------------|
| `GET/PUT /api/dashboard/notifications/[id]` | Individual notification management |
| `GET /api/dashboard/notifications/unread-count` | Unread notification count |
| `GET/PUT /api/dashboard/presave/[id]` | Individual pre-save campaign management |

### Studio
| Endpoint | Description |
|----------|-------------|
| `GET/POST /api/studio/contacts` | Studio CRM contacts |
| `PUT/DELETE /api/studio/contacts/[id]` | Individual contact management |
| `GET/POST /api/studio/booking-requests` | Booking request management |
| `PUT/DELETE /api/studio/booking-requests/[id]` | Individual booking |
| `GET/POST /api/studio/invoices` | Invoice CRUD |
| `GET /api/studio/invoices/[id]/pdf` | Generate invoice PDF |
| `POST /api/studio/invoices/[id]/send` | Email invoice to client |
| `GET/POST /api/studio/intake-links` | Intake form link management |
| `GET/PUT /api/studio/intake-submissions/[id]` | Intake submission handling |
| `GET/POST /api/studio/session-notes` | Session note management |
| `POST /api/studio/quick-send` | Send file without booking |
| `POST /api/studio/[studioId]/book-request` | Public: submit booking request |
| `POST /api/studio/[studioId]/contact` | Public: contact studio |
| `POST /api/studio/canvas/[trackId]` | Canvas video for studio roster track |
| `POST /api/studio/canvas/checkout` | Canvas video Stripe checkout for studio |
| `GET /api/studio/canvas/tracks` | Get studio tracks eligible for canvas |
| `POST /api/studio/canvas/upload` | Upload canvas video for studio |
| `POST /api/studio/ai-tools/roster` | AI tools applied to roster artists |
| `GET /api/studio/artist-search` | Search artists for studio roster |
| `GET/POST /api/studio/artists` | Studio roster management |
| `GET/POST /api/studio/bookings` | Studio bookings |
| `GET/PUT/DELETE /api/studio/bookings/[id]` | Individual booking management |
| `POST /api/studio/contacts/[id]/cancel-sequence` | Cancel email sequence for contact |
| `GET/POST /api/studio/credits` | Studio credits/attributions |
| `GET/PUT/DELETE /api/studio/credits/[id]` | Individual credit |
| `GET/POST /api/studio/engineers` | Engineer profile management |
| `GET/PUT/DELETE /api/studio/engineers/[id]` | Individual engineer |
| `GET/POST /api/studio/equipment` | Equipment list management |
| `GET/PUT/DELETE /api/studio/equipment/[id]` | Individual equipment item |
| `POST /api/studio/generate-page` | AI-generate studio public page |
| `POST /api/studio/generation-feedback` | Feedback on AI page generation |
| `GET /api/studio/generation-log/latest` | Latest AI generation log entry |
| `GET/PUT /api/studio/inbox/[id]` | Individual inbox message management |
| `GET/PUT /api/studio/intake-submissions/[id]/analyze` | Analyze intake submission with AI |
| `POST /api/studio/invoices/[id]/pay` | Mark invoice as manually paid |
| `POST /api/studio/invoices/reminders` | Send invoice payment reminders |
| `POST /api/studio/my-slug` | Retrieve studio slug |
| `POST /api/studio/pageview/[studioId]` | Track studio page views |
| `GET/POST /api/studio/portfolio` | Portfolio track management |
| `GET/PUT/DELETE /api/studio/portfolio/[id]` | Individual portfolio track |
| `GET/PUT /api/studio/quick-send/[id]` | Individual quick-send file management |
| `GET /api/studio/referral-credits` | Studio referral credit tracking |
| `GET/PUT /api/studio/session-notes/[id]` | Individual session note |
| `GET /api/studio/settings/slug-check` | Check studio slug availability |
| `POST /api/studio/setup` | Studio account setup handler |

### Beats & Licensing
| Endpoint | Description |
|----------|-------------|
| `GET /api/beats` | Beat marketplace listing with filters |
| `GET/POST /api/beats/previews` | Beat preview management |
| `GET/POST /api/beats/licenses` | Beat license purchases |
| `GET /api/beats/licenses/[id]/pdf` | License document PDF |
| `POST /api/beats/checkout` | Stripe Checkout for beat purchase |

### Explore & Audio
| Endpoint | Description |
|----------|-------------|
| `GET /api/explore` | Explore page data (artists, beats, studios) |
| `POST /api/explore/radar-filter` | Filter by audio feature profile |
| `GET /api/audio-features/[id]` | Audio features for a track |
| `GET /api/audio-features/collab-matches` | Collab match recommendations |
| `GET /api/audio-features/studio/[slug]` | Studio track audio features |

### Public Engagement
| Endpoint | Description |
|----------|-------------|
| `POST /api/public/artist-trackplay` | Track a song play event |
| `POST /api/public/artist-linkclick` | Track a link click event |
| `POST /api/public/booking-inquiry/[artistSlug]` | Submit artist booking inquiry |
| `POST /api/public/fan-contact/[artistSlug]` | Fan contact form submission |
| `POST /api/public/fan-funding` | Public Stripe Checkout for fan-to-artist credit funding (no auth required) |
| `POST /api/public/support/[artistSlug]` | Fan tip/support submission |
| `POST /api/public/presave-click` | Pre-save campaign click |
| `POST /api/public/shows/[showId]/waitlist` | Join show waitlist |
| `POST /api/intake/[token]` | Submit intake form by token |
| `GET /api/intake/[token]/deposit-status` | Poll deposit payment confirmation for intake form |
| `GET /api/dl/[token]` | Download delivered file by token |
| `GET /api/invoice/[id]` | Public invoice data |
| `POST /api/public/artist-activity` | Record artist activity events |
| `POST /api/public/artist-pageview/[artistSlug]` | Track artist page views |
| `POST /api/public/artist-qr/[artistSlug]` | QR code scan tracking |
| `POST /api/public/shows/interest` | Register interest in a show |
| `POST /api/public/stream-lease-play` | Track stream lease plays |
| `POST /api/public/tracks/checkout` | Stripe checkout for track purchases |

### Admin
| Endpoint | Description |
|----------|-------------|
| `GET/POST /api/admin/users` | User CRUD |
| `POST /api/admin/users/[id]/comp` | Comp user subscription |
| `POST /api/admin/users/[id]/suspend` | Suspend user |
| `POST /api/admin/users/[id]/impersonate` | Start impersonation session |
| `POST /api/admin/impersonate/exit` | End impersonation |
| `GET/POST /api/admin/studios` | Studio CRUD |
| `PATCH /api/admin/studios/[id]/tier` | Change studio subscription tier |
| `GET/POST /api/admin/affiliates` | Affiliate management |
| `POST /api/admin/affiliates/[id]/approve` | Approve affiliate application |
| `GET/POST /api/admin/ambassadors` | Ambassador management |
| `POST /api/admin/ambassadors/[id]/payout` | Process ambassador payout |
| `GET/POST /api/admin/promo-codes` | Promo code management |
| `GET/POST /api/admin/team` | Admin team management |
| `GET /api/admin/ai-usage` | AI job usage reporting |
| `GET /api/admin/analytics/funnel` | Conversion funnel data |
| `GET /api/admin/churn` | Churn risk analysis |
| `GET/POST /api/admin/moderation` | Studio content moderation |
| `GET/POST /api/admin/settings/pricing` | Live PlatformPricing editor |
| `GET/POST /api/admin/ai-insights-log/[id]` | View AI insights log details |
| `GET /api/admin/ai-learning` | Aggregated AI feedback and learning analytics |
| `GET /api/admin/attribution` | Platform-wide attribution analytics |
| `POST /api/admin/audio-features/backfill` | Backfill audio features for existing tracks |
| `POST /api/admin/content/[type]/[id]/request-docs` | Request documentation from studio content |
| `GET/POST /api/admin/explore/[id]` | Manage explore feature cards by ID |
| `GET /api/admin/explore` | Explore feature card management |
| `POST /api/admin/impersonate/start` | Begin user impersonation session |
| `POST /api/admin/insights` | AI-generated platform insights summary |
| `POST /api/admin/moderation/[studioId]/approve` | Approve studio content from moderation |
| `POST /api/admin/moderation/[studioId]/scan` | Scan studio for moderation flags |
| `GET/POST /api/admin/moderation/flags/[flagId]` | Individual moderation flag management |
| `GET/POST /api/admin/moderation/flags` | List all moderation flags |
| `GET /api/admin/promo-popups/[id]/analytics` | Analytics for specific promo popup |
| `GET/PUT/DELETE /api/admin/promo-popups/[id]` | Promo popup CRUD |
| `GET/POST /api/admin/promo-popups` | Promo popup management |
| `POST /api/admin/support-chat` | Admin support chat handling |
| `POST /api/admin/team/[id]/deactivate` | Deactivate admin team member |
| `POST /api/admin/team/[id]/reactivate` | Reactivate admin team member |
| `POST /api/admin/team/[id]/reset-password` | Reset admin team member password |
| `PATCH /api/admin/team/[id]/role` | Change admin team member role |
| `POST /api/admin/users/[id]/dj-verify` | Force DJ verification status |
| `POST /api/admin/affiliates/[id]/commission` | Manage affiliate commission |
| `POST /api/admin/affiliates/[id]/reject` | Reject affiliate application |
| `POST /api/admin/affiliates/[id]/suspend` | Suspend affiliate account |

### AI Agent Platform
| Endpoint | Description |
|----------|-------------|
| `POST /api/agents/master-cron` | Master cron — routes to all agents on schedule |
| `POST /api/agents/churn-prevention` | Churn Prevention Agent — detects at-risk users, sends re-engagement |
| `POST /api/agents/revenue-optimization` | Revenue Optimization Agent — upsell nudges, upgrade prompts |
| `POST /api/agents/release-strategy` | Release Strategy Agent — pre-release coaching per artist |
| `POST /api/agents/fan-engagement` | Fan Engagement Agent — tip/merch automations, milestone alerts |
| `POST /api/agents/session-followup` | Session Follow-Up Agent — studio post-session email + review request |
| `POST /api/agents/anr-intelligence` | A&R Intelligence Agent — weekly play/revenue/collab insights (Push/Reign) |
| `POST /api/agents/content-moderation` | Content Moderation Agent — studio profile/portfolio review queue |
| `POST /api/agents/lead-scoring` | Lead Scoring Agent — scores studio contacts for conversion likelihood |
| `POST /api/agents/admin-dashboard` | Admin Dashboard Agent — weekly platform KPI summary email |
| Booking Agent (`src/lib/agents/booking-agent.ts`) | DJ booking reminders and follow-up automation |

### Release Board
| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboard/releases` | List all releases for authenticated user (enriched with track data + linked assets) |
| `POST /api/dashboard/releases` | Create new release — validates `artistId` ownership of all trackIds |
| `GET /api/dashboard/releases/[id]` | Enriched single release with all linked asset details |
| `PUT /api/dashboard/releases/[id]` | Partial update — title, trackIds, asset IDs, releaseDate |
| `DELETE /api/dashboard/releases/[id]` | Delete release grouping only (assets untouched) |

### Artist Avatar Studio
| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboard/avatar` | List user's generated avatars |
| `POST /api/dashboard/avatar/generate` | Generate new avatar — style, prompt, optional ref image (fal.ai FLUX) |
| `PUT /api/dashboard/avatar/[id]` | Update avatar label |
| `DELETE /api/dashboard/avatar/[id]` | Delete an avatar |
| `POST /api/dashboard/avatar/[id]/set-profile` | Set avatar as profile default (`isDefault: true`) |

### Music Video Studio
| Endpoint | Description |
|----------|-------------|
| `POST /api/video-studio/stripe` | Create Stripe Checkout for Quick or Director mode (guest + subscriber) |
| `GET /api/video-studio/[id]` | Get video job detail |
| `POST /api/video-studio/[id]/brief/lock` | Lock Director Mode creative brief |
| `GET /api/video-studio/[id]/download` | Download completed video file |
| `POST /api/video-studio/[id]/generate` | Trigger production generation |
| `POST /api/video-studio/[id]/publish` | Publish video to artist profile |
| `GET /api/video-studio/[id]/refs` | Character reference images for job |
| `POST /api/video-studio/[id]/regenerate` | Regenerate entire video |
| `GET /api/video-studio/[id]/shots` | Shot list for Director Mode job |
| `GET /api/video-studio/[id]/status` | Poll generation status + progress |
| `GET /api/video-studio/presets` | List VideoPresets for Quick Mode |
| `POST /api/video-studio/track/click` | Redirect click tracking for Email 4 conversion gate |
| `GET /api/video-studio/director` | Director Mode session management |
| `GET /api/video-studio/create` | Initialize new video job |
| `GET/POST /api/admin/video-studio/styles` | VideoStyle CRUD (PLATFORM_ADMIN) |
| `PATCH/DELETE /api/admin/video-studio/styles/[id]` | Individual VideoStyle management |
| `GET/POST /api/admin/video-studio/presets` | VideoPreset management (PLATFORM_ADMIN) |

### Cover Art Studio
| Endpoint | Description |
|----------|-------------|
| `GET/POST /api/cover-art` | List and create CoverArtJob records |
| `GET/PUT/DELETE /api/cover-art/[id]` | Individual job management |
| `GET /api/cover-art/[id]/status` | Poll generation status |
| `POST /api/cover-art/checkout` | Stripe Checkout for guest cover art purchase |
| `GET /api/cover-art/styles` | List active CoverArtStyles |
| `GET/POST /api/admin/cover-art/styles` | CoverArtStyle CRUD (PLATFORM_ADMIN) |

### Lyric Video Studio
| Endpoint | Description |
|----------|-------------|
| `GET /api/lyric-video/styles` | Active TypographyStyles ordered by sortOrder |
| `GET /api/lyric-video/status` | Poll job status — progress, currentStep, finalVideoUrl, errorMessage |
| `POST /api/lyric-video/checkout` | Stripe Checkout for Quick or Director mode (guest + subscriber) |
| `POST /api/lyric-video/brief` | Create draft LyricVideo job + Claude greeting (Director Mode) |
| `POST /api/lyric-video/brief/chat` | Claude conversation turn as creative director |
| `POST /api/lyric-video/brief/lock` | Save conversationLog + creativeBrief to DB |
| `GET /api/lyric-video/section-plan` | Run analyzeSong → Claude per-section background prompts (cached) |

### Cron Jobs (protected by CRON_SECRET)
| Endpoint | Description |
|----------|-------------|
| `POST /api/cron/send-emails` | Dispatch scheduled email sequences |
| `POST /api/cron/onboarding-emails` | Send onboarding email drip |
| `POST /api/cron/re-engagement-emails` | Send re-engagement emails |
| `POST /api/cron/trial-expiration` | Handle trial expiration |
| `POST /api/cron/stream-lease-cleanup` | Cancel expired stream leases |
| `POST /api/cron/quality-scores` | Daily batch recalculation of track quality scores (maxDuration 300, batches of 50) |
| `POST /api/cron/agents` | Orchestrates all batch 2 agents on schedule |
| `POST /api/cron/dj-monthly-earnings` | Monthly DJ earnings summary |
| `POST /api/cron/dj-weekly-summary` | Weekly DJ summary email |
| `POST /api/cron/fan-anniversaries` | Fan anniversary notifications |
| `POST /api/cron/stream-lease-payment-grace` | Stream lease grace period handling |
| `POST /api/cron/youtube-sync` | YouTube video sync orchestration |

### Dev (blocked in production)
| Endpoint | Description |
|----------|-------------|
| `GET /api/dev/email-preview` | Render branded email HTML in browser — `?context=MERCH_ORDER_CONFIRMATION` etc. |

### Misc
| Endpoint | Description |
|----------|-------------|
| `POST /api/uploadthing` | UploadThing file upload handler |
| `POST /api/affiliate/apply` | Submit affiliate application |
| `GET /api/affiliate/me` | Current affiliate status |
| `POST /api/affiliate/connect` | Initiate Stripe Connect for affiliate payouts |
| `GET /api/affiliate/connect/refresh` | Refresh expired Stripe Connect link |
| `POST /api/affiliate/payout` | Request affiliate payout |
| `POST /api/splits/review/[token]/agree` | E-sign split sheet by link |
| `POST /api/splits/review/[token]/reject` | Reject split sheet by link |
| `GET /api/notifications` | Fetch user notifications |
| `GET /api/receipts` | List AI/payment receipts |
| `GET /api/year-in-review/[year]` | Year-in-review data |
| `GET /api/artists` | Public artist directory listings |
| `GET /api/audio-features/analyze` | Analyze audio features for a track |
| `GET /api/audio-features/my-average` | Current user's average audio features |
| `GET /api/audio-features/similar-artists` | Find similar artists by audio profile |
| `GET /api/audio-features/similar-tracks` | Find similar tracks by audio profile |
| `GET /api/explore/featured` | Featured cards for explore page |
| `GET /api/explore/merch` | Merch products section in explore |
| `GET /api/explore/recently-played` | Recently played tracks section |
| `GET /api/explore/record-play` | Record a track play event from explore |
| `GET /api/explore/rising` | Rising/trending tracks section |
| `GET /api/explore/sample-packs` | Sample packs section in explore |
| `GET/POST /api/fans/automations` | Fan automation CRUD |
| `POST /api/invoice/[id]/notify-payment` | Notify studio of manual payment |
| `POST /api/merch/mockup` | Generate Printful product mockup |
| `GET /api/merch/shipping-estimate` | Estimate merch shipping costs |
| `GET /api/og/[type]/[id]` | Dynamic OG image by type and ID |
| `POST /api/promo/redeem` | Redeem promo code at checkout |
| `POST /api/promo/validate` | Validate promo code |
| `GET/POST /api/samples` | Sample management |
| `GET/PUT/DELETE /api/samples/[id]` | Individual sample management |
| `GET /api/tracks/[id]/card-detail` | Track card detail data for explore cards |
| `GET /api/tracks/[id]/overlay` | Track overlay data (BPM, key, canvas URL) |

---

## PRISMA MODELS (128 total)

```
Account              ActivityLog          AdminAccount
Affiliate            AffiliateReferral    AIGeneration
ArtistAvatar         Release
AIInsightsLog        AIJob                AgentLog
Ambassador           AmbassadorPayout     ArtistBookingInquiry
ArtistCollaborator   ArtistPhoto          ArtistPressItem
ArtistRelease        ArtistShow           ArtistSite
ArtistSupport        ArtistTestimonial    ArtistVideo
ArtistWithdrawal     AudioFeatures        AudioFingerprint
BeatLeaseSettings    BeatLicense          BeatPreview
BookingSession       BroadcastLog         Contact
ContactSubmission    CoverArtJob          CoverArtStyle
Crate                CrateCollaborator    CrateInvite
CrateItem            DeliveredFile        DigitalProduct
DigitalPurchase      DJAttribution        DJBookingInquiry
DJEvent              DJMix                DJMixTrack
DJProfile            DJSet                DJVerificationApplication
DJWithdrawal         EmailCampaign        ExploreFeatureCard
FanAutomation        FanContact           FanFunding
FanScore             GenerationFeedback   GenerationLog
IntakeLink           IntakeSubmission     Invoice
LicenseDocument      LinkClick            LyricVideo
MerchOrder           MerchOrderItem       MerchProduct
MerchVariant         ModerationFlag       MusicVideo
Notification         OnboardingEmailLog   PageView
Payment              PendingSignup        PlatformPricing
PreSaveCampaign      PreSaveClick         ProducerLeaseSettings
ProducerProfile      PromoCode            PromoPopup
PromoRedemption      QuickSend            RecentPlay
ReEngagementEmailLog Receipt              Referral
ReleasePlan          ReleasePlanTask      RevenueReportAlert
RevenueReportConfig  RevenueReportGoal    RevenueReportLog
SampleLog            ScheduledEmail       SessionNote
SessionNoteAttachment ShowInterest        ShowWaitlist
Split                SplitPayment         SplitSheet
StemSeparation       StreamLease          StreamLeaseAgreement
StreamLeaseBookmark  StreamLeasePayment   StreamLeasePlay
Studio               StudioArtist         StudioCredit
StudioEngineer       StudioEquipment      StudioPortfolioTrack
Subscription         Track                TrackPlay
TrackShieldResult    TrackShieldScan      TypographyStyle
User                 UserAttribution      VerificationToken
VideoPreset          VideoStyle           YouTubeSync
YoutubeReference
```

---

## INTEGRATIONS

| Service | Purpose | Status |
|---------|---------|--------|
| **Stripe** | Subscriptions, PPU, payouts, webhooks | ✅ Keys set — test mode |
| **Anthropic Claude** | Contract Scanner, Bio Generator, A&R Report, Press Kit | ✅ Key set |
| **Replicate** | Vocal Remover (Demucs) + Lyric Video Whisper (`openai/whisper` model path, no OpenAI key needed) | ✅ Key set |
| **FAL.ai / Kling** | AI Music Video (primary provider) | ✅ Key set |
| **Auphonic** | AI Mastering | ✅ Key set |
| **Remotion** | Lyric Video rendering (Lambda) — ✅ DEPLOYED, serveUrl set | ✅ Keys set |
| **Brevo** | Transactional email, SMS, campaigns | ✅ Keys set |
| **UploadThing** | File uploads (audio, images, PDFs) | ✅ Token set |
| **AWS S3** | Stem/audio file storage | ✅ Keys set |
| **Supabase PostgreSQL** | Primary database | ✅ Connected |
| **YouTube Data API** | YouTube video sync/embed + DJ set seeding | ✅ Key set |
| **AudD** | Track Shield — content recognition scanning against 80M+ songs | ✅ Key set |
| **ACRCloud** | DJ mix track identification + track upload acoustic fingerprinting | ✅ Token set |
| **Sentry** | Error monitoring | ⏭️ SKIPPED — PostHog used instead |
| **PostHog** | Product analytics + error tracking | ✅ INTEGRATED — `posthog-js` (client) + `posthog-node` (server) |
| **Stripe Connect** | DJ and producer direct payouts | ✅ Code complete — transfer.paid/failed webhook handlers wired |
| **Printful** | Print-on-demand merch fulfillment (order creation, webhook status updates, issue/defect claims) | ✅ Key set — `PRINTFUL_API_KEY` |
| **Google OAuth** | Social login via NextAuth Google provider | ✅ Live |
| **Facebook OAuth** | Social login via NextAuth Facebook provider | ⏳ Pending Meta business verification |

---

## FEATURES

### Auth & Onboarding
| Feature | Status |
|---------|--------|
| Email/password login | ✅ DONE |
| Google OAuth login — existing users sign in, new users redirected to signup flow | ✅ DONE |
| Facebook OAuth login — wired, hidden until Meta business verification completes | ⏳ PENDING |
| Social profile auto-population — name + photo from Google/Facebook set on account creation | ✅ DONE |
| `authProvider` tracked on User model (`"email"` / `"google"` / `"facebook"`) | ✅ DONE |
| Facebook button hidden on login + signup pages (remove `hidden` class to re-enable) | ✅ DONE |
| New user signup (artist / producer / studio path) | ✅ DONE |
| Forgot / reset password (Brevo email) | ✅ DONE |
| Post-checkout onboarding wizard | ✅ DONE |
| Promo code redemption at signup | ✅ DONE |
| PendingSignup → User creation (webhook fallback) | ✅ DONE |
| Required ToS + Privacy checkbox on signup (email + OAuth flows) — blocks submit if unchecked | ✅ DONE |
| `agreedToTerms Boolean @default(false)` + `agreedToTermsAt DateTime?` on `PendingSignup` — legal consent record | ✅ DONE |
| `onboardingTourCompleted Boolean @default(false)` on `User` — prevents re-showing tour after first completion | ✅ DONE |
| Onboarding tour (react-joyride v3) — fires once for new users after dashboard fully renders (1s delay) | ✅ DONE |
| Artist tour: 5 steps — Music → AI Tools → Merch → Artist Site → Explore | ✅ DONE |
| Studio tour: 5 steps — Bookings → Contacts → Invoices → AI Tools → Settings | ✅ DONE |
| `data-tour` attributes on `DashboardSidebar` (music, ai-tools, merch, site, explore) and `StudioSidebar` (bookings, contacts, invoices, studio-ai, studio-settings) | ✅ DONE |
| Dashboard layout + Studio layout each fetch `onboardingTourCompleted`, render `DashboardTourWrapper` with correct role | ✅ DONE |
| `POST /api/dashboard/onboarding-complete` — sets `onboardingTourCompleted: true`; called on tour finish or skip | ✅ DONE |

### Artist Dashboard
| Feature | Status |
|---------|--------|
| Dashboard home with stats | ✅ DONE |
| Track/release management | ✅ DONE |
| Digital products (Singles $0.99–$49.99 / EP $4.99–$99.99 / Albums $4.99–$99.99) | ✅ DONE |
| Digital product metadata + ID3 tag embedding on download | ✅ DONE |
| Buyer email receipt on purchase (Brevo) | ✅ DONE |
| Artist sale notification on purchase | ✅ DONE |
| Artist public mini-site (dynamic `/[slug]`) | ✅ DONE |
| Pre-save campaigns | ✅ DONE |
| Artist shows and events | ✅ DONE |
| Fan database and engagement scoring | ✅ DONE |
| Fan automation triggers (tip/merch) | ✅ DONE |
| Merch storefront + full order system (see Merch section below) | ✅ DONE |
| QR code generator | ✅ DONE |
| Year-in-review stats page | ✅ DONE |
| Release planner with task tracking | ✅ DONE |
| SMS broadcast campaigns | ✅ DONE |
| Play/link click analytics | ✅ DONE |
| Referral program + reward tiers (CREDIT_1 / FREE_MONTH / DISCOUNT_20 / LIFETIME_PUSH / LIFETIME_REIGN) | ✅ DONE |
| Referral LIFETIME tier — $0 Stripe prices created, subscription migration wired | ✅ DONE |
| Referral tier-drop detection — reverts subscription to paid + in-app notification + Brevo email | ✅ DONE |
| Affiliate program | ✅ DONE |
| Custom artist slug | ✅ DONE |
| Notifications (in-app) | ✅ DONE |

### AI Tools
| Feature | Status |
|---------|--------|
| AI Cover Art (Replicate/Flux) — Standard $4.99 / Premium $7.99 — public `/cover-art` + subscriber dashboard — 6 styles, Claude prompt enhancement, 4 variations, Pro refinement, 4-email conversion drip | ✅ DONE |
| AI Mastering (Auphonic) — $7.99 PPU | ✅ DONE |
| AI Music Video (Kling via FAL) — public `/video-studio` + subscriber dashboard — Quick + Director modes, WorkflowBoard, VideoPreset picker, CameraDirectionPicker, 4-email conversion drip | ✅ DONE |
| AI Lyric Video Studio (Remotion Lambda) — Quick $17.99 guest / $14.99 sub · Director $29.99 guest / $24.99 sub | ✅ DONE — 5 Framer Motion typography styles, Kling v3 Pro AI backgrounds per section, Director Mode Claude chat + section plan editor, public `/lyric-video` gate screen, 4-email conversion drip, guest linking on login |
| A&R Report (Claude) | ✅ DONE |
| Press Kit (Claude + PDF) — $9.99 PPU | ✅ DONE |
| Bio Generator (Claude, free) | ✅ DONE |
| Contract Scanner (Claude + pdf-parse, PPU) | ✅ DONE |
| Split Sheet Generator (free PDF) | ✅ DONE |
| Vocal Remover (Replicate Demucs, PPU) | ✅ DONE |
| Track Shield (AudD content scan) — Single $2.99 / 5-pack $9.99 / 10-pack $14.99 / Catalog $29.99 | ✅ DONE |
| Canvas Video — upload free / AI generate $1.99 PPU (Remotion Lambda TrackCanvas, 9:16 looping, Ken Burns + beat pulse) | ✅ DONE |
| Canvas Video — artist dashboard UI (upload + generate, preview, replace, remove, paid return handler) | ✅ DONE |
| Canvas Video — DJ mix dashboard UI (per-row panel, same flow) | ✅ DONE |
| Canvas Video — studio AI tools (roster artist + track selector, upload/generate) | ✅ DONE |
| Canvas Video — CanvasPlayer plays only in MiniPlayer Now Playing area; all cards show static cover art | ✅ DONE |
| Canvas Video — wired across platform (public page, explore, DJ crate, marketplace, dashboard, DJ profile) | ✅ DONE |
| Canvas Video — `HeroCanvasDisplay` ambient panel on artist public page (below Listen Now button) | ✅ DONE |
| Canvas Video — ambient panel reacts to MiniPlayer in real time (track-specific canvas or cover art) | ✅ DONE |
| Canvas Video — dominant color radial glow behind panel via `fast-average-color` (transitions 1s ease) | ✅ DONE |
| Canvas Video — AnimatePresence 500ms cross-fade on track change | ✅ DONE |
| Canvas Video — 4-edge gradient dissolve overlays (bottom 40%, top 20%, left 20%, right 20%) | ✅ DONE |
| Canvas Video — two-column layout on `/[slug]`: canvas 280px left column, page content right column | ✅ DONE |
| `Track.lyrics String?` — lyrics field added to Prisma schema for synced display | ✅ DONE |
| `AudioTrack.lyrics` + `AudioTrack.description` — added to Zustand audio store type | ✅ DONE |
| Auto-scrolling `LyricsDisplay` component below canvas video — synced to MiniPlayer playback position | ✅ DONE |
| Lyrics scroll — `overflow-y: hidden` + direct `scrollTop = scrollHeight × progress` (no jitter) | ✅ DONE |
| Lyrics highlighting — current line white, past lines `#444444`, upcoming lines `#666666` | ✅ DONE |
| Lyrics top/bottom dissolve gradient overlays (56px each) | ✅ DONE |
| Credit system (used/limit per tier) | ✅ DONE |
| Credit reset on monthly renewal (`invoice.paid`) | ✅ DONE |
| PPU Stripe Checkout flow | ✅ DONE |
| CreditExhaustedBanner → Stripe Checkout | ✅ DONE |
| AI job polling (4s interval) | ✅ DONE |
| AI receipts and history | ✅ DONE |

### Subscription & Billing
| Feature | Status |
|---------|--------|
| Subscription tiers (Launch $19 / Push $49 / Reign $99) | ✅ DONE |
| Studio tiers (Pro $49 / Elite $99) | ✅ DONE |
| Stripe Checkout for new subscriptions | ✅ DONE — Stripe keys set |
| Subscription upgrade/downgrade | ✅ DONE — Stripe keys set |
| Stripe billing portal | ✅ DONE — Stripe keys set |
| Stripe webhook (subscription lifecycle) | ✅ DONE |
| Affiliate commission on renewals | ✅ DONE |
| Stripe Connect DJ + producer payouts (`transfer.paid`/`transfer.failed` wired) | ✅ DONE (code) — needs Stripe account connected |
| DB-backed PlatformPricing (admin editable) | ✅ DONE |
| Price standardization (Reign $99, Mastering $7.99, Lyric Video Quick $17.99g/$14.99s, Director $29.99g/$24.99s, Press Kit $9.99, Cover Art $4.99/$7.99) | ✅ DONE |

### Beat Marketplace
| Feature | Status |
|---------|--------|
| Producer beat listings | ✅ DONE |
| Beat preview player | ✅ DONE |
| Beat licensing (Basic / Exclusive / Unlimited) | ✅ DONE |
| Beat purchase via Stripe Checkout | ✅ DONE — Stripe keys set |
| Stream Leases ($1/mo recurring) | ✅ DONE |
| Stream lease revenue splits (70/30) | ✅ DONE |
| Stream lease grace period (3 days) on failed payment | ✅ DONE |
| License document PDF | ✅ DONE |

### Digital Products (new)
| Feature | Status |
|---------|--------|
| Digital product types: Single ($0.99–$49.99), EP ($4.99–$99.99), Album ($4.99–$99.99) | ✅ DONE |
| Artist creates and prices digital products | ✅ DONE |
| Stripe Checkout for digital purchase | ✅ DONE |
| Buyer email receipt via Brevo on purchase | ✅ DONE |
| Artist in-app notification on sale | ✅ DONE |
| Token-gated download link for buyer | ✅ DONE |
| ID3 tags embedded in MP3 on download (node-id3) | ✅ DONE |
| Metadata fields: title, artist, album, genre, year, ISRC, songwriter, producer, copyright, explicit, BPM, key | ✅ DONE |
| StoreSection on public artist page (`/[slug]`) | ✅ DONE |

### Explore & Discovery
| Feature | Status |
|---------|--------|
| Explore page (artists / beats / studios tabs) | ✅ DONE |
| NLP natural language search (Compromise.js) | ✅ DONE |
| NLP intent pills below search bar | ✅ DONE |
| Audio radar filter (8-axis) | ✅ DONE |
| Collab match recommendations | ✅ DONE |
| AudioFeatures data population pipeline | ⚠️ PARTIAL — trigger exists, data sparsely populated |
| Quality score system — 0–100 signal: play velocity (25pts), DJ crate adds (20), purchases (15), audio uniqueness (10), recency (15), profile completeness (15), stale penalty | ✅ DONE |
| `qualityScore Int @default(0)` on Track model — pre-computed, updated by daily cron | ✅ DONE |
| Explore sections ranked by qualityScore — Trending, Beats, DJ Picks, New Releases | ✅ DONE |
| Cold-start fallback on all 4 sections — profile completeness + recency when <5 qualifying results | ✅ DONE |
| Daily quality-score recalculation cron (`POST /api/cron/quality-scores`, CRON_SECRET protected, maxDuration 300) | ✅ DONE |
| Cron orchestrator updated — QUALITY_SCORE_UPDATE agent fires daily with 22h dedup guard | ✅ DONE |
| New explore endpoints: `/api/explore/trending`, `/api/explore/new-releases`, `/api/explore/beats`, `/api/explore/dj-picks` | ✅ DONE |

### Studio
| Feature | Status |
|---------|--------|
| Studio public page (6 templates + Custom) | ✅ DONE — Classic, Bold, Editorial, Clean, Cinematic, Grid, Custom all wired in [slug]/page.tsx |
| Booking request management | ✅ DONE |
| CRM contacts + activity log | ✅ DONE |
| Intake forms with e-signature | ✅ DONE |
| Invoice builder + Stripe payment | ✅ DONE — `POST /api/invoice/[id]/stripe-checkout` + webhook marks PAID |
| File delivery (QuickSend) | ✅ DONE |
| Email blast campaigns (Brevo) | ✅ DONE |
| Session notes | ✅ DONE |
| Studio analytics dashboard | ✅ DONE |
| Artist roster management | ✅ DONE |
| Studio referral credit system | ✅ DONE |

### Merch System (Steps 1–15)
| Feature | Status |
|---------|--------|
| Printful API client (`src/lib/printful.ts`) — order creation, catalog, webhooks, issue claims | ✅ DONE |
| Schema: `MerchProduct`, `MerchVariant`, `MerchOrder`, `MerchOrderItem` | ✅ DONE |
| Curated Printful catalog (`GET /api/merch/catalog`) — t-shirts, hoodies, posters, hats, mugs | ✅ DONE |
| POD product creation — 6-step wizard (category → product → variants → design upload → mockup → publish) | ✅ DONE |
| Self-fulfilled product creation — title, description, images, variants, stock quantity | ✅ DONE |
| Design upload + Printful mockup preview | ✅ DONE |
| Public merch storefront (`/[slug]/merch`) — gallery, size/color picker, cart | ✅ DONE |
| Merch section on artist public page (`/[slug]`) with "View All" link | ✅ DONE |
| Merch grid on DJ public profile with link to artist merch store | ✅ DONE |
| Stripe Checkout for merch (with shipping address collection) | ✅ DONE |
| Printful order auto-submission on `checkout.session.completed` webhook | ✅ DONE |
| Artist merch dashboard — product list, order list, status management, tracking entry | ✅ DONE |
| Artist order management — update fulfillment status, tracking number, tracking URL, carrier | ✅ DONE |
| Self-fulfilled stock decrement on purchase; `stockQuantity` tracked per variant | ✅ DONE |
| Low stock warning notification when self-fulfilled stock drops to ≤3 | ✅ DONE |
| Defect/replacement claim (`POST /api/dashboard/merch/orders/defect-claim` → Printful issues API) | ✅ DONE |
| Return policy per product (POD standard / self-fulfilled custom / default) | ✅ DONE |
| Revenue split: POD = `(retailPrice − basePrice) × 85%` artist; self-fulfilled = `retailPrice × 85% + shipping` | ✅ DONE |
| `artistBalance` + `artistTotalEarnings` on User — incremented on every order | ✅ DONE |
| `ArtistWithdrawal` model — request payout via Stripe Connect ($25 minimum) | ✅ DONE |
| Merch balance page + withdrawal history on `/dashboard/earnings` | ✅ DONE |
| DJ Attribution for merch — 10% of artist earnings credited to DJ if `djDiscoveryOptIn=true` | ✅ DONE |
| DJ merch page (`/dashboard/dj/merch`) — same product + order management | ✅ DONE |
| Studio merch page (`/studio/merch`) — same product + order management | ✅ DONE |
| Buyer order confirmation email (gold IndieThis branding) | ✅ DONE |
| Buyer shipped email with tracking link | ✅ DONE |
| Buyer delivered email (`sendMerchDeliveredEmail`) | ✅ DONE |
| Artist new-order notification: "You sold a [product] to [buyer]!" | ✅ DONE |
| Artist self-fulfilled order email with buyer shipping address | ✅ DONE |
| Admin merch overview — orders/month, platform cut, overdue orders, Printful health, status breakdown, top products | ✅ DONE |

### AI Agent Platform — Batch 1 (Steps 1–11)
| Feature | Status |
|---------|--------|
| `AgentLog` model — tracks every agent action with agentType, action, status, metadata, timestamps | ✅ DONE |
| `logAgentAction()` utility + admin agent log page | ✅ DONE |
| Master cron (`POST /api/agents/master-cron`) — routes to all agents by schedule | ✅ DONE |
| Churn Prevention Agent — detects subscribers inactive >14 days, sends re-engagement sequence | ✅ DONE |
| Revenue Optimization Agent — upgrade nudges for near-limit users, upsell prompts | ✅ DONE |
| Release Strategy Agent — pre-release coaching emails (Mon/Wed/Fri cadence) | ✅ DONE |
| Fan Engagement Agent — tip/merch milestone automations | ✅ DONE |
| Session Follow-Up Agent — studio post-session email + review request | ✅ DONE |
| A&R Intelligence Agent — weekly play/revenue/collab insights (Push/Reign only, Fridays) | ✅ DONE |
| Content Moderation Agent — studio profile/portfolio queue for admin review | ✅ DONE |
| Lead Scoring Agent — scores studio CRM contacts for conversion likelihood | ✅ DONE |
| Enhanced Admin Dashboard Agent — weekly KPI summary email to admin | ✅ DONE |
| Admin agent log page — per-agent history, action counts, status | ✅ DONE |

### AI Agent Platform — Batch 2 (7 new agents + release bundle)
| Feature | Status |
|---------|--------|
| Creative Prompt Agent — daily nudge to artists missing cover art or metadata | ✅ DONE |
| Inactive Content Agent — weekly (Tuesdays) nudges artists with stale tracks/merch | ✅ DONE |
| Trend Forecaster Agent — weekly (Fridays) sends genre/trend teasers to artists | ✅ DONE |
| Producer–Artist Match Agent — weekly (Thursdays) matches producers to compatible artists | ✅ DONE |
| Payment Recovery Agent — daily escalation emails at Day 2 / 5 / 10 for failed payments | ✅ DONE |
| Collaboration Matchmaker Agent — monthly (1st of month) surfaces collab opportunities | ✅ DONE |
| Release Bundle Agent — weekly (Tuesdays) finds artists with tracks missing 2+ of cover art/canvas/lyric video, sends $18.99 bundle notification | ✅ DONE |
| `RELEASE_BUNDLE` added to `AgentType` enum in Prisma schema | ✅ DONE |
| All batch 2 agents orchestrated via `POST /api/cron/agents` cron route | ✅ DONE |
| `dj-monthly-earnings` cron wired in `vercel.json` — fires 1st of each month at 07:00 UTC | ✅ DONE |
| `dj-weekly-summary` cron wired in `vercel.json` — fires every Monday at 07:00 UTC | ✅ DONE |
| `fan-anniversaries` cron wired in `vercel.json` — fires daily at midnight UTC | ✅ DONE |

### Ambassador / Affiliate
| Feature | Status |
|---------|--------|
| Ambassador program with payout tracking | ✅ DONE |
| Affiliate program with commission tiers | ✅ DONE |
| Referral tracking and reward billing | ✅ DONE |
| Affiliate coupon at Stripe checkout (10% / 3mo) | ✅ DONE |

### DJ Platform (new)
| Feature | Status |
|---------|--------|
| DJ mode toggle on user account | ✅ DONE |
| DJ profile (slug, bio, genres, city, social links, profile photo) | ✅ DONE |
| Public DJ profile page (`/dj/[djSlug]`) — sets, mixes, crates, events | ✅ DONE |
| Public crate page (`/dj/[djSlug]/crate/[crateName]`) | ✅ DONE |
| DJ crate management + CrateItem tracking | ✅ DONE |
| DJ mix uploads with ACRCloud auto-tracklist identification | ✅ DONE |
| DJ mix canvas video (upload free / generate $1.99) | ✅ DONE |
| DJ set management (YouTube-linked, real thumbnail data) | ✅ DONE |
| DJ events listing | ✅ DONE |
| DJ verification flow (NONE → PENDING → APPROVED/DENIED) | ✅ DONE |
| Attribution cookie on profile/mix/crate visit (`POST /api/dj/attribute`) | ✅ DONE |
| DJ Attribution Engine — 10% of artist portion credited to DJ on purchase if `djDiscoveryOptIn=true` | ✅ DONE |
| DJ earnings dashboard — balance, total, attributions, withdrawals | ✅ DONE |
| DJ payout via Stripe Connect (`stripe.transfers.create`, transfer.paid/failed webhooks) | ✅ DONE (code) |
| DJ analytics dashboard — fans attributed, revenue, 12-week Recharts chart | ✅ DONE |
| DJ settings page — bio, genres, city, social links | ✅ DONE |
| Artist DJ Activity page — crate adds, DJs who have their tracks, DJ-attributed revenue | ✅ DONE |
| "Picked by X DJs" badge on artist public page (shows when ≥3 DJs) | ✅ DONE |
| Admin DJ analytics section (platform stats, top DJs, pending verification) | ✅ DONE |
| Admin DJ verification queue (approve/deny) | ✅ DONE |
| Audio fingerprinting on track upload (fpcalc local → ACRCloud acoustic fingerprint on Vercel) | ✅ DONE |
| DJ directory tab on Explore page | ✅ DONE |
| Seed script with real YouTube DJ set data (`scripts/seed-dj.js`) | ✅ DONE |

### Admin Panel
| Feature | Status |
|---------|--------|
| User management (comp, suspend, impersonate) | ✅ DONE |
| Studio management (tier, unpublish, moderation) | ✅ DONE |
| AI usage analytics and job detail | ✅ DONE |
| Revenue and churn analytics | ✅ DONE |
| Promo code CRUD | ✅ DONE |
| PlatformPricing live editor | ✅ DONE |
| Affiliate and ambassador management | ✅ DONE |
| Conversion funnel analytics | ✅ DONE |
| Content moderation queue | ✅ DONE |
| Admin team management with roles | ✅ DONE |
| DJ analytics stats + verification queue | ✅ DONE |
| Merch overview — orders, platform cut, status breakdown, top products, Printful health | ✅ DONE |
| Agent log — per-agent action history and status counts | ✅ DONE |
| AI Insights Card (cached 24h Claude summary of platform KPIs) | ✅ DONE |
| Churn prediction table (at-risk subscribers) | ✅ DONE |
| Stream lease stats (active leases, plays, duplicate flags) | ✅ DONE |
| Booking lead tracking — platform-wide leads, potential value, per-studio breakdown | ✅ DONE |

### Fan Funding / Artist Credits (Feature 1 — Steps 1–5)
| Feature | Status |
|---------|--------|
| `FanFunding` model — artistId, fanName, fanEmail, amount (cents), creditsAwarded, stripePaymentId, message | ✅ DONE |
| `platformCredits Int @default(0)` + `supporterCount Int @default(0)` on User | ✅ DONE |
| `POST /api/public/fan-funding` — public Stripe Checkout (no auth required); min $1, max $500; validates artist has active subscription | ✅ DONE |
| Stripe webhook handler — `fan_funding` checkout type; creates FanFunding record, increments credits + supporterCount | ✅ DONE |
| Notification to artist on funding received | ✅ DONE |
| Confirmation email to fan via Brevo (branded) | ✅ DONE |
| "Support [Artist]" button on `/[slug]` — gold outline, heart icon, opens modal | ✅ DONE |
| Support modal — preset amounts ($5/$10/$25/$50), custom amount, fan name/email/message fields, coral CTA | ✅ DONE |
| Post-payment `?funded=true` toast on artist page | ✅ DONE |
| Fan funding dashboard section on `/dashboard/earnings` — total received, supporter count, recent transactions | ✅ DONE |
| `sendFanFundingReceivedEmail` wired to Stripe webhook — artist notified with amount + credit balance | ✅ DONE |

### Sample Packs (Feature 2 — Steps 1–9)
| Feature | Status |
|---------|--------|
| `SAMPLE_PACK` type added to `DigitalProduct` schema | ✅ DONE |
| Sample pack upload — ZIP up to 128MB via UploadThing | ✅ DONE |
| Preview audio extraction from ZIP (first .wav/.mp3 found) | ✅ DONE |
| Sample pack listing on producer dashboard | ✅ DONE |
| Sample pack public display on artist/producer page (`StoreSection`) | ✅ DONE |
| Stripe Checkout for sample pack purchase | ✅ DONE |
| Token-gated download link for buyers | ✅ DONE |
| Buyer email receipt via Brevo (`sendSamplePackPurchaseEmail`) | ✅ DONE |
| Artist in-app notification on sample pack sale | ✅ DONE |

### Admin Popups & OG Optimization (Feature 3)
| Feature | Status |
|---------|--------|
| Promo popup system — admin-configured, dismissible overlay on public pages | ✅ DONE |
| OG image API (`/api/og`) — dynamic social share images per artist/track/page | ✅ DONE |
| Social meta tags on artist public pages and explore | ✅ DONE |

### Branded Transactional Emails (Feature 6 — Steps 17–20)
| Feature | Status |
|---------|--------|
| Shared `buildEmailTemplate()` — dark HTML (#0A0A0A body, #111111 card, #D4A843 gold, #E85D4A coral CTAs) | ✅ DONE |
| `getFeaturePromotion(context)` — 15 context cases; rule: never promote what user just used | ✅ DONE |
| `getWhatsNew()` — 10 rotating items, consistent by day-of-year across all emails | ✅ DONE |
| `sendBrandedEmail()` wrapper — applied to all existing transactional functions | ✅ DONE |
| All 9 existing email functions migrated to branded template | ✅ DONE |
| 10 new email functions created and wired to trigger points: | ✅ DONE |
| &nbsp;&nbsp;`sendVocalRemovalCompleteEmail` → vocal-remover status poll on Replicate succeeded | ✅ DONE |
| &nbsp;&nbsp;`sendMasteringCompleteEmail` → ai-job-processor MASTERING COMPLETE block | ✅ DONE |
| &nbsp;&nbsp;`sendCoverArtCompleteEmail` → ai-job-processor COVER_ART COMPLETE block | ✅ DONE |
| &nbsp;&nbsp;`sendPressKitCompleteEmail` → ai-job-processor PRESS_KIT COMPLETE block | ✅ DONE |
| &nbsp;&nbsp;`sendLyricVideoCompleteEmail` → lyric video Phase 2 render completion | ✅ DONE |
| &nbsp;&nbsp;`sendTrackShieldCompleteEmail` → track-shield scan route post-scan | ✅ DONE |
| &nbsp;&nbsp;`sendBeatPurchaseReceiptEmail` → Stripe webhook BEAT_LICENSE handler | ✅ DONE |
| &nbsp;&nbsp;`sendFanFundingReceivedEmail` → Stripe webhook fan_funding handler (artist side) | ✅ DONE |
| &nbsp;&nbsp;`sendInvoiceEmail` → studio invoice send route (replaces raw sendEmail, carries PDF attachment) | ✅ DONE |
| &nbsp;&nbsp;`sendSessionFollowUpEmail` → studio bookings PATCH on COMPLETED status | ✅ DONE |
| Dev preview route — `GET /api/dev/email-preview?context=X` (blocked in production) | ✅ DONE |
| `/api/dev` added to public paths in `src/proxy.ts` | ✅ DONE |

### Canvas & Overlay Enhancements
| Feature | Status |
|---------|--------|
| Canvas video plays in cards — CanvasPlayer with fade transition, fallback to cover art | ✅ DONE |
| Stronger gradient overlay on canvas cards for text legibility | ✅ DONE |
| Radar prominence — audio feature radar visible on track/artist cards | ✅ DONE |
| BPM pulse animation — card pulse synced to track BPM | ✅ DONE |
| Parallax effect on artist/track hero sections | ✅ DONE |
| Overlay data endpoint (`GET /api/tracks/[id]/overlay`) — BPM, key, genre, energy, canvas URL | ✅ DONE |

### Explore Cards (Steps 6–9)
| Feature | Status |
|---------|--------|
| Credits visibility on explore cards — producer/writer credits shown inline | ✅ DONE |
| Canvas upload prompt on explore cards — CTA when artist has no canvas video | ✅ DONE |
| Video trimmer — trim canvas video to loop section before upload | ✅ DONE |
| Upload specs modal — shows accepted formats, max size, recommended resolution | ✅ DONE |

### Intake Deposit & Studio Payments
| Feature | Status |
|---------|--------|
| Intake deposit payment flow — fan pays deposit via Stripe Checkout on intake form | ✅ DONE |
| Stripe webhook confirms deposit — sets `submission.depositPaid`, `submission.depositAmount`, adds note to draft invoice | ✅ DONE |
| `GET /api/intake/[token]/deposit-status` — polls deposit confirmation for intake form | ✅ DONE |

### Stripe Connect — Dashboard
| Feature | Status |
|---------|--------|
| `POST /api/dashboard/onboarding-complete` | Mark onboarding tour as completed for current user |
| `POST /api/dashboard/stripe-connect` — creates Stripe Express account, stores `stripeConnectId` on User, returns onboarding link | ✅ DONE |
| `GET /api/dashboard/stripe-connect/refresh` — refreshes expired Stripe Connect account links | ✅ DONE |
| `ConnectStripeButton` component — reusable button for initiating Stripe Connect onboarding | ✅ DONE |
| Stripe Connect status shown on `/dashboard/earnings` — payout options + connect status | ✅ DONE |
| Stripe Connect status on `/dashboard/affiliate` — affiliate payout integration | ✅ DONE |
| DJ earnings (`/dashboard/dj/earnings`) — Stripe Connect onboarding for DJ payouts | ✅ DONE |

### Artist Public Page UX
| Feature | Status |
|---------|--------|
| Preview My Page button on `/dashboard/site` and `/dashboard/settings` | ✅ DONE |
| Branded 404 page for unknown slugs (dark theme, IndieThis logo, link to explore) | ✅ DONE |
| MerchGrid horizontal carousel with left/right gold arrow buttons on `/[slug]` | ✅ DONE |
| MerchGrid `fullPage` prop — switches to 2-col grid on `/[slug]/merch` | ✅ DONE |
| Explore page merch section converted from static grid to horizontal carousel with arrows | ✅ DONE |
| IndieThis artist page (`/indiethis`) navbar shows platform logo via `isPlatform` prop | ✅ DONE |
| IndieThis merch store: 7 products (Snapback, Hoodie, Classic Tee, Dad Hat, Poster, Sticker, Luggage Tag) with real Printful mockups | ✅ DONE |
| Two-column layout on `/[slug]` — canvas + lyrics left (280px), hero/music/merch/shows right | ✅ DONE |

### Payments — Studio
| Feature | Status |
|---------|--------|
| Stripe invoice payment (card) on public invoice page | ✅ DONE |
| Cash App Pay option on intake form (studio sets `cashAppHandle` in settings) | ✅ DONE |
| Zelle, PayPal, Venmo handles on invoice + intake (studio configures in settings) | ✅ DONE |
| "Payment claimed" banner on invoice when studio marks payment received via alt method | ✅ DONE |
| Apple Pay / Google Pay — work automatically via Stripe card element (no extra setup needed) | ✅ DONE (Stripe built-in) |

### Social Login — Google + Facebook (Session 9)
| Feature | Status |
|---------|--------|
| Google OAuth provider added to NextAuth (`next-auth/providers/google`) | ✅ DONE |
| Facebook OAuth provider added to NextAuth (`next-auth/providers/facebook`) | ✅ DONE |
| `signIn` callback — existing user lookup by email; updates `authProvider` + photo | ✅ DONE |
| `signIn` callback — new user → creates PendingSignup with social data, redirects to `/signup` | ✅ DONE |
| `jwt` callback — fetches `role` + `djMode` from DB for OAuth sign-ins | ✅ DONE |
| Schema: `passwordHash String?` (nullable for OAuth users) on User + PendingSignup | ✅ DONE |
| Schema: `authProvider String @default("email")` on User + PendingSignup | ✅ DONE |
| Schema: `socialPhoto String?` on PendingSignup — auto-fills user photo on account creation | ✅ DONE |
| `signup-init`: skips password for OAuth; stores `authProvider` in PendingSignup upsert | ✅ DONE |
| `create-user-from-pending`: sets `authProvider` + `photo` from PendingSignup on user create | ✅ DONE |
| Login page: Google + Facebook buttons above email form with "or" divider | ✅ DONE |
| Signup page: social buttons + OAuth pre-fill mode (email locked, password hidden, name pre-populated) | ✅ DONE |
| Facebook data deletion callback (`POST /api/auth/facebook-data-deletion`) — Meta requirement | ✅ DONE |
| Google OAuth — tested and working ✅ | ✅ LIVE |
| Facebook OAuth — pending Meta business verification | ⏳ PENDING |
| Brand assets: all SVG logos converted to PNG at 2× resolution | ✅ DONE |
| Facebook cover photo (820×312) + profile pic (400×400) + Meta app icon (1024×1024) generated | ✅ DONE |

### Legal Pages
| Feature | Status |
|---------|--------|
| Terms of Service (`/terms`) — 21 sections, Clear Ear Corp, April 2026 | ✅ DONE |
| ToS covers: subscriptions, PPU, AI tools, merch splits (15%/85%), fan funding, DJ attribution (10%), beat marketplace, stream leases, platform agents, Track Shield, audio fingerprinting, prohibited conduct, arbitration (Cook County IL) | ✅ DONE |
| Privacy Policy (`/privacy`) — 14 sections, April 2026 | ✅ DONE |
| Privacy lists all third-party services: Stripe, Brevo, Printful, UploadThing, AWS S3, Supabase, Vercel, ACRCloud, AudD, Anthropic Claude, fal.ai, Replicate, Auphonic, PostHog | ✅ DONE |
| CCPA section in Privacy (California residents) | ✅ DONE |
| Facebook data deletion callback endpoint + noted in Privacy | ✅ DONE |
| Contact email: `info@indiethis.com` | ✅ DONE |
| Operator: Clear Ear Corp, Chicago, Illinois | ✅ DONE |

### Progressive Web App (PWA)
| Feature | Status |
|---------|--------|
| `public/manifest.json` — name, description, start_url `/`, display standalone, theme_color `#D4A843`, orientation portrait | ✅ DONE |
| PWA icons: `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (20% safe-zone padding on `#0A0A0A` bg) in `public/icons/` | ✅ DONE |
| `public/sw.js` — network-first caching strategy; precaches `/`, `/explore`, `/pricing`; cleans old caches on activate | ✅ DONE |
| Root layout: `<link rel="manifest">`, `<meta name="theme-color">`, Apple mobile web app meta tags, `<link rel="apple-touch-icon">` | ✅ DONE |
| `PWARegister` — production-only service worker registration (no-op in dev) | ✅ DONE |
| `InstallPrompt` — `beforeinstallprompt` banner: dark bg, gold heading, Install button, × dismiss; persists dismiss in localStorage | ✅ DONE |
| No PWA library — manual setup only (manifest + SW + InstallPrompt) | ✅ DONE |
| IndieThis is installable on Android, iOS (Add to Home Screen), and desktop Chrome/Edge | ✅ DONE |

### Analytics & Monitoring
| Feature | Status |
|---------|--------|
| PostHog product analytics + error tracking | ✅ DONE |
| PostHog client-side init via `instrumentation-client.ts` (Next.js 15.3+ pattern) | ✅ DONE |
| PostHog server-side singleton at `src/lib/posthog.ts` (`posthog-node`, `flushAt: 1`) | ✅ DONE |
| Auto-captures: pageviews, clicks, interactions, web vitals, session replay | ✅ DONE — PostHog built-in |
| Error tracking — enable in PostHog dashboard (no extra code needed) | ✅ DONE — PostHog built-in |
| Env vars: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` | ✅ SET |
| Sentry error monitoring | ⏭️ SKIPPED — PostHog covers error tracking |

### Revenue Report Agent
| Feature | Status |
|---------|--------|
| `src/lib/agents/revenue-report.ts` — scheduled business summary email (DAILY/WEEKLY/MONTHLY) | ✅ DONE |
| Revenue breakdown: subscriptions, PPU, merch cut, beat licensing, digital sales, fan funding, sample packs, MRR, period-over-period % change | ✅ DONE |
| User metrics: signups, new subscribers, churn, net growth, signups by provider | ✅ DONE |
| Product usage: top/least-used AI tools, top merch product, top digital product | ✅ DONE |
| Threshold alerts (`RevenueReportAlert`): DAILY_REVENUE / DAILY_SIGNUPS / DAILY_CHURN, ABOVE/BELOW conditions, 24h cooldown | ✅ DONE |
| Cron wired: `runRevenueReportAgent` + `checkAlerts` on every cron cycle | ✅ DONE |
| Admin panel: `/admin/revenue-report` — live preview, Send Now, alert config UI | ✅ DONE |
| API: `POST /api/admin/revenue-report/send-now`, `GET /api/admin/revenue-report/preview` | ✅ DONE |
| AdminSidebar: "Rev Report" nav entry | ✅ DONE |

### Music Video Studio (Steps 1–10 + extras)
| Feature | Status |
|---------|--------|
| Schema: `MusicVideo`, `VideoStyle`, `VideoPreset`, `VIDEO_CONVERSION` AgentType | ✅ DONE |
| Stripe checkout at `/api/video-studio/stripe` (guest + subscriber) | ✅ DONE |
| Song analyzer: BPM, key, energy, lyrics, structure via fal.ai Whisper + Claude | ✅ DONE |
| Quick Mode: VideoPreset picker, vision prompt, aspect ratio selector | ✅ DONE |
| Director Mode: Claude creative brief, shot list editor, character ref uploads, conversation log | ✅ DONE |
| `WorkflowBoard` — node-based production map showing all stages and their status | ✅ DONE |
| `CameraDirectionPicker` — per-scene camera direction selection (pan, zoom, static, etc.) | ✅ DONE |
| Camera direction auto-detection — shot-list generator suggests directions from lyrics/mood | ✅ DONE |
| `VideoPreset` schema + seed — 10 default presets with style/mood/prompt combos | ✅ DONE |
| `PresetPicker` component — Quick Mode preset grid with preview thumbnails | ✅ DONE |
| `VideoStudioClient` wizard UI (multi-step, both modes, WorkflowBoard integrated) | ✅ DONE |
| Character portrait via FLUX Kontext Pro | ✅ DONE |
| Parallel scene generation — max 3 concurrent, model-specific fal.ai params (Seedance 2.0, Seedance 1.5 Pro, Kling, etc.) | ✅ DONE |
| Remotion Lambda stitching — `MusicVideoComposition` with per-scene crossfade, `renderMediaOnLambda` | ✅ DONE |
| Thumbnail from highest-energy scene | ✅ DONE |
| `sendMusicVideoCompleteEmail()` — completion notification with preview link | ✅ DONE |
| API routes: download, refs, generate, regenerate, publish, brief, brief/lock, shots, scene-regen, status | ✅ DONE |
| Stripe webhook handler for `tool === "MUSIC_VIDEO"` | ✅ DONE |
| Non-subscriber gate — `GateScreen.tsx` collects email/Google OAuth, sets `indiethis_guest_email` cookie | ✅ DONE |
| Payment guard in pipeline — throws if amount > 0 and no `stripePaymentId` | ✅ DONE |
| Abandoned cart agent — targets PENDING jobs >2h, sends re-engagement email | ✅ DONE |
| Video Conversion Agent: 4-email drip (immediate / 48h / 5d / 10d), Email 4 gated on `conversionAnyOpened`, unique 50%-off Stripe promo code | ✅ DONE |
| Redirect click tracking at `/api/video-studio/track/click` | ✅ DONE |
| `VIDEO_CONVERSION` wired into `/api/cron/agents` with 22h dedup guard | ✅ DONE |
| Session linking: `linkGuestVideosByEmail()` claims guest videos on first dashboard login | ✅ DONE |
| Premium landing page `/video-studio` — hero with DemoReel + bg video loop, mode cards, OG/Twitter metadata; `?start=1` gates wizard | ✅ DONE |
| Sub-pages: `/video-studio/[id]/generating` (progress), `/video-studio/[id]/preview` (complete), `/video-studio/director/[id]` (Director session) | ✅ DONE |
| Admin panel `/admin/video-studio` — metrics dashboard (total/monthly videos + revenue, avg cost/margin, conversion rate, avg gen time, popular styles/models), video list table (100 most recent, filterable) | ✅ DONE |
| VideoStyle + VideoPreset CRUD via admin API (PLATFORM_ADMIN only) | ✅ DONE |
| Preview page (`/video-studio/[id]/preview`) — "Discover more" section shows 4 trending track cards (2×2/4-col grid, cover art, artist name, links to artist profile) | ✅ DONE |
| Trending tracks fetched server-side (ordered by plays desc, must have coverArtUrl, status PUBLISHED) | ✅ DONE |
| Audio file validation on `videoStudioAudio` UploadThing endpoint via `validateUT()` → `validateUpload("audio")` | ✅ DONE |
| **Claude QA loop** — `qaReviewScene()` sends thumbnail + scene description to Claude vision; returns `{approved, reason, refinedPrompt}`; auto-regenerates once on rejection; graceful fallback if no thumbnail or parse error | ✅ DONE |
| **Model fallback chain** — `MODEL_FALLBACKS` maps each primary fal.ai model to ordered fallbacks; tried on infrastructure failure; `fallbackUsed` + `fallbackAttempts` tracked per scene | ✅ DONE |
| `GeneratedSceneOutput` extended — 10 new tracking fields: `thumbnailUrl`, `qaApproved`, `qaReason`, `qaRetried`, `originalPrompt`, `refinedPrompt`, `primaryModel`, `actualModel`, `fallbackUsed`, `fallbackAttempts`, `manualRejected`, `manualRedirectNote` | ✅ DONE |
| **Reject & Redirect** — "Redirect" button on complete `ClipNode`s during Director Mode generation; inline textarea "What should change?"; Enter to submit, Escape to cancel; appends `Artist direction: <note>` to base prompt; re-generates that scene; one-per-scene cap; `manualRejected` overlay shown after submission | ✅ DONE |
| `autoLinkToRelease()` fire-and-forget — wired into music video, cover art, and lyric video completion pipelines; links asset to any Release containing the trackId | ✅ DONE |

### Artist Avatar System (Steps 1–11)
| Feature | Status |
|---------|--------|
| Schema: `ArtistAvatar` — `id`, `userId`, `avatarUrl`, `style`, `prompt`, `isDefault`, `dominantColors`, `label`, `createdAt` | ✅ DONE |
| `AVATAR_STYLES` — 8 style presets (Cinematic, Anime, Oil Painting, Neon Cyberpunk, Comic Book, Watercolor, 3D Render, Studio Portrait) | ✅ DONE |
| `src/lib/avatar/styles.ts` — client-safe export of `AVATAR_STYLES` (no sharp/fal imports); resolves Vercel build failure | ✅ DONE |
| `src/lib/avatar/generator.ts` — generation engine: fal.ai FLUX Kontext, dominant color extraction, saves to `ArtistAvatar` | ✅ DONE |
| Avatar Studio dashboard at `/dashboard/avatar` — generate form, gallery, set-default button, delete | ✅ DONE |
| `AvatarPicker` reusable component — compact/standard variant, `onSelect(AvatarSelectPayload)`, `onUploadUrl(url)` | ✅ DONE |
| `AvatarSelectPayload` — `{ url: string; dominantColors: DominantColors \| null; avatarId: string }` | ✅ DONE |
| Video Studio (Quick + Director modes) — AvatarPicker in Step 2 sets character reference image | ✅ DONE |
| Cover Art tool — AvatarPicker in Phase 2 sets `refImageUrl` for generation (logged-in users) | ✅ DONE |
| Lyric Video (Quick + Director modes) — AvatarPicker replaces cover art URL input for logged-in users | ✅ DONE |
| Canvas Video page (`/dashboard/ai/canvas`) — AvatarPicker on empty state, X button to clear ref | ✅ DONE |
| OG image route (`/api/og/[type]/[id]`) — artist + DJ types prefer `avatars[0].avatarUrl` over photo | ✅ DONE |
| Artist public page (`/[slug]`) — `avatars { where: { isDefault: true } }` query; uses avatar as profile photo | ✅ DONE |
| Dashboard sidebar + mobile nav — "Avatar Studio" entry with `UserCircle` icon (after AI Tools) | ✅ DONE |
| **Bug fix (Vercel):** `sharp` was bundling into client via `AvatarStudio.tsx → generator.ts → sharp`; fixed by extracting `AVATAR_STYLES` to `styles.ts` | ✅ FIXED |

### Cover Art Generator (Steps 1–7)
| Feature | Status |
|---------|--------|
| Schema: `CoverArtJob`, `CoverArtStyle`, `COVER_ART_CONVERSION` AgentType | ✅ DONE |
| Style seed: 6 presets (Cinematic Glow, Retro Grain, Neon Noir, Minimal, Abstract Burst, Golden Hour) | ✅ DONE |
| Claude prompt enhancement engine — style-aware enrichment before generation | ✅ DONE |
| Generation service: Replicate FLUX-dev (Standard) + FLUX-pro (Pro), 4 variations in parallel | ✅ DONE |
| API routes: generate, regenerate, publish, styles CRUD (PLATFORM_ADMIN) | ✅ DONE |
| Dashboard wizard — 5 steps, variation grid, fullscreen preview, Pro refinement flow | ✅ DONE |
| Stripe checkout at `/api/dashboard/ai/cover-art/checkout` (subscriber PPU) | ✅ DONE |
| Cover Art Conversion Agent — 4-email drip + 30% promo (Email 4 gated on open tracking) | ✅ DONE |
| Public landing page `/cover-art` — gate screen (email/Google OAuth), wizard, post-Stripe return | ✅ DONE |
| `linkGuestCoverArtsByEmail()` — links guest jobs to user on first dashboard login | ✅ DONE |
| Admin panel `/admin/cover-art` — metrics dashboard, job list, CoverArtStyle CRUD | ✅ DONE |

### Lyric Video Studio Upgrade (Steps 1–9)
| Feature | Status |
|---------|--------|
| Schema: `LyricVideo` (guest + subscriber, Quick + Director), `TypographyStyle`, `LYRIC_VIDEO_CONVERSION` AgentType | ✅ DONE |
| Pricing: Quick $17.99 guest / $14.99 sub · Director $29.99 guest / $24.99 sub | ✅ DONE |
| `TypographyStyle` seed: KARAOKE, KINETIC_BOUNCE, SMOOTH_FADE, GLITCH, HANDWRITTEN (5 styles) | ✅ DONE |
| `TypographyPreview` component — Framer Motion animations per style, 5s auto-loop, compact mode | ✅ DONE |
| Background scene generator — fal.ai Kling v3 Pro, cover art as seed, 3-concurrent batch, mood/section prompt maps | ✅ DONE |
| `CinematicLyricVideo` Remotion composition — 4 layers: Background (crossfade clips), Effects (beat pulse + vignette), Typography (5 styles), Branding (watermark) | ✅ DONE |
| Registered `CinematicLyricVideo` composition in `remotion/src/Root.tsx` alongside legacy `LyricVideo` | ✅ DONE |
| Quick Mode wizard — 5 phases: upload → style picker → confirm+pay → generating → download | ✅ DONE |
| Director Mode wizard — 6 phases: upload → Claude chat → section plan editor → confirm+pay → generating → review | ✅ DONE |
| `lyricVideoAudio` UploadThing endpoint — public, no auth, 64MB audio | ✅ DONE |
| Generation pipeline: analyzeSong → color extraction (sharp) → Kling backgrounds → Remotion Lambda → email | ✅ DONE |
| Payment guard in pipeline — throws if amount > 0 and no `stripePaymentId` | ✅ DONE |
| Stripe webhook handler for `LYRIC_VIDEO_QUICK` and `LYRIC_VIDEO_DIRECTOR` tools | ✅ DONE |
| Lyric Video Conversion Agent — 4-email drip (ready / value / social proof / 30% promo gated on open) | ✅ DONE |
| Lyric Video Abandoned Cart Agent — targets PENDING jobs >2h, sends re-engagement email | ✅ DONE |
| `LYRIC_VIDEO_CONVERSION` wired into `/api/cron/agents` with 22h dedup guard | ✅ DONE |
| Public `/lyric-video` page — `LyricVideoGateScreen` (email/Google OAuth), `LyricVideoClient` mode picker, OG + Twitter metadata | ✅ DONE |
| `indiethis_guest_email` cookie shared with cover-art gate (7-day, JSON `{email, name}`) | ✅ DONE |
| Subscriber redirect to `/dashboard/ai/lyric-video` on page load | ✅ DONE |
| `?paid=1&jobId=...&mode=...` post-Stripe return auto-polls and advances wizard | ✅ DONE |
| `?mode=director` / `?mode=quick` URL param pre-selects mode | ✅ DONE |
| `/api/lyric-video/*` added to `PUBLIC_PATHS` in `src/proxy.ts` | ✅ DONE |
| `linkGuestLyricVideosByEmail()` — links guest jobs to user on first dashboard login (parallel with music video linking) | ✅ DONE |

### Release Board (Steps 3–7)
| Feature | Status |
|---------|--------|
| Schema: `Release` model — `id`, `userId`, `title`, `trackIds Json` (String[]), `coverArtJobId?`, `musicVideoId?`, `lyricVideoId?`, `canvasVideoId?`, `masteredTrackId?`, `releaseDate?` | ✅ DONE |
| API routes: GET/POST `/api/dashboard/releases`, GET/PUT/DELETE `/api/dashboard/releases/[id]`, `enrichRelease()` helper | ✅ DONE |
| `autoLinkToRelease(trackId, assetType, assetId)` — `array_contains` query, non-blocking; only sets field if not already linked | ✅ DONE |
| Auto-link wired into music video, cover art, and lyric video completion pipelines | ✅ DONE |
| Releases list page `/dashboard/releases` — grid of release cards with cover art thumbnail, track count badge, 5 `AssetDots` (gold when linked, grey when not), formatted release date | ✅ DONE |
| `CreateReleaseModal` — title input, multi-select track picker with cover art thumbnails; navigates directly to new release on create | ✅ DONE |
| Empty state — Package icon + "Create Your First Release" CTA | ✅ DONE |
| Individual release page `/dashboard/releases/[id]` — `EditableTitle` click-to-edit inline, inline date picker auto-saves on change | ✅ DONE |
| 5 `AssetCard`s: Cover Art, Music Video, Lyric Video, Mastered Track, Canvas Video — gold icon when linked, grey+subtle CTA when not; no red Xs | ✅ DONE |
| Track carousel — horizontal scroll with `useRef` left/right `ChevronLeft`/`ChevronRight` arrows (appear when >3 tracks) | ✅ DONE |
| Delete button with `confirm()` dialog | ✅ DONE |
| DashboardSidebar + DashboardMobileNav: "Releases" entry with Package icon after Music | ✅ DONE |

### Not Started
| Feature | Status |
|---------|--------|
| Custom domain support for artist sites | ❌ NOT STARTED |
| White-label studio branding (Elite tier) | ❌ NOT STARTED |
| PWA (installable web app) | ✅ DONE — manifest, service worker, install prompt |
| Native mobile app (React Native) | ❌ NOT STARTED |
| Spotify / Apple Music API integration | ❌ NOT STARTED |
| TikTok API integration | ❌ NOT STARTED |

---

## KNOWN BUGS / ISSUES

| # | File | Issue |
|---|------|-------|
| 1 | ~~`src/lib/stripe.ts:24`~~ | ~~`PLAN_PRICES.reign.amount` still set to `14900` (old $149 price)~~ **FIXED** — updated to `9900` |
| 2 | `AudioFeatures` table | Sparse data — radar filter works but most tracks/beats have no AudioFeatures record; similarity matching returns few results |
| 3 | ~~Stripe everywhere~~ | ~~No `STRIPE_SECRET_KEY` in env → all subscription, PPU, invoice, beat purchase flows return 503 in dev~~ **FIXED** — all 6 Stripe env vars set; products + prices created in test mode |
| 4 | ~~`CRON_SECRET` not set~~ | ~~Cron routes have no auth protection in dev~~ **FIXED** — all 5 cron routes validated; `CRON_SECRET` set in `.env` |
| 5 | ~~`YOUTUBE_API_KEY` not set~~ | **FIXED** — key set in `.env.local` |
| 6 | ~~SMS limits hardcoded~~ | ~~SMS limit values are hardcoded per tier, not in PlatformPricing~~ **FIXED** — moved to `PlatformPricing` table; editable from `/admin/settings/pricing` |
| 7 | ~~`STRIPE_PRICE_ID_PUSH_LIFETIME` / `STRIPE_PRICE_ID_REIGN_LIFETIME`~~ | **FIXED** — $0 Stripe prices created, IDs set in `.env.local`, billing + tier-drop logic fully wired |
| 10 | ~~Chromaprint / fpcalc not on Vercel~~ | **FIXED** — SHA-256 fallback replaced with ACRCloud File Scanning API; stores matched title/artist/ISRC/confidence as JSON |

---

## ENVIRONMENT VARIABLES

| Variable | Used For | Status |
|----------|---------|--------|
| `DATABASE_URL` | Prisma primary DB connection | ✅ SET |
| `DIRECT_URL` | Prisma direct connection (migrations) | ✅ SET |
| `AUTH_SECRET` | NextAuth session signing | ✅ SET |
| `NEXTAUTH_SECRET` | NextAuth legacy compat | ✅ SET |
| `NEXTAUTH_URL` | NextAuth base URL | ✅ SET |
| `NEXT_PUBLIC_APP_URL` | Absolute URLs in emails/Stripe | ✅ SET |
| `ADMIN_EMAIL` | Admin account bootstrap | ✅ SET |
| `ADMIN_PASSWORD` | Admin account bootstrap | ✅ SET |
| `ANTHROPIC_API_KEY` | Claude (A&R, Press Kit, Bio, Contract) | ✅ SET |
| `REPLICATE_API_TOKEN` | Vocal Remover (Demucs) + Whisper transcription | ✅ SET |
| `FAL_KEY` | AI Music Video (Kling via FAL) | ✅ SET |
| `AUPHONIC_API_KEY` | AI Mastering | ✅ SET |
| `REMOTION_FUNCTION_NAME` | Lyric Video Lambda (`remotion-render-4-0-436-mem2048mb-disk2048mb-120sec`) | ✅ SET |
| `REMOTION_SERVE_URL` | Lyric Video Lambda serve URL | ✅ SET |
| `BREVO_API_KEY` | Email and SMS sending | ✅ SET |
| `BREVO_FROM_EMAIL` | Brevo sender email | ✅ SET |
| `BREVO_FROM_NAME` | Brevo sender name | ✅ SET |
| `BREVO_SMS_SENDER` | Brevo SMS sender ID | ✅ SET |
| `BREVO_WAITLIST_LIST_ID` | Brevo waitlist list | ✅ SET |
| `BREVO_ARTISTS_LIST_ID` | Brevo artists list | ✅ SET |
| `BREVO_STUDIOS_LIST_ID` | Brevo studios list | ✅ SET |
| `BREVO_NEWSLETTER_LIST_ID` | Brevo newsletter list | ✅ SET |
| `UPLOADTHING_TOKEN` | File upload (UploadThing v6+) | ✅ SET |
| `AWS_ACCESS_KEY_ID` | S3 stem/audio storage | ✅ SET |
| `AWS_SECRET_ACCESS_KEY` | S3 stem/audio storage | ✅ SET |
| `AWS_REGION` | S3 region | ✅ SET |
| `STRIPE_SECRET_KEY` | All Stripe operations | ✅ SET |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js client | ✅ SET |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification | ✅ SET |
| `STRIPE_PRICE_LAUNCH` | Launch plan Stripe price ID | ✅ SET |
| `STRIPE_PRICE_PUSH` | Push plan Stripe price ID | ✅ SET |
| `STRIPE_PRICE_REIGN` | Reign plan Stripe price ID | ✅ SET |
| `STRIPE_PRICE_ID_PUSH_LIFETIME` | $0 Push lifetime price (`price_1TGonsCnAaQlzZZifcbsXKba`) | ✅ SET |
| `STRIPE_PRICE_ID_REIGN_LIFETIME` | $0 Reign lifetime price (`price_1TGontCnAaQlzZZiZvBCO8of`) | ✅ SET |
| `CRON_SECRET` | Cron route authentication | ✅ SET |
| `YOUTUBE_API_KEY` | YouTube video sync + DJ set seeding | ✅ SET |
| `AUDD_API_KEY` | Track Shield — AudD content recognition API | ✅ SET |
| `ACRCLOUD_TOKEN` | ACRCloud JWT token for mix track identification | ✅ SET |
| `PRINTFUL_API_KEY` | Printful print-on-demand order creation + webhooks | ✅ SET |
| `STRIPE_PRICE_STUDIO_PRO` | Studio Pro plan Stripe price ID (`price_1TH38eCnAaQlzZZiDdIjBHRd`) | ✅ SET |
| `STRIPE_PRICE_STUDIO_ELITE` | Studio Elite plan Stripe price ID (`price_1TH38eCnAaQlzZZi1kziXj0W`) | ✅ SET |
| `FACEBOOK_CLIENT_ID` | Facebook OAuth provider (NextAuth) | ✅ SET |
| `FACEBOOK_CLIENT_SECRET` | Facebook OAuth provider (NextAuth) | ✅ SET |
| `GOOGLE_CLIENT_ID` | Google OAuth provider (NextAuth) | ✅ SET |
| `GOOGLE_CLIENT_SECRET` | Google OAuth provider (NextAuth) | ✅ SET |
| `BREVO_REPLY_TO` | Brevo reply-to address (optional) | ⚠️ OPTIONAL |
| `ADMIN_SECRET` | Admin API secret (referenced in code) | ⚠️ CHECK USAGE |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | PostHog client + server analytics | ✅ SET |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog ingest host (`https://us.i.posthog.com`) | ✅ SET |

---

## STRIPE SETUP CHECKLIST (when connecting account)

- [x] Add `STRIPE_SECRET_KEY` to env
- [x] Add `STRIPE_WEBHOOK_SECRET` to env
- [x] Create products + prices for Launch ($19), Push ($49), Reign ($99) → add price IDs to env
- [x] Create products + prices for Studio Pro ($49), Studio Elite ($99) → price IDs set in env
- [x] Create $0 lifetime prices for Push + Reign referral rewards → price IDs set in env
- [x] Update `PLAN_PRICES.reign.amount` from `14900` → `9900` in `src/lib/stripe.ts`
- [x] Add `invoice.created` to webhook subscribed events — handler at line 913 in `src/app/api/stripe/webhook/route.ts`
- [ ] Configure Stripe Connect for DJ + producer direct payouts
- [x] Add `transfer.paid` and `transfer.failed` to webhook subscribed events (DJ payouts)
- [ ] Set webhook endpoint to `https://indiethis.com/api/stripe/webhook` (production)
- [ ] Test: new signup → `checkout.session.completed` → user created + credits set
- [ ] Test: monthly renewal → `invoice.paid` (billing_reason=subscription_cycle) → credits reset
- [ ] Test: digital product purchase → buyer gets email receipt + download link
- [ ] Test: DJ payout → `DJWithdrawal` status updates to COMPLETED via `transfer.paid` webhook
