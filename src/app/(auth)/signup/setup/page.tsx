import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import SetupWizard from "./SetupWizard";

export default async function SetupPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/signup/setup");
  }

  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: {
      name:             true,
      bio:              true,
      photo:            true,
      city:             true,
      genres:           true,
      soundcloudUrl:    true,
      instagramHandle:  true,
      tiktokHandle:     true,
      youtubeChannel:   true,
      spotifyUrl:       true,
      appleMusicUrl:    true,
      signupPath:       true,
      onboardingStep:   true,
      setupCompletedAt: true,
    },
  });

  if (!user) redirect("/login");

  // Already completed — send to appropriate dashboard
  if (user.setupCompletedAt) {
    const session2 = await auth();
    if (session2?.user?.role === "STUDIO_ADMIN") redirect("/studio");
    redirect("/dashboard?welcome=1");
  }

  return (
    <SetupWizard
      initialStep={(user.onboardingStep as 0 | 1 | 2) ?? 0}
      initialData={{
        name:            user.name,
        bio:             user.bio            ?? "",
        photo:           user.photo          ?? "",
        city:            user.city           ?? "",
        genres:          user.genres         ?? [],
        soundcloudUrl:   user.soundcloudUrl  ?? "",
        instagramHandle: user.instagramHandle ?? "",
        tiktokHandle:    user.tiktokHandle   ?? "",
        youtubeChannel:  user.youtubeChannel ?? "",
        spotifyUrl:      user.spotifyUrl     ?? "",
        appleMusicUrl:   user.appleMusicUrl  ?? "",
      }}
      signupPath={user.signupPath ?? "artist"}
    />
  );
}
