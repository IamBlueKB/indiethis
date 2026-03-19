import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const session = await getAdminSession();

  // Not logged in → go to login
  if (!session) redirect("/admin/login");

  // Already changed → go to panel
  if (!session.mustChangePassword) redirect("/admin");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--background)" }}
    >
      <ChangePasswordForm name={session.name} />
    </div>
  );
}
