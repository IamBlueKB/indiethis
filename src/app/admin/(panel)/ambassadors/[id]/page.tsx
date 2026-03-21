import { requireAdminAccess } from "@/lib/require-admin-access";
import AmbassadorDetailContent from "./AmbassadorDetailContent";

export default async function AmbassadorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminAccess("ambassadors");
  const { id } = await params;
  return <AmbassadorDetailContent id={id} />;
}
