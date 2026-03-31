import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { DollarSign, TrendingUp, AlertCircle, Disc3, ListMusic, User } from "lucide-react";
import WithdrawButton from "./WithdrawButton";
import ConnectStripeButton from "./ConnectStripeButton";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  CRATE:   "Crate",
  MIX:     "Mix",
  PROFILE: "Profile",
};

const SOURCE_TYPE_ICONS: Record<string, React.ElementType> = {
  CRATE:   Disc3,
  MIX:     ListMusic,
  PROFILE: User,
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:    { bg: "rgba(234,179,8,0.12)",   color: "#EAB308", label: "Pending" },
  PROCESSING: { bg: "rgba(59,130,246,0.12)",  color: "#3B82F6", label: "Processing" },
  COMPLETED:  { bg: "rgba(74,222,128,0.12)",  color: "#4ADE80", label: "Completed" },
  FAILED:     { bg: "rgba(248,113,113,0.12)", color: "#F87171", label: "Failed" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DJEarningsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id as string;

  // Load DJ profile with user, recent attributions, and recent withdrawals
  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { stripeConnectId: true } },
      attributions: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          sourceType: true,
          sourceId: true,
          artistId: true,
          amount: true,
          createdAt: true,
        },
      },
      withdrawals: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      },
    },
  });

  if (!djProfile) redirect("/dashboard");

  // Look up artist names for attributions
  const artistIds = [...new Set(djProfile.attributions.map((a) => a.artistId))];
  const artists = artistIds.length
    ? await db.user.findMany({
        where: { id: { in: artistIds } },
        select: { id: true, name: true },
      })
    : [];
  const artistMap = Object.fromEntries(artists.map((u) => [u.id, u.name ?? "Unknown Artist"]));

  // Withdrawal eligibility
  const hasStripe = !!djProfile.user.stripeConnectId;
  const balance   = djProfile.balance;
  const canWithdraw = hasStripe && balance >= 2500;
  let disabledReason: string | undefined;
  if (!hasStripe) {
    disabledReason = "Connect your Stripe account to withdraw.";
  } else if (balance < 2500) {
    disabledReason = `Minimum withdrawal is $25.00. Balance: ${fmtCents(balance)}.`;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DJ Earnings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Attribution earnings from your crates, mixes, and profile
          </p>
        </div>
        <WithdrawButton
          disabled={!canWithdraw}
          disabledReason={disabledReason}
          balanceCents={balance}
        />
      </div>

      {/* No Stripe banner */}
      {!hasStripe && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm"
          style={{
            backgroundColor: "rgba(234,179,8,0.06)",
            borderColor: "rgba(234,179,8,0.25)",
            color: "#EAB308",
          }}
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>
            Connect your Stripe account to withdraw earnings.{" "}
            <ConnectStripeButton />
          </span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Current Balance */}
        <div
          className="rounded-xl border p-5"
          style={{
            backgroundColor: "rgba(212,168,67,0.08)",
            borderColor: "rgba(212,168,67,0.3)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Available Balance</p>
          </div>
          <p className="text-3xl font-bold" style={{ color: "#D4A843" }}>
            {fmtCents(balance)}
          </p>
          {balance < 2500 && balance > 0 && (
            <p className="text-[11px] mt-1 text-muted-foreground">
              {fmtCents(2500 - balance)} more until minimum withdrawal
            </p>
          )}
          {balance === 0 && (
            <p className="text-[11px] mt-1 text-muted-foreground">
              Earnings from artist purchases will appear here
            </p>
          )}
        </div>

        {/* Total Earnings */}
        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total Earned (All Time)</p>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {fmtCents(djProfile.totalEarnings)}
          </p>
          <p className="text-[11px] mt-1 text-muted-foreground">
            {djProfile.attributions.length > 0
              ? `${djProfile.attributions.length} attribution${djProfile.attributions.length !== 1 ? "s" : ""} (last 30 shown)`
              : "No attributions yet"}
          </p>
        </div>
      </div>

      {/* Attribution History */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="px-5 py-4 border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <p className="text-sm font-semibold text-foreground">Attribution History</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Earnings credited when artists you introduced make purchases
          </p>
        </div>

        {djProfile.attributions.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            style={{ backgroundColor: "var(--card)" }}
          >
            <DollarSign size={36} className="text-muted-foreground/30 mb-3" />
            <p className="font-medium text-foreground mb-1">No attributions yet</p>
            <p className="text-sm text-muted-foreground">
              Share your crates, mixes, and profile to earn attribution when artists buy.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              >
                {["Date", "Source", "Artist", "Earned"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {djProfile.attributions.map((attr) => {
                const Icon = SOURCE_TYPE_ICONS[attr.sourceType] ?? Disc3;
                const sourceLabel = SOURCE_TYPE_LABELS[attr.sourceType] ?? attr.sourceType;
                const artistName  = artistMap[attr.artistId] ?? "Unknown Artist";

                return (
                  <tr
                    key={attr.id}
                    className="border-b last:border-b-0 hover:bg-white/3 transition-colors"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {/* Date */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {fmtDate(attr.createdAt)}
                    </td>

                    {/* Source type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: "rgba(212,168,67,0.12)",
                          color: "#D4A843",
                        }}
                      >
                        <Icon size={10} />
                        {sourceLabel}
                      </span>
                    </td>

                    {/* Artist name */}
                    <td className="px-4 py-3 text-foreground font-medium">
                      {artistName}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 font-semibold" style={{ color: "#4ADE80" }}>
                      +{fmtCents(attr.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Withdrawal History */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="px-5 py-4 border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <p className="text-sm font-semibold text-foreground">Withdrawal History</p>
        </div>

        {djProfile.withdrawals.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 text-center"
            style={{ backgroundColor: "var(--card)" }}
          >
            <p className="text-sm text-muted-foreground">No withdrawals yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              >
                {["Date", "Amount", "Status", "Completed"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {djProfile.withdrawals.map((w) => {
                const statusStyle = STATUS_STYLES[w.status] ?? STATUS_STYLES.PENDING;
                return (
                  <tr
                    key={w.id}
                    className="border-b last:border-b-0 hover:bg-white/3 transition-colors"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {/* Date */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {fmtDate(w.createdAt)}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {fmtCents(w.amount)}
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.color,
                        }}
                      >
                        {statusStyle.label}
                      </span>
                    </td>

                    {/* Completed at */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {w.completedAt ? fmtDate(w.completedAt) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
