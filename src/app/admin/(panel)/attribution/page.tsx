import { requireAdminAccess } from "@/lib/require-admin-access";
import AdminAttributionPage from "./AttributionContent";

export default async function AttributionPage() {
  await requireAdminAccess("attribution");
  return <AdminAttributionPage />;
}
