# CLAUDE.md — IndieThis Build System

## What This Project Is

**IndieThis** is a full-stack SaaS platform for independent music artists and recording studios.
Stack: Next.js 16 · TypeScript · Tailwind v4 · shadcn/ui (base-nova) · Zustand · Brevo · Dolby.io · UploadThing

All source lives in `src/`. No CMS, no monorepo, no separate API server — everything is Next.js App Router.

---

## Session Boot Sequence

At the start of every session, read in order:

```
1. Read: memory/project-notes.md       ← current build state, what's done, what's next
2. Read: memory/learned-patterns.md    ← stack-specific patterns and gotchas
3. Read: memory/decisions-log.md       ← why key decisions were made; don't relitigate them
4. Read: tracking/active-workflows.md  ← any features mid-build?
5. Read: tracking/session-context.md   ← last session's ending state
6. Scan: src/                          ← understand current file layout before writing
```

Do NOT start writing code until steps 1–5 are complete.

---

## Non-Negotiable Rules

| # | Rule |
|---|------|
| 1 | **Read before write** — always read a file before editing it |
| 2 | **Build must pass** — run `npm run build` after every significant change set |
| 3 | **Log all decisions** — add an entry to `memory/decisions-log.md` for every architectural choice |
| 4 | **Update project-notes** — mark features complete in `memory/project-notes.md` when done |
| 5 | **One feature, one session** — don't half-build two things; finish one before starting another |
| 6 | **No fake data in production paths** — mock data only inside `src/lib/mock/` or `__tests__/` |
| 7 | **Server-only libs stay server-only** — Brevo, Dolby, DB clients never imported in client components |

---

## Directory Map

```
src/
  app/                   ← Next.js App Router pages and layouts
    (auth)/              ← sign-in, sign-up, password reset (TODO)
    (dashboard)/         ← artist dashboard (TODO)
    (studio)/            ← studio owner panel (TODO)
    api/                 ← API route handlers
  components/
    layout/              ← Navbar, Footer (shared across all pages)
    public/              ← Homepage sections (Hero, Features, Pricing, etc.)
    ui/                  ← shadcn/ui components (do not hand-edit; re-add via CLI)
    providers.tsx        ← ThemeProvider and any future global context
  lib/
    brevo/               ← Email (transactional + campaigns) and SMS via Brevo
    dolby/               ← AI Mastering via Dolby.io Media API
    utils.ts             ← cn() and shared utilities
  store/
    audio.ts             ← Zustand: audio player state
    notifications.ts     ← Zustand: notification bell state
    user.ts              ← Zustand: user profile + tier (persisted)
    index.ts             ← barrel export

memory/                  ← persistent build context (tracked in git)
tracking/                ← active workflows and session state
```

---

## Tech Stack Quick Reference

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 16.1.6 | App Router, Turbopack dev |
| Language | TypeScript 5 | strict mode |
| Styling | Tailwind CSS v4 | CSS-first `@theme {}` — no tailwind.config.ts directives |
| Components | shadcn/ui base-nova | Uses `@base-ui/react` — **no `asChild` prop**; use `buttonVariants` + Link |
| State | Zustand 5 | `persist` middleware on user store |
| Email / SMS | Brevo (`@getbrevo/brevo`) | `BrevoClient` — see `src/lib/brevo/` |
| AI Mastering | Dolby.io (`@dolbyio/dolbyio-rest-apis-client`) | App Key + Secret → JWT; see `src/lib/dolby/` |
| File Uploads | UploadThing (`uploadthing`, `@uploadthing/react`) | Not yet wired to routes |
| Tables | TanStack Table v8 | For admin and studio data tables |
| Charts | Recharts 3 | For earnings and analytics dashboards |
| Theme | next-themes | Forced dark — `forcedTheme="dark"` in providers.tsx |
| Toast | Sonner | Replaces deprecated shadcn toast |

---

## Environment Variables

All vars live in `.env.local`. Required vars by feature:

| Feature | Vars |
|---------|------|
| Brevo email/SMS | `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME`, `BREVO_SMS_SENDER` |
| Brevo lists | `BREVO_WAITLIST_LIST_ID`, `BREVO_ARTISTS_LIST_ID`, `BREVO_STUDIOS_LIST_ID`, `BREVO_NEWSLETTER_LIST_ID` |
| Dolby mastering | `DOLBY_APP_KEY`, `DOLBY_APP_SECRET` |
| UploadThing | `UPLOADTHING_TOKEN` |
| App URL | `NEXT_PUBLIC_APP_URL` |
| Auth (pending) | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` |
| Database (pending) | `DATABASE_URL` |

---

## Build & Dev Commands

```bash
npm run dev      # Turbopack dev server on port 3456 (via start-indiethis.js)
npm run build    # Production build — must pass before any PR / deploy
npm run lint     # ESLint
```

Preview server launcher: `C:\Users\brian\Documents\ai-tools\claude-system\claude-system\start-indiethis.js`

---

## Coding Conventions

- **Server components** by default; add `"use client"` only when needed (event handlers, hooks, stores)
- **Lib modules are server-only** — Brevo and Dolby clients must never be imported in `"use client"` files; call them from API routes or Server Actions
- **Component naming**: PascalCase files, one component per file for pages/sections
- **Import alias**: `@/` maps to `src/`
- **CSS tokens**: use `var(--color-accent)`, `var(--card)`, etc. — never hardcode hex in Tailwind classes except for one-off inline styles
- **Colors reference**: accent `#D4A843` · CTA `#E85D4A` · bg `#0A0A0B` · card `#141416` · text `#F5F0E8`

---

## Feature Build Order (Roadmap)

```
Phase 1 — Homepage          ✅ DONE
Phase 2 — Auth              sign-up, sign-in, password reset, email verify
Phase 3 — Artist Dashboard  earnings, AI tools, merch, artist mini-site editor
Phase 4 — Studio Panel      booking management, artist roster, file delivery, invoicing
Phase 5 — AI Tool Pages     AI Music Video, Cover Art, Mastering (Dolby), A&R Report
Phase 6 — Marketplace       beat marketplace, merch storefront
Phase 7 — Artist Mini-Sites public artist pages, custom domain support
Phase 8 — Admin             platform admin, user management, analytics
```

---

## AI Services

### Dolby.io — AI Mastering (`src/lib/dolby/mastering.ts`)
- **Auth:** `DOLBY_APP_KEY` + `DOLBY_APP_SECRET` → JWT (cached 25 min)
- **Tiers:** Quick = -14 LUFS (streaming), Studio Grade = -9 LUFS (commercial/radio)
- **Both tiers hit the same API** — only loudness target and preset differ
- **Job flow:** upload to dlb:// → `startMastering()` → `pollMasteringJob()` → download
- **Preview:** `previewMastering()` for A/B comparison (max 30 seconds)
- **Key gotcha:** `jobContent` must be `JSON.stringify(spec)` — not a plain object

### Brevo — Email + SMS (`src/lib/brevo/`)
- **Auth:** Single `BREVO_API_KEY` via `BrevoClient`
- **Transactional email:** `sendEmail()`, `sendTemplateEmail()` + typed helpers in `email.ts`
- **SMS:** `sendSMS()` + typed helpers in `sms.ts` — `tag` is `{ field: string }` object
- **Campaigns:** `createEmailCampaign()`, `sendCampaignNow()`, `addWaitlistSignup()` in `campaigns.ts`
- **Lists:** Configure list IDs in `.env.local` — `BREVO_WAITLIST_LIST_ID` etc.
- **Key gotcha:** Tag is `{ field: "string" }` not a bare string; campaign send takes `{ campaignId }` not a number

### UploadThing — File Uploads (`uploadthing`, `@uploadthing/react`)
- **Status:** Installed, not yet wired to routes
- **Pattern:** Define router in `src/app/api/uploadthing/core.ts`, expose at `src/app/api/uploadthing/route.ts`
- **Client:** `useUploadThing()` hook from `@uploadthing/react`
- **Auth var:** `UPLOADTHING_TOKEN`

---

## Pending Architecture Decisions

These must be resolved before Phase 2 (Auth) begins:

| Decision | Options | Status |
|----------|---------|--------|
| Auth library | NextAuth v5 / Clerk / custom JWT | ⬜ Pending |
| Database | Prisma + Postgres / Supabase / PlanetScale | ⬜ Pending |
| File storage | UploadThing (installed) / S3 / Cloudflare R2 | Leaning UploadThing |
| Payments | Stripe (standard) | ⬜ Pending |

---

## Agent Routing

| Task type | Approach |
|-----------|----------|
| New page or feature | Read project-notes → check decisions-log → plan in tracking/ → build |
| Bug fix | Read the failing file first → check learned-patterns for known gotchas |
| New lib integration | Add to decisions-log first → create `src/lib/[name]/` → update project-notes |
| UI component | Check if shadcn has it → `npx shadcn@latest add [name]` before building custom |
| API route | `src/app/api/[route]/route.ts` — never call Brevo/Dolby from client components |
| Database schema | Update decisions-log → create migration → update project-notes |
| Session end | Update `tracking/session-context.md` with what changed and what's next |
