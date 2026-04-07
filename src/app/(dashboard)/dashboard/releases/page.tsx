/**
 * /dashboard/releases — Release Board list
 *
 * Server component: auth check, pass initial releases to client.
 */

import { redirect }        from "next/navigation";
import { auth }            from "@/lib/auth";
import ReleasesClient      from "./ReleasesClient";

export const metadata = { title: "Releases — IndieThis" };

export default async function ReleasesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <ReleasesClient />;
}
