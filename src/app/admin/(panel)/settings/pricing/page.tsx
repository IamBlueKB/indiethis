import { requireAdminAccess } from "@/lib/require-admin-access";
import { db } from "@/lib/db";
import PricingSettingsContent from "./PricingSettingsContent";

export const metadata = { title: "Pricing Settings — IndieThis Admin" };

export default async function PricingSettingsPage() {
  await requireAdminAccess("settings");

  const rows = await db.platformPricing.findMany({ orderBy: { sortOrder: "asc" } });

  return <PricingSettingsContent initialPricing={rows} />;
}
