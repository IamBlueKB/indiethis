import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "PLATFORM_ADMIN") redirect("/login");

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      artistName: true,
      createdAt: true,
      subscription: { select: { tier: true, status: true } },
      _count: { select: { sessions: true, tracks: true } },
    },
  });

  const ROLE_COLOR: Record<string, string> = {
    ARTIST: "#5AC8FA", STUDIO_ADMIN: "#D4A843", PLATFORM_ADMIN: "#E85D4A",
  };

  const TIER_COLOR: Record<string, string> = {
    LAUNCH: "#888", PUSH: "#D4A843", REIGN: "#34C759",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} registered users</p>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="grid grid-cols-[1fr_180px_100px_100px_80px] text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <span>User</span>
          <span>Role</span>
          <span>Plan</span>
          <span>Sessions</span>
          <span>Joined</span>
        </div>
        {users.map((u) => (
          <div
            key={u.id}
            className="grid grid-cols-[1fr_180px_100px_100px_80px] items-center px-5 py-3.5 border-b last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}>
                {u.name[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full w-fit"
              style={{ backgroundColor: `${ROLE_COLOR[u.role]}18`, color: ROLE_COLOR[u.role] }}>
              {u.role === "STUDIO_ADMIN" ? "STUDIO" : u.role}
            </span>
            <span className="text-xs font-semibold" style={{ color: u.subscription ? (TIER_COLOR[u.subscription.tier] ?? "#888") : "#555" }}>
              {u.subscription?.tier ?? "—"}
            </span>
            <span className="text-sm text-muted-foreground">{u._count.sessions}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
        ))}
        {users.length === 0 && (
          <div className="py-12 text-center">
            <Users size={28} className="mx-auto text-muted-foreground opacity-40 mb-2" />
            <p className="text-sm text-muted-foreground">No users yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
