import { requireAdminAccess } from "@/lib/require-admin-access";
import AdminAffiliatesPage from "./AffiliatesContent";

export default async function AffiliatesPage() {
  await requireAdminAccess("affiliates");
  return <AdminAffiliatesPage />;
}
