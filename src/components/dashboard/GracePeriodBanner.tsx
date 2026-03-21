"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface GracePeriodBannerProps {
  graceUntil: string; // ISO string
}

export function GracePeriodBanner({ graceUntil }: GracePeriodBannerProps) {
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(graceUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-3 text-sm font-medium"
      style={{ backgroundColor: "#E85D4A", color: "#fff" }}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="shrink-0" />
        <span>
          Your trial ended.{" "}
          {daysLeft > 0
            ? `You have ${daysLeft} day${daysLeft !== 1 ? "s" : ""} to subscribe before your account is locked.`
            : "Subscribe now to restore your access."}
        </span>
      </div>
      <Link
        href="/dashboard/upgrade"
        className="shrink-0 px-4 py-1.5 rounded-lg text-sm font-bold no-underline transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#fff", color: "#E85D4A" }}
      >
        Subscribe Now →
      </Link>
    </div>
  );
}
