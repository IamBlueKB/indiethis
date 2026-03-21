import { requireAdminAccess } from "@/lib/require-admin-access";
import PromoAnalyticsContent from "./PromoAnalyticsContent";

export default async function PromoAnalyticsPage() {
  await requireAdminAccess("promo-analytics");
  return <PromoAnalyticsContent />;
}
