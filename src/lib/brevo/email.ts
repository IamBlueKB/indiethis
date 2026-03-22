/**
 * Brevo transactional email service
 * Handles all one-to-one triggered emails: welcome, auth, bookings, payouts, etc.
 */

import { getBrevoClient } from "./client";

const FROM_EMAIL = () => process.env.BREVO_FROM_EMAIL ?? "hello@indiethis.com";
const FROM_NAME = () => process.env.BREVO_FROM_NAME ?? "IndieThis";
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: EmailRecipient;
  tags?: string[];
}

export interface TemplateEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  templateId: number;
  params?: Record<string, string | number | boolean>;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Core send helpers
// ---------------------------------------------------------------------------

/**
 * Send a fully custom HTML transactional email.
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const client = getBrevoClient();

  await client.transactionalEmails.sendTransacEmail({
    sender: { email: FROM_EMAIL(), name: FROM_NAME() },
    to: recipients,
    subject: options.subject,
    htmlContent: options.htmlContent,
    ...(options.textContent && { textContent: options.textContent }),
    ...(options.replyTo && { replyTo: options.replyTo }),
    ...(options.tags && { tags: options.tags }),
  });
}

/**
 * Send a Brevo template-based transactional email.
 */
export async function sendTemplateEmail(
  options: TemplateEmailOptions
): Promise<void> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const client = getBrevoClient();

  await client.transactionalEmails.sendTransacEmail({
    sender: { email: FROM_EMAIL(), name: FROM_NAME() },
    to: recipients,
    templateId: options.templateId,
    ...(options.params && { params: options.params }),
    ...(options.tags && { tags: options.tags }),
  });
}

// ---------------------------------------------------------------------------
// Auth emails
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(user: {
  email: string;
  displayName: string;
  tier: string;
}): Promise<void> {
  await sendEmail({
    to: { email: user.email, name: user.displayName },
    subject: "Welcome to IndieThis — your artist platform is ready",
    htmlContent: `
      <h1>Welcome, ${user.displayName}!</h1>
      <p>Your <strong>${user.tier}</strong> account is active. Start creating, selling, and growing.</p>
      <p><a href="${APP_URL()}/dashboard">Go to your dashboard →</a></p>
    `,
    textContent: `Welcome, ${user.displayName}! Your ${user.tier} account is active. Visit: ${APP_URL()}/dashboard`,
    tags: ["welcome", "onboarding"],
  });
}

export async function sendPasswordResetEmail(user: {
  email: string;
  displayName: string;
  resetLink: string;
}): Promise<void> {
  await sendEmail({
    to: { email: user.email, name: user.displayName },
    subject: "Reset your IndieThis password",
    htmlContent: `
      <h1>Password Reset</h1>
      <p>Hi ${user.displayName},</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${user.resetLink}">Reset Password →</a></p>
      <p>If you didn't request this, ignore this email.</p>
    `,
    textContent: `Reset your password: ${user.resetLink} (expires in 1 hour)`,
    tags: ["auth", "password-reset"],
  });
}

export async function sendEmailVerification(user: {
  email: string;
  displayName: string;
  verifyLink: string;
}): Promise<void> {
  await sendEmail({
    to: { email: user.email, name: user.displayName },
    subject: "Verify your IndieThis email address",
    htmlContent: `
      <h1>Verify your email</h1>
      <p>Hi ${user.displayName}, click below to verify your email address.</p>
      <p><a href="${user.verifyLink}">Verify Email →</a></p>
    `,
    tags: ["auth", "email-verification"],
  });
}

// ---------------------------------------------------------------------------
// Booking & studio emails
// ---------------------------------------------------------------------------

export async function sendBookingConfirmation(booking: {
  artistEmail: string;
  artistName: string;
  studioName: string;
  sessionDate: string;
  sessionTime: string;
  duration: string;
  totalPrice: string;
  bookingRef: string;
}): Promise<void> {
  await sendEmail({
    to: { email: booking.artistEmail, name: booking.artistName },
    subject: `Booking confirmed — ${booking.studioName} on ${booking.sessionDate}`,
    htmlContent: `
      <h1>Booking Confirmed</h1>
      <p>Hi ${booking.artistName}, your session is booked!</p>
      <table>
        <tr><td><strong>Studio</strong></td><td>${booking.studioName}</td></tr>
        <tr><td><strong>Date</strong></td><td>${booking.sessionDate}</td></tr>
        <tr><td><strong>Time</strong></td><td>${booking.sessionTime}</td></tr>
        <tr><td><strong>Duration</strong></td><td>${booking.duration}</td></tr>
        <tr><td><strong>Total</strong></td><td>${booking.totalPrice}</td></tr>
        <tr><td><strong>Ref</strong></td><td>${booking.bookingRef}</td></tr>
      </table>
      <p><a href="${APP_URL()}/dashboard/bookings/${booking.bookingRef}">View Booking →</a></p>
    `,
    replyTo: { email: "support@indiethis.com", name: "IndieThis Support" },
    tags: ["booking", "confirmation"],
  });
}

export async function sendBookingCancellation(booking: {
  artistEmail: string;
  artistName: string;
  studioName: string;
  sessionDate: string;
  bookingRef: string;
  refundAmount?: string;
}): Promise<void> {
  await sendEmail({
    to: { email: booking.artistEmail, name: booking.artistName },
    subject: `Booking cancelled — ${booking.studioName} on ${booking.sessionDate}`,
    htmlContent: `
      <h1>Booking Cancelled</h1>
      <p>Hi ${booking.artistName}, your booking (Ref: ${booking.bookingRef}) has been cancelled.</p>
      ${booking.refundAmount ? `<p>A refund of <strong>${booking.refundAmount}</strong> will be processed within 5–7 business days.</p>` : ""}
      <p><a href="${APP_URL()}/dashboard/bookings">View your bookings →</a></p>
    `,
    replyTo: { email: "support@indiethis.com", name: "IndieThis Support" },
    tags: ["booking", "cancellation"],
  });
}

export async function sendStudioNewBookingAlert(booking: {
  studioEmail: string;
  studioOwnerName: string;
  artistName: string;
  sessionDate: string;
  sessionTime: string;
  duration: string;
  bookingRef: string;
}): Promise<void> {
  await sendEmail({
    to: { email: booking.studioEmail, name: booking.studioOwnerName },
    subject: `New booking from ${booking.artistName} — ${booking.sessionDate}`,
    htmlContent: `
      <h1>New Booking</h1>
      <p>Hi ${booking.studioOwnerName}, you have a new studio booking.</p>
      <table>
        <tr><td><strong>Artist</strong></td><td>${booking.artistName}</td></tr>
        <tr><td><strong>Date</strong></td><td>${booking.sessionDate}</td></tr>
        <tr><td><strong>Time</strong></td><td>${booking.sessionTime}</td></tr>
        <tr><td><strong>Duration</strong></td><td>${booking.duration}</td></tr>
        <tr><td><strong>Ref</strong></td><td>${booking.bookingRef}</td></tr>
      </table>
      <p><a href="${APP_URL()}/studio/bookings/${booking.bookingRef}">Manage Booking →</a></p>
    `,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["studio", "booking", "alert"],
  });
}

// ---------------------------------------------------------------------------
// Payout & earnings emails
// ---------------------------------------------------------------------------

export async function sendPayoutNotification(payout: {
  artistEmail: string;
  artistName: string;
  amount: string;
  payoutDate: string;
  payoutMethod: string;
}): Promise<void> {
  await sendEmail({
    to: { email: payout.artistEmail, name: payout.artistName },
    subject: `Payout sent — ${payout.amount} is on its way`,
    htmlContent: `
      <h1>Payout Sent 💸</h1>
      <p>Hi ${payout.artistName}, your payout of <strong>${payout.amount}</strong> has been processed.</p>
      <p><strong>Method:</strong> ${payout.payoutMethod}<br>
      <strong>Date:</strong> ${payout.payoutDate}</p>
      <p><a href="${APP_URL()}/dashboard/earnings">View Earnings →</a></p>
    `,
    replyTo: { email: "billing@indiethis.com", name: "IndieThis Billing" },
    tags: ["payout", "earnings"],
  });
}

export async function sendSaleNotification(sale: {
  artistEmail: string;
  artistName: string;
  itemType: "beat" | "merch" | "track";
  itemName: string;
  saleAmount: string;
  buyerLocation?: string;
}): Promise<void> {
  const typeLabel = { beat: "Beat", merch: "Merch item", track: "Track" }[
    sale.itemType
  ];
  await sendEmail({
    to: { email: sale.artistEmail, name: sale.artistName },
    subject: `New sale — ${typeLabel}: ${sale.itemName}`,
    htmlContent: `
      <h1>You Made a Sale! 🎉</h1>
      <p>Hi ${sale.artistName},</p>
      <p><strong>${typeLabel}:</strong> ${sale.itemName}<br>
      <strong>Amount:</strong> ${sale.saleAmount}
      ${sale.buyerLocation ? `<br><strong>From:</strong> ${sale.buyerLocation}` : ""}</p>
      <p><a href="${APP_URL()}/dashboard/earnings">View Earnings →</a></p>
    `,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["sale", sale.itemType],
  });
}

// ---------------------------------------------------------------------------
// Intake form link emails
// ---------------------------------------------------------------------------

export async function sendIntakeLinkEmail(params: {
  email: string;
  name: string;
  studioName: string;
  intakeUrl: string;
}): Promise<void> {
  await sendEmail({
    to: { email: params.email, name: params.name },
    subject: `${params.studioName} sent you a booking intake form`,
    htmlContent: `
      <h1>Complete Your Booking Intake</h1>
      <p>Hi ${params.name},</p>
      <p><strong>${params.studioName}</strong> has sent you a personalized intake form to get started on your session.</p>
      <p>Please complete the form within 72 hours:</p>
      <p><a href="${params.intakeUrl}" style="background:#7B61FF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Complete Intake Form</a></p>
      <p>Or copy this link:<br><code>${params.intakeUrl}</code></p>
      <p style="color:#888;font-size:12px;">This link expires in 72 hours.</p>
    `,
    replyTo: { email: "support@indiethis.com", name: "IndieThis Support" },
    tags: ["intake-link"],
  });
}

// ---------------------------------------------------------------------------
// Quick send delivery emails
// ---------------------------------------------------------------------------

export async function sendQuickSendEmail(params: {
  recipientEmail: string;
  recipientName?: string;
  senderName: string;
  message?: string;
  downloadUrl: string;
  fileCount: number;
}): Promise<void> {
  await sendEmail({
    to: { email: params.recipientEmail, name: params.recipientName },
    subject: `${params.senderName} sent you ${params.fileCount} file${params.fileCount === 1 ? "" : "s"}`,
    htmlContent: `
      <h1>You Have Files Waiting</h1>
      <p>${params.senderName} has sent you ${params.fileCount} file${params.fileCount === 1 ? "" : "s"}.</p>
      ${params.message ? `<p><em>"${params.message}"</em></p>` : ""}
      <p><a href="${params.downloadUrl}" style="background:#7B61FF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Download Files</a></p>
      <p>Or copy this link:<br><code>${params.downloadUrl}</code></p>
      <p style="color:#888;font-size:12px;">This link expires in 7 days.</p>
    `,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["quick-send"],
  });
}

// ---------------------------------------------------------------------------
// Beat preview notification emails
// ---------------------------------------------------------------------------

export async function sendBeatPreviewEmail(params: {
  recipientEmail: string;
  recipientName: string;
  producerName: string;
  trackTitle: string;
  previewUrl: string;
  expiresAt: Date;
}): Promise<void> {
  const expiryStr = params.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  await sendEmail({
    to: { email: params.recipientEmail, name: params.recipientName },
    subject: `${params.producerName} shared a beat with you`,
    htmlContent: `
      <h1>New Beat Preview</h1>
      <p>Hi ${params.recipientName},</p>
      <p><strong>${params.producerName}</strong> shared a beat preview with you: <strong>${params.trackTitle}</strong>.</p>
      <p><a href="${params.previewUrl}" style="background:#7B61FF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Listen to Beat</a></p>
      <p style="color:#888;font-size:12px;">This preview expires on ${expiryStr}.</p>
    `,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["beat-preview"],
  });
}

// ---------------------------------------------------------------------------
// AI credits & subscription emails
// ---------------------------------------------------------------------------

export async function sendLowCreditsWarning(user: {
  email: string;
  displayName: string;
  creditsRemaining: number;
}): Promise<void> {
  await sendEmail({
    to: { email: user.email, name: user.displayName },
    subject: `You're running low on AI credits — ${user.creditsRemaining} left`,
    htmlContent: `
      <h1>Low AI Credits</h1>
      <p>Hi ${user.displayName}, you have <strong>${user.creditsRemaining} AI credits</strong> remaining.</p>
      <p>Top up or upgrade your plan to keep creating without interruption.</p>
      <p><a href="${APP_URL()}/dashboard/billing">Upgrade Plan →</a></p>
    `,
    replyTo: { email: "support@indiethis.com", name: "IndieThis Support" },
    tags: ["credits", "billing"],
  });
}

// ---------------------------------------------------------------------------
// Affiliate program emails
// ---------------------------------------------------------------------------

export async function sendAffiliateApprovalEmail(affiliate: {
  name: string;
  email: string;
  customSlug: string;
  discountCode: string;
  affiliateLink: string;
  dashboardUrl: string;
}): Promise<void> {
  await sendEmail({
    to: { email: affiliate.email, name: affiliate.name },
    subject: "You're approved — welcome to the IndieThis Affiliate Program 🎉",
    htmlContent: `
      <h1>Welcome to the IndieThis Affiliate Program, ${affiliate.name}!</h1>
      <p>Your application has been approved. Here are your unique details:</p>
      <table cellpadding="8" style="border-collapse:collapse;width:100%;max-width:480px;">
        <tr style="background:#f5f5f5;">
          <td style="font-weight:bold;border:1px solid #e0e0e0;">Your affiliate link</td>
          <td style="border:1px solid #e0e0e0;">
            <a href="${affiliate.affiliateLink}" style="color:#D4A843;">${affiliate.affiliateLink}</a>
          </td>
        </tr>
        <tr>
          <td style="font-weight:bold;border:1px solid #e0e0e0;">Your discount code</td>
          <td style="border:1px solid #e0e0e0;font-family:monospace;font-size:16px;font-weight:bold;color:#D4A843;">
            ${affiliate.discountCode}
          </td>
        </tr>
      </table>
      <h2 style="margin-top:24px;">How it works</h2>
      <ul>
        <li>Share your affiliate link or discount code with your audience.</li>
        <li>Your audience gets <strong>10% off their first 3 months</strong> when they use your code.</li>
        <li>You earn <strong>20% commission for 12 months</strong> on every paying artist you refer.</li>
        <li>Commissions are paid out monthly via Stripe Connect once you connect your account.</li>
      </ul>
      <p style="margin-top:24px;">
        <a href="${affiliate.dashboardUrl}" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">
          View Your Affiliate Dashboard →
        </a>
      </p>
      <p style="color:#888;font-size:12px;margin-top:24px;">
        Questions? Reply to this email and we'll help you out.
      </p>
    `,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    textContent: `
Welcome to the IndieThis Affiliate Program, ${affiliate.name}!

Your affiliate link: ${affiliate.affiliateLink}
Your discount code: ${affiliate.discountCode}

Your audience gets 10% off their first 3 months when they use your code.
You earn 20% commission for 12 months on every paying referral.

View your dashboard: ${affiliate.dashboardUrl}
    `.trim(),
    tags: ["affiliate", "approval"],
  });
}

// ---------------------------------------------------------------------------
// Admin account emails
// ---------------------------------------------------------------------------

export async function sendAdminWelcomeEmail(admin: {
  name: string;
  email: string;
  temporaryPassword: string;
  role: string;
  loginUrl: string;
}): Promise<void> {
  const roleLabel =
    admin.role === "OPS_ADMIN" ? "Ops Admin" :
    admin.role === "SUPPORT_ADMIN" ? "Support Admin" :
    admin.role;

  await sendEmail({
    to: { email: admin.email, name: admin.name },
    subject: "You've been added to the IndieThis admin team",
    htmlContent: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;">
        <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;">Welcome to IndieThis Admin, ${admin.name}</h1>
        <p style="color:#555;margin-bottom:24px;">
          You've been granted <strong>${roleLabel}</strong> access to the IndieThis platform administration panel.
        </p>
        <div style="background:#f7f7f7;border-radius:12px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Your login details</p>
          <p style="margin:0 0 6px;font-size:14px;"><strong>Email:</strong> ${admin.email}</p>
          <p style="margin:0 0 6px;font-size:14px;"><strong>Temporary password:</strong> <code style="background:#e8e8e8;padding:2px 6px;border-radius:4px;">${admin.temporaryPassword}</code></p>
          <p style="margin:0;font-size:13px;color:#E85D4A;">⚠ Please change your password after your first login.</p>
        </div>
        <a href="${admin.loginUrl}"
           style="background:#E85D4A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;">
          Sign In to Admin Panel →
        </a>
        <p style="margin-top:24px;font-size:12px;color:#888;">
          If you weren't expecting this email, please contact your Super Admin immediately.
        </p>
      </div>
    `,
    replyTo: { email: "admin@indiethis.com", name: "IndieThis Admin" },
    textContent: `
Welcome to IndieThis Admin, ${admin.name}!

You've been granted ${roleLabel} access.

Login details:
  Email: ${admin.email}
  Temporary password: ${admin.temporaryPassword}

Please change your password after your first login.

Sign in at: ${admin.loginUrl}
    `.trim(),
    tags: ["admin", "welcome"],
  });
}

export async function sendAdminPasswordResetEmail(admin: {
  name: string;
  email: string;
  temporaryPassword: string;
  resetBy: string;
  loginUrl: string;
}): Promise<void> {
  await sendEmail({
    to: { email: admin.email, name: admin.name },
    subject: "Your IndieThis admin password has been reset",
    htmlContent: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;">
        <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;">Password Reset — IndieThis Admin</h1>
        <p style="color:#555;margin-bottom:24px;">
          Hi ${admin.name}, your admin account password was reset by <strong>${admin.resetBy}</strong>.
        </p>
        <div style="background:#f7f7f7;border-radius:12px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Your new temporary credentials</p>
          <p style="margin:0 0 6px;font-size:14px;"><strong>Email:</strong> ${admin.email}</p>
          <p style="margin:0 0 6px;font-size:14px;"><strong>Temporary password:</strong> <code style="background:#e8e8e8;padding:2px 6px;border-radius:4px;">${admin.temporaryPassword}</code></p>
          <p style="margin:0;font-size:13px;color:#E85D4A;">⚠ Please change your password immediately after logging in.</p>
        </div>
        <a href="${admin.loginUrl}"
           style="background:#E85D4A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;">
          Sign In to Admin Panel →
        </a>
        <p style="margin-top:24px;font-size:12px;color:#888;">
          If you didn't expect this reset, contact your Super Admin immediately.
        </p>
      </div>
    `,
    replyTo: { email: "admin@indiethis.com", name: "IndieThis Admin" },
    textContent: `
Password Reset — IndieThis Admin

Hi ${admin.name}, your admin password was reset by ${admin.resetBy}.

New temporary password: ${admin.temporaryPassword}

Please change your password immediately after logging in.

Sign in at: ${admin.loginUrl}
    `.trim(),
    tags: ["admin", "password-reset"],
  });
}

export async function sendSubscriptionRenewalReminder(user: {
  email: string;
  displayName: string;
  tier: string;
  renewalDate: string;
  amount: string;
}): Promise<void> {
  await sendEmail({
    to: { email: user.email, name: user.displayName },
    subject: `Your ${user.tier} plan renews on ${user.renewalDate}`,
    htmlContent: `
      <h1>Upcoming Renewal</h1>
      <p>Hi ${user.displayName},</p>
      <p>Your <strong>${user.tier}</strong> plan will renew on <strong>${user.renewalDate}</strong> for <strong>${user.amount}</strong>.</p>
      <p><a href="${APP_URL()}/dashboard/billing">Manage Subscription →</a></p>
    `,
    replyTo: { email: "billing@indiethis.com", name: "IndieThis Billing" },
    tags: ["billing", "renewal"],
  });
}

// ── Promo & Trial Emails ───────────────────────────────────────────────────────

export async function sendPromoWelcomeEmail(user: {
  email: string;
  name: string;
  benefitDescription: string;
  code: string;
}): Promise<void> {
  await sendEmail({
    to: { email: user.email, name: user.name },
    subject: "Your promo code has been activated 🎉",
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0A0A0A;">
        <h1 style="font-size:24px;margin-bottom:8px;">You're in.</h1>
        <p style="color:#555;">Your promo code <strong style="color:#0A0A0A;">${user.code}</strong> has been applied to your account.</p>
        <div style="background:#F5F0E8;border-radius:12px;padding:20px 24px;margin:24px 0;">
          <p style="margin:0;font-size:16px;font-weight:600;">${user.benefitDescription}</p>
        </div>
        <p>Head to your dashboard to start creating.</p>
        <a href="${APP_URL()}/dashboard" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:8px;">Go to Dashboard →</a>
      </div>
    `,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["promo", "welcome"],
  });
}

export async function sendTrialExpiringEmail(user: {
  email: string;
  name: string;
  daysLeft: number;
  tier: string;
}): Promise<void> {
  await sendEmail({
    to: { email: user.email, name: user.name },
    subject: `Your ${user.tier} trial ends in ${user.daysLeft} day${user.daysLeft !== 1 ? "s" : ""}`,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0A0A0A;">
        <h1 style="font-size:22px;">Your trial is almost up.</h1>
        <p>Hi ${user.name}, your <strong>${user.tier}</strong> trial ends in <strong>${user.daysLeft} day${user.daysLeft !== 1 ? "s" : ""}</strong>.</p>
        <p>Subscribe now to keep your tracks, merch products, fan contacts, and everything you've built.</p>
        <a href="${APP_URL()}/dashboard/upgrade" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:8px;">Subscribe to Keep Access →</a>
      </div>
    `,
    replyTo: { email: "support@indiethis.com", name: "IndieThis Support" },
    tags: ["trial", "expiring"],
  });
}

export async function sendTrialExpiredEmail(user: {
  email: string;
  name: string;
}): Promise<void> {
  await sendEmail({
    to: { email: user.email, name: user.name },
    subject: "Your trial has ended — you have 3 days to subscribe",
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0A0A0A;">
        <h1 style="font-size:22px;">Your trial ended.</h1>
        <p>Hi ${user.name}, your free trial has ended. You have <strong>3 days</strong> to subscribe before your account is locked.</p>
        <p>Nothing has been deleted. Subscribe now and pick up right where you left off.</p>
        <a href="${APP_URL()}/dashboard/upgrade" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:8px;">Subscribe Now →</a>
      </div>
    `,
    replyTo: { email: "support@indiethis.com", name: "IndieThis Support" },
    tags: ["trial", "expired"],
  });
}

export async function sendGracePeriodEmail(user: {
  email: string;
  name: string;
  stats: { tracks: number; merch: number; contacts: number };
}): Promise<void> {
  await sendEmail({
    to: { email: user.email, name: user.name },
    subject: "Tomorrow is your last day — don't lose your content",
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0A0A0A;">
        <h1 style="font-size:22px;">Last chance.</h1>
        <p>Hi ${user.name}, tomorrow is the last day before your account is locked.</p>
        <p>Here's what's waiting for you:</p>
        <ul style="list-style:none;padding:0;">
          ${user.stats.tracks > 0 ? `<li style="padding:6px 0;border-bottom:1px solid #eee;">🎵 <strong>${user.stats.tracks}</strong> track${user.stats.tracks !== 1 ? "s" : ""}</li>` : ""}
          ${user.stats.merch > 0 ? `<li style="padding:6px 0;border-bottom:1px solid #eee;">👕 <strong>${user.stats.merch}</strong> merch product${user.stats.merch !== 1 ? "s" : ""}</li>` : ""}
          ${user.stats.contacts > 0 ? `<li style="padding:6px 0;">👥 <strong>${user.stats.contacts}</strong> fan contact${user.stats.contacts !== 1 ? "s" : ""}</li>` : ""}
        </ul>
        <a href="${APP_URL()}/dashboard/upgrade" style="display:inline-block;background:#E85D4A;color:#fff;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:16px;">Subscribe Before It's Too Late →</a>
      </div>
    `,
    replyTo: { email: "support@indiethis.com", name: "IndieThis Support" },
    tags: ["trial", "grace-period"],
  });
}

export async function sendAccountLockedEmail(user: {
  email: string;
  name: string;
}): Promise<void> {
  await sendEmail({
    to: { email: user.email, name: user.name },
    subject: "Your account has been locked",
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0A0A0A;">
        <h1 style="font-size:22px;">Your account is locked.</h1>
        <p>Hi ${user.name}, your trial grace period has ended and your account is now locked.</p>
        <p><strong>Nothing has been deleted.</strong> Subscribe anytime to restore full access — your tracks, merch, and contacts are all still there.</p>
        <a href="${APP_URL()}/dashboard/upgrade" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:8px;">Restore Access →</a>
      </div>
    `,
    replyTo: { email: "support@indiethis.com", name: "IndieThis Support" },
    tags: ["trial", "locked"],
  });
}

export async function sendDiscountEndedEmail(user: {
  email: string;
  name: string;
  tier: string;
}): Promise<void> {
  await sendEmail({
    to: { email: user.email, name: user.name },
    subject: "Your discount period has ended",
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0A0A0A;">
        <h1 style="font-size:22px;">Your promotional discount has ended.</h1>
        <p>Hi ${user.name}, your promotional discount period on the <strong>${user.tier}</strong> plan has ended.</p>
        <p>Your next charge will be at the standard rate. You can manage your subscription anytime from your dashboard.</p>
        <a href="${APP_URL()}/dashboard/upgrade" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:8px;">Manage Subscription →</a>
      </div>
    `,
    replyTo: { email: "billing@indiethis.com", name: "IndieThis Billing" },
    tags: ["discount", "ended"],
  });
}

// ---------------------------------------------------------------------------
// Ambassador emails
// ---------------------------------------------------------------------------

export async function sendAmbassadorRewardEmail(
  ambassador: { name: string; email: string },
  amount: number,
  event: string
): Promise<void> {
  const eventLabel: Record<string, string> = {
    SIGNUP: "a new signup",
    CONVERSION: "a conversion",
    UPGRADE: "a tier upgrade",
  };
  await sendEmail({
    to: { email: ambassador.email, name: ambassador.name },
    subject: `You earned $${amount.toFixed(2)} — IndieThis Ambassador`,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0A0A0A;">
        <h1 style="font-size:22px;color:#D4A843;">You earned $${amount.toFixed(2)}! 🎉</h1>
        <p>Hi ${ambassador.name}, you just earned <strong>$${amount.toFixed(2)}</strong> for ${eventLabel[event] ?? event} through your ambassador code.</p>
        <p>Your balance is updated and will be paid out automatically once it reaches $25.</p>
        <a href="${APP_URL()}/ambassador" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:8px;">View Dashboard →</a>
      </div>
    `,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["ambassador", "reward"],
  });
}

export async function sendAmbassadorPayoutEmail(
  ambassador: { name: string; email: string },
  amount: number,
  method: string
): Promise<void> {
  const methodLabel: Record<string, string> = {
    STRIPE_CONNECT: "Stripe",
    CREDIT: "account credit",
    MANUAL: "manual transfer",
  };
  await sendEmail({
    to: { email: ambassador.email, name: ambassador.name },
    subject: `Payout sent: $${amount.toFixed(2)} — IndieThis`,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0A0A0A;">
        <h1 style="font-size:22px;">Payout Sent ✓</h1>
        <p>Hi ${ambassador.name}, a payout of <strong>$${amount.toFixed(2)}</strong> has been sent via ${methodLabel[method] ?? method}.</p>
        <p>Please allow 1–3 business days for funds to appear depending on your payout method.</p>
        <a href="${APP_URL()}/ambassador" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:8px;">View Dashboard →</a>
      </div>
    `,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["ambassador", "payout"],
  });
}
