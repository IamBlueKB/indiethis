# Project Notes — IndieThis

_Last updated: 2026-03-15 (Session 2)_

---

## Build Status

| Phase | Feature | Status | Notes |
|-------|---------|--------|-------|
| 1 | Homepage — Hero | ✅ Done | Waitlist CTA, waveform animation, tagline |
| 1 | Homepage — Features | ✅ Done | 8 cards, 48px tinted icons |
| 1 | Homepage — How It Works | ✅ Done | 3-step card layout |
| 1 | Homepage — Pricing | ✅ Done | Spark / Flame / Dynasty + À La Carte |
| 1 | Homepage — For Studios | ✅ Done | Clear Ear Studios callout, feature grid |
| 1 | Homepage — Social Proof | ✅ Done | Replaced with waitlist CTA + "coming soon" |
| 1 | Homepage — Footer | ✅ Done | Newsletter, links, copyright |
| 1 | Navbar | ✅ Done | Fixed, scroll blur, mobile hamburger |
| — | Brevo service layer | ✅ Done | email.ts, sms.ts, campaigns.ts |
| — | Dolby mastering service | ✅ Done | mastering.ts — JWT cached, quick + studio tiers |
| — | Zustand stores | ✅ Done | audio, notifications, user (persisted) |
| — | shadcn/ui installed | ✅ Done | base-nova style |
| — | Additional deps | ✅ Done | uploadthing, recharts, @tanstack/react-table, next-themes |
| 2 | Auth — Sign Up | ✅ Done | `/signup` page, API route, Brevo welcome email |
| 2 | Auth — Sign In | ✅ Done | `/login` page, NextAuth Credentials provider |
| 2 | Auth — Password Reset | 🔄 Partial | `/forgot-password` page + API; token is placeholder |
| 2 | Auth — Email Verify | ⬜ TODO | |
| 2 | Prisma Schema | ✅ Done | 13 models, 11 enums, generated client |
| 2 | Role-Based Middleware | ✅ Done | `src/proxy.ts` — ARTIST/STUDIO_ADMIN/PLATFORM_ADMIN |
| 2 | Artist Dashboard Shell | ✅ Done | Layout + sidebar + topbar + home page |
| 2 | Studio Admin Shell | ✅ Done | Layout + sidebar + topbar + home page |
| 2 | Platform Admin Shell | ✅ Done | Layout + sidebar + topbar + home page |
| 3 | Artist Dashboard | 🔄 Shell only | Sub-pages (music, AI, merch, etc.) are next |
| 3 | AI Music Video tool | ⬜ TODO | |
| 3 | AI Cover Art tool | ⬜ TODO | |
| 3 | AI Mastering tool | ⬜ TODO | Dolby service ready |
| 3 | AI A&R Report tool | ⬜ TODO | |
| 3 | Merch Storefront | ⬜ TODO | |
| 3 | Artist Mini-Site editor | ⬜ TODO | |
| 4 | Studio Panel — Bookings | ⬜ TODO | |
| 4 | Studio Panel — Roster | ⬜ TODO | |
| 4 | Studio Panel — File Delivery | ⬜ TODO | |
| 4 | Studio Panel — Revenue | ⬜ TODO | |
| 5 | Beat Marketplace | ⬜ TODO | Dynasty tier only |
| 6 | Public Artist Pages | ⬜ TODO | |
| 7 | Custom Domain Support | ⬜ TODO | Dynasty tier |
| 8 | Admin Panel | ⬜ TODO | |

---

## Current Priority

**Phase 2 — Auth (in progress).** Core auth is live. Needs: real DATABASE_URL, `prisma db push`, email verification, real password reset tokens.

---

## Key Design Decisions Already Made

- No free tier — Spark starts at $19/mo
- Platform not yet launched — no live stats shown on homepage
- Testimonials replaced with waitlist CTA until real artists are onboarded
- All mastering (Quick + Studio Grade) runs through Dolby.io — tier controls loudness target only
- Email blasts, transactional email, and SMS all through Brevo (no Twilio, no Resend)
- Dark mode only — `forcedTheme="dark"` in ThemeProvider
- shadcn base-nova uses `@base-ui/react` — no `asChild`, use `buttonVariants` + Link pattern

---

## Homepage Copy Corrections Applied (2026-03-15)

1. "Start Creating Free" → "Start Creating"
2. Hero stats bar removed → tagline: "Built for independent artists. Powered by AI. Owned by you."
3. SocialProof stats + testimonials removed → waitlist CTA
4. SCROLL / ChevronDown removed
5. Feature icons: 48px, per-feature tint colors
6. Pricing: all cards dark bg; Flame = gold border
7. Clear Ear Studios: address stripped to "Chicago, IL"
8. Footer: darkened to `#050507`
