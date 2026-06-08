# IndieThis — Feature Gating Spec (Lite Launch)

_For 4.7. Goal: launch IndieThis with working products only. Hide the AI Mix Console and Pro Studio Mixer completely from the public — no nav, no routes, no mention — until the engine is ready. Founder (and explicitly flagged accounts) retain full access behind the scenes. Do not delete or break any mix console code. This is access control only._

---

## WHAT STAYS PUBLIC

These work and remain fully live and visible to all users:
- Mastering (and mastering results, guest flow, everything)
- Video Studio
- Vocal Remover
- Distribution
- Storefront / Marketplace

Do not touch any of these.

---

## WHAT GETS GATED (INVISIBLE TO PUBLIC)

- AI Mix Console (entire wizard, upload, analyze, direction, results)
- Pro Studio Mixer
- All mix-console API routes
- All mix-console nav links, homepage mentions, dashboard cards, cross-sell CTAs pointing INTO the mix console

The public must have NO way to discover the mix console exists — no visible link, no reachable URL, no "coming soon" placeholder, no waitlist. Complete invisibility.

---

## GATING MECHANISM

### Server-side flag

Create a single source of truth: `MIX_CONSOLE_ENABLED` — an env var, default `false`.

Plus a per-account allowlist so the founder and chosen testers get access regardless of the global flag.

**Access logic (server-side helper):**

```ts
// src/lib/feature-flags.ts
export function canAccessMixConsole(user?: { id?: string; email?: string; mixConsoleAccess?: boolean }): boolean {
  // Global kill switch — when true, everyone gets it (full launch later)
  if (process.env.MIX_CONSOLE_ENABLED === "true") return true;

  // Otherwise, only explicitly allowlisted accounts
  if (!user) return false;
  if (user.mixConsoleAccess === true) return true;

  // Founder allowlist by email (env-driven, comma-separated)
  const allowlist = (process.env.MIX_CONSOLE_ALLOWLIST ?? "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  if (user.email && allowlist.includes(user.email.toLowerCase())) return true;

  return false;
}
```

### Schema

Add a per-user flag so access can be granted without redeploying:
```prisma
// User model
mixConsoleAccess Boolean @default(false)
```
Run `prisma db push`. Set your own account to `true` directly in the DB.

### Env vars (Vercel + .env.local)
```
MIX_CONSOLE_ENABLED=false
MIX_CONSOLE_ALLOWLIST=your@email.com
```

---

## ENFORCEMENT — THREE LAYERS

### 1. Route protection (server-side, the real gate)

Every mix-console page and API route checks `canAccessMixConsole()` server-side BEFORE rendering or responding. If false:
- Pages: return a 404 (Next.js `notFound()`) — NOT a redirect to a "coming soon" page. A 404 means the route looks like it doesn't exist. This is critical — no "coming soon," no hint it's real.
- API routes: return 404 JSON, not 403. 403 reveals the endpoint exists. 404 reveals nothing.

Routes to protect:
```
src/app/mix-console/**            (all — wizard, results, studio, guest routes)
src/app/dashboard/ai/mix-console/**
src/app/api/mix-console/**         (all API + webhooks)
```

Webhook exception: Replicate webhooks (`/api/mix-console/webhook/**`) must still function for any in-flight founder/beta jobs. Gate webhooks on a valid job existing + signature, NOT on user access — a webhook has no user session. Leave webhooks reachable but they only act on real job IDs, so they're harmless.

### 2. Navigation / UI removal

Remove every visible entry point to the mix console for users who fail `canAccessMixConsole()`:
- Main nav: hide "AI Mix Console" link
- Homepage: remove any mix console section/mention
- Dashboard: hide mix console cards, recent mixes, CTAs
- Mastering results page: the "Mix this track first" or any cross-sell INTO mix console — hide it (keep mastering's own flow intact)

For allowlisted users, all of this shows normally. Use the same `canAccessMixConsole()` check to conditionally render.

### 3. Sitemap / SEO

- Remove all mix-console routes from `sitemap.xml` / sitemap generation
- Add mix-console paths to `robots.txt` disallow (belt and suspenders)
- Ensure no mix-console page emits meta tags or OG previews

---

## FOUNDER / BETA ACCESS (BEHIND THE SCENES)

When `canAccessMixConsole()` returns true for a user:
- Full nav link appears
- All routes load normally
- Full wizard → analyze → direction → results → studio flow works
- Everything behaves exactly as it does today

This means: set `mixConsoleAccess = true` on your account (or add your email to `MIX_CONSOLE_ALLOWLIST`), and you use the entire mix console + studio normally while the public sees nothing.

To add a beta tester later: flip their `mixConsoleAccess` to `true` in the DB. No deploy needed.

To launch publicly later: set `MIX_CONSOLE_ENABLED=true`. Everything appears for everyone at once.

---

## VERIFICATION

- Logged out: no mix console nav, homepage, or dashboard mention. Hitting `/mix-console`, `/dashboard/ai/mix-console/xxx`, `/mix-console/studio` → 404.
- Logged in as a normal (non-allowlisted) user: same as above — 404 everywhere, no UI entry points.
- Logged in as founder (allowlisted): full nav link, all routes load, full flow works end to end.
- API routes return 404 (not 403) for non-allowlisted requests.
- Mastering, video, vocal remover, distribution, storefront: all unaffected, fully public.
- Replicate webhooks still process founder/beta jobs correctly.
- `sitemap.xml` contains no mix-console URLs.

---

## DO NOT

- Do not delete or comment out mix console code — it stays fully functional behind the gate
- Do not use redirects or "Coming Soon" pages — use 404 so the feature appears not to exist
- Do not return 403 on API routes — use 404 (403 confirms the endpoint is real)
- Do not touch mastering, video, vocal remover, distribution, or storefront
- Do not gate webhooks on user session — they have none; gate on valid job + signature only
