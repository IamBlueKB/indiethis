import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET — return djProfile info for the user (used to populate admin user detail page)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: id },
    select: {
      id: true,
      slug: true,
      isVerified: true,
      verificationStatus: true,
      verifiedAt: true,
    },
  });

  return NextResponse.json({ djProfile: djProfile ?? null });
}

// PATCH — verify or revoke a DJ's verification
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { action: "verify" | "revoke" };
  const { action } = body;

  if (action !== "verify" && action !== "revoke")
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: id },
    select: { id: true },
  });

  if (!djProfile)
    return NextResponse.json({ error: "DJ profile not found for this user" }, { status: 404 });

  const now = new Date();
  const adminName = session.name ?? session.email ?? "Admin";

  const updated = await db.dJProfile.update({
    where: { id: djProfile.id },
    data:
      action === "verify"
        ? {
            isVerified: true,
            verificationStatus: "APPROVED",
            verifiedAt: now,
            verifiedBy: adminName,
          }
        : {
            isVerified: false,
            verificationStatus: "NONE",
            verifiedAt: null,
            verifiedBy: null,
          },
    select: {
      id: true,
      slug: true,
      isVerified: true,
      verificationStatus: true,
      verifiedAt: true,
    },
  });

  return NextResponse.json({ djProfile: updated });
}
