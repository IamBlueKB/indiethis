import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Settings, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "PLATFORM_ADMIN") redirect("/login");

  const integrations = [
    { name: "Brevo (Email)", key: "BREVO_API_KEY", env: process.env.BREVO_API_KEY },
    { name: "UploadThing", key: "UPLOADTHING_SECRET", env: process.env.UPLOADTHING_SECRET },
    { name: "NextAuth Secret", key: "AUTH_SECRET", env: process.env.AUTH_SECRET },
    { name: "Database URL", key: "DATABASE_URL", env: process.env.DATABASE_URL },
    { name: "Stripe Secret Key", key: "STRIPE_SECRET_KEY", env: process.env.STRIPE_SECRET_KEY },
    { name: "Stripe Webhook Secret", key: "STRIPE_WEBHOOK_SECRET", env: process.env.STRIPE_WEBHOOK_SECRET },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Environment configuration and integrations</p>
      </div>

      {/* Integration status */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <Settings size={15} className="text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Environment Variables</h2>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {integrations.map(({ name, key, env }) => {
            const configured = !!env;
            return (
              <div key={key} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{key}</p>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: configured ? "#34C759" : "#E85D4A" }}>
                  {configured
                    ? <><CheckCircle2 size={13} /> Configured</>
                    : <><XCircle size={13} /> Missing</>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Admin identity */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
          <ShieldCheck size={15} className="text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Admin Account</h2>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-foreground">{session?.user?.name ?? "Admin"}</p>
          <p className="text-xs text-muted-foreground">{session?.user?.email ?? ""}</p>
          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1" style={{ backgroundColor: "#E85D4A18", color: "#E85D4A" }}>
            PLATFORM_ADMIN
          </span>
        </div>
      </div>
    </div>
  );
}
