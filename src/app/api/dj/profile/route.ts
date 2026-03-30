import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/dj/profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await db.dJProfile.findUnique({
    where: { userId: session.user.id as string },
    select: {
      id: true,
      slug: true,
      bio: true,
      genres: true,
      city: true,
      profilePhotoUrl: true,
      socialLinks: true,
      isVerified: true,
      verificationStatus: true,
      balance: true,
      totalEarnings: true,
    },
  });

  if (!profile) return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  return NextResponse.json({ profile });
}

// PUT /api/dj/profile
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Require djMode on the user
  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { djMode: true },
  });
  if (!user?.djMode) return NextResponse.json({ error: "DJ mode not enabled" }, { status: 403 });

  const body = await req.json();
  const { bio, genres, city, profilePhotoUrl, socialLinks } = body;

  const updateData: Record<string, unknown> = {};
  if (bio !== undefined) updateData.bio = bio;
  if (genres !== undefined) updateData.genres = genres;
  if (city !== undefined) updateData.city = city;
  if (profilePhotoUrl !== undefined) updateData.profilePhotoUrl = profilePhotoUrl;
  if (socialLinks !== undefined) updateData.socialLinks = socialLinks;

  const profile = await db.dJProfile.update({
    where: { userId: session.user.id as string },
    data: updateData,
    select: {
      id: true,
      slug: true,
      bio: true,
      genres: true,
      city: true,
      profilePhotoUrl: true,
      socialLinks: true,
      isVerified: true,
      verificationStatus: true,
      balance: true,
      totalEarnings: true,
    },
  });

  return NextResponse.json({ profile });
}
