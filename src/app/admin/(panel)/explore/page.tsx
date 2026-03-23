import { requireAdminAccess } from "@/lib/require-admin-access";
import ExploreContent from "./ExploreContent";

export default async function AdminExplorePage() {
  await requireAdminAccess("explore");
  return <ExploreContent />;
}
