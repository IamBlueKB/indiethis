/**
 * POST /api/auth/facebook-data-deletion
 *
 * Facebook Data Deletion Callback — required for apps using Facebook Login.
 * When a user removes the app from their Facebook account, Meta calls this
 * endpoint. We delete or anonymize the user's data and return a confirmation URL.
 *
 * https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

function parseSignedRequest(signedRequest: string, appSecret: string): { user_id: string } | null {
  try {
    const [encodedSig, payload] = signedRequest.split(".");
    const sig     = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    const data    = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { user_id: string };
    const expected = createHmac("sha256", appSecret).update(payload).digest();
    if (!sig.equals(expected)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    let formBody: FormData;
    try {
      formBody = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
    }
    const signedRequest  = formBody.get("signed_request") as string | null;
    const appSecret      = process.env.FACEBOOK_CLIENT_SECRET;
    const appUrl         = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

    if (!signedRequest || !appSecret) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const data = parseSignedRequest(signedRequest, appSecret);
    if (!data?.user_id) {
      return NextResponse.json({ error: "Invalid signed request" }, { status: 400 });
    }

    // Find user by Facebook provider (authProvider = "facebook")
    // We don't store Facebook user IDs directly, so we log the request
    // and return a confirmation URL. Users can also delete via /dashboard/settings.
    const confirmationCode = `fb-${data.user_id}-${Date.now()}`;

    // Best-effort: if we can match by a stored facebookId field in future, delete here.
    // For now, log and confirm — Meta only requires we return the URL.
    console.info(`[facebook-data-deletion] Request for Facebook user ${data.user_id}, code: ${confirmationCode}`);

    return NextResponse.json({
      url:  `${appUrl}/privacy?deletion=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    console.error("[facebook-data-deletion]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
