import { requireAdminAccess } from "@/lib/require-admin-access";
import AdminUsersPage from "./UsersContent";

export default async function UsersPage() {
  const { viewOnly } = await requireAdminAccess("users");
  return <AdminUsersPage viewOnly={viewOnly} />;
}
