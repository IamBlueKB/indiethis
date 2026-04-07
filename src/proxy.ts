import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/pricing",
  "/studios",
  "/explore",
];

function isPublicPath(pathname: string): boolean {
  // Allow public static paths and API auth routes
  if (pathname.startsWith("/api/auth")) return true;
  // Admin panel — protected by admin cookie auth (getAdminSession), not NextAuth
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/api/admin")) return true;
  if (pathname.startsWith("/api/uploadthing")) return true;
  if (pathname.startsWith("/api/public")) return true;
  // Dev email preview — never auth-gated (route itself blocks in production)
  if (pathname.startsWith("/api/dev")) return true;
  // Stripe checkout — handles both new signups (unauthenticated) and upgrades (authenticated)
  if (pathname === "/api/stripe/checkout") return true;
  // Music Video Studio — public (guests + subscribers)
  if (pathname.startsWith("/api/video-studio")) return true;
  // Cover Art Studio — public (guests + subscribers); /api/cover-art/* only
  if (pathname.startsWith("/api/cover-art")) return true;
  // Public invoice pages — no auth required (artists paying invoices)
  if (pathname.startsWith("/api/invoice")) return true;
  // Invoice pay route — called from public invoice page
  if (pathname.match(/^\/api\/studio\/invoices\/[^/]+\/pay$/)) return true;
  if (pathname.startsWith("/api/explore")) return true;
  if (pathname.startsWith("/api/artists")) return true;
  if (pathname.startsWith("/api/studios")) return true;
  if (pathname.startsWith("/api/beats")) return true;
  // OG image API — public (used for social share previews)
  if (pathname.startsWith("/api/og")) return true;
  // Merch catalog — public (used on artist public merch pages)
  if (pathname.startsWith("/api/merch/catalog")) return true;
  // Printful webhook — public (called by Printful servers)
  if (pathname.startsWith("/api/webhooks/printful")) return true;
  // Track overlay endpoint — public (used on explore / artist pages)
  if (pathname.match(/^\/api\/tracks\/[^/]+\/overlay$/)) return true;
  // Audio features endpoint — public (used by LazyAudioRadar on explore / artist pages)
  if (pathname.match(/^\/api\/audio-features\/[^/]+$/)) return true;
  // Digital product checkout — public (buyer provides email)
  if (pathname === "/api/digital-products/checkout") return true;
  // Digital download API — public (uses token auth)
  if (pathname.startsWith("/api/dl/digital/")) return true;
  // Public studio contact form — /api/studio/[studioId]/contact
  if (/^\/api\/studio\/[^/]+\/contact$/.test(pathname)) return true;
  // Public studio booking request — /api/studio/[studioId]/book-request
  if (/^\/api\/studio\/[^/]+\/book-request$/.test(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  // Quick send download links — no auth required
  if (pathname.startsWith("/dl/")) return true;
// Intake forms — /[studioSlug]/intake/[token]
  if (pathname.match(/^\/[^/]+\/intake\//)) return true;
  // Artist public sites — single-segment slug paths (/artistslug or /artistslug/...)
  // Exclude protected app routes
  const protectedPrefixes = ["/dashboard", "/studio", "/admin", "/api", "/_next"];
  if (!protectedPrefixes.some((p) => pathname.startsWith(p))) {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length >= 1) return true;
  }
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function getDashboardForRole(role: Role): string {
  switch (role) {
    case "STUDIO_ADMIN":
      return "/studio";
    default:
      return "/dashboard";
  }
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role as Role | undefined;

  // Allow public paths through
  if (isPublicPath(nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Not authenticated → redirect to login
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Platform admin routes — handled by admin cookie auth, not NextAuth
  if (nextUrl.pathname.startsWith("/admin") && nextUrl.pathname !== "/admin/login") {
    if (role !== "PLATFORM_ADMIN") {
      return NextResponse.redirect(
        new URL(getDashboardForRole(role ?? "ARTIST"), nextUrl)
      );
    }
  }

  // Studio routes — STUDIO_ADMIN only
  if (nextUrl.pathname.startsWith("/studio")) {
    if (role !== "STUDIO_ADMIN") {
      return NextResponse.redirect(
        new URL(getDashboardForRole(role ?? "ARTIST"), nextUrl)
      );
    }
  }

  // Artist dashboard routes — ARTIST and PLATFORM_ADMIN
  if (nextUrl.pathname.startsWith("/dashboard")) {
    if (role !== "ARTIST" && role !== "PLATFORM_ADMIN") {
      return NextResponse.redirect(
        new URL(getDashboardForRole(role ?? "ARTIST"), nextUrl)
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public image files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
