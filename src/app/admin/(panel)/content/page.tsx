import { requireAdminAccess } from "@/lib/require-admin-access";
import ContentLicensesContent  from "./ContentLicensesContent";

export default async function ContentLicensesPage() {
  await requireAdminAccess("content");
  return <ContentLicensesContent />;
}
