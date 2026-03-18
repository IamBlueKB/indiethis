import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/brevo";
import { markContactsAsReferred } from "@/lib/studio-referral";
import type { Role } from "@prisma/client";

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase(); // e.g. "A3F2B1C4"
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, role, referralCode: usedReferralCode } = body as {
      name: string;
      email: string;
      password: string;
      role?: string;
      referralCode?: string;
    };

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Normalize role — default to ARTIST
    const userRole: Role =
      role === "STUDIO_ADMIN" ? "STUDIO_ADMIN" : "ARTIST";

    // Check for existing account
    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Resolve referral — look up the referrer by their referral code
    let referredById: string | undefined;
    if (usedReferralCode) {
      const referrer = await db.user.findUnique({
        where: { referralCode: usedReferralCode.toUpperCase() },
        select: { id: true },
      });
      if (referrer) referredById = referrer.id;
    }

    // Generate a unique referral code for this new user
    let newReferralCode: string;
    let codeExists = true;
    do {
      newReferralCode = generateReferralCode();
      const existing = await db.user.findUnique({ where: { referralCode: newReferralCode } });
      codeExists = !!existing;
    } while (codeExists);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role: userRole,
        referralCode: newReferralCode,
        referredById,
      },
    });

    // Send welcome email — fire-and-forget (don't block response)
    sendWelcomeEmail({
      email: user.email,
      displayName: user.name,
      tier: "launch",
    }).catch(() => {
      // Silently ignore email failures — user is still created
    });

    // If this is an artist, check whether any studio has them as a BOOKING or
    // MANUAL contact — mark those contacts as referred so they become eligible
    // for the studio referral credit when the artist makes a purchase.
    if (userRole === "ARTIST") {
      markContactsAsReferred(user.email, user.id).catch(() => {});
    }

    return NextResponse.json(
      { message: "Account created successfully." },
      { status: 201 }
    );
  } catch (error) {
    console.error("[register] Error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
