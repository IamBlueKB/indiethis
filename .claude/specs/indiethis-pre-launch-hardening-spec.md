# IndieThis — Pre-Launch Hardening & Verification Spec

_For 4.7. Goal: take IndieThis from "works for me" to "safe to put in front of the public." Covers security hardening, full-site functional testing, legal pages, admin panel verification, and final polish. Work in phases, in order. Commit per logical unit. Stop at any phase boundary for review._

**Preserve these — do not remove or break:**
- IndieThis merch display on the Explore page (keep exactly as is)
- The ClearEar Studios site (stays live, untouched)
- The gated AI Mix Console + Pro Studio Mixer (stay gated, stay functional behind the flag)
- Mastering, Video Studio, Vocal Remover, Distribution, Storefront (all stay public and working)

---

## PHASE 1 — CRITICAL SECURITY (do before any public launch)

### 1.1 Supabase Row Level Security (HIGHEST PRIORITY)
- Audit every table: is RLS enabled? If not, the public anon key can read/write the DB directly, bypassing all API gating.
- Enable RLS on every table.
- Write policies: users can only read/write their own rows. Service-role key (server-side only) bypasses RLS for legitimate backend operations.
- Verify storage buckets are PRIVATE — accessed only via signed URLs, never public-read.
- Confirm the Supabase anon key in the client bundle can do nothing destructive even if extracted.

### 1.2 IDOR / Ownership checks
- Audit EVERY API route that accesses a resource by ID (`/api/*/job/[id]`, downloads, results, studio, mastering, etc.).
- Each must verify the authenticated user OWNS that resource server-side — not just that it exists.
- Guest/token routes: verify the token matches the specific resource.
- This is the most common real breach. No route trusts a client-supplied ID without an ownership check.

### 1.3 Cost-abuse protection (critical given Replicate spend)
- Rate-limit job submission (mastering, video, vocal remover) per user and per IP.
- Guest/unauthenticated job submission: CAPTCHA (hCaptcha or Cloudflare Turnstile) + hard per-IP daily cap.
- Per-user daily spending cap — a compromised account cannot run thousands of jobs.
- Verify the Replicate API key is server-side only, never in the client bundle.
- Verify fal.ai keys server-side only.

### 1.4 Auth hardening
- Rate-limit + brute-force lockout on login, signup, password reset (temporary lock after N failures).
- Account enumeration protection: login says "invalid email or password" (never which). Signup/reset says "if this email exists…".
- Email verification required before account is active (stops throwaway signups draining Replicate).
- Password reset tokens: 15–30 min expiry, single-use.
- Regenerate session ID on login (session fixation).
- Session expiry + invalidate on password change.
- Password hashing: bcrypt 12+ rounds (or argon2). Verify current hashing.

### 1.5 Webhook security
- Replicate webhooks: verify signature before processing (all of them — mix, mastering, video).
- Stripe webhooks: verify signature + idempotency (don't double-process events).

### 1.6 Input validation
- Zod schema on every API route input. Reject malformed payloads with 400.
- Mass-assignment protection: never spread `req.body` into Prisma create/update — whitelist fields explicitly.
- File upload validation: check MIME type AND magic bytes, enforce size limits, accept audio formats only, reject everything else.

### 1.7 Secret hygiene
- Audit: no non-`NEXT_PUBLIC_` env var reaches the client bundle. Grep client components for secret usage.
- Production error responses: no stack traces, no internal paths.
- Logs: no passwords, tokens, or PII captured.

---

## PHASE 2 — SECURITY HEADERS

In `next.config.js` `headers()`, apply globally:

```js
{
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains; preload"
},
{ key: "X-Content-Type-Options", value: "nosniff" },
{ key: "X-Frame-Options", value: "SAMEORIGIN" },
{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
{
  key: "Permissions-Policy",
  value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()"
}
```
(microphone=self only if the app records audio in-browser; otherwise microphone=() too.)

### Content-Security-Policy
- Implement in `Content-Security-Policy-Report-Only` mode FIRST.
- Allowlist all real domains: self, Supabase, Replicate, fal.ai, Stripe, cdnjs, your CDN, Google fonts if used, any analytics.
- Watch console for violations across every page (including audio players, Stripe checkout, video studio).
- Once clean, switch to enforcing `Content-Security-Policy`.
- Secure cookies everywhere: HttpOnly, Secure, SameSite=Lax.
- CORS: no wildcard `*` on authenticated endpoints.

---

## PHASE 3 — DATA & ABUSE HARDENING

- API response filtering: never return password hashes, internal flags, or other users' data in JSON.
- Pagination caps: limit max records per query.
- Dependency scan: `npm audit`, enable Dependabot or Snyk, patch known CVEs.
- Audit logging on admin actions: feature-flag flips, user deletions, refunds, access grants — who, what, when.
- Consider 2FA for admin accounts.

---

## PHASE 4 — SEED ACCOUNT CLEANUP

- Query and list all seed/test accounts (emails like `@indiethis.dev`, `test-artist`, `producer1`, etc.). Show the list for confirmation BEFORE deletion.
- After confirmation, delete them and any orphaned data (their jobs, files, storefront entries).
- Do NOT delete the founder account (`iambluekb@gmail.com`).
- Verify real user analytics aren't polluted by leftover test data.

---

## PHASE 5 — LEGAL PAGES

- Privacy Policy: what data is collected, how it's used, third parties (Supabase, Replicate, Stripe, fal.ai), retention, user rights.
- Terms of Service: acceptable use, IP ownership of uploads, that the user warrants they own/license what they upload, liability limits, account termination.
- DMCA / takedown process: you host user-uploaded music — required. A contact + process for rights holders.
- GDPR: data deletion mechanism (user can delete account + all data). Cookie consent banner if EU traffic.
- Make sure these are linked in the footer and at signup ("I agree to Terms + Privacy").
- NOTE: These should be reviewed by a lawyer before launch. 4.7 can draft solid starting templates but flag that legal review is recommended — this spec does not constitute legal advice.

---

## PHASE 6 — ADMIN PANEL VERIFICATION

- Walk every admin panel function and confirm it works end to end:
  - Reference library: upload, genre tag, process, stats, trends, intelligence tabs
  - User management: view, flag `mixConsoleAccess`, delete
  - Revenue/reporting views
  - Any feature-flag controls
  - Mastering/video/job monitoring if present
- Confirm admin auth is separate and secured (2FA recommended).
- Confirm no admin route is reachable without admin auth.
- Audit-log admin actions (ties to Phase 3).

---

## PHASE 7 — FULL-SITE FUNCTIONAL TEST

Agents can do automated browser testing. Use Playwright (a Playwright MCP/plugin exists) to script end-to-end flows. Test matrix:

### Public / logged-out
- Homepage loads, all sections render
- Explore page loads, IndieThis merch displays correctly, ClearEar Studios link/site intact
- Mastering: guest flow upload → analyze → master → results → download
- Video Studio: full flow
- Vocal Remover: full flow
- Distribution: flow loads
- Storefront: browse, product pages
- Gated mix console routes → 404 (verify invisibility)
- Signup, login, password reset, email verification
- Legal pages load and link correctly

### Logged-in normal user
- Dashboard loads, shows only entitled tools (no mix console)
- Each product flow works end to end
- Account settings, billing, data deletion
- Storefront management, merch

### Logged-in founder (allowlisted)
- Mix console fully accessible and functional
- Pro Studio mixer works
- Admin panel fully functional

### Cross-cutting
- Stripe checkout (test mode) completes for each paid product
- Mobile responsive across key pages
- No console errors on any page
- All forms validate and reject bad input
- 404 and error pages render properly

Produce a pass/fail report per flow. Fix failures, re-test.

---

## PHASE 8 — FINAL POLISH

- Consistent header/footer/nav across all public pages (the ResultsHeader gap surfaced earlier — make sure every page has proper site chrome).
- No placeholder text, lorem ipsum, broken images, dead links.
- Loading states and error states on every async action.
- Favicon, OG images, meta titles/descriptions on public pages (NOT on gated pages).
- Consistent branding — IndieThis logo, colors, typography everywhere.
- Mobile pass on every public page.
- Page load performance — lazy-load heavy assets, optimize images.
- Confirm ClearEar Studios site styling/links unaffected by any global changes.

---

## EXECUTION ORDER

1. Phase 1 (critical security) — do not launch without this
2. Phase 4 (seed cleanup) — quick, do early
3. Phase 2 (headers) — CSP in report-only first
4. Phase 3 (data/abuse)
5. Phase 6 (admin verification)
6. Phase 5 (legal drafts)
7. Phase 7 (full-site test) — after security is in, test everything
8. Phase 8 (polish) — fix what the test surfaces

Commit per logical unit. Stop at each phase boundary for review. For anything touching predict.py or requiring a cog push, stop and flag it.

## DO NOT
- Do not remove IndieThis merch from Explore
- Do not touch the ClearEar Studios site
- Do not ungate the mix console / Pro Studio
- Do not break mastering, video, vocal remover, distribution, storefront
- Do not delete the founder account during seed cleanup
- Do not enforce CSP before report-only mode confirms the allowlist is complete
