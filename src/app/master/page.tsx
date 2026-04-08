import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MasterLandingClient } from "./MasterLandingClient";

export const metadata = {
  title:       "AI Mix & Master — IndieThis",
  description: "Professional AI mixing and mastering. Upload stems or a stereo mix. Four versions in minutes. Free 30-second preview.",
  openGraph: {
    title:       "AI Mix & Master — IndieThis",
    description: "Professional AI mixing and mastering. Free 30-second preview. No plug-ins, no engineers.",
    images:      [{ url: "/images/og/master.jpg", width: 1200, height: 630 }],
  },
};

export default async function MasterPage() {
  const session = await auth();

  // Subscribers go straight to dashboard — they get discounted pricing there
  if (session?.user) {
    redirect("/dashboard/ai/master");
  }

  return <MasterLandingClient />;
}
