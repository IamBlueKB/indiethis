# Active Workflows — IndieThis

_Updated each session. One workflow per active feature build._

---

## Current Status

**Phase 2 (Auth + Layouts) is 🔄 In Progress.**

---

## Active Workflow

### WF-AUTH-20260315-01 — Auth + Layout Shells
**Status:** 🔄 In Progress
**Started:** 2026-03-15
**Decisions locked:**
- Auth: NextAuth v5 (`next-auth@beta`) + Credentials + JWT
- Database: Prisma 5 + PostgreSQL
- Password hashing: `bcryptjs`

**Completed in this session:**
- [x] Features headline/subheadline updated
- [x] `prisma/schema.prisma` — 13 models, 11 enums, NextAuth Account + VerificationToken
- [x] `npx prisma generate` — client generated
- [x] `src/lib/db.ts` — Prisma singleton
- [x] `src/lib/auth.ts` — NextAuth v5 config
- [x] `src/types/next-auth.d.ts` — Session + JWT type extensions
- [x] `src/app/api/auth/[...nextauth]/route.ts` — route handler
- [x] `src/app/api/auth/register/route.ts` — user creation + Brevo welcome email
- [x] `src/app/api/auth/forgot-password/route.ts` — password reset email
- [x] `src/middleware.ts` — role-based route protection
- [x] `src/app/(auth)/layout.tsx` + login + signup + forgot-password pages
- [x] `src/components/dashboard/` — DashboardSidebar + TopBar + MobileNav
- [x] `src/app/(dashboard)/layout.tsx` + `/dashboard/page.tsx`
- [x] `src/components/studio/` — StudioSidebar + StudioTopBar
- [x] `src/app/(studio)/layout.tsx` + `/studio/page.tsx`
- [x] `src/components/admin/` — AdminSidebar + AdminTopBar
- [x] `src/app/admin/layout.tsx` + `/admin/page.tsx`

**Remaining for Phase 2:**
- [ ] `prisma db push` when real PostgreSQL URL is configured
- [ ] Individual dashboard sub-pages (music, AI tools, merch, etc.)
- [ ] Email verification flow
- [ ] Password reset with real token (replace placeholder)
- [ ] Stripe integration for subscription management

---

## Completed Workflows

### WF-HOMEPAGE-20260301-01 — Homepage Build
**Status:** ✅ Complete
**Sections built:** Hero, Features, How It Works, Pricing, For Studios, Social Proof, Footer, Navbar
**Corrections applied:** 9 copy/design fixes on 2026-03-15
**Build:** Passing `npm run build` ✅

### WF-INFRA-20260305-01 — Service Layer Setup
**Status:** ✅ Complete
**Deliverables:**
- `src/lib/brevo/` — email, SMS, campaigns
- `src/lib/dolby/` — AI mastering
- `src/store/` — audio, notifications, user
- `.env.local` — all required vars documented
