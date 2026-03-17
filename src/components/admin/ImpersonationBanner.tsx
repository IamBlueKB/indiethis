"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function parseMeta(): { userId: string; userName: string } | null {
  try {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith("impersonation_meta="))
      ?.split("=")
      .slice(1)
      .join("=");
    return raw ? (JSON.parse(decodeURIComponent(raw)) as { userId: string; userName: string }) : null;
  } catch {
    return null;
  }
}

export default function ImpersonationBanner() {
  const [meta, setMeta] = useState<{ userId: string; userName: string } | null>(null);
  const [exiting, setExiting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMeta(parseMeta());
  }, []);

  if (!meta) return null;

  async function handleExit() {
    setExiting(true);
    await fetch("/api/admin/impersonate/exit", { method: "POST" });
    router.push("/admin/users");
    router.refresh();
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-4 px-4 py-2.5 text-sm font-semibold text-white"
      style={{ backgroundColor: "#E85D4A" }}
    >
      <span>
        👁 Viewing as <strong>{meta.userName}</strong> — admin impersonation active
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="px-3 py-1 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-60"
      >
        {exiting ? "Exiting…" : "Exit"}
      </button>
    </div>
  );
}
