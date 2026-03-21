import { requireAdminAccess } from "@/lib/require-admin-access";
import AmbassadorsContent from "./AmbassadorsContent";

export default async function AmbassadorsPage() {
  await requireAdminAccess("ambassadors");
  return <AmbassadorsContent />;
}
