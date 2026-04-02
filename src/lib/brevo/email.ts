/**
 * Brevo transactional email service
 * Handles all one-to-one triggered emails: welcome, auth, bookings, payouts, etc.
 */

import { getBrevoClient } from "./client";
import { buildEmailTemplate, type TemplateUserData } from "./email-template";

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

export interface EmailAttachment {
  content: string; // base64-encoded file content
  name:    string; // filename e.g. "split-sheet.pdf"
  type?:   string; // MIME type e.g. "application/pdf"
}

export interface SendEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: EmailRecipient;
  tags?: string[];
  attachment?: EmailAttachment[];
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
    ...(options.tags       && { tags: options.tags }),
    ...(options.attachment && { attachment: options.attachment }),
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

/**
 * Send a fully branded transactional email using the shared template.
 * Wraps primaryContent in the IndieThis header/footer with contextual
 * feature promotion and What's New section.
 */
export async function sendBrandedEmail(options: Omit<SendEmailOptions, "htmlContent"> & {
  primaryContent: string;
  context?:       string;
  userData?:      TemplateUserData;
  noPromotion?:   boolean;
}): Promise<void> {
  const { primaryContent, context, userData, noPromotion, ...emailOptions } = options;
  return sendEmail({
    ...emailOptions,
    htmlContent: buildEmailTemplate({ primaryContent, context, userData, noPromotion }),
  });
}

// ---------------------------------------------------------------------------
// Auth emails
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(user: {
  email:        string;
  displayName:  string;
  tier:         string;
  artistSlug?:  string;
}): Promise<void> {
  await sendBrandedEmail({
    to:      { email: user.email, name: user.displayName },
    subject: "Welcome to IndieThis — your artist platform is ready",
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Welcome, ${user.displayName}!</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Your <strong style="color:#D4A843;">${user.tier}</strong> account is active.
        Start creating, selling, and growing.
      </p>
      <a href="${APP_URL()}/dashboard" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Go to Your Dashboard &rarr;
      </a>
    `,
    textContent: `Welcome, ${user.displayName}! Your ${user.tier} account is active. Visit: ${APP_URL()}/dashboard`,
    context:     "SUBSCRIPTION_WELCOME",
    userData:    { artistSlug: user.artistSlug },
    tags:        ["welcome", "onboarding"],
  });
}

export async function sendPasswordResetEmail(user: {
  email:       string;
  displayName: string;
  resetLink:   string;
}): Promise<void> {
  await sendBrandedEmail({
    to:      { email: user.email, name: user.displayName },
    subject: "Reset your IndieThis password",
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Password Reset</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 8px;">Hi ${user.displayName},</p>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Click the button below to reset your password. This link expires in <strong>1 hour</strong>.
      </p>
      <a href="${user.resetLink}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Reset Password &rarr;
      </a>
      <p style="color:#666;font-size:12px;margin:20px 0 0;">
        If you didn&rsquo;t request this, you can safely ignore this email.
      </p>
    `,
    textContent:  `Reset your password: ${user.resetLink} (expires in 1 hour)`,
    noPromotion:  true,
    tags:         ["auth", "password-reset"],
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
  artistEmail:   string;
  artistName:    string;
  artistSlug?:   string;
  itemType:      "beat" | "merch" | "track";
  itemName:      string;
  saleAmount:    string;
  buyerLocation?: string;
}): Promise<void> {
  const typeLabel = { beat: "Beat", merch: "Merch item", track: "Track" }[sale.itemType];
  await sendBrandedEmail({
    to:      { email: sale.artistEmail, name: sale.artistName },
    subject: `New sale — ${typeLabel}: ${sale.itemName}`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">You Made a Sale! &#x1F389;</h1>
      <p style="color:#ccc;font-size:14px;margin:0 0 16px;">Hi ${sale.artistName},</p>
      <div style="background:#1A1A1A;border:1px solid #222;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
        <p style="color:#888;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">${typeLabel}</p>
        <p style="color:#fff;font-size:16px;font-weight:700;margin:0 0 8px;">${sale.itemName}</p>
        <p style="color:#D4A843;font-size:20px;font-weight:700;margin:0;">${sale.saleAmount}</p>
        ${sale.buyerLocation ? `<p style="color:#888;font-size:12px;margin:8px 0 0;">From: ${sale.buyerLocation}</p>` : ""}
      </div>
      <a href="${APP_URL()}/dashboard/earnings" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        View Earnings &rarr;
      </a>
    `,
    replyTo:  { email: "hello@indiethis.com", name: "IndieThis" },
    context:  "ARTIST_SALE_NOTIFICATION",
    userData: { artistSlug: sale.artistSlug },
    tags:     ["sale", sale.itemType],
  });
}

// ---------------------------------------------------------------------------
// Self-fulfilled merch order notification
// ---------------------------------------------------------------------------

export async function sendSelfFulfilledOrderEmail(params: {
  artistEmail: string;
  artistName:  string;
  orderId:     string;
  buyerName:   string;
  buyerEmail:  string;
  shippingAddress: {
    line1:   string;
    line2?:  string;
    city:    string;
    state:   string;
    zip:     string;
    country: string;
  };
  items: { title: string; size: string; color: string; quantity: number; unitPrice: number }[];
  totalPrice: number;
}): Promise<void> {
  const itemsHtml = params.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:4px 8px">${i.title}</td>
          <td style="padding:4px 8px">${i.size}${i.color ? ` / ${i.color}` : ""}</td>
          <td style="padding:4px 8px">×${i.quantity}</td>
          <td style="padding:4px 8px">$${i.unitPrice.toFixed(2)}</td>
        </tr>`,
    )
    .join("");

  const addr = params.shippingAddress;
  const addressHtml = [addr.line1, addr.line2, `${addr.city}, ${addr.state} ${addr.zip}`, addr.country]
    .filter(Boolean)
    .join("<br>");

  await sendBrandedEmail({
    to:      { email: params.artistEmail, name: params.artistName },
    subject: `New order — ship to ${params.buyerName}`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">You Have a New Order!</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Hi ${params.artistName}, someone just purchased your merch. Please ship the item(s) as soon as possible.
      </p>

      <p style="color:#D4A843;font-size:13px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">
        Order #${params.orderId.slice(-8).toUpperCase()}
      </p>
      <table style="border-collapse:collapse;width:100%;max-width:480px;margin:0 0 16px;">
        <thead>
          <tr style="background:#1A1A1A;">
            <th style="padding:8px;text-align:left;color:#888;font-size:12px;font-weight:600;">Item</th>
            <th style="padding:8px;text-align:left;color:#888;font-size:12px;font-weight:600;">Variant</th>
            <th style="padding:8px;text-align:left;color:#888;font-size:12px;font-weight:600;">Qty</th>
            <th style="padding:8px;text-align:left;color:#888;font-size:12px;font-weight:600;">Price</th>
          </tr>
        </thead>
        <tbody style="color:#ccc;font-size:13px;">${itemsHtml}</tbody>
      </table>
      <p style="color:#fff;font-weight:700;margin:0 0 20px;">Order total: <span style="color:#D4A843;">$${params.totalPrice.toFixed(2)}</span></p>

      <p style="color:#D4A843;font-size:13px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Ship To</p>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
        <strong style="color:#fff;">${params.buyerName}</strong><br>
        ${addressHtml}<br>
        <a href="mailto:${params.buyerEmail}" style="color:#D4A843;">${params.buyerEmail}</a>
      </p>

      <a href="${APP_URL()}/dashboard/merch" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        View in Dashboard &rarr;
      </a>
    `,
    replyTo:  { email: "hello@indiethis.com", name: "IndieThis" },
    context:  "ARTIST_MERCH_ORDER",
    tags:     ["merch", "self-fulfilled", "order"],
  });
}

// ---------------------------------------------------------------------------
// Buyer merch order confirmation
// ---------------------------------------------------------------------------

export async function sendMerchOrderConfirmationEmail(params: {
  buyerEmail:  string;
  buyerName:   string;
  orderId:     string;
  artistName:  string;
  artistSlug:  string;
  shippingAddress: {
    line1:   string;
    line2?:  string;
    city:    string;
    state:   string;
    zip:     string;
    country: string;
  };
  items: { title: string; size: string; color: string; quantity: number; unitPrice: number }[];
  subtotal:     number;
  shippingCost: number;
  total:        number;
}): Promise<void> {
  const itemsHtml = params.items
    .map((i) => `<tr>
      <td style="padding:4px 8px">${i.title}</td>
      <td style="padding:4px 8px">${i.size}${i.color && i.color !== "N/A" ? ` / ${i.color}` : ""}</td>
      <td style="padding:4px 8px">×${i.quantity}</td>
      <td style="padding:4px 8px;text-align:right">$${i.unitPrice.toFixed(2)}</td>
    </tr>`)
    .join("");

  const addr = params.shippingAddress;
  const addressHtml = [addr.line1, addr.line2, `${addr.city}, ${addr.state} ${addr.zip}`, addr.country]
    .filter(Boolean).join("<br>");

  const orderUrl = `${APP_URL()}/order/${params.orderId}`;

  await sendBrandedEmail({
    to:      { email: params.buyerEmail, name: params.buyerName },
    subject: `Your order from ${params.artistName} is confirmed!`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Order Confirmed &#x2713;</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Hi ${params.buyerName}, thanks for supporting <strong style="color:#fff;">${params.artistName}</strong>! Your order has been received.
      </p>

      <p style="color:#D4A843;font-size:13px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">
        Order #${params.orderId.slice(-8).toUpperCase()}
      </p>
      <table style="border-collapse:collapse;width:100%;max-width:480px;margin:0 0 16px;">
        <thead>
          <tr style="background:#1A1A1A;">
            <th style="padding:8px;text-align:left;color:#888;font-size:12px;font-weight:600;">Item</th>
            <th style="padding:8px;text-align:left;color:#888;font-size:12px;font-weight:600;">Variant</th>
            <th style="padding:8px;text-align:left;color:#888;font-size:12px;font-weight:600;">Qty</th>
            <th style="padding:8px;text-align:right;color:#888;font-size:12px;font-weight:600;">Price</th>
          </tr>
        </thead>
        <tbody style="color:#ccc;font-size:13px;">${itemsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding:6px 8px;text-align:right;color:#888;font-size:13px;">Subtotal</td>
            <td style="padding:6px 8px;text-align:right;color:#ccc;font-size:13px;">$${params.subtotal.toFixed(2)}</td>
          </tr>
          ${params.shippingCost > 0 ? `<tr>
            <td colspan="3" style="padding:6px 8px;text-align:right;color:#888;font-size:13px;">Shipping</td>
            <td style="padding:6px 8px;text-align:right;color:#ccc;font-size:13px;">$${params.shippingCost.toFixed(2)}</td>
          </tr>` : ""}
          <tr style="border-top:1px solid #222;">
            <td colspan="3" style="padding:8px;text-align:right;color:#fff;font-weight:700;">Total</td>
            <td style="padding:8px;text-align:right;color:#D4A843;font-weight:700;font-size:15px;">$${params.total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <p style="color:#D4A843;font-size:13px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Shipping To</p>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">${params.buyerName}<br>${addressHtml}</p>

      <a href="${orderUrl}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Track Your Order &rarr;
      </a>
      <p style="color:#666;font-size:12px;margin:16px 0 0;">
        Questions? Reply to this email or visit
        <a href="${APP_URL()}/${params.artistSlug}" style="color:#D4A843;">the artist&rsquo;s page</a>.
      </p>
    `,
    replyTo:  { email: "hello@indiethis.com", name: "IndieThis" },
    context:  "MERCH_ORDER_CONFIRMATION",
    userData: { artistSlug: params.artistSlug },
    tags:     ["merch", "order", "buyer-confirmation"],
  });
}

// ---------------------------------------------------------------------------
// Buyer merch shipped notification
// ---------------------------------------------------------------------------

export async function sendMerchShippedEmail(params: {
  buyerEmail:    string;
  buyerName:     string;
  orderId:       string;
  artistName:    string;
  trackingNumber: string;
  trackingUrl?:  string;
  carrier?:      string;
}): Promise<void> {
  const orderUrl = `${APP_URL()}/order/${params.orderId}`;
  const trackingLink = params.trackingUrl
    ? `<a href="${params.trackingUrl}" style="color:#D4A843">${params.trackingNumber}</a>`
    : `<strong>${params.trackingNumber}</strong>`;

  await sendBrandedEmail({
    to:      { email: params.buyerEmail, name: params.buyerName },
    subject: `Your order from ${params.artistName} has shipped!`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Your Order is on the Way! &#x1F4E6;</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hi ${params.buyerName}, great news &mdash; <strong style="color:#fff;">${params.artistName}</strong> has shipped your order.
      </p>
      <div style="background:#1A1A1A;border:1px solid #222;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
        ${params.carrier ? `<p style="color:#888;font-size:12px;margin:0 0 4px;"><strong style="color:#ccc;">Carrier:</strong> ${params.carrier}</p>` : ""}
        <p style="color:#888;font-size:12px;margin:0;"><strong style="color:#ccc;">Tracking:</strong> ${trackingLink}</p>
      </div>
      <a href="${orderUrl}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        View Order Status &rarr;
      </a>
    `,
    replyTo:  { email: "hello@indiethis.com", name: "IndieThis" },
    context:  "MERCH_SHIPPED",
    tags:     ["merch", "order", "shipped"],
  });
}

// ---------------------------------------------------------------------------
// Buyer merch delivered notification
// ---------------------------------------------------------------------------

export async function sendMerchDeliveredEmail(params: {
  buyerEmail: string;
  buyerName:  string;
  orderId:    string;
  artistName: string;
  artistSlug: string;
}): Promise<void> {
  const orderUrl  = `${APP_URL()}/order/${params.orderId}`;
  const merchUrl  = `${APP_URL()}/${params.artistSlug}/merch`;

  await sendBrandedEmail({
    to:      { email: params.buyerEmail, name: params.buyerName },
    subject: `Your order from ${params.artistName} has arrived!`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Your Order Has Arrived! &#x1F389;</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Hi ${params.buyerName}, your merch from <strong style="color:#fff;">${params.artistName}</strong> has been delivered. Enjoy!
      </p>
      <a href="${orderUrl}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        View Order &rarr;
      </a>
      <p style="margin-top:16px;">
        <a href="${merchUrl}" style="color:#D4A843;text-decoration:none;font-size:13px;">Browse more merch from ${params.artistName} &rarr;</a>
      </p>
    `,
    replyTo:  { email: "hello@indiethis.com", name: "IndieThis" },
    context:  "MERCH_DELIVERED",
    userData: { artistSlug: params.artistSlug },
    tags:     ["merch", "order", "delivered"],
  });
}

// ---------------------------------------------------------------------------
// Fan Funding confirmation to fan
// ---------------------------------------------------------------------------

export async function sendFanFundingConfirmationEmail(params: {
  fanEmail:    string;
  fanName:     string | null;
  artistName:  string;
  artistSlug?: string;
  amount:      number; // cents
}): Promise<void> {
  const appUrl    = APP_URL();
  const dollarAmt = (params.amount / 100).toFixed(2);
  const toName    = params.fanName || "Fan";

  await sendBrandedEmail({
    to:      { email: params.fanEmail, name: toName },
    subject: `You supported ${params.artistName} on IndieThis &#x1F3B5;`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Thank you for your support!</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hi ${toName}, your <strong style="color:#D4A843;">$${dollarAmt}</strong> goes directly toward
        <strong style="color:#fff;">${params.artistName}</strong>&rsquo;s music production, mastering,
        and promotion on IndieThis. You&rsquo;re fueling independent music &mdash; thank you.
      </p>
      <a href="${appUrl}/explore" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Discover More Artists &rarr;
      </a>
    `,
    replyTo:  { email: "hello@indiethis.com", name: "IndieThis" },
    context:  "FAN_FUNDING_RECEIPT",
    userData: { artistSlug: params.artistSlug },
    tags:     ["fan-funding", "confirmation"],
  });
}

// ---------------------------------------------------------------------------
// Sample Pack purchase confirmation
// ---------------------------------------------------------------------------

export async function sendSamplePackPurchaseEmail(params: {
  buyerEmail:    string;
  packTitle:     string;
  producerName:  string;
  producerSlug?: string;
  sampleCount:   number;
  amount:        number; // cents
  downloadUrl:   string;
}): Promise<void> {
  const appUrl = APP_URL();
  const dollar = (params.amount / 100).toFixed(2);

  await sendBrandedEmail({
    to:      { email: params.buyerEmail },
    subject: `Your Sample Pack is ready: ${params.packTitle}`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Your Sample Pack is ready!</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Thanks for purchasing <strong style="color:#fff;">${params.packTitle}</strong> by
        <strong style="color:#fff;">${params.producerName}</strong>.
        Your pack contains ${params.sampleCount} audio sample${params.sampleCount !== 1 ? "s" : ""} &mdash; ready to download below.
      </p>
      <div style="background:#1A1A1A;border:1px solid #222;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
        <p style="color:#888;font-size:12px;margin:0 0 4px;">Purchase total</p>
        <p style="color:#D4A843;font-size:20px;font-weight:700;margin:0;">$${dollar}</p>
      </div>
      <a href="${params.downloadUrl}" style="background:#E85D4A;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:15px;">
        Download Sample Pack &rarr;
      </a>
      <p style="color:#666;font-size:12px;margin:16px 0 0;">
        Keep this email &mdash; your download link is valid for up to 5 downloads.<br>
        Need help? <a href="mailto:support@indiethis.com" style="color:#D4A843;">support@indiethis.com</a>
      </p>
    `,
    replyTo:  { email: "hello@indiethis.com", name: "IndieThis" },
    context:  "DIGITAL_PURCHASE_RECEIPT",
    userData: { artistSlug: params.producerSlug },
    tags:     ["sample-pack", "purchase"],
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
  sessionDate?: string | null;
  sessionTime?: string | null;
  endTime?: string | null;
  hourlyRate?: number | null;
  sessionHours?: number | null;
}): Promise<void> {
  const { sessionDate, sessionTime, endTime, hourlyRate, sessionHours } = params;

  // Session date line
  let sessionLine = "";
  if (sessionDate) {
    const dateStr = new Date(sessionDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const timeStr = sessionTime ? ` at ${sessionTime}${endTime ? ` – ${endTime}` : ""}` : "";
    sessionLine = `<p style="margin:0 0 8px 0"><strong>Session:</strong> ${dateStr}${timeStr}</p>`;
  }

  // Pricing lines
  let pricingBlock = "";
  if (hourlyRate && sessionHours) {
    const total = hourlyRate * sessionHours;
    pricingBlock = `
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:16px 0;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden">
        <tr style="background:#fafafa">
          <td style="padding:10px 14px;font-size:13px;color:#555">
            ${sessionHours} hr${sessionHours !== 1 ? "s" : ""} × $${hourlyRate}/hr
          </td>
          <td style="padding:10px 14px;font-size:14px;font-weight:700;color:#111;text-align:right">
            $${total.toFixed(2)}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 14px;font-size:12px;color:#888">
            Deposit and balance due are confirmed on the form
          </td>
          <td></td>
        </tr>
      </table>`;
  }

  await sendEmail({
    to: { email: params.email, name: params.name },
    subject: `${params.studioName} sent you a booking intake form`,
    htmlContent: `
      <h1 style="margin:0 0 16px 0;font-size:20px">Complete Your Booking Intake</h1>
      <p style="margin:0 0 12px 0">Hi ${params.name},</p>
      <p style="margin:0 0 16px 0"><strong>${params.studioName}</strong> has sent you a personalized intake form to complete before your session.</p>
      ${sessionLine}
      ${pricingBlock}
      <p style="margin:16px 0 8px 0">Please complete the form within 72 hours:</p>
      <p style="margin:0 0 16px 0">
        <a href="${params.intakeUrl}" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">
          Complete Intake Form
        </a>
      </p>
      <p style="margin:0 0 16px 0">Or copy this link:<br><code style="font-size:12px">${params.intakeUrl}</code></p>
      <p style="color:#888;font-size:12px;margin:0">This link expires in 72 hours.</p>
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
      <p><a href="${params.downloadUrl}" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">Download Files</a></p>
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

// ---------------------------------------------------------------------------
// License Vault — documentation request
// ---------------------------------------------------------------------------

export async function sendDocumentationRequestEmail(params: {
  userEmail:    string;
  userName:     string;
  contentTitle: string;
  contentType:  "beat" | "track" | "stream lease";
  vaultUrl:     string;
}): Promise<void> {
  const typeLabel = { beat: "Beat", track: "Track", "stream lease": "Stream Lease" }[params.contentType];
  await sendEmail({
    to: { email: params.userEmail, name: params.userName },
    subject: `Action required: Please upload documentation for "${params.contentTitle}"`,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0A0A0A;">
        <h1 style="font-size:22px;">Documentation Request</h1>
        <p>Hi ${params.userName},</p>
        <p>IndieThis has received an inquiry about your ${typeLabel}: <strong>${params.contentTitle}</strong>.</p>
        <p>To help us resolve this quickly, please upload proof of ownership (license agreement, receipt, or clearance document) to your License Vault and attach it to this content.</p>
        <a href="${params.vaultUrl}" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:8px;">Open License Vault →</a>
        <p style="margin-top:24px;font-size:13px;color:#555;">If you believe this inquiry was sent in error or have any questions, reply to this email and our team will follow up.</p>
      </div>
    `,
    textContent: `Hi ${params.userName},\n\nIndieThis has received an inquiry about your ${typeLabel}: "${params.contentTitle}".\n\nPlease upload proof of ownership to your License Vault and attach it to this content:\n${params.vaultUrl}\n\nIf you have questions, reply to this email.`,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis Support" },
    tags: ["moderation", "documentation-request"],
  });
}

// ---------------------------------------------------------------------------
// Session Notes / Project Tracker emails
// ---------------------------------------------------------------------------

/**
 * Notify artist that the studio added/shared session notes.
 */
export async function sendSessionNoteEmail(params: {
  artistEmail: string;
  artistName: string;
  studioName: string;
  noteTitle: string;
  sessionDate: string;
  dashboardUrl: string;
}): Promise<void> {
  await sendEmail({
    to: { email: params.artistEmail, name: params.artistName },
    subject: `${params.studioName} added session notes for you`,
    htmlContent: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;border-radius:12px;overflow:hidden;">
        <div style="background:#D4A843;padding:20px 32px;">
          <h1 style="margin:0;font-size:20px;color:#0A0A0A;font-weight:800;">Session Notes Ready</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;">Hi ${params.artistName},</p>
          <p style="margin:0 0 16px;"><strong>${params.studioName}</strong> has shared session notes from your <strong>${params.sessionDate}</strong> session:</p>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
            <p style="margin:0;font-weight:700;font-size:15px;">${params.noteTitle}</p>
          </div>
          <a href="${params.dashboardUrl}" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;">View Session Notes →</a>
          <p style="margin-top:32px;font-size:12px;color:#666;">You can leave feedback directly in your IndieThis sessions dashboard.</p>
        </div>
      </div>
    `,
    textContent: `Hi ${params.artistName},\n\n${params.studioName} has shared session notes from your ${params.sessionDate} session: "${params.noteTitle}".\n\nView them here: ${params.dashboardUrl}`,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["session-notes"],
  });
}

/**
 * Notify studio that an artist submitted feedback on a session note.
 */
export async function sendArtistSessionFeedbackEmail(params: {
  studioEmail: string;
  studioName: string;
  artistName: string;
  noteTitle: string;
  feedback: string;
  bookingsUrl: string;
}): Promise<void> {
  await sendEmail({
    to: { email: params.studioEmail, name: params.studioName },
    subject: `${params.artistName} left feedback on session notes`,
    htmlContent: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;border-radius:12px;overflow:hidden;">
        <div style="background:#D4A843;padding:20px 32px;">
          <h1 style="margin:0;font-size:20px;color:#0A0A0A;font-weight:800;">Artist Feedback Received</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;"><strong>${params.artistName}</strong> left feedback on your session notes <em>"${params.noteTitle}"</em>:</p>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #D4A843;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
            <p style="margin:0;font-size:14px;line-height:1.6;">${params.feedback}</p>
          </div>
          <a href="${params.bookingsUrl}" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;">View in Bookings →</a>
        </div>
      </div>
    `,
    textContent: `${params.artistName} left feedback on your session notes "${params.noteTitle}":\n\n"${params.feedback}"\n\nView in bookings: ${params.bookingsUrl}`,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["session-feedback"],
  });
}

// ---------------------------------------------------------------------------
// Split Sheet emails
// ---------------------------------------------------------------------------

/**
 * Invite a contributor to review and agree to a split sheet.
 */
export async function sendSplitSheetInviteEmail(params: {
  recipientEmail: string;
  recipientName: string;
  creatorName: string;
  trackTitle: string;
  role: string;
  percentage: number;
  reviewUrl: string;
}): Promise<void> {
  await sendEmail({
    to: { email: params.recipientEmail, name: params.recipientName },
    subject: `${params.creatorName} invited you to a split sheet`,
    htmlContent: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;border-radius:12px;overflow:hidden;">
        <div style="background:#D4A843;padding:20px 32px;">
          <h1 style="margin:0;font-size:20px;color:#0A0A0A;font-weight:800;">Split Sheet Invitation</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;">Hi ${params.recipientName},</p>
          <p style="margin:0 0 16px;"><strong>${params.creatorName}</strong> has invited you to agree to a split sheet for:</p>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 20px;margin:0 0 16px;">
            <p style="margin:0;font-weight:700;font-size:16px;">${params.trackTitle}</p>
          </div>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:14px 20px;margin:0 0 24px;display:flex;gap:24px;">
            <div style="flex:1;">
              <p style="margin:0 4px 0;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.05em;">Your Role</p>
              <p style="margin:0;font-weight:700;">${params.role}</p>
            </div>
            <div style="flex:1;">
              <p style="margin:0 4px 0;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.05em;">Your Share</p>
              <p style="margin:0;font-weight:700;color:#D4A843;">${params.percentage}%</p>
            </div>
          </div>
          <a href="${params.reviewUrl}" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;">Review &amp; Sign Split Sheet →</a>
          <p style="margin-top:32px;font-size:12px;color:#666;">You can agree or reject this split sheet. Your earnings will be distributed automatically once all contributors agree.</p>
        </div>
      </div>
    `,
    textContent: `Hi ${params.recipientName},\n\n${params.creatorName} has invited you to a split sheet for "${params.trackTitle}".\n\nYour role: ${params.role}\nYour share: ${params.percentage}%\n\nReview and sign here: ${params.reviewUrl}`,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["split-sheet", "invite"],
  });
}

/**
 * Notify split sheet creator that a contributor agreed.
 */
export async function sendSplitSheetAgreedEmail(params: {
  creatorEmail: string;
  creatorName: string;
  contributorName: string;
  trackTitle: string;
  agreedCount: number;
  totalCount: number;
  dashboardUrl: string;
}): Promise<void> {
  await sendEmail({
    to: { email: params.creatorEmail, name: params.creatorName },
    subject: `${params.contributorName} agreed to the split sheet`,
    htmlContent: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;border-radius:12px;overflow:hidden;">
        <div style="background:#D4A843;padding:20px 32px;">
          <h1 style="margin:0;font-size:20px;color:#0A0A0A;font-weight:800;">Split Sheet Agreed</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;"><strong>${params.contributorName}</strong> agreed to the split sheet for <strong>"${params.trackTitle}"</strong>.</p>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:14px 20px;margin:0 0 24px;">
            <p style="margin:0;font-size:14px;color:#999;">${params.agreedCount} of ${params.totalCount} contributors agreed</p>
            <div style="background:#2a2a2a;border-radius:4px;height:6px;margin-top:8px;overflow:hidden;">
              <div style="background:#D4A843;height:100%;width:${Math.round((params.agreedCount / params.totalCount) * 100)}%;border-radius:4px;"></div>
            </div>
          </div>
          <a href="${params.dashboardUrl}" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;">View Split Sheet →</a>
        </div>
      </div>
    `,
    textContent: `${params.contributorName} agreed to the split sheet for "${params.trackTitle}".\n\n${params.agreedCount} of ${params.totalCount} contributors agreed.\n\nView: ${params.dashboardUrl}`,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["split-sheet", "agreed"],
  });
}

/**
 * Notify all contributors that the split sheet is now active (all agreed).
 */
export async function sendSplitSheetActiveEmail(params: {
  recipientEmail: string;
  recipientName: string;
  trackTitle: string;
  percentage: number;
  role: string;
  dashboardUrl: string;
}): Promise<void> {
  await sendEmail({
    to: { email: params.recipientEmail, name: params.recipientName },
    subject: `Split sheet for "${params.trackTitle}" is now active`,
    htmlContent: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;border-radius:12px;overflow:hidden;">
        <div style="background:#D4A843;padding:20px 32px;">
          <h1 style="margin:0;font-size:20px;color:#0A0A0A;font-weight:800;">Split Sheet Active ✓</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;">Hi ${params.recipientName},</p>
          <p style="margin:0 0 16px;">All contributors have agreed. The split sheet for <strong>"${params.trackTitle}"</strong> is now active.</p>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:14px 20px;margin:0 0 24px;">
            <p style="margin:0 4px 0;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.05em;">Your Share</p>
            <p style="margin:0;font-weight:700;font-size:20px;color:#D4A843;">${params.percentage}% as ${params.role}</p>
          </div>
          <p style="margin:0 0 24px;color:#aaa;font-size:14px;">Your earnings from this track will be distributed automatically according to your agreed split percentage.</p>
          <a href="${params.dashboardUrl}" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;">View Split Sheet →</a>
        </div>
      </div>
    `,
    textContent: `Hi ${params.recipientName},\n\nAll contributors agreed. The split sheet for "${params.trackTitle}" is now active.\n\nYour share: ${params.percentage}% as ${params.role}\n\nView: ${params.dashboardUrl}`,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["split-sheet", "active"],
  });
}

/**
 * Notify split sheet creator that a contributor rejected the sheet.
 */
export async function sendSplitSheetRejectedEmail(params: {
  creatorEmail: string;
  creatorName: string;
  contributorName: string;
  trackTitle: string;
  reason?: string;
  dashboardUrl: string;
}): Promise<void> {
  await sendEmail({
    to: { email: params.creatorEmail, name: params.creatorName },
    subject: `${params.contributorName} rejected the split sheet`,
    htmlContent: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;border-radius:12px;overflow:hidden;">
        <div style="background:#D4A843;padding:20px 32px;">
          <h1 style="margin:0;font-size:20px;color:#0A0A0A;font-weight:800;">Split Sheet Disputed</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;"><strong>${params.contributorName}</strong> rejected the split sheet for <strong>"${params.trackTitle}"</strong>.</p>
          ${params.reason ? `
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #ef4444;border-radius:8px;padding:14px 20px;margin:0 0 24px;">
            <p style="margin:0 0 4px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.05em;">Reason</p>
            <p style="margin:0;font-size:14px;line-height:1.6;">${params.reason}</p>
          </div>` : ""}
          <p style="margin:0 0 24px;color:#aaa;font-size:14px;">You can edit the split sheet and re-send invites to resolve the dispute.</p>
          <a href="${params.dashboardUrl}" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;">View &amp; Edit Split Sheet →</a>
        </div>
      </div>
    `,
    textContent: `${params.contributorName} rejected the split sheet for "${params.trackTitle}".${params.reason ? `\n\nReason: "${params.reason}"` : ""}\n\nView and edit: ${params.dashboardUrl}`,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["split-sheet", "rejected"],
  });
}

/**
 * Notify a contributor they have a pending balance awaiting payout.
 */
export async function sendSplitPendingBalanceEmail(params: {
  recipientEmail: string;
  recipientName: string;
  trackTitle: string;
  pendingAmount: number;
  reviewUrl: string;
}): Promise<void> {
  await sendEmail({
    to: { email: params.recipientEmail, name: params.recipientName },
    subject: `You have earnings pending from "${params.trackTitle}"`,
    htmlContent: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;border-radius:12px;overflow:hidden;">
        <div style="background:#D4A843;padding:20px 32px;">
          <h1 style="margin:0;font-size:20px;color:#0A0A0A;font-weight:800;">Earnings Waiting for You</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;">Hi ${params.recipientName},</p>
          <p style="margin:0 0 16px;">You have <strong style="color:#D4A843;">$${params.pendingAmount.toFixed(2)}</strong> in pending earnings from <strong>"${params.trackTitle}"</strong>.</p>
          <p style="margin:0 0 24px;color:#aaa;font-size:14px;">Connect a Stripe account to receive your payout automatically.</p>
          <a href="${params.reviewUrl}" style="display:inline-block;background:#D4A843;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;">Claim Your Earnings →</a>
        </div>
      </div>
    `,
    textContent: `Hi ${params.recipientName},\n\nYou have $${params.pendingAmount.toFixed(2)} in pending earnings from "${params.trackTitle}".\n\nClaim here: ${params.reviewUrl}`,
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["split-sheet", "pending-balance"],
  });
}

/**
 * Send the finalised split sheet PDF to a contributor who does not have
 * an IndieThis account (no userId). The PDF is attached directly to the email.
 */
export async function sendSplitSheetDocumentEmail(params: {
  recipientEmail:  string;
  recipientName:   string;
  trackTitle:      string;
  percentage:      number;
  role:            string;
  pdfBase64:       string; // base64-encoded PDF buffer
  dashboardUrl:    string;
}): Promise<void> {
  await sendEmail({
    to:      { email: params.recipientEmail, name: params.recipientName },
    subject: `Your split sheet for "${params.trackTitle}" is ready`,
    htmlContent: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#f5f5f5;border-radius:12px;overflow:hidden;">
        <div style="background:#D4A843;padding:20px 32px;">
          <p style="margin:0 0 4px;font-size:12px;color:#0A0A0A;font-weight:600;letter-spacing:1px;text-transform:uppercase;">IndieThis</p>
          <h1 style="margin:0;font-size:22px;color:#0A0A0A;font-weight:800;">Split Sheet Ready</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;">Hi ${params.recipientName},</p>
          <p style="margin:0 0 16px;">
            All contributors have agreed to the split sheet for
            <strong style="color:#f5f5f5;">"${params.trackTitle}"</strong>.
            Your copy is attached to this email as a PDF.
          </p>

          <div style="background:#141414;border:1px solid #2a2a2a;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
            <p style="margin:0 0 6px;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your Share</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#D4A843;">${params.percentage.toFixed(1)}%</p>
            <p style="margin:4px 0 0;font-size:12px;color:#888;">${params.role.replace(/_/g, " ")}</p>
          </div>

          <p style="margin:0 0 8px;font-size:13px;color:#aaa;">
            Keep this document for your records. It confirms your ownership stake and the agreed royalty
            split for all future earnings from this track.
          </p>

          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #2a2a2a;">
            <p style="margin:0;font-size:11px;color:#666;">
              IndieThis · <a href="https://indiethis.com" style="color:#D4A843;text-decoration:none;">indiethis.com</a>
            </p>
          </div>
        </div>
      </div>
    `,
    textContent: `Hi ${params.recipientName},\n\nAll contributors have agreed to the split sheet for "${params.trackTitle}". Your copy is attached.\n\nYour share: ${params.percentage.toFixed(1)}% (${params.role})\n\nKeep this document for your records.`,
    attachment: [
      {
        content: params.pdfBase64,
        name:    `split-sheet-${params.trackTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`,
        type:    "application/pdf",
      },
    ],
    replyTo: { email: "hello@indiethis.com", name: "IndieThis" },
    tags: ["split-sheet", "document-delivery"],
  });
}

// ---------------------------------------------------------------------------
// Onboarding email sequence (Days 0 / 1 / 3 / 5 / 7 / 14 / 30)
// ---------------------------------------------------------------------------

function onboardingBase(bodyHtml: string, ctaText: string, ctaUrl: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#C8C8C8;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
      <div style="padding:28px 32px 0 32px;">
        <p style="margin:0 0 28px;font-size:18px;font-weight:800;color:#D4A843;letter-spacing:-0.5px;">IndieThis</p>
        ${bodyHtml}
        <table cellpadding="0" cellspacing="0" style="margin:28px 0 32px;">
          <tr>
            <td style="background-color:#D4A843;border-radius:10px;">
              <a href="${ctaUrl}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#0A0A0A;text-decoration:none;">${ctaText}</a>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;font-size:11px;color:#333;line-height:1.6;">IndieThis · Everything an independent artist needs.<br/>You're receiving this because you signed up at indiethis.com. <a href="${APP_URL()}/dashboard/settings" style="color:#444;text-decoration:underline;">Manage preferences</a></p>
      </div>
    </div>
  `;
}

export async function sendOnboardingWelcomeEmail(user: { email: string; name: string }): Promise<void> {
  await sendEmail({
    to:          { email: user.email, name: user.name },
    subject:     "You're in. Let's build something.",
    replyTo:     { email: process.env.BREVO_REPLY_TO ?? "hello@indiethis.com" },
    tags:        ["onboarding", "day0"],
    htmlContent: onboardingBase(
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Welcome to IndieThis, ${user.name}. You now have everything you need to create, sell, and grow as an independent artist — all in one place.</p>
       <p style="margin:0;font-size:15px;line-height:1.7;">Here's your first move:</p>`,
      "Upload Your First Track →",
      `${APP_URL()}/dashboard/music`,
    ),
  });
}

export async function sendOnboardingDay1Email(user: { email: string; name: string }): Promise<void> {
  await sendEmail({
    to:          { email: user.email, name: user.name },
    subject:     "Your first track is waiting",
    replyTo:     { email: process.env.BREVO_REPLY_TO ?? "hello@indiethis.com" },
    tags:        ["onboarding", "day1"],
    htmlContent: onboardingBase(
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">The artists who grow fastest on IndieThis upload their first track within 24 hours. It takes 2 minutes.</p>
       <p style="margin:0;font-size:15px;line-height:1.7;">Upload a track and your artist page starts working for you.</p>`,
      "Upload Now →",
      `${APP_URL()}/dashboard/music`,
    ),
  });
}

export async function sendOnboardingDay3Email(user: { email: string; name: string }): Promise<void> {
  await sendEmail({
    to:          { email: user.email, name: user.name },
    subject:     "Try this — it takes 12 seconds",
    replyTo:     { email: process.env.BREVO_REPLY_TO ?? "hello@indiethis.com" },
    tags:        ["onboarding", "day3"],
    htmlContent: onboardingBase(
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Most artists spend $200 on cover art. On IndieThis, you describe what you want and get 4 options in 12 seconds.</p>
       <p style="margin:0;font-size:15px;line-height:1.7;">Your first one might already be included in your plan.</p>`,
      "Generate Cover Art →",
      `${APP_URL()}/dashboard/ai/cover-art`,
    ),
  });
}

export async function sendOnboardingDay5Email(user: { email: string; name: string }): Promise<void> {
  await sendEmail({
    to:          { email: user.email, name: user.name },
    subject:     "Your page is ready. Just hit publish.",
    replyTo:     { email: process.env.BREVO_REPLY_TO ?? "hello@indiethis.com" },
    tags:        ["onboarding", "day5"],
    htmlContent: onboardingBase(
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">You have a full artist website waiting — music, merch, shows, booking, tips, fan capture. 18 sections that build themselves from your data.</p>
       <p style="margin:0;font-size:15px;line-height:1.7;">All you have to do is publish it.</p>`,
      "Launch Your Page →",
      `${APP_URL()}/dashboard/site`,
    ),
  });
}

export async function sendOnboardingDay7Email(user: { email: string; name: string; artistSlug: string | null }): Promise<void> {
  const slug = user.artistSlug ?? "your-page";
  await sendEmail({
    to:          { email: user.email, name: user.name },
    subject:     "Share your page. Build your list.",
    replyTo:     { email: process.env.BREVO_REPLY_TO ?? "hello@indiethis.com" },
    tags:        ["onboarding", "day7"],
    htmlContent: onboardingBase(
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Your IndieThis page is live. Now share it.</p>
       <p style="margin:0;font-size:15px;line-height:1.7;">Every person who visits can become a fan — email signups, merch buyers, tip supporters. The link is <span style="color:#D4A843;font-weight:600;">indiethis.com/${slug}</span>. Put it in your bio, your stories, your DMs.</p>`,
      "View Your Page →",
      `${APP_URL()}/${slug}`,
    ),
  });
}

export async function sendOnboardingDay14Email(
  user: { email: string; name: string },
  unusedFeatures: { name: string; description: string; url: string }[],
): Promise<void> {
  const top3 = unusedFeatures.slice(0, 3);
  const featureRows = top3.map((f) => `
    <div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#fff;">${f.name}</p>
      <p style="margin:0 0 6px;font-size:13px;color:#666;">${f.description}</p>
      <a href="${f.url}" style="font-size:12px;color:#D4A843;text-decoration:none;font-weight:600;">Try it →</a>
    </div>
  `).join("");

  await sendEmail({
    to:          { email: user.email, name: user.name },
    subject:     "3 features you haven't tried yet",
    replyTo:     { email: process.env.BREVO_REPLY_TO ?? "hello@indiethis.com" },
    tags:        ["onboarding", "day14"],
    htmlContent: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#C8C8C8;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
        <div style="padding:28px 32px;">
          <p style="margin:0 0 20px;font-size:18px;font-weight:800;color:#D4A843;letter-spacing:-0.5px;">IndieThis</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;">You've been on IndieThis for two weeks. Here are 3 features you haven't tried yet:</p>
          ${featureRows}
          <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
            <tr>
              <td style="background-color:#D4A843;border-radius:10px;">
                <a href="${APP_URL()}/dashboard" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#0A0A0A;text-decoration:none;">Explore Your Dashboard →</a>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#333;">IndieThis · <a href="${APP_URL()}/dashboard/settings" style="color:#444;text-decoration:underline;">Manage preferences</a></p>
        </div>
      </div>
    `,
  });
}

export async function sendOnboardingDay30Email(
  user:  { email: string; name: string; artistSlug: string | null },
  stats: { pageViews: number; plays: number; fans: number; earnings: number },
): Promise<void> {
  const slug     = user.artistSlug ?? "your-page";
  const hasStats = stats.pageViews > 0 || stats.plays > 0 || stats.fans > 0 || stats.earnings > 0;

  const statsBlock = hasStats
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:12px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <tr>
          ${[
            ["Page Views", stats.pageViews.toLocaleString()],
            ["Plays",      stats.plays.toLocaleString()],
            ["Fans",       stats.fans.toLocaleString()],
            ["Earned",     `$${stats.earnings.toFixed(2)}`],
          ].map(([label, val]) => `
          <td align="center" style="padding:16px 8px;background:#141414;border-right:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#D4A843;">${val}</p>
            <p style="margin:0;font-size:10px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:0.5px;">${label}</p>
          </td>`).join("")}
        </tr>
      </table>`
    : `<p style="margin:12px 0 20px;font-size:14px;color:#666;line-height:1.7;">Your page is set up and ready. The artists who earn on IndieThis share their page consistently. Your link: <span style="color:#D4A843;">indiethis.com/${slug}</span></p>`;

  await sendEmail({
    to:          { email: user.email, name: user.name },
    subject:     "Your first month on IndieThis",
    replyTo:     { email: process.env.BREVO_REPLY_TO ?? "hello@indiethis.com" },
    tags:        ["onboarding", "day30"],
    htmlContent: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#C8C8C8;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
        <div style="padding:28px 32px;">
          <p style="margin:0 0 20px;font-size:18px;font-weight:800;color:#D4A843;letter-spacing:-0.5px;">IndieThis</p>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.7;">One month in. Here's how you're doing:</p>
          ${statsBlock}
          <table cellpadding="0" cellspacing="0" style="margin-top:8px;">
            <tr>
              <td style="background-color:#D4A843;border-radius:10px;">
                <a href="${APP_URL()}/dashboard" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#0A0A0A;text-decoration:none;">View Your Analytics →</a>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#333;">IndieThis · <a href="${APP_URL()}/dashboard/settings" style="color:#444;text-decoration:underline;">Manage preferences</a></p>
        </div>
      </div>
    `,
  });
}

// ─── Re-engagement Emails ─────────────────────────────────────────────────────

function reEngagementBase(bodyHtml: string, ctaText: string, ctaUrl: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;color:#C8C8C8;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
      <div style="padding:28px 32px;">
        <p style="margin:0 0 20px;font-size:18px;font-weight:800;color:#D4A843;letter-spacing:-0.5px;">IndieThis</p>
        ${bodyHtml}
        <table cellpadding="0" cellspacing="0" style="margin-top:20px;">
          <tr>
            <td style="background-color:#D4A843;border-radius:10px;">
              <a href="${ctaUrl}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#0A0A0A;text-decoration:none;">${ctaText}</a>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;font-size:11px;color:#333;">IndieThis · <a href="${APP_URL()}/dashboard/settings" style="color:#444;text-decoration:underline;">Manage preferences</a></p>
      </div>
    </div>
  `;
}

// 7-day inactive — page view nudge
export async function sendReEngagement7DayEmail(
  user:      { email: string; name: string; artistSlug: string | null },
  pageViews: number,
): Promise<void> {
  const body = pageViews > 0
    ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">People are visiting your page even when you're not here.</p>
       <p style="margin:0 0 20px;font-size:32px;font-weight:800;color:#D4A843;">${pageViews} views this week</p>
       <p style="margin:0;font-size:14px;color:#888;line-height:1.7;">Come see who's checking you out.</p>`
    : `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">You've been quiet for a week.</p>
       <p style="margin:0;font-size:14px;color:#888;line-height:1.7;">Your page is still live at <span style="color:#D4A843;">indiethis.com/${user.artistSlug ?? "your-page"}</span> — the more you share it, the more it works.</p>`;

  await sendEmail({
    to:          { email: user.email, name: user.name },
    subject:     `Your page had ${pageViews} view${pageViews === 1 ? "" : "s"} this week`,
    replyTo:     { email: process.env.BREVO_REPLY_TO ?? "hello@indiethis.com" },
    tags:        ["re-engagement", "7day"],
    htmlContent: reEngagementBase(body, "View Your Analytics →", `${APP_URL()}/dashboard/analytics`),
  });
}

// 14-day inactive — unused feature highlight
export async function sendReEngagement14DayEmail(
  user:    { email: string; name: string },
  feature: { name: string; description: string; url: string },
): Promise<void> {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">We built something new while you were away.</p>
    <div style="background:#141414;border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:20px 24px;margin-bottom:4px;">
      <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#fff;">${feature.name}</p>
      <p style="margin:0;font-size:14px;color:#888;line-height:1.7;">${feature.description}</p>
    </div>`;

  await sendEmail({
    to:          { email: user.email, name: user.name },
    subject:     "We built something new while you were away",
    replyTo:     { email: process.env.BREVO_REPLY_TO ?? "hello@indiethis.com" },
    tags:        ["re-engagement", "14day"],
    htmlContent: reEngagementBase(body, `Try ${feature.name} →`, feature.url),
  });
}

// 30-day inactive — personal check-in
export async function sendReEngagement30DayEmail(
  user: { email: string; name: string },
): Promise<void> {
  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Your IndieThis account is still active.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#888;line-height:1.7;">Your page, your music, your merch — it's all still live. If you need help getting started or have questions, reply to this email. We read every one.</p>`;

  await sendEmail({
    to:          { email: user.email, name: user.name },
    subject:     "Still here if you need us",
    replyTo:     { email: process.env.BREVO_REPLY_TO ?? "hello@indiethis.com" },
    tags:        ["re-engagement", "30day"],
    htmlContent: reEngagementBase(body, "Log In →", `${APP_URL()}/dashboard`),
  });
}

// ─── Intake Status Notifications ─────────────────────────────────────────────

export async function sendIntakeConfirmedEmail(params: {
  email: string;
  name: string;
  studioName: string;
  sessionDate?: string | null;
  sessionTime?: string | null;
  endTime?: string | null;
}): Promise<void> {
  const dateInfo = params.sessionDate
    ? `<p style="margin:0 0 8px;font-size:14px;"><strong>Date:</strong> ${params.sessionDate}${params.sessionTime ? ` at ${params.sessionTime}` : ""}${params.endTime ? ` – ${params.endTime}` : ""}</p>`
    : "";
  await sendEmail({
    to: { email: params.email, name: params.name },
    subject: `Your session is confirmed — ${params.studioName}`,
    htmlContent: `
      <div style="font-family:sans-serif;background:#0A0A0A;color:#e0e0e0;padding:40px 24px;max-width:520px;margin:auto;border-radius:12px;">
        <h2 style="color:#D4A843;margin:0 0 16px;">Session Confirmed ✓</h2>
        <p style="margin:0 0 16px;">Hi ${params.name}, your session at <strong>${params.studioName}</strong> has been confirmed.</p>
        ${dateInfo}
        <p style="margin:16px 0 0;font-size:13px;color:#888;">Reply to this email if you have any questions.</p>
      </div>`,
    replyTo: { email: FROM_EMAIL(), name: FROM_NAME() },
    tags: ["intake", "confirmed"],
  });
}

export async function sendIntakeCompletedEmail(params: {
  email: string;
  name: string;
  studioName: string;
}): Promise<void> {
  await sendEmail({
    to: { email: params.email, name: params.name },
    subject: `Session completed — ${params.studioName}`,
    htmlContent: `
      <div style="font-family:sans-serif;background:#0A0A0A;color:#e0e0e0;padding:40px 24px;max-width:520px;margin:auto;border-radius:12px;">
        <h2 style="color:#D4A843;margin:0 0 16px;">Session Completed</h2>
        <p style="margin:0 0 16px;">Hi ${params.name}, your session at <strong>${params.studioName}</strong> has been marked as completed. Thanks for coming in!</p>
        <p style="margin:0;font-size:13px;color:#888;">Reply to this email if you have any questions.</p>
      </div>`,
    replyTo: { email: FROM_EMAIL(), name: FROM_NAME() },
    tags: ["intake", "completed"],
  });
}

export async function sendIntakeCancelledEmail(params: {
  email: string;
  name: string;
  studioName: string;
}): Promise<void> {
  await sendEmail({
    to: { email: params.email, name: params.name },
    subject: `Session cancelled — ${params.studioName}`,
    htmlContent: `
      <div style="font-family:sans-serif;background:#0A0A0A;color:#e0e0e0;padding:40px 24px;max-width:520px;margin:auto;border-radius:12px;">
        <h2 style="color:#e05252;margin:0 0 16px;">Session Cancelled</h2>
        <p style="margin:0 0 16px;">Hi ${params.name}, your session at <strong>${params.studioName}</strong> has been cancelled.</p>
        <p style="margin:0;font-size:13px;color:#888;">If you'd like to reschedule, please reach out to the studio directly.</p>
      </div>`,
    replyTo: { email: FROM_EMAIL(), name: FROM_NAME() },
    tags: ["intake", "cancelled"],
  });
}

// 45-day inactive — churn prevention (subscription renewal warning)
export async function sendReEngagement45DayEmail(
  user:         { email: string; name: string },
  subscription: { tier: string; renewsAt: Date; amountCents: number },
): Promise<void> {
  const tierLabel  = subscription.tier.charAt(0) + subscription.tier.slice(1).toLowerCase();
  const renewDate  = subscription.renewsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const amount     = `$${(subscription.amountCents / 100).toFixed(0)}`;

  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Your <strong style="color:#fff;">${tierLabel}</strong> subscription renews on <strong style="color:#fff;">${renewDate}</strong> for <strong style="color:#D4A843;">${amount}/mo</strong>.</p>
    <p style="margin:0;font-size:14px;color:#888;line-height:1.7;">If IndieThis isn't working for you, we want to fix that. Reply and tell us what's missing — or if you'd like to pause, you can manage your subscription below.</p>`;

  await sendEmail({
    to:          { email: user.email, name: user.name },
    subject:     "Your next month is coming up",
    replyTo:     { email: process.env.BREVO_REPLY_TO ?? "hello@indiethis.com" },
    tags:        ["re-engagement", "45day", "churn-prevention"],
    htmlContent: reEngagementBase(body, "Manage Subscription →", `${APP_URL()}/dashboard/settings`),
  });
}

// ---------------------------------------------------------------------------
// AI tool completion emails
// ---------------------------------------------------------------------------

export async function sendCoverArtCompleteEmail(params: {
  artistEmail: string;
  artistName:  string;
  artistSlug?: string;
  trackTitle:  string;
  artUrl:      string;
}): Promise<void> {
  await sendBrandedEmail({
    to:      { email: params.artistEmail, name: params.artistName },
    subject: `Your cover art for "${params.trackTitle}" is ready`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Your Cover Art is Ready!</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hi ${params.artistName}, your AI-generated cover art for
        <strong style="color:#fff;">&ldquo;${params.trackTitle}&rdquo;</strong> is ready to use.
      </p>
      <a href="${params.artUrl}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        View Your Cover Art &rarr;
      </a>
    `,
    context:  "COVER_ART_COMPLETE",
    userData: { artistSlug: params.artistSlug },
    tags:     ["ai", "cover-art", "complete"],
  });
}

export async function sendMasteringCompleteEmail(params: {
  artistEmail:  string;
  artistName:   string;
  artistSlug?:  string;
  trackTitle:   string;
  downloadUrl:  string;
}): Promise<void> {
  await sendBrandedEmail({
    to:      { email: params.artistEmail, name: params.artistName },
    subject: `Mastering complete — "${params.trackTitle}" is ready`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Mastering Complete!</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hi ${params.artistName}, your AI-mastered version of
        <strong style="color:#fff;">&ldquo;${params.trackTitle}&rdquo;</strong> is ready to download.
      </p>
      <a href="${params.downloadUrl}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Download Mastered Track &rarr;
      </a>
    `,
    context:  "MASTERING_COMPLETE",
    userData: { artistSlug: params.artistSlug },
    tags:     ["ai", "mastering", "complete"],
  });
}

export async function sendVocalRemovalCompleteEmail(params: {
  artistEmail:  string;
  artistName:   string;
  artistSlug?:  string;
  trackTitle:   string;
  downloadUrl:  string;
}): Promise<void> {
  await sendBrandedEmail({
    to:      { email: params.artistEmail, name: params.artistName },
    subject: `Stems ready — "${params.trackTitle}" vocal removal complete`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Your Stems are Ready!</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hi ${params.artistName}, the vocal and instrumental stems for
        <strong style="color:#fff;">&ldquo;${params.trackTitle}&rdquo;</strong> have been separated and are ready to download.
      </p>
      <a href="${params.downloadUrl}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Download Stems &rarr;
      </a>
    `,
    context:  "VOCAL_REMOVAL_COMPLETE",
    userData: { artistSlug: params.artistSlug },
    tags:     ["ai", "vocal-removal", "complete"],
  });
}

export async function sendLyricVideoCompleteEmail(params: {
  artistEmail:  string;
  artistName:   string;
  artistSlug?:  string;
  trackTitle:   string;
  videoUrl:     string;
}): Promise<void> {
  await sendBrandedEmail({
    to:      { email: params.artistEmail, name: params.artistName },
    subject: `Lyric video ready — "${params.trackTitle}"`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Your Lyric Video is Ready!</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hi ${params.artistName}, your lyric video for
        <strong style="color:#fff;">&ldquo;${params.trackTitle}&rdquo;</strong> has been generated.
      </p>
      <a href="${params.videoUrl}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        View Lyric Video &rarr;
      </a>
    `,
    context:  "LYRIC_VIDEO_COMPLETE",
    userData: { artistSlug: params.artistSlug },
    tags:     ["ai", "lyric-video", "complete"],
  });
}

export async function sendPressKitCompleteEmail(params: {
  artistEmail:  string;
  artistName:   string;
  artistSlug?:  string;
  pressKitUrl:  string;
}): Promise<void> {
  await sendBrandedEmail({
    to:      { email: params.artistEmail, name: params.artistName },
    subject: "Your IndieThis press kit is ready",
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Your Press Kit is Ready!</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hi ${params.artistName}, your AI-generated press kit is complete and ready to share with
        blogs, playlist curators, and industry contacts.
      </p>
      <a href="${params.pressKitUrl}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        View Press Kit &rarr;
      </a>
    `,
    context:  "PRESS_KIT_COMPLETE",
    userData: { artistSlug: params.artistSlug },
    tags:     ["ai", "press-kit", "complete"],
  });
}

export async function sendTrackShieldCompleteEmail(params: {
  artistEmail:    string;
  artistName:     string;
  artistSlug?:    string;
  trackTitle:     string;
  issuesFound:    number;
  reportUrl:      string;
}): Promise<void> {
  const issueText = params.issuesFound === 0
    ? "No unauthorized uses were found — your music is clear."
    : `${params.issuesFound} potential issue${params.issuesFound !== 1 ? "s" : ""} found. Review the full report for details.`;

  await sendBrandedEmail({
    to:      { email: params.artistEmail, name: params.artistName },
    subject: `Track Shield scan complete — "${params.trackTitle}"`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Track Shield Scan Complete</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hi ${params.artistName}, your Track Shield scan for
        <strong style="color:#fff;">&ldquo;${params.trackTitle}&rdquo;</strong> has finished.
      </p>
      <div style="background:#1A1A1A;border:1px solid #222;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
        <p style="color:${params.issuesFound === 0 ? "#4ade80" : "#E85D4A"};font-size:14px;font-weight:700;margin:0;">
          ${issueText}
        </p>
      </div>
      <a href="${params.reportUrl}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        View Full Report &rarr;
      </a>
    `,
    context:  "TRACK_SHIELD_COMPLETE",
    userData: { artistSlug: params.artistSlug },
    tags:     ["ai", "track-shield", "complete"],
  });
}

// ---------------------------------------------------------------------------
// Beat purchase receipt (to buyer)
// ---------------------------------------------------------------------------

export async function sendBeatPurchaseReceiptEmail(params: {
  buyerEmail:    string;
  buyerName?:    string;
  beatTitle:     string;
  producerName:  string;
  producerSlug?: string;
  licenseType:   string;
  amount:        number; // cents
  downloadUrl:   string;
}): Promise<void> {
  const dollar = (params.amount / 100).toFixed(2);
  await sendBrandedEmail({
    to:      { email: params.buyerEmail, name: params.buyerName },
    subject: `Your beat license: "${params.beatTitle}"`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Beat License Confirmed!</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        You&rsquo;ve licensed <strong style="color:#fff;">&ldquo;${params.beatTitle}&rdquo;</strong>
        by <strong style="color:#fff;">${params.producerName}</strong>.
      </p>
      <div style="background:#1A1A1A;border:1px solid #222;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
        <p style="color:#888;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">License Type</p>
        <p style="color:#fff;font-size:15px;font-weight:700;margin:0 0 8px;">${params.licenseType}</p>
        <p style="color:#888;font-size:12px;margin:0 0 4px;">Amount paid</p>
        <p style="color:#D4A843;font-size:20px;font-weight:700;margin:0;">$${dollar}</p>
      </div>
      <a href="${params.downloadUrl}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Download Beat &rarr;
      </a>
      <p style="color:#666;font-size:12px;margin:16px 0 0;">
        Keep this email as your license record. Need help? <a href="mailto:support@indiethis.com" style="color:#D4A843;">support@indiethis.com</a>
      </p>
    `,
    context:  "BEAT_PURCHASE_RECEIPT",
    userData: { artistSlug: params.producerSlug },
    tags:     ["beat", "license", "purchase"],
  });
}

// ---------------------------------------------------------------------------
// Fan funding received (to artist)
// ---------------------------------------------------------------------------

export async function sendFanFundingReceivedEmail(params: {
  artistEmail:   string;
  artistName:    string;
  artistSlug?:   string;
  fanName:       string | null;
  amount:        number; // cents
  totalCredits?: number;
}): Promise<void> {
  const dollar    = (params.amount / 100).toFixed(2);
  const fromWho   = params.fanName || "An anonymous fan";
  await sendBrandedEmail({
    to:      { email: params.artistEmail, name: params.artistName },
    subject: `${fromWho} just supported you with $${dollar}!`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Someone Supported You! &#x1F4B8;</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hi ${params.artistName}, <strong style="color:#fff;">${fromWho}</strong> just sent you a contribution.
      </p>
      <div style="background:#1A1A1A;border:1px solid #222;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
        <p style="color:#888;font-size:12px;margin:0 0 4px;">Amount received</p>
        <p style="color:#D4A843;font-size:24px;font-weight:700;margin:0;">$${dollar}</p>
        ${params.totalCredits !== undefined ? `
        <p style="color:#888;font-size:12px;margin:8px 0 0;">
          Your new platform credit balance: <strong style="color:#fff;">${params.totalCredits} credits</strong>
        </p>` : ""}
      </div>
      <a href="${APP_URL()}/dashboard/earnings" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        View Your Balance &rarr;
      </a>
    `,
    context:  "FAN_FUNDING_RECEIVED",
    userData: { artistSlug: params.artistSlug },
    tags:     ["fan-funding", "received"],
  });
}

// ---------------------------------------------------------------------------
// Invoice sent (to artist/client)
// ---------------------------------------------------------------------------

export async function sendInvoiceEmail(params: {
  recipientEmail: string;
  recipientName:  string;
  senderName:     string;
  invoiceId:      string;
  amount:         string;
  dueDate:        string;
  invoiceUrl:     string;
}): Promise<void> {
  await sendBrandedEmail({
    to:      { email: params.recipientEmail, name: params.recipientName },
    subject: `Invoice from ${params.senderName} — ${params.amount} due ${params.dueDate}`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Invoice from ${params.senderName}</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hi ${params.recipientName}, you have a new invoice from <strong style="color:#fff;">${params.senderName}</strong>.
      </p>
      <div style="background:#1A1A1A;border:1px solid #222;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
        <p style="color:#888;font-size:12px;margin:0 0 4px;">Invoice #${params.invoiceId.slice(-8).toUpperCase()}</p>
        <p style="color:#D4A843;font-size:24px;font-weight:700;margin:0 0 8px;">${params.amount}</p>
        <p style="color:#888;font-size:12px;margin:0;">Due: <strong style="color:#ccc;">${params.dueDate}</strong></p>
      </div>
      <a href="${params.invoiceUrl}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        View Invoice &rarr;
      </a>
    `,
    noPromotion: true,
    tags:        ["invoice", "billing"],
  });
}

// ---------------------------------------------------------------------------
// Studio session follow-up
// ---------------------------------------------------------------------------

export async function sendSessionFollowUpEmail(params: {
  artistEmail:   string;
  artistName:    string;
  studioName:    string;
  sessionDate:   string;
  followUpUrl:   string;
}): Promise<void> {
  await sendBrandedEmail({
    to:      { email: params.artistEmail, name: params.artistName },
    subject: `How was your session at ${params.studioName}?`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">How Was Your Session?</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hi ${params.artistName}, just checking in after your session at
        <strong style="color:#fff;">${params.studioName}</strong> on ${params.sessionDate}.
        Hope it was productive!
      </p>
      <a href="${params.followUpUrl}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Leave a Review &rarr;
      </a>
    `,
    context: "SESSION_FOLLOWUP",
    tags:    ["session", "follow-up"],
  });
}
