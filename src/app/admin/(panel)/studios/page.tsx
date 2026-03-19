import { requireAdminAccess } from "@/lib/require-admin-access";
import AdminStudiosPage from "./StudiosContent";

export default async function StudiosPage() {
  const { viewOnly } = await requireAdminAccess("studios");
  return <AdminStudiosPage viewOnly={viewOnly} />;
}
