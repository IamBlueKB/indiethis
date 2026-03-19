import { db } from "@/lib/db";
import { requireAdminAccess } from "@/lib/require-admin-access";
import { ShieldCheck, UsersRound, Circle } from "lucide-react";
import TeamActions from "./TeamActions";

// ─── Role config ──────────────────────────────────────────────────────────────

type AdminRole = "SUPER_ADMIN" | "OPS_ADMIN" | "SUPPORT_ADMIN";

const ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN:   "Super Admin",
  OPS_ADMIN:     "Ops Admin",
  SUPPORT_ADMIN: "Support Admin",
};

const ROLE_COLOR: Record<AdminRole, string> = {
  SUPER_ADMIN:   "#E85D4A",
  OPS_ADMIN:     "#D4A843",
  SUPPORT_ADMIN: "#888888",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminTeamPage() {
  await requireAdminAccess("team");

  const admins = await db.adminAccount.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id:          true,
      name:        true,
      email:       true,
      role:        true,
      isActive:    true,
      lastLoginAt: true,
      createdAt:   true,
      createdBy:   true,
    },
  });

  const active   = admins.filter((a) => a.isActive).length;
  const inactive = admins.length - active;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground tracking-tight flex items-center gap-2.5">
            <UsersRound size={22} style={{ color: "#E85D4A" }} />
            Admin Team
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {admins.length} admin account{admins.length !== 1 ? "s" : ""} · {active} active
            {inactive > 0 ? ` · ${inactive} deactivated` : ""}
          </p>
        </div>
        <TeamActions />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Super Admins",   role: "SUPER_ADMIN",   color: "#E85D4A" },
          { label: "Ops Admins",     role: "OPS_ADMIN",     color: "#D4A843" },
          { label: "Support Admins", role: "SUPPORT_ADMIN", color: "#888888" },
        ].map(({ label, role, color }) => {
          const count = admins.filter((a) => a.role === role).length;
          return (
            <div
              key={role}
              className="rounded-2xl border p-4 flex items-center gap-4"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}18` }}
              >
                <ShieldCheck size={18} style={{ color }} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Table header */}
        <div
          className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
          style={{
            borderColor: "var(--border)",
            gridTemplateColumns: "1fr 180px 120px 110px 110px",
          }}
        >
          <span>Admin</span>
          <span>Role</span>
          <span>Status</span>
          <span>Last Login</span>
          <span>Added</span>
        </div>

        {admins.length === 0 ? (
          <div className="py-16 text-center">
            <UsersRound size={28} className="mx-auto text-muted-foreground opacity-30 mb-2" />
            <p className="text-sm text-muted-foreground">No admin accounts yet.</p>
          </div>
        ) : (
          admins.map((admin) => {
            const role  = admin.role as AdminRole;
            const color = ROLE_COLOR[role];
            return (
              <div
                key={admin.id}
                className="grid items-center px-5 py-4 border-b last:border-b-0"
                style={{
                  borderColor: "var(--border)",
                  gridTemplateColumns: "1fr 180px 120px 110px 110px",
                  opacity: admin.isActive ? 1 : 0.55,
                }}
              >
                {/* Identity */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                    style={{ background: admin.isActive ? `linear-gradient(135deg, ${color}, ${color}99)` : "rgba(255,255,255,0.1)" }}
                  >
                    {initials(admin.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{admin.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                  </div>
                </div>

                {/* Role badge */}
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full w-fit"
                  style={{ backgroundColor: `${color}18`, color }}
                >
                  <ShieldCheck size={11} strokeWidth={2.5} />
                  {ROLE_LABEL[role]}
                </span>

                {/* Status */}
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: admin.isActive ? "#34C759" : "#888888" }}
                >
                  <Circle
                    size={7}
                    fill={admin.isActive ? "#34C759" : "#888888"}
                    stroke="none"
                  />
                  {admin.isActive ? "Active" : "Deactivated"}
                </span>

                {/* Last login */}
                <span className="text-xs text-muted-foreground">{fmt(admin.lastLoginAt)}</span>

                {/* Created */}
                <span className="text-xs text-muted-foreground">{fmt(admin.createdAt)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
