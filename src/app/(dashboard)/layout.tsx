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

  const userId = session.user.id as string;

  // Onboarding gate — new users must complete setup before accessing dashboard
  const onboardingCheck = await db.user.findUnique({
    where:  { id: userId },
    select: { signupPath: true, setupCompletedAt: true },
  });
  if (onboardingCheck?.signupPath && !onboardingCheck.setupCompletedAt) {
    redirect("/signup/setup");
  }

  const [beatCount, producerLeaseCount, gracePeriod] = await Promise.all([
    // Count beats — tracks that have a BeatLeaseSettings record
    db.beatLeaseSettings.count({ where: { beat: { artistId: userId } } }),
    db.streamLease.count({ where: { producerId: userId } }),
    db.promoRedemption.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        graceUntil: { not: null, gt: new Date() },
      },
      select: { graceUntil: true },
      orderBy: { graceUntil: "asc" },
    }),
  ]);

const hasProducerActivity = beatCount > 0;
  const hasProducerStreamLeases = producerLeaseCount > 0;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
      <DashboardSidebar
        hasProducerActivity={hasProducerActivity}
        hasProducerStreamLeases={hasProducerStreamLeases}
      />
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
