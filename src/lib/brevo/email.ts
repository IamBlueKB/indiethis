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
    tags: ["credits", "billing"],
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
    tags: ["billing", "renewal"],
  });
}
