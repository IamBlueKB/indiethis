import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [user, aiBreakdown, merchData, beatLicenses, totalBeatLicenses, totalMerchOrders] =
    await Promise.all([
      db.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          photo: true,
          bio: true,
          artistName: true,
          instagramHandle: true,
          tiktokHandle: true,
          spotifyUrl: true,
          appleMusicUrl: true,
          youtubeChannel: true,
          stripeCustomerId: true,
          createdAt: true,
          lastLoginAt: true,
          isComped: true,
          compExpiresAt: true,
          isSuspended: true,
          subscription: {
            select: {
              id: true,
              tier: true,
              status: true,
              createdAt: true,
              canceledAt: true,
              cancelReason: true,
              currentPeriodEnd: true,
              stripeSubscriptionId: true,
            },
          },
          _count: {
            select: {
              sessions: true,
              aiGenerations: true,
              tracks: true,
              receipts: true,
              merchProducts: true,
              producerLicenses: true,
            },
          },
          sessions: {
            take: 20,
            orderBy: { dateTime: "desc" },
            select: {
              id: true,
              dateTime: true,
              status: true,
              paymentStatus: true,
              sessionType: true,
              studio: { select: { id: true, name: true, slug: true } },
            },
          },
          aiGenerations: {
            take: 20,
            orderBy: { createdAt: "desc" },
            select: { id: true, type: true, status: true, createdAt: true },
          },
          receipts: {
            take: 20,
            orderBy: { createdAt: "desc" },
            select: { id: true, type: true, description: true, amount: true, createdAt: true },
          },
          artistSite: {
            select: {
              id: true,
              template: true,
              isPublished: true,
              draftMode: true,
              customDomain: true,
              showMusic: true,
              showVideos: true,
              showMerch: true,
              showContact: true,
              followGateEnabled: true,
            },
          },
          tracks: {
            take: 5,
            orderBy: { createdAt: "desc" },
            select: { id: true, title: true, status: true, plays: true, downloads: true, earnings: true, createdAt: true },
          },
          merchProducts: {
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              productType: true,
              basePrice: true,
              isActive: true,
              _count: { select: { orders: true } },
            },
          },
          ownedStudios: {
            select: {
              id: true,
              name: true,
              slug: true,
              studioTier: true,
              tierOverride: true,
              isPublished: true,
              createdAt: true,
              _count: { select: { artists: true, sessions: true, contacts: true, emailCampaigns: true } },
            },
          },
          artistLicenses: {
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              licenseType: true,
              price: true,
              status: true,
              createdAt: true,
              track: { select: { title: true } },
            },
          },
        },
      }),
      // AI usage breakdown by tool type
      db.aIGeneration.groupBy({
        by: ["type"],
        where: { artistId: id },
        _count: { type: true },
        orderBy: { _count: { type: "desc" } },
      }),
      // Merch products for this user
      Promise.resolve(null), // placeholder — already fetched via user.merchProducts
      // Beat licenses purchased by this user
      db.beatLicense.findMany({
        where: { artistId: id },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, licenseType: true, price: true, createdAt: true, track: { select: { title: true } } },
      }),
      db.beatLicense.count({ where: { artistId: id } }),
      db.merchOrder.count({ where: { artistId: id } }),
    ]);

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...user,
    aiBreakdown,       // [{ type: "VIDEO", _count: { type: 3 } }, ...]
    beatLicenses,      // beats this user has licensed (as artist/buyer)
    totalBeatLicenses, // total purchased
    totalMerchOrders,  // total merch orders from their products
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const body = (await req.json()) as {
    name?: string;
    email?: string;
    bio?: string;
    artistName?: string;
    instagramHandle?: string;
    tiktokHandle?: string;
    spotifyUrl?: string;
    appleMusicUrl?: string;
    youtubeChannel?: string;
    role?: string;
    isSuspended?: boolean;
    isComped?: boolean;
    compExpiresAt?: string | null;
    subscriptionTier?: string;
    subscriptionStatus?: string;
  };

  const { subscriptionTier, subscriptionStatus, compExpiresAt, role, isComped, ...rest } = body;

  const validRoles = ["ARTIST", "STUDIO_ADMIN", "PLATFORM_ADMIN"];
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  await db.user.update({
    where: { id },
    data: {
      ...rest,
      ...(role ? { role: role as "ARTIST" | "STUDIO_ADMIN" | "PLATFORM_ADMIN" } : {}),
      ...(typeof isComped !== "undefined"
        ? { isComped, compExpiresAt: isComped && compExpiresAt ? new Date(compExpiresAt) : null }
        : {}),
    },
  });

  if (subscriptionTier || subscriptionStatus) {
    const validTiers = ["LAUNCH", "PUSH", "REIGN"];
    const validStatuses = ["ACTIVE", "PAST_DUE", "CANCELLED"];
    if (subscriptionTier && !validTiers.includes(subscriptionTier))
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    if (subscriptionStatus && !validStatuses.includes(subscriptionStatus))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    await db.subscription.updateMany({
      where: { userId: id },
      data: {
        ...(subscriptionTier ? { tier: subscriptionTier as "LAUNCH" | "PUSH" | "REIGN" } : {}),
        ...(subscriptionStatus ? { status: subscriptionStatus as "ACTIVE" | "PAST_DUE" | "CANCELLED" } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
