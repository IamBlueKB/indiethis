import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/brevo/email";

// POST /api/affiliate/apply
// Public — no auth required. Creates a PENDING Affiliate record and notifies admin.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name?: string;
      email?: string;
      creatorType?: string;
      socialLinks?: string;
      audienceSize?: string;
      promotionPlan?: string;
    };

    const { name, email, creatorType, socialLinks, audienceSize, promotionPlan } = body;

    if (!name?.trim() || !email?.trim() || !creatorType || !audienceSize || !promotionPlan?.trim()) {
      return NextResponse.json({ error: "All required fields must be filled in." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Prevent duplicate applications for the same email
    const existing = await db.affiliate.findFirst({
      where: { applicantEmail: normalizedEmail },
      select: { id: true, status: true },
    });

    if (existing) {
      const label =
        existing.status === "PENDING"   ? "already under review" :
        existing.status === "APPROVED"  ? "already approved" :
        existing.status === "REJECTED"  ? "not accepted at this time" :
        "on hold";
      return NextResponse.json(
        { error: `An application for this email is ${label}.` },
        { status: 409 }
      );
    }

    // Create the PENDING affiliate record — slug and discountCode are set at approval time
    await db.affiliate.create({
      data: {
        applicantName:  name.trim(),
        applicantEmail: normalizedEmail,
        status:         "PENDING",
        applicationData: {
          creatorType:   creatorType.trim(),
          socialLinks:   socialLinks?.trim() ?? "",
          audienceSize:  audienceSize.trim(),
          promotionPlan: promotionPlan.trim(),
        },
      },
    });

    // Notify admin — fire-and-forget; missing env var is not a fatal error
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    if (adminEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
      void sendEmail({
        to: { email: adminEmail, name: "IndieThis Admin" },
        subject: `New affiliate application — ${name.trim()}`,
        htmlContent: `
          <h2>New Affiliate Application</h2>
          <table cellpadding="4">
            <tr><td><strong>Name</strong></td><td>${name.trim()}</td></tr>
            <tr><td><strong>Email</strong></td><td>${normalizedEmail}</td></tr>
            <tr><td><strong>Creator type</strong></td><td>${creatorType}</td></tr>
            <tr><td><strong>Audience size</strong></td><td>${audienceSize}</td></tr>
            <tr><td><strong>Promotion plan</strong></td><td>${promotionPlan.trim()}</td></tr>
            ${socialLinks ? `<tr><td><strong>Social links</strong></td><td>${socialLinks.trim().replace(/\n/g, "<br>")}</td></tr>` : ""}
          </table>
          <p><a href="${appUrl}/admin/affiliates">Review in Admin Panel →</a></p>
        `,
        tags: ["affiliate", "application", "admin-alert"],
      }).catch(() => {
        // Non-critical — don't let a failed notification break the response
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[affiliate/apply] error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
