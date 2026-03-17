# Decisions Log — IndieThis

_Every architectural or product decision with rationale. Before making a conflicting choice, check here first._

---

## D-2026-03-01 — Framework: Next.js 16 App Router

**Decision:** Use Next.js 16 with App Router and Turbopack.
**Rationale:** Server Components reduce client bundle size for the public marketing pages. App Router enables nested layouts for the artist/studio dashboard split. Turbopack significantly faster in dev.
**Alternatives considered:** Remix (no strong reason to switch), Vite SPA (loses SSR/SEO benefit for homepage).

---

## D-2026-03-01 — Styling: Tailwind v4 + CSS-First Config

**Decision:** Use Tailwind v4 with `@theme {}` blocks in `globals.css`. No `tailwind.config.ts` directive approach.
**Rationale:** `create-next-app` installed v4. CSS-first approach is the correct v4 pattern. Attempting v3 syntax causes silent failures.
**Note:** `@theme inline {}` block bridges CSS custom properties to Tailwind utility classes.

---

## D-2026-03-01 — Component Library: shadcn base-nova

**Decision:** Use shadcn/ui with the `base-nova` style (installed via `npx shadcn@latest init --defaults`).
**Rationale:** Latest shadcn default. Uses `@base-ui/react` which is more performant than Radix UI.
**Implication:** No `asChild` prop on any component. Use `buttonVariants` + Link for navigable buttons.

---

## D-2026-03-05 — Email/SMS: Brevo (not Twilio + Resend)

**Decision:** All email and SMS goes through Brevo (`@getbrevo/brevo`).
**Rationale:** Single vendor for transactional email, SMS, and blast campaigns. Brevo has competitive pricing and a solid REST API. Avoids managing two separate billing accounts.
**Replaced:** Twilio (SMS), Resend (transactional email).
**SDK note:** `@getbrevo/brevo` v2 uses `BrevoClient` with namespaced sub-APIs, not the old class-per-API pattern.

---

## D-2026-03-05 — AI Mastering: Dolby.io (both tiers)

**Decision:** Both "Quick" ($4.99) and "Studio Grade" ($14.99) mastering use Dolby.io Media API.
**Rationale:** Same backend, different loudness targets. Quick = -14 LUFS (streaming), Studio = -9 LUFS (commercial). No need for a second mastering vendor.
**SDK:** `@dolbyio/dolbyio-rest-apis-client`. Auth: App Key + App Secret → JWT (25-min cache).
**Job spec:** Must be passed as `JSON.stringify(spec)` — not a plain object.

---

## D-2026-03-05 — State Management: Zustand

**Decision:** Zustand for global client state (audio player, notifications, user profile).
**Rationale:** Minimal boilerplate, no providers needed for basic stores, `persist` middleware handles localStorage. Suitable for this scale without Redux complexity.
**Stores:** `audio.ts`, `notifications.ts`, `user.ts` (persisted to `indiethis-user` key).

---

## D-2026-03-05 — File Uploads: UploadThing

**Decision:** All file upload flows use UploadThing.
**Rationale:** Purpose-built for Next.js App Router. Handles presigned URLs, client hooks (`useUploadThing`), and server-side file routing cleanly. Better DX than raw S3.
**Status:** Installed, not yet wired to routes.

---

## D-2026-03-10 — No Free Tier

**Decision:** Spark ($19/mo) is the entry tier. No free plan.
**Rationale:** Platform quality requires paid users. Free tier creates support burden and attracts non-serious users.
**Implication:** "Start Creating Free" CTA was changed to "Start Creating".

---

## D-2026-03-10 — Launch State: Waitlist Only

**Decision:** Homepage shows waitlist CTA instead of live stats or testimonials.
**Rationale:** Platform has not launched. Showing fabricated stats (2,400+ artists, $1.2M+ earnings) would be dishonest.
**Applied:** Stats bar removed from Hero, stats grid + testimonials replaced with waitlist CTA in SocialProof.

---

## D-2026-03-10 — Theme: Dark Only

**Decision:** Force dark mode. No light mode toggle.
**Rationale:** IndieThis brand and design system is built for dark. Light mode would require a full parallel design system that isn't budgeted.
**Implementation:** `forcedTheme="dark"` in `providers.tsx`. Both `:root` and `.dark` in globals.css have identical palette values.

---

## D-2026-03-10 — Tables: TanStack Table v8

**Decision:** All data tables (artist dashboard, studio panel, admin) use `@tanstack/react-table`.
**Rationale:** Headless, composable, works with shadcn `table` component. Industry standard for complex tables.

---

## D-2026-03-10 — Charts: Recharts 3

**Decision:** All charts and graphs use Recharts.
**Rationale:** React-native, works without canvas setup, good shadcn integration pattern exists.

---

## D-2026-03-15 — Auth: NextAuth v5 + Credentials + JWT

**Decision:** Use `next-auth@beta` (v5) with Credentials provider and JWT session strategy.
**Rationale:** NextAuth v5 is the App Router-native build. Credentials provider handles email/password; JWT strategy avoids needing database sessions. PrismaAdapter used for user management and future OAuth support.
**Versions:** `next-auth@beta`, `@auth/prisma-adapter@1.6.0`, `prisma@5.22.0`
**Key files:** `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/types/next-auth.d.ts`
**Gotcha:** `next-auth` v5 installs Prisma 7 by default. Downgraded to `prisma@5` + `@auth/prisma-adapter@1` which uses the classic `url = env("DATABASE_URL")` pattern in schema.prisma. Prisma 7 changed this to a `prisma.config.ts` file — avoid that pattern.

---

## D-2026-03-15 — Database: Prisma + PostgreSQL

**Decision:** Prisma ORM with PostgreSQL for all data persistence.
**Rationale:** Prisma type-safety aligns with TypeScript strict mode. PostgreSQL handles relational data (users → subscriptions → sessions → delivered files) cleanly. `@auth/prisma-adapter` requires Prisma.
**Schema:** `prisma/schema.prisma` — 13 business models + 11 enums + NextAuth Account + VerificationToken models.
**Singleton:** `src/lib/db.ts` — global PrismaClient with hot-reload guard.
**Note:** `BookingSession` (not `Session`) used to avoid name conflict with NextAuth's Session model.
**Pending:** Run `prisma db push` or `prisma migrate dev` when a real PostgreSQL URL is configured.
