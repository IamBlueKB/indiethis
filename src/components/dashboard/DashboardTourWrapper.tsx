"use client";

import { useState } from "react";
import { OnboardingTour } from "@/components/OnboardingTour";

interface DashboardTourWrapperProps {
  tourCompleted: boolean;
  role: "artist" | "studio";
}

export default function DashboardTourWrapper({ tourCompleted, role }: DashboardTourWrapperProps) {
  const [showTour, setShowTour] = useState(!tourCompleted);

  async function handleComplete() {
    setShowTour(false);
    await fetch("/api/dashboard/onboarding-complete", { method: "POST" });
  }

  return (
    <OnboardingTour
      showTour={showTour}
      onComplete={handleComplete}
      role={role}
    />
  );
}
