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

  const studio = await db.studio.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      studioTier: true,
      tierOverride: true,
      isPublished: true,
      isEnterprise: true,
      createdAt: true,
      description: true,
      bio: true,
      tagline: true,
      address: true,
      streetAddress: true,
      city: true,
      state: true,
      zipCode: true,
      phone: true,
      email: true,
      instagram: true,
      tiktok: true,
      youtube: true,
      facebook: true,
      template: true,
      accentColor: true,
      customDomain: true,
      stripePaymentsEnabled: true,
      generationsUsedThisMonth: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          lastLoginAt: true,
        },
      },
      _count: {
        select: {
          artists: true,
          sessions: true,
          contacts: true,
          emailCampaigns: true,
        },
      },
      sessions: {
        take: 5,
        orderBy: { dateTime: "desc" },
        select: {
          id: true,
          dateTime: true,
          status: true,
          paymentStatus: true,
          sessionType: true,
          contact: { select: { name: true } },
        },
      },
      emailCampaigns: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          subject: true,
          recipientCount: true,
          openCount: true,
          sentAt: true,
          createdAt: true,
        },
      },
      contacts: {
        select: { source: true },
      },
    },
  });

  if (!studio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Aggregate contact sources
  const contactSources: Record<string, number> = {};
  for (const c of studio.contacts) {
    contactSources[c.source] = (contactSources[c.source] ?? 0) + 1;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { contacts: _contacts, ...studioData } = studio;

  return NextResponse.json({ ...studioData, contactSources });
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
    description?: string;
    bio?: string;
    tagline?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    phone?: string;
    email?: string;
    instagram?: string;
    studioTier?: string;
    tierOverride?: string | null;
    isPublished?: boolean;
    isEnterprise?: boolean;
  };

  const { studioTier, tierOverride, ...rest } = body;

  const validTiers = ["PRO", "ELITE"];
  if (studioTier && !validTiers.includes(studioTier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  if (tierOverride !== undefined && tierOverride !== null && !validTiers.includes(tierOverride)) {
    return NextResponse.json({ error: "Invalid tierOverride" }, { status: 400 });
  }

  await db.studio.update({
    where: { id },
    data: {
      ...rest,
      ...(studioTier ? { studioTier: studioTier as "PRO" | "ELITE" } : {}),
      ...(tierOverride !== undefined ? { tierOverride: tierOverride ?? null } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
