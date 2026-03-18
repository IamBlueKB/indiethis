import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { sendAffiliateApprovalEmail } from "@/lib/brevo/email";

/** Slugify a name: "John Doe" → "johndoe" */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

/** Generate a unique customSlug, appending a counter if needed */
async function generateUniqueSlug(base: string): Promise<string> {
  const candidate = slugify(base) || "affiliate";
  let slug = candidate;
  let n = 1;
  while (await db.affiliate.findUnique({ where: { customSlug: slug } })) {
    slug = `${candidate}${n}`;
    n++;
  }
  return slug;
}

/** Generate a unique discount code: INDIE + up to 8 chars of slug uppercased */
async function generateUniqueDiscountCode(slug: string): Promise<string> {
  const base = `INDIE${slug.toUpperCase().slice(0, 8)}`;
  let code = base;
  let n = 1;
  while (await db.affiliate.findUnique({ where: { discountCode: code } })) {
    code = `${base}${n}`;
    n++;
  }
  return code;
}

// POST /api/admin/affiliates/[id]/approve
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const affiliate = await db.affiliate.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      applicantName: true,
      applicantEmail: true,
      customSlug: true,
      discountCode: true,
    },
  });

  if (!affiliate) {
    return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
  }
  if (affiliate.status === "APPROVED") {
    return NextResponse.json({ error: "Already approved." }, { status: 409 });
  }

  // Generate slug and code if not yet set
  const customSlug   = affiliate.customSlug   ?? await generateUniqueSlug(affiliate.applicantName);
  const discountCode = affiliate.discountCode ?? await generateUniqueDiscountCode(customSlug);

  const updated = await db.affiliate.update({
    where: { id },
    data: {
      status:       "APPROVED",
      customSlug,
      discountCode,
      approvedAt:   new Date(),
    },
  });

  // Send approval email — non-fatal if it fails
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
  await sendAffiliateApprovalEmail({
    name:          affiliate.applicantName,
    email:         affiliate.applicantEmail,
    customSlug,
    discountCode,
    affiliateLink: `${appUrl}/go/${customSlug}`,
    dashboardUrl:  `${appUrl}/affiliate/dashboard`,
  }).catch((err: unknown) => {
    console.error("[affiliate/approve] approval email failed:", err);
  });

  return NextResponse.json({ ok: true, affiliate: updated });
}
