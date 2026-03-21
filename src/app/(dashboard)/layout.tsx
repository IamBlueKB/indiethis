import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import MiniPlayer from "@/components/audio/MiniPlayer";
import { GracePeriodBanner } from "@/components/dashboard/GracePeriodBanner";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ARTIST") {
    redirect("/login");
  }

  // Check for active grace period
  const gracePeriod = await db.promoRedemption.findFirst({
    where: {
      userId: session.user.id as string,
      status: "ACTIVE",
      graceUntil: { not: null, gt: new Date() },
    },
    select: { graceUntil: true },
    orderBy: { graceUntil: "asc" },
  });

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
      <DashboardSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <DashboardTopBar />
        {gracePeriod?.graceUntil && (
          <GracePeriodBanner graceUntil={gracePeriod.graceUntil.toISOString()} />
        )}
        {/* pb-20 leaves room for the fixed MiniPlayer when a track is loaded */}
        <main className="flex-1 overflow-y-auto p-6 pb-20">
          {children}
        </main>
      </div>
      {/* Persistent mini-player — survives client-side navigation */}
      <MiniPlayer />
    </div>
  );
}
