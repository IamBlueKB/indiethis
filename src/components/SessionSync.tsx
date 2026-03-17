"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useUserStore } from "@/store";

export function SessionSync() {
  const { data: session, status } = useSession();
  const { setUser, clearUser } = useUserStore();

  useEffect(() => {
    if (status === "unauthenticated") {
      clearUser();
      return;
    }
    if (status !== "authenticated" || !session?.user?.id) return;

    fetch("/api/user/me")
      .then((r) => r.json())
      .then((profile) => {
        if (profile?.id) setUser(profile);
      })
      .catch(() => {/* silent */});
  }, [status, session?.user?.id, setUser, clearUser]);

  return null;
}
