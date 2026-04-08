import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MasterPageClient } from "./MasterPageClient";

export const metadata = { title: "AI Mix & Master — IndieThis" };

export default async function MasterPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <MasterPageClient userId={session.user.id!} />;
}
