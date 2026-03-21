import { requireAdminAccess } from "@/lib/require-admin-access";
import PromoCodesContent from "./PromoCodesContent";

export default async function PromoCodesPage() {
  await requireAdminAccess("promo-codes");
  return <PromoCodesContent />;
}
