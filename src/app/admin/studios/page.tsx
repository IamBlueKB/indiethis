import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";

export default async function AdminStudiosPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "PLATFORM_ADMIN") redirect("/login");

  const studios = await db.studio.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      owner: { select: { name: true, email: true } },
      _count: { select: { artists: true, sessions: true, contacts: true } },
    },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Studios</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{studios.length} registered studios</p>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="grid grid-cols-[1fr_160px_80px_80px_80px] text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <span>Studio</span>
          <span>Owner</span>
          <span>Artists</span>
          <span>Sessions</span>
          <span>Contacts</span>
        </div>
        {studios.map((s) => (
          <div
            key={s.id}
            className="grid grid-cols-[1fr_160px_80px_80px_80px] items-center px-5 py-4 border-b last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground truncate">/{s.slug}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-foreground truncate">{s.owner.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{s.owner.email}</p>
            </div>
            <span className="text-sm text-muted-foreground">{s._count.artists}</span>
            <span className="text-sm text-muted-foreground">{s._count.sessions}</span>
            <span className="text-sm text-muted-foreground">{s._count.contacts}</span>
          </div>
        ))}
        {studios.length === 0 && (
          <div className="py-12 text-center">
            <Building2 size={28} className="mx-auto text-muted-foreground opacity-40 mb-2" />
            <p className="text-sm text-muted-foreground">No studios yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
