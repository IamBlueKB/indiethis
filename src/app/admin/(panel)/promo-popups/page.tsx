import { requireAdminAccess } from "@/lib/require-admin-access";
import PromoPopupsContent from "./PromoPopupsContent";

export default async function PromoPopupsPage() {
  await requireAdminAccess("promo-popups");
  return <PromoPopupsContent />;
}
