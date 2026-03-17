import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [user, subscription, studio] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        photo: true,
        artistSlug: true,
        stripeCustomerId: true,
        role: true,
      },
    }),
    db.subscription.findUnique({
      where: { userId },
      select: { tier: true, aiVideoCreditsUsed: true, aiVideoCreditsLimit: true },
    }),
    db.studio.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    }),
  ]);

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tier =
    user.role === "STUDIO_ADMIN"
      ? "studio"
      : ((subscription?.tier?.toLowerCase() ?? "launch") as string);

  const aiCreditsRemaining = subscription
    ? Math.max(0, subscription.aiVideoCreditsLimit - subscription.aiVideoCreditsUsed)
    : 0;

  return NextResponse.json({
    id: user.id,
    email: user.email,
    displayName: user.name,
    avatarUrl: user.photo ?? null,
    tier,
    aiCreditsRemaining,
    studioId: studio?.id ?? null,
    artistPageSlug: user.artistSlug ?? null,
    stripeCustomerId: user.stripeCustomerId ?? null,
    onboardingComplete: true,
  });
}
