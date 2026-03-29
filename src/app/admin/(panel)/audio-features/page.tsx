import { requireAdminAccess } from "@/lib/require-admin-access";
import AudioFeaturesBackfillContent from "./AudioFeaturesBackfillContent";

export default async function AudioFeaturesPage() {
  await requireAdminAccess("audio-features");
  return <AudioFeaturesBackfillContent />;
}
