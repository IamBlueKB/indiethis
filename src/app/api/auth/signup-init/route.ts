/**
 * POST /api/auth/signup-init
 *
 * Step 1 of the atomic signup flow.
 * Validates the user's info, hashes their password, and stores it in a
 * temporary PendingSignup record. Returns a pendingId that is passed through
 * the pricing → Stripe checkout flow.
 *
 * No User record is created here. The account is created after successful
 * Stripe payment in /api/auth/complete-signup (or as a fallback in the webhook).
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { addHours } from "date-fns";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name:         string;
      email:        string;
      password:     string;
      role?:        string;
      authProvider?: string;
      signupPath?:  string;
      referralCode?: string;
      affiliateId?:  string;
      promoCode?:    string;
      source?:       string;
      utmSource?:    string;
      utmMedium?:    string;
      utmCampaign?:  string;
      landingPage?:     string;
      firstVisitAt?:    string;
      agreedToTerms?:   boolean;
      agreedToTermsAt?: string;
    };

    const {
      name, email, password, role,
      signupPath, referralCode, affiliateId, promoCode,
      source, utmSource, utmMedium, utmCampaign, landingPage, firstVisitAt,
      authProvider, agreedToTerms, agreedToTermsAt,
    } = body;

    const isOAuth = authProvider && authProvider !== "email";

    // ── Validation ────────────────────────────────────────────────────────
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 }
      );
    }

    if (!isOAuth && !password) {
      return NextResponse.json(
        { error: "Password is required." },
        { status: 400 }
      );
    }

    if (!isOAuth && password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userRole: Role  = role === "STUDIO_ADMIN" ? "STUDIO_ADMIN" : "ARTIST";

    // ── Check for existing account ────────────────────────────────────────
    const existingUser = await db.user.findUnique({
      where:  { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // ── Hash password (skip for OAuth signups) ────────────────────────────
    const passwordHash = isOAuth ? null : await bcrypt.hash(password, 12);

    // ── Upsert PendingSignup ──────────────────────────────────────────────
    // Upsert so a user can re-submit the form (e.g. after closing the tab)
    // without creating duplicate pending records.
    const pending = await db.pendingSignup.upsert({
      where:  { email: normalizedEmail },
      update: {
        name:          name.trim(),
        passwordHash,
        authProvider:  authProvider ?? "email",
        role:          userRole,
        signupPath:    signupPath ?? (userRole === "STUDIO_ADMIN" ? "studio" : "artist"),
        referredByCode: referralCode?.toUpperCase() ?? null,
        affiliateId:   affiliateId   ?? null,
        promoCode:     promoCode?.trim() ?? null,
        source:        source        ?? null,
        utmSource:     utmSource     ?? null,
        utmMedium:     utmMedium     ?? null,
        utmCampaign:   utmCampaign   ?? null,
        landingPage:      landingPage      ?? null,
        firstVisitAt:     firstVisitAt     ? new Date(firstVisitAt) : null,
        agreedToTerms:    agreedToTerms    ?? false,
        agreedToTermsAt:  agreedToTermsAt  ? new Date(agreedToTermsAt) : null,
        stripeSessionId: null,
        tier:          null,
        expiresAt:     addHours(new Date(), 24),
      },
      create: {
        email:         normalizedEmail,
        name:          name.trim(),
        passwordHash,
        authProvider:  authProvider ?? "email",
        role:          userRole,
        signupPath:    signupPath ?? (userRole === "STUDIO_ADMIN" ? "studio" : "artist"),
        referredByCode: referralCode?.toUpperCase() ?? null,
        affiliateId:   affiliateId   ?? null,
        promoCode:     promoCode?.trim() ?? null,
        source:        source        ?? null,
        utmSource:     utmSource     ?? null,
        utmMedium:     utmMedium     ?? null,
        utmCampaign:   utmCampaign   ?? null,
        landingPage:     landingPage     ?? null,
        firstVisitAt:    firstVisitAt    ? new Date(firstVisitAt) : null,
        agreedToTerms:   agreedToTerms   ?? false,
        agreedToTermsAt: agreedToTermsAt ? new Date(agreedToTermsAt) : null,
        expiresAt:     addHours(new Date(), 24),
      },
    });

    return NextResponse.json({ pendingId: pending.id }, { status: 200 });
  } catch (err) {
    console.error("[signup-init]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
