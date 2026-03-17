# Learned Patterns — IndieThis

_Patterns discovered during the build. Read this before writing any new code._

---

## Tailwind v4 — CSS-First Config

**Problem:** `create-next-app` installs Tailwind v4, which does NOT use `tailwind.config.ts` directives.

**Pattern:**
```css
/* globals.css */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme {
  --color-accent: #D4A843;
  --font-display: var(--font-outfit), sans-serif;
  /* custom tokens here */
}

/* Bridge CSS vars → Tailwind utility classes */
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  /* etc. */
}
```

Never use `@tailwind base`, `@tailwind components`, `@tailwind utilities` — those are v3 directives.

---

## shadcn base-nova — No `asChild`

**Problem:** The `base-nova` shadcn style uses `@base-ui/react` primitives, not Radix UI. `Button` does not support the `asChild` prop.

**Pattern — link-styled button:**
```tsx
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ✅ Correct
<Link href="/signup" className={cn(buttonVariants({ variant: "default" }), "extra-classes")}>
  Sign Up
</Link>

// ❌ Wrong — asChild not supported in base-nova
<Button asChild><Link href="/signup">Sign Up</Link></Button>
```

---

## Brevo SDK v2 — `BrevoClient` Pattern

**Problem:** `@getbrevo/brevo` v2 exports only `BrevoClient`, `BrevoEnvironment`, `BrevoError`. The old class-per-API pattern (`new Brevo.TransactionalEmailsApi()`) does not exist.

**Pattern:**
```ts
import { BrevoClient } from "@getbrevo/brevo";

const client = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

// Transactional email — plain object request
await client.transactionalEmails.sendTransacEmail({
  sender: { email: "hello@indiethis.com", name: "IndieThis" },
  to: [{ email: user.email }],
  subject: "...",
  htmlContent: "...",
});

// SMS — tag is { field: string }, NOT a bare string
await client.transactionalSms.sendTransacSms({
  sender: "IndieThis",
  recipient: "+12025551234",
  content: "...",
  tag: { field: "booking-confirmation" },  // ← object, not string
  type: "transactional",
} as any);  // type cast needed due to SDK quirk

// Campaign send-now — pass { campaignId }, NOT a bare number
await client.emailCampaigns.sendEmailCampaignNow({ campaignId: 123 });

// Remove from list — pass { listId, body: { emails } }, NOT (listId, body)
await (client.contacts.removeContactFromList as any)({
  listId: 1,
  body: { emails: ["user@example.com"] },
});
```

---

## Dolby.io — Auth + Job Spec as JSON String

**Problem:** Dolby mastering API takes `(JwtToken, jobContentString)` — the job spec must be `JSON.stringify()`'d. The token is the full `JwtToken` object, not a bare string.

**Pattern:**
```ts
import * as dolby from "@dolbyio/dolbyio-rest-apis-client";

// 1. Get token (returns full JwtToken object)
const jwt = await dolby.media.authentication.getApiAccessToken(appKey, appSecret, 1800);

// 2. Start job — jobContent is JSON.stringify'd
const jobId = await dolby.media.mastering.start(jwt, JSON.stringify({
  inputs: [{ source: "dlb://input.wav" }],
  outputs: [{ destination: "dlb://output.wav", master: { ... } }],
}));

// 3. Poll
const result = await dolby.media.mastering.getResults(jwt, jobId);
```

Cache the JWT for 25 minutes — Dolby issues 30-minute tokens.

---

## CSS `ringColor` Is Not a Valid Inline Style Property

**Problem:** TypeScript rejects `style={{ ringColor: "..." }}` — `ringColor` is not in `CSSProperties`.

**Pattern — use `boxShadow` for highlight rings:**
```tsx
// ❌ Wrong
style={{ ringColor: tier.color }}

// ✅ Correct
style={{ boxShadow: `0 0 60px ${tier.color}18, 0 0 0 2px ${tier.color}50` }}
```

---

## Windows Preview Server — Spawn Pattern

**Problem:** On Windows, `.cmd` files (npm.cmd, next.cmd) cannot be spawned with `child_process.spawn` without `shell: true`. The `cwd` field in `.claude/launch.json` must be a relative path.

**Pattern — Node.js launcher script:**
```js
// start-indiethis.js
const { spawn } = require("child_process");
const path = require("path");
const port = process.env.PORT || "3456";
const appDir = "C:\\Users\\brian\\Documents\\indiethis";

const child = spawn(
  "C:\\Program Files\\nodejs\\node.exe",
  [path.join(appDir, "node_modules", "next", "dist", "bin", "next"), "dev", "--port", port],
  { cwd: appDir, stdio: "inherit", env: { ...process.env } }
);
```

---

## Server-Only Lib Pattern

Brevo and Dolby clients must never run on the client. If you need to call them from a form or button:

```ts
// src/app/api/waitlist/route.ts  ← call Brevo here
import { addWaitlistSignup } from "@/lib/brevo";

// src/components/public/SocialProof.tsx  ← call the API route here
await fetch("/api/waitlist", { method: "POST", body: JSON.stringify({ email }) });
```

---

## next-themes — Forced Dark

The app is dark-only. `forcedTheme="dark"` is set in `providers.tsx`.
Both `:root` and `.dark` in `globals.css` have identical IndieThis palette values.
`suppressHydrationWarning` is set on `<html>` in `layout.tsx`.

---

## IndieThis Color Reference

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-accent` | `#D4A843` | Gold — primary brand, CTAs |
| `--color-cta` | `#E85D4A` | Coral/red — destructive actions, secondary CTA |
| `--background` | `#0A0A0B` | Page background |
| `--card` | `#141416` | Card surfaces |
| `--foreground` | `#F5F0E8` | Primary text |
| `--muted-foreground` | `#8A8A8E` | Secondary text |
| `--border` | `#2A2A2E` | Borders |
| Footer bg | `#050507` | Slightly darker than page bg |
| Studios section | `#0D0D0F` | Slightly lighter than page bg |

---

## Prisma v7 vs v5 — Use v5 for now

**Problem:** `npm install prisma` installs Prisma 7 which removes `url = env("DATABASE_URL")` from the datasource block. It now requires `prisma.config.ts` + a driver adapter (`@prisma/adapter-pg`) which adds complexity.

**Pattern — stay on Prisma 5:**
```bash
npm install prisma@5 @prisma/client@5 @auth/prisma-adapter@1
```

```prisma
# prisma/schema.prisma — WORKS on Prisma 5
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Do NOT upgrade to Prisma 7** until there's a clear need — the `@auth/prisma-adapter@1.x` targets Prisma 5.

---

## NextAuth v5 — Session JWT has id and role

**Pattern — extend types in `src/types/next-auth.d.ts`:**
```ts
import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role; } & DefaultSession["user"];
  }
  interface User { role: Role; }
}
declare module "next-auth/jwt" {
  interface JWT { id: string; role: Role; }
}
```

**Pattern — inject in callbacks:**
```ts
callbacks: {
  async jwt({ token, user }) {
    if (user) { token.id = user.id; token.role = (user as any).role; }
    return token;
  },
  async session({ session, token }) {
    session.user.id = token.id as string;
    (session.user as any).role = token.role;
    return session;
  },
}
```

---

## Prisma — BookingSession naming

**Problem:** Prisma schema had `model Session` which conflicts with NextAuth's own Session model concept.

**Fix:** Renamed to `model BookingSession` in schema and updated all relations accordingly. This avoids confusion and keeps the two concepts cleanly separated.

---

## NextAuth v5 + @auth/prisma-adapter — Version Conflict

**Problem:** `next-auth@beta` bundles its own internal `@auth/core` at `node_modules/next-auth/node_modules/@auth/core`. `@auth/prisma-adapter` uses the hoisted `@auth/core` at `node_modules/@auth/core`. These are different versions and their types are incompatible.

**Error symptom:**
```
Type 'Adapter' is not assignable to type 'Adapter'.
Property 'role' is missing in type 'AdapterUser' ...
```

**Fix for credentials-only auth (JWT strategy):** Remove `adapter: PrismaAdapter(db)` from the NextAuth config entirely. The `authorize()` callback does user lookup directly via `db.user.findUnique()`, so the adapter isn't needed.

**When to add adapter back:** Only needed for OAuth providers (Google, GitHub, etc.) or database sessions. At that point, pin `@auth/prisma-adapter` to the same `@auth/core` version bundled by `next-auth@beta`.

---

## Next.js 16 — proxy.ts (not middleware.ts)

**Problem:** Next.js 16 deprecated `src/middleware.ts` in favor of `src/proxy.ts`.

**Pattern:** Create `src/proxy.ts` with the same content you would put in `middleware.ts`. The export format is identical:
```ts
import { auth } from "@/lib/auth";
export default auth((req) => { ... });
export const config = { matcher: [...] };
```

The build will show `ƒ Proxy (Middleware)` in the route table when `proxy.ts` is correctly detected.
