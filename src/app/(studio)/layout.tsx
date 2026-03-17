import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import StudioSidebar from "@/components/studio/StudioSidebar";
import StudioTopBar from "@/components/studio/StudioTopBar";
import type { ReactNode } from "react";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    redirect("/login");
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { slug: true },
  });

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
      <StudioSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <StudioTopBar studioSlug={studio?.slug ?? null} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
