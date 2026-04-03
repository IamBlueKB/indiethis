import { NextRequest, NextResponse } from "next/server";
import { buildEmailTemplate } from "@/lib/brevo/email-template";

/**
 * DEV ONLY — renders a sample branded email in the browser.
 * GET /api/dev/email-preview?context=MERCH_ORDER_CONFIRMATION
 *
 * Remove this file before going to production (or gate it behind NODE_ENV check).
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const context = req.nextUrl.searchParams.get("context") ?? "MERCH_ORDER_CONFIRMATION";

  const primaryContent = getSampleContent(context);

  const html = buildEmailTemplate({
    primaryContent,
    context,
    userData: {
      artistSlug:   "jay-nova",
      referralSlug: "jay-nova",
      unsubscribeUrl: "https://indiethis.com/settings",
    },
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function getSampleContent(context: string): string {
  switch (context) {
    case "MERCH_ORDER_CONFIRMATION":
      return `
        <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Order Confirmed ✓</h1>
        <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
          Hi Alex, thanks for supporting <strong style="color:#fff;">Jay Nova</strong>! Your order has been received.
        </p>
        <p style="color:#D4A843;font-size:13px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">
          Order #A9F3C2E1
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
          <tbody style="color:#ccc;font-size:13px;">
            <tr><td style="padding:8px;">Classic Tee</td><td style="padding:8px;">M / Black</td><td style="padding:8px;">×1</td><td style="padding:8px;text-align:right;">$32.00</td></tr>
            <tr><td style="padding:8px;">Snapback Hat</td><td style="padding:8px;">One Size</td><td style="padding:8px;">×1</td><td style="padding:8px;text-align:right;">$38.00</td></tr>
          </tbody>
          <tfoot>
            <tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#888;font-size:13px;">Subtotal</td><td style="padding:6px 8px;text-align:right;color:#ccc;font-size:13px;">$70.00</td></tr>
            <tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#888;font-size:13px;">Shipping</td><td style="padding:6px 8px;text-align:right;color:#ccc;font-size:13px;">$5.99</td></tr>
            <tr style="border-top:1px solid #222;"><td colspan="3" style="padding:8px;text-align:right;color:#fff;font-weight:700;">Total</td><td style="padding:8px;text-align:right;color:#D4A843;font-weight:700;font-size:15px;">$75.99</td></tr>
          </tfoot>
        </table>
        <p style="color:#D4A843;font-size:13px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Shipping To</p>
        <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
          Alex Johnson<br>123 Main St<br>Brooklyn, NY 11201<br>United States
        </p>
        <a href="#" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
          Track Your Order →
        </a>
      `;

    case "SUBSCRIPTION_WELCOME":
      return `
        <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Welcome, Jay Nova!</h1>
        <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
          Your <strong style="color:#D4A843;">PUSH</strong> account is active.
          Start creating, selling, and growing.
        </p>
        <a href="#" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
          Go to Your Dashboard →
        </a>
      `;

    case "MASTERING_COMPLETE":
      return `
        <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Mastering Complete!</h1>
        <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
          Hi Jay Nova, your AI-mastered version of
          <strong style="color:#fff;">"Midnight Drive (feat. Aria)"</strong> is ready to download.
        </p>
        <a href="#" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
          Download Mastered Track →
        </a>
      `;

    case "FAN_FUNDING_RECEIVED":
      return `
        <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Someone Supported You! 💸</h1>
        <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
          Hi Jay Nova, <strong style="color:#fff;">Alex Johnson</strong> just sent you a contribution.
        </p>
        <div style="background:#1A1A1A;border:1px solid #222;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
          <p style="color:#888;font-size:12px;margin:0 0 4px;">Amount received</p>
          <p style="color:#D4A843;font-size:24px;font-weight:700;margin:0 0 8px;">$25.00</p>
          <p style="color:#888;font-size:12px;margin:0;">Your new platform credit balance: <strong style="color:#fff;">250 credits</strong></p>
        </div>
        <a href="#" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
          View Your Balance →
        </a>
      `;

    default:
      return `
        <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Notification</h1>
        <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">Context: <code style="color:#D4A843;">${context}</code></p>
        <a href="#" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
          View Dashboard →
        </a>
      `;
  }
}
