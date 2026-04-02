/**
 * Shared HTML template builder for all IndieThis transactional emails.
 * Provides: logo header, content area, contextual feature promotion,
 * What's New rotating section, and consistent footer.
 */

import { getFeaturePromotion, type PromotionUserData } from "./email-promotions";
import { getWhatsNew } from "./whats-new";

const APP_URL = "https://indiethis.com";

export type TemplateUserData = PromotionUserData;

export function buildEmailTemplate(options: {
  /** The core email message — rendered inside the dark content card. */
  primaryContent: string;
  /** Email context key — determines which feature promotion to show. */
  context?:       string;
  /** Per-user data for footer personalisation and promo links. */
  userData?:      TemplateUserData;
  /**
   * Set true for purely transactional emails (password reset, invoices)
   * where a feature promotion would feel out of place.
   */
  noPromotion?:   boolean;
}): string {
  const promotion = !options.noPromotion && options.context
    ? getFeaturePromotion(options.context, options.userData ?? {})
    : null;

  const whatsNew       = getWhatsNew();
  const referralSlug   = options.userData?.referralSlug;
  const unsubscribeUrl = options.userData?.unsubscribeUrl ?? `${APP_URL}/settings`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="background:#0A0A0A;margin:0;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">

    <!-- Header: IndieThis wordmark -->
    <tr>
      <td style="padding:24px;text-align:center;">
        <span style="font-size:22px;font-weight:700;color:#D4A843;letter-spacing:-0.5px;font-family:Arial,Helvetica,sans-serif;">IndieThis</span>
      </td>
    </tr>

    <!-- Primary Content -->
    <tr>
      <td style="background:#111111;border-radius:12px;padding:32px 24px;">
        ${options.primaryContent}
      </td>
    </tr>

    <!-- Divider -->
    <tr>
      <td style="padding:20px 0;">
        <hr style="border:none;border-top:1px solid #1A1A1A;margin:0;">
      </td>
    </tr>

    ${promotion ? `
    <!-- Contextual Feature Promotion -->
    <tr>
      <td style="padding:0 24px 8px;">
        <p style="color:#D4A843;font-size:12px;font-weight:700;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:0.5px;">${promotion.heading}</p>
        <p style="color:#888;font-size:13px;margin:0 0 14px 0;line-height:1.6;">${promotion.text}</p>
        <a href="${promotion.ctaUrl}" style="background:#E85D4A;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:700;font-size:13px;display:inline-block;">${promotion.ctaText} &rarr;</a>
      </td>
    </tr>

    <!-- Divider -->
    <tr>
      <td style="padding:20px 0;">
        <hr style="border:none;border-top:1px solid #1A1A1A;margin:0;">
      </td>
    </tr>
    ` : ""}

    <!-- What's New -->
    <tr>
      <td style="padding:0 24px 16px;">
        <p style="color:#D4A843;font-size:13px;font-weight:700;margin:0 0 6px 0;">What&rsquo;s New on IndieThis</p>
        <p style="color:#888;font-size:13px;margin:0;line-height:1.6;">${whatsNew}</p>
      </td>
    </tr>

    <!-- Divider -->
    <tr>
      <td style="padding:12px 0;">
        <hr style="border:none;border-top:1px solid #1A1A1A;margin:0;">
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:24px;text-align:center;">
        <p style="color:#666;font-size:12px;margin:0 0 8px;">
          <a href="https://instagram.com/indiethisofficial" style="color:#D4A843;text-decoration:none;">Instagram</a>
          &nbsp;&middot;&nbsp;
          <a href="${APP_URL}" style="color:#D4A843;text-decoration:none;">Website</a>
        </p>
        ${referralSlug ? `
        <p style="color:#666;font-size:12px;margin:0 0 8px;">
          Know someone who should be on IndieThis?
          <a href="${APP_URL}/ref/${referralSlug}" style="color:#D4A843;text-decoration:none;">Share your referral link</a>
        </p>` : ""}
        <p style="color:#444;font-size:11px;margin:0;">
          &copy; 2026 IndieThis &nbsp;&middot;&nbsp;
          <a href="${APP_URL}/privacy" style="color:#444;text-decoration:none;">Privacy</a>
          &nbsp;&middot;&nbsp;
          <a href="${unsubscribeUrl}" style="color:#444;text-decoration:none;">Unsubscribe</a>
        </p>
      </td>
    </tr>

  </table>
</body>
</html>`;
}
