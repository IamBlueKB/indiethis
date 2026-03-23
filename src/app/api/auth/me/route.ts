import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ loggedIn: false, hasSubscription: false });
  }

  const sub = await db.subscription.findUnique({
    where:  { userId: session.user.id },
    select: { status: true },
  });

  const hasSubscription = sub?.status === "ACTIVE" || sub?.status === "PAST_DUE";

  return NextResponse.json({ loggedIn: true, hasSubscription });
}
