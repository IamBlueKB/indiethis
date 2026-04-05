import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import StudioSidebar from "@/components/studio/StudioSidebar";
import StudioTopBar from "@/components/studio/StudioTopBar";
import DashboardTourWrapper from "@/components/dashboard/DashboardTourWrapper";
import type { ReactNode } from "react";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    redirect("/login");
  }

  // Onboarding gate — new studio users must complete setup first
  const onboardingCheck = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { signupPath: true, setupCompletedAt: true },
  });
  if (onboardingCheck?.signupPath && !onboardingCheck.setupCompletedAt) {
    redirect("/signup/setup");
  }

  const [studio, userFlags] = await Promise.all([
    db.studio.findFirst({
      where: { ownerId: session.user.id },
      select: { slug: true },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingTourCompleted: true },
    }),
  ]);

  const tourCompleted = userFlags?.onboardingTourCompleted ?? false;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
      <StudioSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <StudioTopBar studioSlug={studio?.slug ?? null} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Onboarding tour — shown once for new studio users */}
      <DashboardTourWrapper tourCompleted={tourCompleted} role="studio" />
    </div>
  );
}
