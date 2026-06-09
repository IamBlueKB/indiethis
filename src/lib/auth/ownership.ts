/**
 * Server-side ownership guards for resource-by-id API routes.
 *
 * Standard usage in a route handler:
 *
 *     const guard = await requireOwnedMusicVideo(id);
 *     if (!guard.ok) return guard.response;
 *     const { resource: video, session, isAdmin } = guard;
 *
 * On failure (missing OR not owned), all helpers return a 404 — never 403 —
 * so the response leaks nothing about whether the resource exists. This
 * matches the mix-console gating spec's "complete invisibility" rule.
 *
 * Ownership model per resource (guest or subscriber accepted unless noted):
 *   MusicVideo    — userId match OR guestEmail cookie match
 *   MasteringJob  — userId match OR guestEmail cookie match
 *   MixJob        — userId match OR guestEmail cookie match
 *   AIJob         — triggeredById match (auth required, no guest path)
 *   Invoice       — caller is the owning Studio's owner (auth required)
 *   Ambassador    — caller's session matches ambassador.userId (auth required;
 *                   the promo code alone is NOT sufficient for sensitive ops)
 *
 * PLATFORM_ADMIN always passes ownership for read/maintenance routes.
 */

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import { auth }         from "@/lib/auth";
import { db }           from "@/lib/db";

const NOT_FOUND_BODY = { error: "Not found" } as const;
const NOT_FOUND_STATUS = 404 as const;

function notFound(): NextResponse {
  return NextResponse.json(NOT_FOUND_BODY, { status: NOT_FOUND_STATUS });
}

// NextAuth v5's exported `auth` is overloaded for middleware usage; calling it
// with no args returns the session at runtime, but its return-type union
// doesn't narrow cleanly. We type the result manually based on the session
// shape produced by lib/auth.ts.
type AppSession = {
  user?: {
    id?:    string | null;
    email?: string | null;
    role?:  string | null;
    name?:  string | null;
  };
  expires?: string;
} | null;

type AuthCtx = {
  session:    AppSession;
  isAdmin:    boolean;
  guestEmail: string | null;
};

async function authContext(): Promise<AuthCtx> {
  const session = (await auth()) as AppSession;
  const isAdmin = session?.user?.role === "PLATFORM_ADMIN";
  const guestEmail = (await cookies()).get("indiethis_guest_email")?.value ?? null;
  return { session, isAdmin, guestEmail };
}

type Guard<T> =
  | { ok: true;  resource: T; session: AppSession; isAdmin: boolean; guestEmail: string | null }
  | { ok: false; response: NextResponse };

/**
 * Generic owned-resource guard. Each specific helper below calls this.
 *
 *   - `fetcher` loads the row by id (returns null if missing)
 *   - `isOwner` returns true if the caller owns the resource
 *
 * Both missing and unowned collapse to a single 404 response so callers
 * cannot distinguish "doesn't exist" from "isn't yours".
 */
async function requireOwnedResource<T>(args: {
  id:       string;
  fetcher:  (id: string) => Promise<T | null>;
  isOwner:  (resource: T, ctx: AuthCtx) => boolean;
}): Promise<Guard<T>> {
  const ctx = await authContext();
  const resource = await args.fetcher(args.id);
  if (!resource) return { ok: false, response: notFound() };
  if (!args.isOwner(resource, ctx)) return { ok: false, response: notFound() };
  return { ok: true, resource, ...ctx };
}

// ── Resource-specific helpers ────────────────────────────────────────────────

export async function requireOwnedMusicVideo(id: string) {
  return requireOwnedResource({
    id,
    fetcher: (id) => db.musicVideo.findUnique({ where: { id } }),
    isOwner: (v, { session, isAdmin, guestEmail }) =>
      isAdmin
      || (!!session?.user?.id && v.userId === session.user.id)
      || (!!guestEmail && !!v.guestEmail && v.guestEmail.toLowerCase() === guestEmail.toLowerCase()),
  });
}

export async function requireOwnedMasteringJob(id: string) {
  return requireOwnedResource({
    id,
    fetcher: (id) => db.masteringJob.findUnique({ where: { id } }),
    isOwner: (j, { session, isAdmin, guestEmail }) =>
      isAdmin
      || (!!session?.user?.id && j.userId === session.user.id)
      || (!!guestEmail && !!j.guestEmail && j.guestEmail.toLowerCase() === guestEmail.toLowerCase()),
  });
}

export async function requireOwnedMixJob(id: string) {
  return requireOwnedResource({
    id,
    fetcher: (id) => db.mixJob.findUnique({ where: { id } }),
    isOwner: (j, { session, isAdmin, guestEmail }) =>
      isAdmin
      || (!!session?.user?.id && j.userId === session.user.id)
      || (!!guestEmail && !!j.guestEmail && j.guestEmail.toLowerCase() === guestEmail.toLowerCase()),
  });
}

export async function requireOwnedAIJob(id: string) {
  return requireOwnedResource({
    id,
    fetcher: (id) => db.aIJob.findUnique({ where: { id } }),
    isOwner: (j, { session, isAdmin }) =>
      isAdmin
      || (!!session?.user?.id && j.triggeredById === session.user.id),
  });
}

/**
 * Invoice ownership = caller's session.user.id matches Studio.ownerId
 * for the studio that owns the invoice. Auth is required; no guest path.
 *
 * Returns the invoice WITH the studio joined for convenience.
 */
export async function requireOwnedInvoice(id: string) {
  return requireOwnedResource({
    id,
    fetcher: (id) =>
      db.invoice.findUnique({
        where:   { id },
        include: { studio: true, contact: true },
      }),
    isOwner: (inv, { session, isAdmin }) =>
      isAdmin || (!!session?.user?.id && inv.studio.ownerId === session.user.id),
  });
}

/**
 * Ambassador-by-code with sensitive-op gating.
 * Read-only lookups can use the code alone (32 bits of entropy + rate-limit
 * in Phase 1.3). This helper is for MONEY-mutating ops (payout, Stripe
 * Connect) and requires both:
 *   1. The code resolves to an active ambassador.
 *   2. The caller's session.user.id matches that ambassador's linked userId.
 *
 * If the ambassador has no linked userId yet (pre-signup state), only an
 * admin may act on the account.
 */
export async function requireAmbassadorBySessionAndCode(code: string) {
  const ctx = await authContext();
  const promo = await db.promoCode.findUnique({
    where:   { code: code.toUpperCase() },
    include: { ambassador: true },
  });
  if (!promo?.ambassador || !promo.ambassador.isActive) {
    return { ok: false as const, response: notFound() };
  }
  const a = promo.ambassador;
  const owned = ctx.isAdmin
    || (!!ctx.session?.user?.id && !!a.userId && a.userId === ctx.session.user.id);
  if (!owned) return { ok: false as const, response: notFound() };
  return { ok: true as const, ambassador: a, promoCode: promo, ...ctx };
}
