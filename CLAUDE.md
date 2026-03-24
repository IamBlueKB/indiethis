# CLAUDE.md — IndieThis Project Context

Read this file before every task. Do not assume what exists — check the codebase first.

---

## What Is IndieThis

IndieThis (indiethis.com) is a SaaS music platform for independent artists, producers, and recording studios. One platform for creating, selling, promoting, and managing music careers. Owner: Blue. Flagship studio: Clear Ear Studios (7411 S Stony Island Ave, Chicago IL 60649, blue@clearearstudios.com, 708-929-8745).

---

## Tech Stack (do not change, do not add alternatives)

- Next.js 14+ App Router, TypeScript
- Tailwind CSS + shadcn/ui
- Prisma + Supabase PostgreSQL
- NextAuth v5
- Stripe (payments, Connect for payouts)
- Brevo (email + SMS, transactional + automations)
- Cloudflare R2 + Uploadthing (file storage)
- Zustand (state management)
- Tanstack Table, React Query, Recharts
- wavesurfer.js (audio player)
- Framer Motion (animations)
- Dolby.io via fal.ai (AI mastering)
- web-audio-beat-detector (BPM detection, free)
- essentia.js (key detection, free)
- embla-carousel-react (carousels)

---

## Design Rules (enforce on every task)

- **Dark theme ONLY** — no light mode anywhere
- **Colors:** Gold/amber #D4A843 accents, coral #E85D4A CTAs, bg #0A0A0A, elevated #111111, surface #1A1A1A
- **No purple anywhere**
- **No prices on public studio pages** — pricing lives in booking/intake flow
- **No placeholder sections** — if data is empty, hide the section entirely. Never show "Coming Soon"
- **No geo-locked copy** — no "Chicago artists" or city-specific language on templates
- **No third-party branding** — no "powered by Dolby/DALL-E/Twilio." "Powered by IndieThis" in footer is fine
- **No fake stats or testimonials** — only show what's actually in the database
- **No free tier, no free trials** (unless via promo code)
- **Hours in 12-hour AM/PM format**
- **Social links only render for platforms with saved handles**
- **"Pay Per Use" replaces "à la carte" everywhere**
- **Fonts:** Playfair Display (headings), DM Sans (body)
- **All prices must import from PlatformPricing via src/lib/pricing.ts** — never hardcode prices

---

## Subscription Tiers

### Artist Tiers
| | Launch $19/mo | Push $49/mo | Reign $149/mo |
|---|---|---|---|
| Artist page | Profile only | Full 18 sections | Full 18 sections |
| AI tool credits | Tier-limited | More credits | Most credits |
| Email blasts | 100/mo | 500/mo | 2000/mo |
| SMS broadcasts | 100/mo | 500/mo | 2000/mo |
| Beat marketplace selling | No | No | Yes |
| Custom domain | No | No | Yes |
| Release planner | No | Yes | Yes |
| Press kit credits | 0 (pay-per-use) | 1/mo | 3/mo |

### Studio Tiers
| | Pro $49/mo | Elite $99/mo |
|---|---|---|
| All studio features | Yes | Yes |
| Email blasts | 500/mo | 2000/mo |
| Gallery photos | Max 6 | Max 12 |
| Featured artists | No | Yes |
| Custom accent color | No | Yes |
| Custom domain | No | Yes |
| Analytics dashboard | No | Yes |

### Pay-Per-Use AI Tools
Cover Art $4.99, Video $19/$29/$49, Mastering $9.99, Lyric Video $24.99, A&R Report $14.99, Press Kit $19.99

### Stream Lease
$1/mo per beat. Split: $0.70 producer, $0.30 IndieThis. Bundles into subscription invoice.

---

## What's Been Built (verified)

### Artist System
- Artist dashboard with all pages
- Artist public page with 18 sections (hero, pinned announcement, live ticker, pre-save, music with waveform players, videos with 2 zones, photos, shows, email/SMS capture, merch, tips, about, testimonials, collaborators, press, booking form, footer, persistent player bar)
- Performance video upload system with categories (LIVE, SESSION, FREESTYLE, BTS, ACOUSTIC, REHEARSAL)
- AI tools: cover art, video, mastering, lyric video, A&R report, press kit
- Merch storefronts (15% IndieThis cut)
- Music sales (10% cut)
- Beat marketplace with licensing (Lease, Non-Exclusive, Exclusive) and PDF agreements
- Stream lease system (8 phases complete) — $1/mo per beat, producer notifications, agreement system, play tracking, saved beats, explanation screen, cancellation with 30-day retention
- BPM and key auto-detection on beat uploads and studio intake
- Auto-generated beat descriptions via Claude API
- Invoicing, CRM with activity log, file delivery
- Email blasts via Brevo
- PWA quick-send page
- Smart links (detect device, reorder streaming pills)
- YouTube channel sync with video-to-product linking

### Studio System
- Studio dashboard with all pages
- Studio public page with 3 templates (Classic, Bold, Editorial) + 4 additional sections (audio portfolio, notable artists, engineer profiles, equipment list)
- Studio profile editor in admin panel
- Contact form on public pages → CRM + Brevo notification
- Studio tiers (Pro/Elite) with feature gating
- Intake form system with AI video upsell
- Clear Ear Studios as flagship on Bold template

### Platform-Wide
- Promo code system (FREE_TRIAL, DISCOUNT, COMP, CREDIT, AI_BUNDLE)
- Ambassador program with per-ambassador reward config, auto-payout at $25 via Stripe Connect
- PlatformPricing model — all prices stored in DB, admin editable at /admin/settings/pricing
- Pricing page with Artist/Studio toggle
- Terms of Service and Privacy Policy pages
- Explore page with 9 sections (featured carousel, trending, new releases, genre browse, beats, studios, rising artists, AI showcase, search bar)
- Seed data across all pages
- GitHub repo + Vercel deployment + indiethis.com domain connected

---

## What's In Progress / Queued (do not build unless specifically told to)

### Producer Integration (16 phases — spec file: indiethis-producer-integration-license-vault-spec.md)
- Auto-detecting producer mode when artist uploads first beat
- Producer sidebar section (My Beats, Stream Leases, Licensing, Analytics, Earnings)
- Producer section on artist public page
- Producer settings with display name, bio, default pricing
- License & Receipt Vault (platform-wide document storage for Splice licenses, Suno receipts, AI generation auto-receipts)

### Gap Features (5 features — spec file: indiethis-gap-features-spec.md)
1. Session notes / project tracker
2. Split sheets / payment splitting via Stripe Connect
3. Release planner (Push + Reign tiers)
4. Explore page enhancements
5. Notification center (30+ trigger types)

### Flow & Revenue Fixes (11 items — spec file: indiethis-flow-revenue-polish-spec.md)
1. Multi-step signup flow
2. Onboarding email sequence (7 emails over 30 days via Brevo)
3. Re-engagement emails for inactive users
4. Press kit tier credits
5. SMS broadcast limit enforcement
6. Upsell prompts (UpgradeGate component)
7. Artist-to-studio connection
8. Booking lead tracking + ROI analytics for studios
9. Explore page as default landing (/ serves explore, marketing page moves to /about)
10. Mobile optimization + SEO (OG images, structured data, sitemap)
11. Signup funnel tracking in admin

### Search Directory Pages (spec file: indiethis-search-directory-pages-spec.md)
- /studios — studio directory with search by name/city/service
- /beats — beat search with genre/BPM/key/price/stream lease filters
- /artists — artist + producer directory with toggle, search by name/genre/city
- Explore page fixes (dead footer links, gateway CTAs, cross-linking, URL params)
- Public nav update with links to all directory pages

### YouTube Sync (spec file: indiethis-youtube-sync-spec.md)
- Channel connection, batch sync cron (80/day limit), deduplication
- Video-to-product linking (track, beat, merch CTAs on videos)
- Video management dashboard

### Homepage
- Spec written (indiethis-homepage-rebuild-spec.md) — cinematic hero, live activity bar, AI demo, value prop cards, timeline, studio strip
- Will move to /about when explore becomes the landing page

---

## Key Architecture Patterns

- **Conditional rendering:** never show empty sections. Always check data exists before rendering.
- **Tier gating:** use UpgradeGate component for locked features. Never show blank pages or 403s — show what they're missing with upgrade CTA.
- **Prices:** always import from `src/lib/pricing.ts` which reads from PlatformPricing DB with 5-minute cache. Never hardcode dollar amounts.
- **Notifications:** use `createNotification(userId, type, title, body, actionUrl)` utility for all in-app notifications.
- **Email:** use Brevo for all transactional and automated emails. Never use another email provider.
- **File uploads:** use Uploadthing for all file uploads. Store URLs in database.
- **Audio playback:** use wavesurfer.js for waveform players. Persistent MiniPlayer for track/beat previews.

---

## Commit Rules

- Commit after every working step
- Use descriptive commit messages
- Push after every commit
- Do not combine multiple features in one commit
- Do not refactor unrelated code while building a feature

---

## Critical Reminders

- Do ONLY what is asked. Do not add features, refactor code, or change files not mentioned in the instruction.
- Confirm your plan BEFORE writing code if the task is complex.
- Check what already exists in the codebase before building something new. Do not recreate existing components.
- If you need to reuse a component that's inline (not exported), extract it into a shared component first, then use it in both places.
- When told to stop, STOP. Do not continue building.
- No Python scripts — this environment may not have Python. Use Node.js alternatives.
