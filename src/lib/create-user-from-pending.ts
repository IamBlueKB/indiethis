/**
 * createUserFromPending
 *
 * Shared helper that converts a PendingSignup into a real User + Subscription.
 * Called by both:
 *   - /api/auth/complete-signup  (primary — triggered by the success redirect page)
 *   - /api/stripe/webhook        (fallback — in case complete-signup page hasn't run)
 *
 * The function is idempotent-safe: callers should check that the user doesn't
 * already exist before calling.
 */

import { randomBytes, randomUUID } from "crypto";
import { addMinutes } from "date-fns";
import type { PendingSignup } from "@prisma/client";
import { db } from "@/lib/db";
import { activateReferral } from "@/lib/referral-tracking";
import { activateAffiliateReferral } from "@/lib/affiliate-commissions";
import { creditStudioForArtistPurchase } from "@/lib/studio-referral";
import { cancelFollowUpByEmail } from "@/lib/email-sequence";
import { markContactsAsReferred } from "@/lib/studio-referral";
import { redeemPromoCode } from "@/lib/promo-redeem";
import { sendOnboardingWelcomeEmail } from "@/lib/brevo/email";

// ── Tier credit limits (mirrors TIER_CREDITS in the webhook) ──────────────────

type TierCredits = {
  aiVideoCreditsLimit:    number;
  aiArtCreditsLimit:      number;
  aiMasterCreditsLimit:   number;
  lyricVideoCreditsLimit: number;
  aarReportCreditsLimit:  number;
  pressKitCreditsLimit:   number;
};

const TIER_CREDITS: Record<string, TierCredits> = {
  LAUNCH:      { aiVideoCreditsLimit: 0, aiArtCreditsLimit: 5,  aiMasterCreditsLimit: 1,  lyricVideoCreditsLimit: 0, aarReportCreditsLimit: 0, pressKitCreditsLimit: 0 },
  PUSH:        { aiVideoCreditsLimit: 2, aiArtCreditsLimit: 10, aiMasterCreditsLimit: 3,  lyricVideoCreditsLimit: 1, aarReportCreditsLimit: 2, pressKitCreditsLimit: 1 },
  REIGN:       { aiVideoCreditsLimit: 5, aiArtCreditsLimit: 15, aiMasterCreditsLimit: 10, lyricVideoCreditsLimit: 3, aarReportCreditsLimit: 5, pressKitCreditsLimit: 3 },
  STUDIO_PRO:  { aiVideoCreditsLimit: 0, aiArtCreditsLimit: 5,  aiMasterCreditsLimit: 1,  lyricVideoCreditsLimit: 0, aarReportCreditsLimit: 0, pressKitCreditsLimit: 0 },
  STUDIO_ELITE:{ aiVideoCreditsLimit: 2, aiArtCreditsLimit: 10, aiMasterCreditsLimit: 5,  lyricVideoCreditsLimit: 1, aarReportCreditsLimit: 2, pressKitCreditsLimit: 1 },
};

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function createUserFromPending(
  pending: PendingSignup,
  stripeSubscriptionId: string | null,
  tier: string,
): Promise<{ user: { id: string; email: string; name: string | null; autoSigninToken: string } }> {
  const normalizedEmail = pending.email.toLowerCase().trim();
  const tierUpper       = tier.toUpperCase();
  const credits         = TIER_CREDITS[tierUpper] ?? TIER_CREDITS.LAUNCH;

  // ── 1. Resolve referrer ───────────────────────────────────────────────────
  let referredById: string | undefined;
  if (pending.referredByCode) {
    const referrer = await db.user.findUnique({
      where:  { referralCode: pending.referredByCode.toUpperCase() },
      select: { id: true },
    });
    if (referrer) referredById = referrer.id;
  }

  // ── 2. Generate unique referral code ──────────────────────────────────────
  let newReferralCode: string;
  let codeExists = true;
  do {
    newReferralCode = generateReferralCode();
    const taken = await db.user.findUnique({ where: { referralCode: newReferralCode } });
    codeExists = !!taken;
  } while (codeExists);

  // ── 3. Generate auto-signin token (10-minute window) ─────────────────────
  const autoSigninToken          = randomUUID();
  const autoSigninTokenExpiresAt = addMinutes(new Date(), 10);

  // ── 4. Create user ────────────────────────────────────────────────────────
  const now       = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const user = await db.user.create({
    data: {
      name:          pending.name.trim(),
      email:         normalizedEmail,
      passwordHash:  pending.passwordHash,
      role:          pending.role,
      referralCode:  newReferralCode,
      referredById,
      referredByCode: referredById ? pending.referredByCode?.toUpperCase() : undefined,
      signupPath:    pending.signupPath ?? (pending.role === "STUDIO_ADMIN" ? "studio" : "artist"),
      firstVisitAt:  pending.firstVisitAt ?? null,
      planSelectedAt: now,
      autoSigninToken,
      autoSigninTokenExpiresAt,
    },
  });

  // ── 5. Create subscription ────────────────────────────────────────────────
  await db.subscription.create({
    data: {
      userId:               user.id,
      tier:                 tierUpper as "LAUNCH" | "PUSH" | "REIGN",
      status:               "ACTIVE",
      stripeSubscriptionId: stripeSubscriptionId ?? null,
      currentPeriodStart:   now,
      currentPeriodEnd:     periodEnd,
      ...credits,
      aiVideoCreditsUsed:    0,
      aiArtCreditsUsed:      0,
      aiMasterCreditsUsed:   0,
      lyricVideoCreditsUsed: 0,
      aarReportCreditsUsed:  0,
      pressKitCreditsUsed:   0,
      smsBroadcastsUsed:     0,
    },
  });

  // ── 6. Referral record ────────────────────────────────────────────────────
  if (referredById) {
    void db.referral.create({
      data: {
        referrerUserId: referredById,
        referredUserId: user.id,
        isActive:       true, // already paid — activate immediately
      },
    }).catch((err) => console.warn("[createUserFromPending] referral create failed:", err));
  }

  // ── 7. Attribution tracking ───────────────────────────────────────────────
  const hasAttribution = pending.referredByCode || pending.affiliateId || pending.source
    || pending.utmSource || pending.utmMedium || pending.utmCampaign || pending.landingPage;

  if (hasAttribution) {
    void db.userAttribution.create({
      data: {
        userId:      user.id,
        ref:         pending.referredByCode  ?? null,
        affiliateId: pending.affiliateId     ?? null,
        source:      pending.source          ?? null,
        utmSource:   pending.utmSource       ?? null,
        utmMedium:   pending.utmMedium       ?? null,
        utmCampaign: pending.utmCampaign     ?? null,
        landingPage: pending.landingPage     ?? null,
      },
    }).catch((err) => console.warn("[createUserFromPending] attribution create failed:", err));
  }

  // ── 8. Affiliate referral ─────────────────────────────────────────────────
  if (pending.affiliateId) {
    void db.affiliate.findUnique({
      where:  { id: pending.affiliateId, status: "APPROVED" },
      select: { id: true, commissionRate: true },
    }).then((affiliate) => {
      if (!affiliate) return;
      return db.affiliateReferral.create({
        data: {
          affiliateId:     affiliate.id,
          referredUserId:  user.id,
          commissionRate:  affiliate.commissionRate,
          monthsRemaining: 12,
          isActive:        true, // already paid
        },
      });
    }).catch((err) => console.warn("[createUserFromPending] affiliateReferral create failed:", err));
  }

  // ── 9. Post-creation side effects (all fire-and-forget) ───────────────────

  void activateReferral(user.id).catch(() => {});
  void activateAffiliateReferral(user.id).catch(() => {});
  void creditStudioForArtistPurchase(user.id, "SUBSCRIPTION").catch(() => {});
  void cancelFollowUpByEmail(normalizedEmail).catch(() => {});

  if (pending.role === "ARTIST") {
    void markContactsAsReferred(normalizedEmail, user.id).catch(() => {});
  }

  if (pending.promoCode?.trim()) {
    void redeemPromoCode(user.id, pending.promoCode.trim()).catch((err) =>
      console.warn("[createUserFromPending] promo redemption failed:", err)
    );
  }

  // Onboarding welcome email
  void (async () => {
    try {
      const alreadySent = await db.onboardingEmailLog.findFirst({
        where: { userId: user.id, emailType: "WELCOME" },
      });
      if (!alreadySent) {
        await sendOnboardingWelcomeEmail({ email: normalizedEmail, name: pending.name ?? "there" });
        await db.onboardingEmailLog.create({ data: { userId: user.id, emailType: "WELCOME" } });
      }
    } catch (e) { console.error("[createUserFromPending] welcome email failed:", e); }
  })();

  // ── 10. Delete PendingSignup ──────────────────────────────────────────────
  void db.pendingSignup.delete({ where: { id: pending.id } }).catch(() => {});

  return { user: { id: user.id, email: user.email, name: user.name, autoSigninToken } };
}
