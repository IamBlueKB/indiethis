"use client";

import { useState, useEffect } from "react";
import { Joyride, EventData, STATUS } from "react-joyride";

interface OnboardingTourProps {
  showTour: boolean;
  onComplete: () => void;
  role: "artist" | "studio";
}

const artistSteps = [
  {
    target: "[data-tour='music']",
    content: "Upload your first track to get started",
    disableBeacon: true,
    placement: "right" as const,
  },
  {
    target: "[data-tour='ai-tools']",
    content: "AI tools to create cover art, videos, and more",
    placement: "right" as const,
  },
  {
    target: "[data-tour='merch']",
    content: "Set up your merch store — we handle printing and shipping",
    placement: "right" as const,
  },
  {
    target: "[data-tour='site']",
    content: "Your public page is live — customize and share it",
    placement: "right" as const,
  },
  {
    target: "[data-tour='explore']",
    content: "Discover other artists and get discovered",
    placement: "bottom" as const,
  },
];

const studioSteps = [
  {
    target: "[data-tour='bookings']",
    content: "Manage bookings and client sessions here",
    disableBeacon: true,
    placement: "right" as const,
  },
  {
    target: "[data-tour='contacts']",
    content: "Your CRM — track every client interaction",
    placement: "right" as const,
  },
  {
    target: "[data-tour='invoices']",
    content: "Create and send invoices with one click",
    placement: "right" as const,
  },
  {
    target: "[data-tour='studio-ai']",
    content: "AI tools for your studio and roster artists",
    placement: "right" as const,
  },
  {
    target: "[data-tour='studio-settings']",
    content: "Set up your public studio page",
    placement: "right" as const,
  },
];

export function OnboardingTour({ showTour, onComplete, role }: OnboardingTourProps) {
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (showTour) {
      // Small delay so the dashboard fully renders before tour starts
      const timer = setTimeout(() => setRun(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [showTour]);

  const handleEvent = (data: EventData) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      onComplete();
    }
  };

  if (!showTour) return null;

  const steps = role === "studio" ? studioSteps : artistSteps;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      onEvent={handleEvent}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        skip: "Skip tour",
      }}
      options={{
        backgroundColor:  "#111111",
        textColor:        "#ffffff",
        primaryColor:     "#D4A843",
        arrowColor:       "#111111",
        overlayColor:     "rgba(0, 0, 0, 0.7)",
        zIndex:           1000,
        showProgress:     true,
        spotlightRadius:  8,
        buttons:          ["back", "skip", "primary"],
      }}
      styles={{
        tooltip: {
          borderRadius: 12,
          padding: "16px 20px",
          fontSize: 14,
          fontFamily: "DM Sans, sans-serif",
        },
        tooltipContent: {
          padding: "8px 0",
          fontSize: 14,
          lineHeight: 1.5,
        },
        buttonPrimary: {
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          padding: "8px 16px",
        } as React.CSSProperties,
        buttonBack: {
          color: "#888888",
          fontSize: 13,
        },
        buttonSkip: {
          color: "#666666",
          fontSize: 12,
        },
      }}
    />
  );
}
