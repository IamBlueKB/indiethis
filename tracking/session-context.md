# Session Context — IndieThis

_Updated at the end of each session. Read this first to resume where we left off._

---

## Last Session: 2026-03-15 (Session 2)

### What Was Done

1. **Features headline updated**
   - Headline: "Your music. Your money. Your move."
   - Subheadline: "One platform. Everything you need to create, sell, and grow as an independent artist."

2. **Prisma schema created** (`prisma/schema.prisma`)
   - 13 business models: User, Studio, StudioArtist, Subscription, BookingSession, Track, DeliveredFile, MerchProduct, MerchOrder, AIGeneration, ArtistSite, Payment, EmailCampaign
   - 11 enums including Role (ARTIST, STUDIO_ADMIN, PLATFORM_ADMIN)
   - NextAuth models: Account, VerificationToken
   - Note: Named `BookingSession` (not `Session`) to avoid conflict with NextAuth Session concept
   - `npx prisma generate` run — client at `node_modules/@prisma/client`

3. **Database singleton** (`src/lib/db.ts`)
   - Global PrismaClient with hot-reload guard

4. **NextAuth v5 config** (`src/lib/auth.ts`)
   - Credentials provider with bcrypt password verification
   - JWT session strategy
   - Injects `id` and `role` into token + session
   - PrismaAdapter removed (version conflict with next-auth@beta) — add back for OAuth later
   - Custom pages: signIn → `/login`, newUser → `/signup`

5. **Type extensions** (`src/types/next-auth.d.ts`)
   - `Session.user.id` (string) and `Session.user.role` (Role enum)
   - `JWT.id` and `JWT.role` extensions

6. **NextAuth route handler** (`src/app/api/auth/[...nextauth]/route.ts`)

7. **Auth API routes**
   - `src/app/api/auth/register/route.ts` — POST: create user + Brevo welcome email
   - `src/app/api/auth/forgot-password/route.ts` — POST: Brevo reset email

8. **Proxy (middleware)** (`src/proxy.ts`)
   - Role-based route protection: `/dashboard` → ARTIST, `/studio` → STUDIO_ADMIN, `/admin` → PLATFORM_ADMIN
   - Note: Next.js 16 renamed `middleware.ts` → `proxy.ts`

9. **Auth pages + layout** (`src/app/(auth)/`)
   - `layout.tsx` — centered, no navbar/footer
   - `login/page.tsx` — email + password, error display, links to signup/forgot-password
   - `signup/page.tsx` — name, email, password, role selector (Artist / Studio Owner)
   - `forgot-password/page.tsx` — email input, success state

10. **Artist dashboard layout shell** (`src/app/(dashboard)/`)
    - `layout.tsx` — server component, redirects non-ARTIST roles
    - `dashboard/page.tsx` — stat cards, onboarding CTA
    - `src/components/dashboard/DashboardSidebar.tsx` — 8 nav items, user info, sign out
    - `src/components/dashboard/DashboardTopBar.tsx` — mobile hamburger, user dropdown
    - `src/components/dashboard/DashboardMobileNav.tsx` — Sheet-based mobile nav

11. **Studio admin layout shell** (`src/app/(studio)/`)
    - `layout.tsx` — server component, redirects non-STUDIO_ADMIN roles
    - `studio/page.tsx` — stat cards, setup CTA
    - `src/components/studio/StudioSidebar.tsx` — 7 nav items
    - `src/components/studio/StudioTopBar.tsx` — top bar + mobile nav

12. **Platform admin layout shell** (`src/app/admin/`)
    - `layout.tsx` — server component, redirects non-PLATFORM_ADMIN roles
    - `page.tsx` — stat cards, platform status table
    - `src/components/admin/AdminSidebar.tsx` — coral accent, 5 nav items
    - `src/components/admin/AdminTopBar.tsx` — top bar + mobile nav

13. **Providers updated** (`src/components/providers.tsx`)
    - Added `<SessionProvider>` wrapper for NextAuth client hooks

14. **Memory files updated**
    - `memory/decisions-log.md` — Auth + Database decisions logged
    - `memory/learned-patterns.md` — Prisma 5 vs 7 gotcha, NextAuth type patterns, BookingSession naming
    - `tracking/active-workflows.md` — WF-AUTH-20260315-01 now active

### Current State of the Codebase

- `npm run build` passes clean ✅
- Preview server: `http://localhost:3456`
- Auth pages live: `/login`, `/signup`, `/forgot-password`
- Dashboard shells live: `/dashboard`, `/studio`, `/admin`
- Middleware proxy running: role-based route protection active
- Prisma schema generated — **needs a real DATABASE_URL to run `prisma db push`**

### Pending Items for Phase 2 Completion

- [ ] Provision a real PostgreSQL database → update `DATABASE_URL` in `.env.local`
- [ ] Run `npx prisma db push` to create tables
- [ ] Email verification flow (send token on signup, verify endpoint)
- [ ] Password reset with real token (current forgot-password uses placeholder token)
- [ ] Individual dashboard sub-pages (music, AI tools, merch, sessions, earnings, settings)
- [ ] Wire `useUserStore` to populate from NextAuth session on login

### Key Architectural Notes

- `src/proxy.ts` is the Next.js 16 equivalent of `middleware.ts`
- `@auth/prisma-adapter` installed but NOT used in auth.ts — version conflict with `next-auth@beta`. Can be wired in when upgrading or adding OAuth.
- `BookingSession` in schema (not `Session`) — avoids naming confusion with NextAuth
- All auth API routes are in `src/app/api/auth/` but NOT handled by NextAuth (register, forgot-password are custom routes; `[...nextauth]` is the NextAuth handler)

### Files Changed This Session

```
src/components/public/Features.tsx                   ← headline + subheadline updated
prisma/schema.prisma                                  ← new — full schema
src/lib/db.ts                                         ← new — Prisma singleton
src/lib/auth.ts                                       ← new — NextAuth v5 config
src/types/next-auth.d.ts                             ← new — type extensions
src/app/api/auth/[...nextauth]/route.ts               ← new
src/app/api/auth/register/route.ts                    ← new
src/app/api/auth/forgot-password/route.ts             ← new
src/proxy.ts                                          ← new — role-based route protection
src/app/(auth)/layout.tsx                             ← new
src/app/(auth)/login/page.tsx                         ← new
src/app/(auth)/signup/page.tsx                        ← new
src/app/(auth)/forgot-password/page.tsx               ← new
src/components/dashboard/DashboardSidebar.tsx         ← new
src/components/dashboard/DashboardTopBar.tsx          ← new
src/components/dashboard/DashboardMobileNav.tsx       ← new
src/app/(dashboard)/layout.tsx                        ← new
src/app/(dashboard)/dashboard/page.tsx                ← new
src/components/studio/StudioSidebar.tsx               ← new
src/components/studio/StudioTopBar.tsx                ← new
src/app/(studio)/layout.tsx                           ← new
src/app/(studio)/studio/page.tsx                      ← new
src/components/admin/AdminSidebar.tsx                 ← new
src/components/admin/AdminTopBar.tsx                  ← new
src/app/admin/layout.tsx                              ← new
src/app/admin/page.tsx                                ← new
src/components/providers.tsx                          ← added SessionProvider
.env.local                                            ← added DATABASE_URL + AUTH_SECRET
memory/decisions-log.md                               ← auth + db decisions added
memory/learned-patterns.md                            ← Prisma 5 vs 7, NextAuth patterns
tracking/active-workflows.md                          ← WF-AUTH-20260315-01 now active
```

---

## Resume Instructions

Start next session by:
1. Reading `memory/project-notes.md` — update Phase 2 rows to complete
2. Reading `tracking/active-workflows.md` — see what's remaining in Phase 2
3. Confirming DATABASE_URL is set before running any db push/migration commands
4. Next priority: dashboard sub-pages (music, AI tools, sessions, earnings, settings)
