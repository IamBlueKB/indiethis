import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { userCanAccessMixConsole } from "@/lib/feature-flags-server";
import { MasterLandingClient } from "./MasterLandingClient";

export const metadata = {
  title:       "AI Mastering — IndieThis",
  description: "Professional AI mastering. Upload your mix, download a release-ready master. Four versions in minutes.",
  openGraph: {
    title:       "AI Mastering — IndieThis",
    description: "Professional AI mastering. Upload your mix, download a release-ready master. No plug-ins, no engineers.",
    images:      [{ url: "/images/og/master.jpg", width: 1200, height: 630 }],
  },
};

export default async function MasterPage(
  { searchParams }: { searchParams: Promise<Record<string, string>> }
) {
  const session = await auth();

  // Subscribers go straight to dashboard — they get discounted pricing there
  if (session?.user) {
    redirect("/dashboard/ai/master");
  }

  const sp       = await searchParams;
  const autoStart = sp.start === "1";
  const resumeJobId = sp.resume ?? null;
  const showMixConsole = await userCanAccessMixConsole();

  return <MasterLandingClient autoStart={autoStart} resumeJobId={resumeJobId} showMixConsole={showMixConsole} />;
}
