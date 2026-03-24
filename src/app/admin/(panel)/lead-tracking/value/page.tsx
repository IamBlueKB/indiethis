import { db } from "@/lib/db";
import { requireAdminAccess } from "@/lib/require-admin-access";
import { DollarSign } from "lucide-react";

export default async function LeadValuePage() {
  await requireAdminAccess("lead-tracking");

  const now          = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const month        = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const studios = await db.studio.findMany({
    select: {
      id:                 true,
      name:               true,
      averageSessionRate: true,
      _count: {
        select: {
          contactSubmissions: { where: { createdAt: { gte: startOfMonth } } },
          intakeSubmissions:  { where: { createdAt: { gte: startOfMonth } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  type StudioRow = {
    id:     string;
    name:   string;
    leads:  number;
    rate:   number;
    value:  number;
  };

  const rows: StudioRow[] = studios
    .map((s) => {
      const leads = s._count.contactSubmissions + s._count.intakeSubmissions;
      const rate  = s.averageSessionRate ?? 150;
      return { id: s.id, name: s.name, leads, rate, value: leads * rate };
    })
    .filter((r) => r.leads > 0)
    .sort((a, b) => b.value - a.value);

  const totalLeads = rows.reduce((sum, r) => sum + r.leads, 0);
  const totalValue = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Potential Lead Value</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Lead count × each studio&apos;s average session rate — {month}
        </p>
      </div>

      {/* How it&apos;s calculated */}
      <div
        className="rounded-2xl border p-5 space-y-2"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How this is calculated</p>
        <p className="text-sm text-foreground">
          Each lead (contact form submission or intake form submission) this month is counted per studio.
          That count is multiplied by the studio&apos;s <strong>Average Session Rate</strong>, which they set in
          their studio settings. The result shows the potential revenue IndieThis has driven for each studio
          if every lead converts to a booked session.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Studios without a custom rate default to <strong>$150</strong>.
        </p>
      </div>

      {/* Summary stat */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Total Leads</p>
          <p className="text-3xl font-bold text-foreground font-display">{totalLeads}</p>
          <p className="text-xs text-muted-foreground mt-1">across {rows.length} studio{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: "var(--card)", borderColor: "rgba(52,199,89,0.3)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Total Potential Value</p>
          <p className="text-3xl font-bold font-display" style={{ color: "#34C759" }}>
            ${totalValue.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">if all leads convert</p>
        </div>
      </div>

      {/* Per-studio table */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        {/* Column headers */}
        <div
          className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
          style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 80px 110px 130px" }}
        >
          <span>Studio</span>
          <span>Leads</span>
          <span>Avg Rate</span>
          <span>Potential Value</span>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <DollarSign size={32} className="mx-auto mb-3 opacity-20 text-foreground" />
            <p className="text-sm font-medium text-foreground">No leads this month</p>
            <p className="text-xs text-muted-foreground mt-1">Data will appear here once studios receive contact or intake form submissions.</p>
          </div>
        ) : (
          <>
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid items-center px-5 py-3.5 border-b text-sm"
                style={{ borderColor: "var(--border)", gridTemplateColumns: "1fr 80px 110px 130px" }}
              >
                <p className="font-medium text-foreground truncate pr-4">{row.name}</p>
                <p className="text-foreground font-semibold">{row.leads}</p>
                <p className="text-muted-foreground">${row.rate.toLocaleString()}</p>
                <p className="font-bold" style={{ color: "#34C759" }}>${row.value.toLocaleString()}</p>
              </div>
            ))}

            {/* Total row */}
            <div
              className="grid items-center px-5 py-4 border-t text-sm font-bold"
              style={{ borderColor: "rgba(255,255,255,0.12)", gridTemplateColumns: "1fr 80px 110px 130px", backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              <p className="text-foreground">Total</p>
              <p className="text-foreground">{totalLeads}</p>
              <p className="text-muted-foreground">—</p>
              <p style={{ color: "#34C759" }}>${totalValue.toLocaleString()}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
