import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import DJVerificationContent from "./DJVerificationContent";

export default async function AdminDJVerificationPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  // Load all PENDING applications with DJ profile and user data
  const applications = await db.dJVerificationApplication.findMany({
    where: { status: "PENDING" },
    orderBy: { appliedAt: "asc" },
    select: {
      id: true,
      status: true,
      appliedAt: true,
      djProfile: {
        select: {
          id: true,
          slug: true,
          socialLinks: true,
          isVerified: true,
          verificationStatus: true,
          user: {
            select: {
              id: true,
              name: true,
              createdAt: true,
            },
          },
          crates: {
            select: {
              _count: { select: { items: true } },
            },
          },
          _count: {
            select: { attributions: true },
          },
        },
      },
    },
  });

  // Compute attributed sales counts per DJ (amount > 0)
  const djIds = applications.map((a) => a.djProfile.id);
  const attributedSales = djIds.length
    ? await db.dJAttribution.groupBy({
        by: ["djProfileId"],
        where: { djProfileId: { in: djIds }, amount: { gt: 0 } },
        _count: { djProfileId: true },
      })
    : [];

  const salesMap: Record<string, number> = {};
  for (const s of attributedSales) {
    salesMap[s.djProfileId] = s._count.djProfileId;
  }

  // Enrich applications with computed data
  const now = new Date();
  const enriched = applications.map((app) => {
    const dj = app.djProfile;
    const accountAgeMonths =
      (now.getFullYear() - dj.user.createdAt.getFullYear()) * 12 +
      (now.getMonth() - dj.user.createdAt.getMonth());
    const totalCrateItems = dj.crates.reduce((s, c) => s + c._count.items, 0);
    const attributedSalesCount = salesMap[dj.id] ?? 0;

    return {
      id: app.id,
      appliedAt: app.appliedAt.toISOString(),
      djProfileId: dj.id,
      djSlug: dj.slug,
      djName: dj.user.name,
      userId: dj.user.id,
      socialLinks: dj.socialLinks as Record<string, string> | null,
      reqAccountAge: accountAgeMonths >= 6,
      accountAgeMonths,
      reqTracks: totalCrateItems >= 20,
      totalCrateItems,
      reqSales: attributedSalesCount >= 1,
      attributedSalesCount,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">DJ Verification Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {enriched.length} pending application{enriched.length !== 1 ? "s" : ""}
        </p>
      </div>
      <DJVerificationContent applications={enriched} />
    </div>
  );
}
