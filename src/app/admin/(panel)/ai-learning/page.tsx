import { requireAdminAccess } from "@/lib/require-admin-access";
import AILearningPage from "./AiLearningContent";

export default async function AiLearningPage() {
  const { viewOnly } = await requireAdminAccess("ai-usage");
  return <AILearningPage viewOnly={viewOnly} />;
}
