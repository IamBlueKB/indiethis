# BUILD-STATUS.md — IndieThis
_Last updated: 2026-04-03 (session 9)_

---

## BUILD STATE

- **Framework:** Next.js 16.1.6 App Router, TypeScript strict
- **Database:** Supabase PostgreSQL via Prisma 5.22.0
- **Auth:** NextAuth v5 beta (`src/proxy.ts`, not middleware) — Google ✅ + Facebook ⏳ (pending Meta business verification)
- **Last clean build:** ✅ passes `npx next build` with zero errors
- **Deployment:** Vercel (auto-deploy on push to `master`)

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
| `/dl/[token]` | File download by token |
| `/invoice/[id]` | Public invoice view and Stripe payment |
| `/splits/review/[token]` | Split sheet review and e-sign |
| `/dj/[djSlug]` | Public DJ profile — sets, mixes, crates, events |
| `/dj/[djSlug]/crate/[crateName]` | Public DJ crate page |

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
| `POST /api/splits/review/[token]/agree` | E-sign split sheet by link |
| `POST /api/splits/review/[token]/reject` | Reject split sheet by link |
| `GET /api/notifications` | Fetch user notifications |
| `GET /api/receipts` | List AI/payment receipts |
| `GET /api/year-in-review/[year]` | Year-in-review data |

---

## PRISMA MODELS (116 total)

```
Account              ActivityLog          AdminAccount
Affiliate            AffiliateReferral    AIGeneration
AIInsightsLog        AIJob                Ambassador
AmbassadorPayout     ArtistBookingInquiry ArtistCollaborator
ArtistPhoto          ArtistPressItem      ArtistRelease
ArtistShow           ArtistSite           ArtistSupport
ArtistTestimonial    ArtistVideo          ArtistWithdrawal
AudioFeatures        AudioFingerprint     BeatLeaseSettings
BeatLicense          BeatPreview          BookingSession
BroadcastLog         Contact              ContactSubmission
CrateItem            DeliveredFile        DigitalProduct
DigitalPurchase      DJAttribution        DJCrate
DJEvent              DJMix                DJMixTrack
DJProfile            DJSet                DJVerificationApplication
DJWithdrawal         EmailCampaign        ExploreFeatureCard
FanAutomation        FanContact           FanFunding
FanScore             GenerationFeedback   GenerationLog
IntakeLink           IntakeSubmission     Invoice
LicenseDocument      LinkClick            MerchOrder
MerchOrderItem       MerchProduct         MerchVariant
Notification         OnboardingEmailLog   PageView
Payment              PendingSignup        PlatformPricing
PreSaveCampaign      PreSaveClick         ProducerLeaseSettings
ProducerProfile      PromoCode            PromoRedemption
QuickSend            RecentPlay           ReEngagementEmailLog
Receipt              Referral             ReleasePlan
ReleasePlanTask      SampleLog            ScheduledEmail
SessionNote          SessionNoteAttachment ShowInterest
ShowWaitlist         Split                SplitPayment
SplitSheet           StemSeparation       StreamLease
StreamLeaseAgreement StreamLeaseBookmark  StreamLeasePayment
StreamLeasePlay      Studio               StudioArtist
StudioCredit         StudioEngineer       StudioEquipment
StudioPortfolioTrack Subscription         Track
TrackPlay            TrackShieldResult    TrackShieldScan
User                 UserAttribution      VerificationToken
YouTubeSync          YoutubeReference
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
| **Sentry** | Error monitoring | ❌ NOT INTEGRATED |
| **PostHog / Mixpanel** | Product analytics | ❌ NOT INTEGRATED |
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
| AI Cover Art (Replicate/Flux) — Standard $4.99 / Premium $7.99 | ✅ DONE |
| AI Mastering (Auphonic) — $7.99 PPU | ✅ DONE |
| AI Music Video (Kling via FAL) | ✅ DONE |
| AI Lyric Video (Remotion Lambda) — $14.99 PPU | ✅ BUILT — Whisper via Replicate, multi-step UI, Remotion deployed |
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
| Price standardization (Reign $99, Mastering $7.99, Lyric Video $14.99, Press Kit $9.99, Cover Art $4.99/$7.99) | ✅ DONE |

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
| Agent infrastructure — `AgentLog` model, `logAgentAction()`, admin agent log page | ✅ DONE |
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
| Release Bundle Agent — coordinates pre-release coaching across multi-step release plans | ✅ DONE |
| All batch 2 agents orchestrated via `POST /api/cron/agents` cron route | ✅ DONE |

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

### Not Started
| Feature | Status |
|---------|--------|
| Sentry error monitoring | ❌ NOT STARTED |
| PostHog / product analytics | ❌ NOT STARTED |
| Custom domain support for artist sites | ❌ NOT STARTED |
| White-label studio branding (Elite tier) | ❌ NOT STARTED |
| Mobile app (React Native / PWA) | ❌ NOT STARTED |
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
| 9 | `AudioFeatures` table | Sparse data — radar filter and similarity matching return few results |
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
| `CLOUDFLARE_ACCOUNT_ID` | Referenced in memory notes, not found in code | ⚠️ UNUSED |

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
