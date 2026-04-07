/**
 * /dashboard/avatar — Artist Avatar Studio
 *
 * Server component: auth check + pass initial avatars to client.
 * Client component (AvatarStudio) handles:
 *   - Management view (has avatars)
 *   - Creation flow (upload → style → generate → pick → save)
 */

import { redirect }  from "next/navigation";
import { auth }      from "@/lib/auth";
import { db }        from "@/lib/db";
import AvatarStudio  from "./AvatarStudio";

export const metadata = { title: "Avatar Studio — IndieThis" };

export default async function AvatarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const avatars = await db.artistAvatar.findMany({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return <AvatarStudio initialAvatars={avatars} />;
}
