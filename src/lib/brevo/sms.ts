/**
 * Brevo transactional SMS service
 * Handles all SMS notifications: booking reminders, session alerts, OTP, delivery confirmations.
 */

import { getBrevoClient } from "./client";

const SMS_SENDER = () => process.env.BREVO_SMS_SENDER ?? "IndieThis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendSMSOptions {
  /** E.164 format: +12025551234 */
  to: string;
  content: string;
  /** Tag string — wrapped into Brevo's Tag object shape automatically */
  tag?: string;
  webUrl?: string;
}

// ---------------------------------------------------------------------------
// Core send helper
// ---------------------------------------------------------------------------

/**
 * Send a transactional SMS via Brevo.
 * `to` must be in E.164 format (e.g., +12025551234).
 */
export async function sendSMS(options: SendSMSOptions): Promise<void> {
  const client = getBrevoClient();

  await client.transactionalSms.sendTransacSms({
    sender: SMS_SENDER(),
    recipient: options.to,
    content: options.content,
    type: "transactional" as const,
    // Brevo Tag is { field: string | string[] }, not a bare string
    ...(options.tag && { tag: { field: options.tag } }),
    ...(options.webUrl && { webUrl: options.webUrl }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

// ---------------------------------------------------------------------------
// Booking & session SMS
// ---------------------------------------------------------------------------

export async function sendBookingConfirmationSMS(booking: {
  phone: string;
  artistName: string;
  studioName: string;
  sessionDate: string;
  sessionTime: string;
  bookingRef: string;
}): Promise<void> {
  await sendSMS({
    to: booking.phone,
    content: `IndieThis: Booking confirmed! ${booking.studioName} on ${booking.sessionDate} at ${booking.sessionTime}. Ref: ${booking.bookingRef}`,
    tag: "booking-confirmation",
  });
}

export async function sendSessionReminder24h(session: {
  phone: string;
  studioName: string;
  sessionDate: string;
  sessionTime: string;
  studioAddress: string;
}): Promise<void> {
  await sendSMS({
    to: session.phone,
    content: `IndieThis: Reminder — your session at ${session.studioName} is tomorrow, ${session.sessionDate} at ${session.sessionTime}. Address: ${session.studioAddress}`,
    tag: "session-reminder-24h",
  });
}

export async function sendSessionReminder1h(session: {
  phone: string;
  studioName: string;
  sessionTime: string;
}): Promise<void> {
  await sendSMS({
    to: session.phone,
    content: `IndieThis: Your session at ${session.studioName} starts in 1 hour at ${session.sessionTime}. Good luck! 🎤`,
    tag: "session-reminder-1h",
  });
}

export async function sendBookingCancellationSMS(booking: {
  phone: string;
  studioName: string;
  sessionDate: string;
  bookingRef: string;
}): Promise<void> {
  await sendSMS({
    to: booking.phone,
    content: `IndieThis: Booking cancelled. ${booking.studioName} on ${booking.sessionDate} (Ref: ${booking.bookingRef}). Check your email for refund details.`,
    tag: "booking-cancellation",
  });
}

// ---------------------------------------------------------------------------
// File delivery SMS
// ---------------------------------------------------------------------------

export async function sendFileDeliverySMS(delivery: {
  phone: string;
  studioName: string;
  fileType: string;
  downloadUrl: string;
}): Promise<void> {
  await sendSMS({
    to: delivery.phone,
    content: `IndieThis: ${delivery.studioName} delivered your ${delivery.fileType}. Download: ${delivery.downloadUrl}`,
    tag: "file-delivery",
    webUrl: delivery.downloadUrl,
  });
}

// ---------------------------------------------------------------------------
// Auth / OTP SMS
// ---------------------------------------------------------------------------

export async function sendOtpSMS(params: {
  phone: string;
  otp: string;
  expiresInMinutes?: number;
}): Promise<void> {
  const expiry = params.expiresInMinutes ?? 10;
  await sendSMS({
    to: params.phone,
    content: `IndieThis verification code: ${params.otp}. Valid for ${expiry} minutes. Do not share this code.`,
    tag: "otp",
  });
}

// ---------------------------------------------------------------------------
// Payout & earnings SMS
// ---------------------------------------------------------------------------

export async function sendPayoutSMS(payout: {
  phone: string;
  amount: string;
  payoutMethod: string;
}): Promise<void> {
  await sendSMS({
    to: payout.phone,
    content: `IndieThis: Payout of ${payout.amount} sent via ${payout.payoutMethod}. Check your IndieThis dashboard for details.`,
    tag: "payout",
  });
}

export async function sendSaleAlertSMS(sale: {
  phone: string;
  itemName: string;
  amount: string;
}): Promise<void> {
  await sendSMS({
    to: sale.phone,
    content: `IndieThis: New sale! "${sale.itemName}" — ${sale.amount} 🎉 Keep it up.`,
    tag: "sale-alert",
  });
}


// ---------------------------------------------------------------------------
// Intake form link SMS
// ---------------------------------------------------------------------------

export async function sendIntakeLinkSMS(params: {
  phone: string;
  name: string;
  studioName: string;
  intakeUrl: string;
}): Promise<void> {
  await sendSMS({
    to: params.phone,
    content: `${params.studioName}: Hi ${params.name}! Complete your booking intake form (expires 72h): ${params.intakeUrl}`,
    tag: "intake-link",
  });
}

// ---------------------------------------------------------------------------
// Quick send delivery SMS
// ---------------------------------------------------------------------------

export async function sendQuickSendSMS(params: {
  phone: string;
  senderName: string;
  fileCount: number;
  downloadUrl: string;
}): Promise<void> {
  await sendSMS({
    to: params.phone,
    content: `${params.senderName} sent you ${params.fileCount} file${params.fileCount === 1 ? "" : "s"} via IndieThis. Download (7d): ${params.downloadUrl}`,
    tag: "quick-send",
  });
}
